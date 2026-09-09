import express from 'express';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  verify: vi.fn(),
  detectTransition: vi.fn(),
  notify: vi.fn(),
  recordRetry: vi.fn(),
  warn: vi.fn(),
}));

vi.mock('../repositories/enterpriseConfigRepository', () => ({
  enterpriseConfigRepository: {},
}));

vi.mock('../repositories/auditRepository', () => ({
  auditRepository: {
    logZaloBroadcastVerificationAndDetectTransition: state.detectTransition,
  },
}));

vi.mock('../social-publishing/zaloBroadcastPublisher', () => ({
  verifyZaloBroadcastAccess: state.verify,
}));

vi.mock('../services/notificationService', () => ({
  notifyZaloBroadcastNotReady: state.notify,
  recordZaloBroadcastNotReadyNotificationFailure: state.recordRetry,
}));

vi.mock('../services/emailService', () => ({
  emailService: {
    testSmtpConnection: vi.fn(),
    sendEmail: vi.fn(),
    emailBase: vi.fn(),
  },
}));

vi.mock('../services/facebookService', () => ({
  verifyFacebookPageAccess: vi.fn(),
}));

vi.mock('../middleware/logger', () => ({
  logger: {
    warn: state.warn,
    info: vi.fn(),
    error: vi.fn(),
  },
}));

import { createEnterpriseRoutes } from '../routes/enterpriseRoutes';

const TENANT_ID = 'tenant-1';
const ADMIN = {
  id: 'admin-1',
  tenantId: TENANT_ID,
  role: 'ADMIN',
};

type VerificationStatus = 'READY' | 'NOT_READY';

async function startTestServer() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = ADMIN;
    next();
  });
  app.use('/api/enterprise', createEnterpriseRoutes(
    (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  ));

  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const port = (server.address() as AddressInfo).port;

  return {
    server,
    request: () => fetch(`http://127.0.0.1:${port}/api/enterprise/zalo/broadcast/verify`, {
      method: 'POST',
    }),
  };
}

async function readJson(response: Response): Promise<Record<string, any>> {
  return response.json() as Promise<Record<string, any>>;
}

describe('admin Zalo broadcast verification route', () => {
  let testServer: Awaited<ReturnType<typeof startTestServer>>;
  let previousStatus: VerificationStatus | null;
  let transitionSequence: number;
  let auditRows: Array<Record<string, unknown>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    previousStatus = null;
    transitionSequence = 0;
    auditRows = [];

    state.verify.mockResolvedValue({
      ready: true,
      retryable: false,
      reasonCode: 'READY',
      reason: null,
      checks: { oaId: 'PASS', quota: 'PASS' },
    });
    state.notify.mockResolvedValue(undefined);
    state.recordRetry.mockResolvedValue(undefined);

    // This models the repository's transactionally serialized transition
    // result: only the first NOT_READY result after READY is a transition.
    state.detectTransition.mockImplementation(async (
      tenantId: string,
      data: { status: VerificationStatus; [key: string]: unknown },
    ) => {
      const priorStatus = previousStatus;
      previousStatus = data.status;
      auditRows.push({ tenantId, ...data });

      if (priorStatus === 'READY' && data.status === 'NOT_READY') {
        transitionSequence += 1;
        return {
          transitionedToNotReady: true,
          previousStatus: 'READY',
          transitionEventId: `transition-${transitionSequence}`,
        };
      }

      return {
        transitionedToNotReady: false,
        previousStatus: priorStatus,
      };
    });

    testServer = await startTestServer();
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) =>
      testServer.server.close((error) => (error ? reject(error) : resolve())),
    );
  });

  it('records READY to NOT_READY and sends one safe admin warning', async () => {
    const readyResponse = await testServer.request();
    expect(readyResponse.status).toBe(200);

    state.verify.mockResolvedValueOnce({
      ready: false,
      retryable: true,
      reasonCode: 'QUOTA_REQUEST_FAILED',
      reason: 'Không thể xác minh quyền quota.',
      checks: { oaId: 'PASS', quota: 'FAIL' },
    });

    const response = await testServer.request();
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(auditRows).toHaveLength(2);
    expect(auditRows[1]).toMatchObject({
      tenantId: TENANT_ID,
      actorId: ADMIN.id,
      status: 'NOT_READY',
      reasonCode: 'QUOTA_REQUEST_FAILED',
      checks: { oaId: 'PASS', quota: 'FAIL' },
    });
    expect(state.notify).toHaveBeenCalledTimes(1);
    expect(state.notify).toHaveBeenCalledWith(TENANT_ID, {
      reasonCode: 'QUOTA_REQUEST_FAILED',
      checkedAt: expect.any(String),
      transitionEventId: 'transition-1',
    });

    expect(body).toMatchObject({
      status: 'NOT_READY',
      ready: false,
      retryable: true,
      reasonCode: 'QUOTA_REQUEST_FAILED',
      checks: { oaId: 'PASS', quota: 'FAIL' },
    });
    expect(body.checkedAt).toEqual(expect.any(String));
    expect(new Date(body.checkedAt).toString()).not.toBe('Invalid Date');
    expect(Object.keys(body).sort()).toEqual([
      'checkedAt',
      'checks',
      'ready',
      'reason',
      'reasonCode',
      'retryable',
      'status',
    ]);
    expect(body).not.toHaveProperty('transitionEventId');
    expect(JSON.stringify(body)).not.toContain('accessToken');
    expect(JSON.stringify(body)).not.toContain('providerPayload');
  });

  it('does not duplicate warnings for concurrent or repeated NOT_READY checks', async () => {
    await testServer.request();

    state.verify.mockResolvedValue({
      ready: false,
      retryable: true,
      reasonCode: 'QUOTA_REQUEST_FAILED',
      reason: 'Không thể xác minh quyền quota.',
      checks: { oaId: 'PASS', quota: 'FAIL' },
    });

    const concurrentResponses = await Promise.all([
      testServer.request(),
      testServer.request(),
    ]);
    const repeatedResponse = await testServer.request();

    expect(concurrentResponses.every(response => response.status === 200)).toBe(true);
    expect(repeatedResponse.status).toBe(200);
    expect(auditRows).toHaveLength(4);
    expect(state.notify).toHaveBeenCalledTimes(1);
    expect(state.notify.mock.calls[0][1]).toMatchObject({
      reasonCode: 'QUOTA_REQUEST_FAILED',
      transitionEventId: 'transition-1',
    });
    expect(state.recordRetry).not.toHaveBeenCalled();
  });
});