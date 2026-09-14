import express from 'express';
import * as http from 'node:http';
import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

const { startAgentRun, finishAgentRun } = vi.hoisted(() => ({
  startAgentRun: vi.fn(),
  finishAgentRun: vi.fn(),
}));
const authenticateToken = vi.hoisted(() => vi.fn());

vi.mock('../services/agentRunsService', () => ({
  startAgentRun,
  finishAgentRun,
}));

import {
  createGeoMonitorCronRouter,
  probeOpenRouter,
  probeOrcaRouter,
  probeTokenRouter,
} from '../routes/geoMonitorCronRoutes';

type Query = (sql: string, params?: unknown[]) => Promise<{ rows: any[] }>;

async function startTestServer(pool: { query: Query }) {
  const app = express();
  app.use(express.json());
  app.use(createGeoMonitorCronRouter(pool as any, 'cron-secret', authenticateToken));

  const server = await new Promise<Server>((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not expose a port');

  return {
    server,
    request: (path: string, method = 'POST') => new Promise<{ status: number; body: any }>((resolve, reject) => {
      const request = http.request(
        {
          hostname: '127.0.0.1',
          port: address.port,
          path,
          method,
          headers: method === 'POST' ? { 'x-internal-secret': 'cron-secret' } : {},
        },
        (response: any) => {
          let body = '';
          response.setEncoding('utf8');
          response.on('data', (chunk: string) => { body += chunk; });
          response.on('end', () => {
            try {
              resolve({ status: response.statusCode || 0, body: JSON.parse(body) });
            } catch (error) {
              reject(error);
            }
          });
        },
      );
      request.on('error', reject);
      request.end();
    }),
  };
}

describe('GEO monitor snapshot route', () => {
  const fetchMock = vi.fn();
  let server: Server;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockRejectedValue(new Error('external probe disabled in test'));
    startAgentRun.mockResolvedValue('run-1');
    finishAgentRun.mockResolvedValue(undefined);
    authenticateToken.mockImplementation((req: any, _res: any, next: any) => {
      req.user = { role: 'SUPER_ADMIN', tenantId: DEFAULT_TENANT_ID };
      next();
    });

    for (const envName of [
      'GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL',
      'GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY',
      'GEMINI_API_KEY',
      'GOOGLE_API_KEY',
      'API_KEY',
      'OPENAI_API_KEY',
      'OPENROUTER_API_KEY',
      'TOKENROUTER_API_KEY',
      'ORCAROUTER_API_KEY',
      'ANTHROPIC_API_KEY',
      'XAI_API_KEY',
      'GOOGLE_CSE_KEY',
      'GOOGLE_CUSTOM_SEARCH_KEY',
      'GOOGLE_CSE_CX',
      'GOOGLE_CUSTOM_SEARCH_CX',
    ]) {
      vi.stubEnv(envName, '');
    }
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('completes without GSC credentials and persists the sync result in gsc_top20_json', async () => {
    const persistedParams: unknown[][] = [];
    const pool = {
      query: vi.fn<Query>().mockImplementation(async (sql: string, params: unknown[] = []) => {
        if (sql.includes('FROM seo_target_keywords')) {
          return {
            rows: [{
              keyword: 'Aqua City',
              best_position: '3.5',
              target_position: '5',
              search_volume: '100',
              target_url: 'https://sgsland.vn/aqua-city',
            }],
          };
        }
        if (sql.includes('INSERT INTO seo_geo_snapshots')) {
          persistedParams.push(params);
          return { rows: [] };
        }
        throw new Error(`Unexpected query: ${sql}`);
      }),
    };
    const testServer = await startTestServer(pool);
    server = testServer.server;

    const response = await testServer.request('/api/internal/geo-monitor-cron');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      ok: true,
      gsc_top20: {
        gsc_sync: {
          ok: false,
          reason: expect.stringContaining('GSC credentials not configured'),
        },
      },
    });
    expect(persistedParams).toHaveLength(1);

    const storedGscTop20 = JSON.parse(String(persistedParams[0][2]));
    expect(storedGscTop20.gsc_sync).toEqual({
      ok: false,
       status: 'missing_credentials',
      reason: expect.stringContaining('GSC credentials not configured'),
    });
    expect(storedGscTop20.gsc_sync.ok).toBe(false);
    expect(typeof storedGscTop20.gsc_sync.reason).toBe('string');
    expect(finishAgentRun).toHaveBeenCalledWith(
      pool,
      'run-1',
      'success',
      expect.objectContaining({ keyword_count: 1 }),
      null,
      expect.any(Number),
    );
  });

  it('probes OpenRouter, TokenRouter, and OrcaRouter as separate GEO engines', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'openrouter-test-key');
    vi.stubEnv('TOKENROUTER_API_KEY', 'tokenrouter-test-key');
    vi.stubEnv('ORCAROUTER_API_KEY', 'orcarouter-test-key');
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'SGS LAND được nhắc đến.' } }] }),
    });

    const [openrouter, tokenrouter, orcarouter] = await Promise.all([
      probeOpenRouter(),
      probeTokenRouter(),
      probeOrcaRouter(),
    ]);

    expect(openrouter).toMatchObject({ engine: 'openrouter', queries: 5, mentions: 5, model: 'z-ai/glm-5.3' });
    expect(tokenrouter).toMatchObject({ engine: 'tokenrouter', queries: 5, mentions: 5, model: 'z-ai/glm-5.3-free' });
    expect(orcarouter).toMatchObject({ engine: 'orcarouter', queries: 5, mentions: 5, model: 'orcarouter/auto' });

    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls.filter(url => url.startsWith('https://openrouter.ai/api/v1/chat/completions'))).toHaveLength(5);
    expect(urls.filter(url => url.startsWith('https://api.tokenrouter.com/v1/chat/completions'))).toHaveLength(5);
    expect(urls.filter(url => url.startsWith('https://api.orcarouter.ai/v1/chat/completions'))).toHaveLength(5);
  });

  it('returns explicit GSC sync status and reason for successful and failed historical snapshots', async () => {
    const pool = {
      query: vi.fn<Query>().mockImplementation(async (sql: string) => {
        if (sql.includes('FROM seo_geo_snapshots')) {
          return {
            rows: [
              {
                date: '2026-09-12',
                ai_mentions_json: {},
                gsc_top20_json: {
                  keywords: [{ keyword: 'Aqua City', position: 3.5 }],
                  gsc_sync: { ok: true, reason: 'synced', keywordsChecked: 1, positionsUpdated: 1 },
                },
                backlinks_json: {},
                lighthouse_json: {},
                created_at: '2026-09-12T04:30:00.000Z',
              },
              {
                date: '2026-09-13',
                ai_mentions_json: {},
                gsc_top20_json: {
                  keywords: [{ keyword: 'Aqua City', position: 3.5 }],
                  gsc_sync: { ok: false, reason: 'GSC query failed: HTTP 403 permission denied' },
                },
                backlinks_json: {},
                lighthouse_json: {},
                created_at: '2026-09-13T04:30:00.000Z',
              },
            ],
          };
        }
        throw new Error(`Unexpected query: ${sql}`);
      }),
    };
    const testServer = await startTestServer(pool);
    server = testServer.server;

    const response = await testServer.request('/api/seo/geo-snapshots?days=30', 'GET');

    expect(response.status).toBe(200);
    expect(response.body.snapshots).toEqual([
      expect.objectContaining({
        date: '2026-09-12',
        gscSync: {
          ok: true,
          status: 'ok',
          reason: 'synced',
          keywordsChecked: 1,
          positionsUpdated: 1,
        },
      }),
      expect.objectContaining({
        date: '2026-09-13',
        gscSync: {
          ok: false,
          status: 'error',
          reason: 'GSC query failed: HTTP 403 permission denied',
        },
      }),
    ]);
  });

  it('marks historical snapshots without gsc_sync as unknown instead of successful', async () => {
    const pool = {
      query: vi.fn<Query>().mockImplementation(async (sql: string) => {
        if (sql.includes('FROM seo_geo_snapshots')) {
          return {
            rows: [{
              date: '2026-09-11',
              ai_mentions_json: {},
              gsc_top20_json: { keywords: [{ keyword: 'Aqua City', position: 3.5 }] },
              backlinks_json: {},
              lighthouse_json: {},
              created_at: '2026-09-11T04:30:00.000Z',
            }],
          };
        }
        throw new Error(`Unexpected query: ${sql}`);
      }),
    };
    const testServer = await startTestServer(pool);
    server = testServer.server;

    const response = await testServer.request('/api/seo/geo-snapshots?days=30', 'GET');

    expect(response.status).toBe(200);
    expect(response.body.snapshots[0].gscSync).toEqual({
      ok: false,
      status: 'unknown',
      reason: 'No GSC sync result recorded for this snapshot',
    });
  });
});