import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { authorize, jwtOptions } = vi.hoisted(() => ({
  authorize: vi.fn(),
  jwtOptions: vi.fn(),
}));

vi.mock('google-auth-library', () => ({
  JWT: class MockJWT {
    constructor(options: unknown) {
      jwtOptions(options);
    }

    authorize() {
      return authorize();
    }
  },
}));

import { syncKeywordPositionsFromSearchConsole } from '../services/searchConsoleService';

describe('Search Console domain-property sync', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    authorize.mockReset();
    jwtOptions.mockReset();
    vi.stubEnv('GSC_SITE_URL', '');
    vi.stubEnv('GSC_LOOKBACK_DAYS', '28');
    vi.stubEnv('GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL', '');
    vi.stubEnv('GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns a non-fatal configuration result when credentials are missing', async () => {
    const pool = { query: vi.fn() };

    await expect(syncKeywordPositionsFromSearchConsole(pool, 'tenant-1')).resolves.toEqual({
      ok: false,
      reason: expect.stringContaining('GSC credentials not configured'),
    });
    expect(pool.query).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns a non-fatal configuration result when the private key is malformed', async () => {
    vi.stubEnv('GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL', 'search-console@example.iam.gserviceaccount.com');
    vi.stubEnv('GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY', 'not-a-private-key');
    authorize.mockRejectedValueOnce(new Error('Invalid PEM private key'));

    const pool = {
      query: vi.fn().mockResolvedValueOnce({
        rows: [{ id: 'keyword-1', keyword: 'Aqua City' }],
      }),
    };

    await expect(syncKeywordPositionsFromSearchConsole(pool, 'tenant-1')).resolves.toMatchObject({
      ok: false,
      reason: 'Invalid PEM private key',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('queries the default sc-domain property through the Search Console v3 endpoint', async () => {
    vi.stubEnv('GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL', 'search-console@example.iam.gserviceaccount.com');
    vi.stubEnv('GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY', '-----BEGIN PRIVATE KEY-----\\nvalid\\n-----END PRIVATE KEY-----');
    authorize.mockResolvedValueOnce({
      access_token: 'access-token',
      expiry_date: Date.now() + 3_600_000,
    });
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      rows: [{ keys: ['Aqua City'], position: 3.5 }],
    }), { status: 200 }));

    const pool = {
      query: vi.fn()
        .mockResolvedValueOnce({
          rows: [{ id: 'keyword-1', keyword: 'Aqua City' }],
        })
        .mockResolvedValueOnce({ rows: [] }),
    };

    await expect(syncKeywordPositionsFromSearchConsole(pool, 'tenant-1')).resolves.toMatchObject({
      ok: true,
      reason: 'synced',
      keywordsChecked: 1,
      positionsUpdated: 1,
    });

    expect(jwtOptions).toHaveBeenCalledWith(expect.objectContaining({
      email: 'search-console@example.iam.gserviceaccount.com',
      key: '-----BEGIN PRIVATE KEY-----\nvalid\n-----END PRIVATE KEY-----',
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    }));
    expect(fetchMock).toHaveBeenCalledWith(
      'https://searchconsole.googleapis.com/webmasters/v3/sites/sc-domain%3Asgsland.vn/searchAnalytics/query',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token',
          'Content-Type': 'application/json',
        }),
      }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      dimensions: ['QUERY'],
      rowLimit: 25000,
      aggregationType: 'auto',
    });
  });
});