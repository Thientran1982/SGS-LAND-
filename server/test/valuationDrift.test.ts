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
const { logger } = await import('../middleware/logger');

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

async function requestJson(
  app: express.Express,
  method: 'GET' | 'POST',
  path: string,
): Promise<{ status: number; body: any }> {
  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  try {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, { method });
    return { status: response.status, body: await response.json() };
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}

function adminApp() {
  return express()
    .use(express.json())
    .use('/api/valuation', createValuationRoutes(
      authenticatedAsAdmin(),
      (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
      (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
      (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
    ));
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
    const operationalSignalSpy = vi.spyOn(logger, 'warn');

    const recordEventSpy = vi.spyOn(notificationRepository, 'recordOperationalEvent').mockResolvedValue({} as any);

    const response = await putJson(adminApp(), '/api/valuation/admin/drift-thresholds', thresholds);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ config, history });
    expect(updateDriftThresholds).toHaveBeenCalledWith(thresholds, 'author-1');
    expect(getDriftThresholdHistory).toHaveBeenCalledOnce();
    expect(operationalSignalSpy).toHaveBeenCalledWith(
      '[Operational] valuation drift-threshold notification delivery failed after commit',
      {
        event: 'valuation_drift_threshold_notification_failed',
        tenantId: 'tenant-1',
        thresholdVersion: 19,
        notificationType: 'drift_threshold_changed',
        errorType: 'Error',
      },
    );
    expect(JSON.stringify(response.body)).not.toContain('notification store unavailable');
    expect(recordEventSpy).toHaveBeenCalledWith(
      'tenant-1',
      'valuation_drift_threshold_notification_failed',
      expect.objectContaining({
        thresholdVersion: 19,
        notification: expect.objectContaining({
          type: 'drift_threshold_changed',
          metadata: expect.objectContaining({ version: 19, thresholds }),
        }),
      }),
    );
    operationalSignalSpy.mockRestore();
    notificationSpy.mockRestore();
    recordEventSpy.mockRestore();
  });

  it('lists tenant-scoped operational events for admins', async () => {
    const event = {
      id: 'event-1',
      tenantId: 'tenant-1',
      eventType: 'valuation_drift_threshold_notification_failed',
      payload: { thresholdVersion: 19 },
      resolvedAt: null,
    };
    const findSpy = vi.spyOn(notificationRepository, 'findOperationalEvents').mockResolvedValue([event] as any);

    const response = await requestJson(adminApp(), 'GET', '/api/valuation/admin/operational-events');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ events: [event] });
    expect(findSpy).toHaveBeenCalledWith('tenant-1', undefined);
    findSpy.mockRestore();
  });

  it('retries the stored notification and resolves the event without updating thresholds', async () => {
    const event = {
      id: 'event-1',
      tenantId: 'tenant-1',
      eventType: 'valuation_drift_threshold_notification_failed',
      payload: {
        thresholdVersion: 19,
        notification: {
          type: 'drift_threshold_changed',
          title: 'Valuation drift thresholds updated',
          body: 'version 19',
          metadata: { version: 19, thresholds: { maeVndPerM2: 29_000_000 } },
        },
      },
      resolvedAt: null,
    };
    const findSpy = vi.spyOn(notificationRepository, 'findOperationalEventById').mockResolvedValue(event as any);
    const createSpy = vi.spyOn(notificationRepository, 'createForTenantAdmins').mockResolvedValue();
    const resolveSpy = vi.spyOn(notificationRepository, 'resolveOperationalEvent').mockResolvedValue({ ...event, resolvedAt: 'now' } as any);

    const response = await requestJson(adminApp(), 'POST', '/api/valuation/admin/operational-events/event-1/retry');

    expect(response.status).toBe(200);
    expect(createSpy).toHaveBeenCalledWith('tenant-1', event.payload.notification);
    expect(resolveSpy).toHaveBeenCalledWith('tenant-1', 'event-1', 'author-1');
    expect(updateDriftThresholds).not.toHaveBeenCalled();
    findSpy.mockRestore();
    createSpy.mockRestore();
    resolveSpy.mockRestore();
  });
});