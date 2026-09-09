import express from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  list: vi.fn(),
}));

vi.mock('../repositories/notificationRepository', () => ({
  notificationRepository: {
    listZaloReadinessNotificationRetries: state.list,
  },
}));

import { createNotificationRoutes } from '../routes/notificationRoutes';

const TENANT_ID = 'tenant-a';

async function startTestServer(role: string) {
  const app = express();
  app.use((req, _res, next) => {
    (req as any).user = { id: 'admin-a', tenantId: TENANT_ID, role };
    next();
  });
  app.use('/api/notifications', createNotificationRoutes(
    (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  ));
  const server = app.listen(0);
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return {
    server,
    request: () => fetch(`http://127.0.0.1:${port}/api/notifications/zalo-readiness`),
  };
}

describe('Zalo readiness warning admin projection', () => {
  let testServer: Awaited<ReturnType<typeof startTestServer>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    state.list.mockResolvedValue([
      {
        reasonCode: 'OA_REQUEST_FAILED',
        checkedAt: '2026-09-09T10:20:30.000Z',
        retryState: {
          status: 'PENDING',
          attemptCount: 1,
          nextAttemptAt: '2026-09-09T10:21:30.000Z',
          deliveredAt: null,
          exhaustedAt: null,
        },
      },
      {
        reasonCode: 'QUOTA_PERMISSION_DENIED',
        checkedAt: '2026-09-09T09:20:30.000Z',
        retryState: {
          status: 'DELIVERED',
          attemptCount: 2,
          nextAttemptAt: null,
          deliveredAt: '2026-09-09T09:22:30.000Z',
          exhaustedAt: null,
        },
      },
    ]);
    testServer = await startTestServer('ADMIN');
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) =>
      testServer.server.close(error => error ? reject(error) : resolve()),
    );
  });

  it('returns only safe tenant-scoped retry facts for pending and delivered warnings', async () => {
    const response = await testServer.request();
    expect(response.status).toBe(200);
    expect(state.list).toHaveBeenCalledWith(TENANT_ID);
    const body = await response.json();

    expect(body).toEqual({ warnings: expect.any(Array) });
    expect(body.warnings).toHaveLength(2);
    expect(body.warnings[0]).toMatchObject({
      reasonCode: 'OA_REQUEST_FAILED',
      checkedAt: '2026-09-09T10:20:30.000Z',
      retryState: { status: 'PENDING', attemptCount: 1 },
    });
    expect(body.warnings[1]).toMatchObject({
      reasonCode: 'QUOTA_PERMISSION_DENIED',
      retryState: { status: 'DELIVERED', attemptCount: 2 },
    });
    expect(JSON.stringify(body)).not.toContain('transitionEventId');
    expect(JSON.stringify(body)).not.toContain('provider');
  });

  it('does not expose the warning projection to non-admin users', async () => {
    await testServer.server.close();
    testServer = await startTestServer('AGENT');

    const response = await testServer.request();
    expect(response.status).toBe(403);
    expect(state.list).not.toHaveBeenCalled();
  });
});