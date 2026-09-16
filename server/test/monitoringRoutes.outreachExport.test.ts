import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';

const { getSummary } = vi.hoisted(() => ({ getSummary: vi.fn() }));
vi.mock('../services/agentMemoryService', () => ({
  agentMemoryService: { getSignalHealth: vi.fn() },
}));
vi.mock('../services/outreachAuditExportTelemetry', () => ({
  getOutreachAuditExportFailureSummary: getSummary,
  normalizeOutreachAuditExportFailureWindow: (value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(1, Math.min(720, Math.trunc(parsed))) : 24;
  },
}));

import { createMonitoringRoutes } from '../routes/monitoringRoutes';

describe('outreach audit export monitoring route', () => {
  let server: Server;
  let origin: string;

  beforeEach(() => {
    getSummary.mockReset();
  });

  it('lets a manager inspect tenant-scoped failure rate and window', async () => {
    getSummary.mockResolvedValue({
      windowHours: 6,
      windowStart: '2026-09-16T04:00:00.000Z',
      windowEnd: '2026-09-16T10:00:00.000Z',
      totalFailures: 2,
      failureRatePerHour: 0.33,
      categories: [],
      rawPayloadIncluded: false,
      approvalContentsIncluded: false,
      providerPayloadIncluded: false,
    });
    const app = express();
    app.use(express.json());
    app.use('/api/monitoring', createMonitoringRoutes((req, _res, next) => {
      const role = req.header('x-test-role') || 'MANAGER';
      (req as any).user = { tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', role };
      next();
    }));
    server = await new Promise<Server>(resolve => {
      const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not expose an address');
    origin = `http://127.0.0.1:${address.port}`;

    const response = await fetch(`${origin}/api/monitoring/outreach-audit-export-failures?windowHours=6`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ totalFailures: 2, failureRatePerHour: 0.33 });
    expect(getSummary).toHaveBeenCalledWith('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 6);

    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  });

  it('does not expose the telemetry endpoint to brokers', async () => {
    const app = express();
    app.use('/api/monitoring', createMonitoringRoutes((req, _res, next) => {
      (req as any).user = { tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', role: 'BROKER' };
      next();
    }));
    const response = await new Promise<Response>(resolve => {
      const instance = app.listen(0, '127.0.0.1', async () => {
        const address = instance.address();
        if (!address || typeof address === 'string') throw new Error('Test server did not expose an address');
        resolve(await fetch(`http://127.0.0.1:${address.port}/api/monitoring/outreach-audit-export-failures`));
        instance.close();
      });
    });
    expect(response.status).toBe(403);
    expect(getSummary).not.toHaveBeenCalled();
  });
});