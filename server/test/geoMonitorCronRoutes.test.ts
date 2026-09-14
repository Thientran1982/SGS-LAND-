import express from 'express';
import * as http from 'node:http';
import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

const { startAgentRun, finishAgentRun } = vi.hoisted(() => ({
  startAgentRun: vi.fn(),
  finishAgentRun: vi.fn(),
}));

vi.mock('../services/agentRunsService', () => ({
  startAgentRun,
  finishAgentRun,
}));

import { createGeoMonitorCronRouter } from '../routes/geoMonitorCronRoutes';

type Query = (sql: string, params?: unknown[]) => Promise<{ rows: any[] }>;

async function startTestServer(pool: { query: Query }) {
  const app = express();
  app.use(express.json());
  app.use(createGeoMonitorCronRouter(pool as any, 'cron-secret', vi.fn()));

  const server = await new Promise<Server>((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not expose a port');

  return {
    server,
    request: (path: string) => new Promise<{ status: number; body: any }>((resolve, reject) => {
      const request = http.request(
        {
          hostname: '127.0.0.1',
          port: address.port,
          path,
          method: 'POST',
          headers: { 'x-internal-secret': 'cron-secret' },
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

    for (const envName of [
      'GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL',
      'GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY',
      'GEMINI_API_KEY',
      'GOOGLE_API_KEY',
      'API_KEY',
      'OPENAI_API_KEY',
      'OPENROUTER_API_KEY',
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
});