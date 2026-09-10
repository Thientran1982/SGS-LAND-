import express from 'express';
import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  runAutoPostingBackfill: vi.fn(),
  runAutoPostingTick: vi.fn(),
  getMarketingFacebookDailyStatus: vi.fn(),
  getAutoPostingSettings: vi.fn(),
  upsertAutoPostingSettings: vi.fn(),
}));

vi.mock('../services/autoPostingSelector', () => ({
  localDayKey: () => '2026-01-03',
  runAutoPostingBackfill: mocks.runAutoPostingBackfill,
  runAutoPostingTick: mocks.runAutoPostingTick,
}));

vi.mock('../repositories/autoPostingRepository', () => ({
  getMarketingFacebookDailyStatus: mocks.getMarketingFacebookDailyStatus,
  getAutoPostingSettings: mocks.getAutoPostingSettings,
  upsertAutoPostingSettings: mocks.upsertAutoPostingSettings,
}));

vi.mock('../services/socialPublicationService', () => ({
  normalizeSocialPlatforms: (value: unknown) => (
    Array.isArray(value) ? value.map(item => String(item).toUpperCase()) : []
  ),
}));

import { createAutoPostingRouter } from '../routes/autoPostingRoutes';

async function startServer(user = { id: 'manager-1', tenantId: 'tenant-1', role: 'MARKETING' }) {
  const app = express();
  app.use(express.json());
  app.use(createAutoPostingRouter(
    {} as any,
    ((req: any, _res: any, next: any) => {
      req.user = user;
      req.tenantId = 'forged-tenant';
      next();
    }) as any,
    'cron-secret',
  ));
  const server = await new Promise<Server>(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not expose a port');
  return { server, origin: `http://127.0.0.1:${address.port}` };
}

async function request(origin: string, body: unknown) {
  const response = await fetch(`${origin}/api/auto-posting/backfill`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

async function getStatus(origin: string) {
  const response = await fetch(`${origin}/api/auto-posting/status`);
  return { status: response.status, body: await response.json() };
}

describe('Marketing Facebook backfill route', () => {
  let server: Server;
  let origin: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.runAutoPostingBackfill.mockResolvedValue({
      created: 1,
      published: 1,
      skipped: 0,
      reason: 'OK',
      backfillRequestId: 'request-1',
    });
    ({ server, origin } = await startServer());
  });

  afterEach(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
  });

  it('passes the requested day, reason, and authenticated manager to the controlled runner', async () => {
    const result = await request(origin, {
      logicalDay: '2026-01-02',
      reason: 'QStash outage during deployment',
    });

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      logicalDay: '2026-01-02',
      requestedReason: 'QStash outage during deployment',
      requestedBy: 'manager-1',
      backfillRequestId: 'request-1',
    });
    expect(mocks.runAutoPostingBackfill).toHaveBeenCalledWith(
      expect.anything(),
      'tenant-1',
      '2026-01-02',
      'QStash outage during deployment',
      'manager-1',
    );
  });

  it('rejects users outside the manager roles before creating a backfill request', async () => {
    const deniedServer = await startServer({
      id: 'agent-1',
      tenantId: 'tenant-1',
      role: 'AGENT',
    });

    try {
      const result = await request(deniedServer.origin, {
        logicalDay: '2026-01-02',
        reason: 'Agent cần kiểm tra',
      });

      expect(result.status).toBe(403);
      expect(result.body.error).toContain('quyền quản lý');
      expect(mocks.runAutoPostingBackfill).not.toHaveBeenCalled();
    } finally {
      await new Promise<void>(resolve => deniedServer.server.close(() => resolve()));
    }
  });

  it('uses the authenticated user tenant for status reads instead of request tenant metadata', async () => {
    mocks.getMarketingFacebookDailyStatus.mockResolvedValue({
      settings: { tenantId: 'tenant-1' },
      todayRun: null,
      lastRun: null,
      backfillRequests: [],
      warning: null,
    });

    const result = await getStatus(origin);

    expect(result.status).toBe(200);
    expect(mocks.getMarketingFacebookDailyStatus).toHaveBeenCalledWith(
      expect.anything(),
      'tenant-1',
      '2026-01-03',
    );
    expect(result.body.settings.tenantId).toBe('tenant-1');
  });

  it('keeps daily runs and backfill history isolated between authenticated tenants', async () => {
    const tenantOneStatus = {
      settings: { tenantId: 'tenant-1', enabled: true },
      todayRun: {
        id: 'run-tenant-1-today',
        tenantId: 'tenant-1',
        logicalDay: '2026-01-03',
        status: 'SUCCESS',
      },
      lastRun: {
        id: 'run-tenant-1-last',
        tenantId: 'tenant-1',
        logicalDay: '2026-01-02',
        status: 'FAILED',
      },
      backfillRequests: [{
        id: 'backfill-tenant-1',
        tenantId: 'tenant-1',
        logicalDay: '2025-12-31',
        status: 'SUCCESS',
      }],
      warning: null,
    };
    const tenantTwoStatus = {
      settings: { tenantId: 'tenant-2', enabled: false },
      todayRun: {
        id: 'run-tenant-2-today',
        tenantId: 'tenant-2',
        logicalDay: '2026-01-03',
        status: 'SKIPPED',
      },
      lastRun: {
        id: 'run-tenant-2-last',
        tenantId: 'tenant-2',
        logicalDay: '2026-01-01',
        status: 'SUCCESS',
      },
      backfillRequests: [{
        id: 'backfill-tenant-2',
        tenantId: 'tenant-2',
        logicalDay: '2025-12-30',
        status: 'FAILED',
      }],
      warning: 'tenant-2 warning',
    };
    mocks.getMarketingFacebookDailyStatus.mockImplementation(async (_pool, requestedTenant) => (
      requestedTenant === 'tenant-1' ? tenantOneStatus : tenantTwoStatus
    ));

    const tenantTwoServer = await startServer({
      id: 'manager-2',
      tenantId: 'tenant-2',
      role: 'MARKETING',
    });

    try {
      const tenantOneResult = await getStatus(origin);
      const tenantTwoResult = await getStatus(tenantTwoServer.origin);

      expect(tenantOneResult.status).toBe(200);
      expect(tenantOneResult.body).toEqual(tenantOneStatus);
      expect(tenantOneResult.body).not.toEqual(expect.objectContaining({
        settings: tenantTwoStatus.settings,
        todayRun: tenantTwoStatus.todayRun,
        lastRun: tenantTwoStatus.lastRun,
        backfillRequests: tenantTwoStatus.backfillRequests,
        warning: tenantTwoStatus.warning,
      }));

      expect(tenantTwoResult.status).toBe(200);
      expect(tenantTwoResult.body).toEqual(tenantTwoStatus);
      expect(tenantTwoResult.body).not.toEqual(expect.objectContaining({
        settings: tenantOneStatus.settings,
        todayRun: tenantOneStatus.todayRun,
        lastRun: tenantOneStatus.lastRun,
        backfillRequests: tenantOneStatus.backfillRequests,
        warning: tenantOneStatus.warning,
      }));

      expect(mocks.getMarketingFacebookDailyStatus).toHaveBeenNthCalledWith(
        1,
        expect.anything(),
        'tenant-1',
        '2026-01-03',
      );
      expect(mocks.getMarketingFacebookDailyStatus).toHaveBeenNthCalledWith(
        2,
        expect.anything(),
        'tenant-2',
        '2026-01-03',
      );
    } finally {
      await new Promise<void>(resolve => tenantTwoServer.server.close(() => resolve()));
    }
  });

  it('rejects future dates and short reasons before creating a backfill request', async () => {
    const future = await request(origin, {
      logicalDay: '2026-01-04',
      reason: 'outage',
    });
    expect(future.status).toBe(400);
    expect(future.body.error).toContain('tương lai');

    const shortReason = await request(origin, {
      logicalDay: '2026-01-02',
      reason: 'x',
    });
    expect(shortReason.status).toBe(400);
    expect(shortReason.body.error).toContain('tối thiểu 3 ký tự');
    expect(mocks.runAutoPostingBackfill).not.toHaveBeenCalled();
  });

  it('returns a conflict when that tenant and day already have a backfill request', async () => {
    mocks.runAutoPostingBackfill.mockResolvedValue({
      created: 0,
      published: 0,
      skipped: 0,
      reason: 'BACKFILL_ALREADY_REQUESTED',
      backfillRequestId: 'request-1',
      backfillStatus: 'BLOCKED',
    });

    const result = await request(origin, {
      logicalDay: '2026-01-02',
      reason: 'Retry after reviewing the outage',
    });

    expect(result.status).toBe(409);
    expect(result.body).toMatchObject({
      code: 'BACKFILL_ALREADY_REQUESTED',
      backfillStatus: 'BLOCKED',
    });
  });
});