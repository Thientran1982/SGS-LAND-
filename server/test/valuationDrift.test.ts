import express from 'express';
import http from 'node:http';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { query, updateDriftThresholds, getDriftThresholdHistory } = vi.hoisted(() => ({
  query: vi.fn(),
  updateDriftThresholds: vi.fn(),
  getDriftThresholdHistory: vi.fn(),
}));

vi.mock('../db', () => ({ pool: { query } }));
vi.mock('../services/priceCalibrationService', () => ({
  priceCalibrationService: {
    updateDriftThresholds,
    getDriftThresholdHistory,
    getDriftThresholdConfig: vi.fn(),
  },
}));

const { notificationRepository } = await import('../repositories/notificationRepository');
const { createValuationRoutes } = await import('../routes/valuationRoutes');

async function putJson(
  app: express.Express,
  path: string,
  body: Record<string, unknown>,
): Promise<{ status: number; body: any }> {
  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  try {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}

function authenticatedAsAdmin() {
  return (_req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (_req as any).user = {
      id: 'author-1',
      tenantId: 'tenant-1',
      role: 'ADMIN',
      name: 'Threshold author',
      email: 'author@example.test',
    };
    next();
  };
}

describe('valuation drift threshold notifications', () => {
  beforeEach(() => {
    query.mockReset();
    updateDriftThresholds.mockReset();
    getDriftThresholdHistory.mockReset();
  });

  it('notifies every active SUPER_ADMIN, ADMIN, and TEAM_LEAD with the committed change', async () => {
    query.mockResolvedValueOnce({
      rows: [
        { id: 'super-admin-1' },
        { id: 'admin-1' },
        { id: 'team-lead-1' },
      ],
    });

    const createSpy = vi.spyOn(notificationRepository, 'create').mockResolvedValue({});
    const thresholds = {
      maeVndPerM2: 31_000_000,
      mape: 0.31,
      consecutiveRuns: 7,
    };

    await notificationRepository.createForTenantAdmins('tenant-1', {
      type: 'drift_threshold_changed',
      title: 'Valuation drift thresholds updated',
      body: 'Thresholds updated',
      metadata: {
        authorId: 'author-1',
        version: 12,
        thresholds,
      },
    });

    expect(createSpy).toHaveBeenCalledTimes(3);
    expect(createSpy.mock.calls.map(([data]) => data)).toEqual([
      expect.objectContaining({
        tenantId: 'tenant-1',
        userId: 'super-admin-1',
        metadata: expect.objectContaining({ authorId: 'author-1', version: 12, thresholds }),
      }),
      expect.objectContaining({
        tenantId: 'tenant-1',
        userId: 'admin-1',
        metadata: expect.objectContaining({ authorId: 'author-1', version: 12, thresholds }),
      }),
      expect.objectContaining({
        tenantId: 'tenant-1',
        userId: 'team-lead-1',
        metadata: expect.objectContaining({ authorId: 'author-1', version: 12, thresholds }),
      }),
    ]);
  });

  it('returns the committed configuration and audit history when notification delivery fails', async () => {
    const thresholds = {
      maeVndPerM2: 29_000_000,
      mape: 0.29,
      consecutiveRuns: 6,
    };
    const config = {
      version: 19,
      thresholds,
      updatedBy: 'author-1',
    };
    const history = [{
      version: 19,
      authorId: 'author-1',
      newThresholds: thresholds,
    }];
    updateDriftThresholds.mockResolvedValue(config);
    getDriftThresholdHistory.mockResolvedValue(history);
    const notificationSpy = vi
      .spyOn(notificationRepository, 'createForTenantAdmins')
      .mockRejectedValue(new Error('notification store unavailable'));

    const app = express()
      .use(express.json())
      .use('/api/valuation', createValuationRoutes(
        authenticatedAsAdmin(),
        (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
        (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
        (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
      ));

    const response = await putJson(app, '/api/valuation/admin/drift-thresholds', thresholds);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ config, history });
    expect(updateDriftThresholds).toHaveBeenCalledWith(thresholds, 'author-1');
    expect(getDriftThresholdHistory).toHaveBeenCalledOnce();
    notificationSpy.mockRestore();
  });
});