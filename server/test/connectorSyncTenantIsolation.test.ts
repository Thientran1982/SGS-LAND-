import express from 'express';
import { request as httpRequest } from 'node:http';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  findConnector: vi.fn(),
  updateConnector: vi.fn(),
  createJob: vi.fn(),
  updateJob: vi.fn(),
  listJobs: vi.fn(),
  findJob: vi.fn(),
}));

vi.mock('../repositories/connectorRepository', () => ({
  connectorRepository: {
    findByUser: state.findConnector,
    update: state.updateConnector,
  },
  syncJobRepository: {
    create: state.createJob,
    update: state.updateJob,
    listByUser: state.listJobs,
    findByUser: state.findJob,
  },
}));

import { createConnectorRoutes } from '../routes/connectorRoutes';

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';
const USER_A = 'user-a';
const USER_B = 'user-b';
const CONNECTOR_A = 'connector-a';
const JOB_A = 'job-a';
const JOB_B = 'job-b';

const SYNCABLE_CONNECTORS = [
  { type: 'GOOGLE_SHEETS', config: { spreadsheetId: 'sheet-a' } },
  { type: 'HUBSPOT', config: { apiKey: 'hubspot-secret' } },
  { type: 'WEBHOOK_EXPORT', config: { targetUrl: 'https://hooks.example.test/leads' } },
  { type: 'SALESFORCE', config: { apiKey: 'salesforce-secret' } },
] as const;

type TestResponse = {
  status: number;
  body: any;
};

function connector(id: string, tenantId: string, type = 'HUBSPOT') {
  return {
    id,
    tenantId,
    type,
    name: `${tenantId} connector`,
    config: type === 'GOOGLE_SHEETS'
      ? { spreadsheetId: 'sheet-a' }
      : type === 'WEBHOOK_EXPORT'
        ? { targetUrl: 'https://hooks.example.test/leads' }
        : { apiKey: 'test-key' },
  };
}

function job(id: string, tenantId: string, connectorId: string) {
  return {
    id,
    tenantId,
    connectorId,
    startedAt: '2026-09-09T00:00:00.000Z',
    status: 'QUEUED',
    recordsProcessed: 0,
    errors: [],
    retryCount: 0,
  };
}

async function startTestServer() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = {
      id: req.header('x-user-id') || USER_A,
      tenantId: req.header('x-tenant-id') || TENANT_A,
      role: 'ADMIN',
    };
    next();
  });
  app.use(
    '/api/connectors',
    createConnectorRoutes((_req: express.Request, _res: express.Response, next: express.NextFunction) => next()),
  );

  const server = app.listen(0);
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not expose a TCP port');

  return {
    server,
    request: (path: string, options: { method?: string; tenantId?: string; userId?: string } = {}) =>
      new Promise<TestResponse>((resolve, reject) => {
        const req = httpRequest(
          {
            hostname: '127.0.0.1',
            port: address.port,
            path,
            method: options.method ?? 'GET',
            headers: {
              'x-tenant-id': options.tenantId ?? TENANT_A,
              'x-user-id': options.userId ?? USER_A,
            },
          },
          response => {
            let body = '';
            response.setEncoding('utf8');
            response.on('data', chunk => (body += chunk));
            response.on('end', () => {
              let parsed: any = body;
              try {
                parsed = JSON.parse(body);
              } catch {
                // Keep the raw body for failures that are not JSON.
              }
              resolve({ status: response.statusCode ?? 0, body: parsed });
            });
          },
        );
        req.on('error', reject);
        req.end();
      }),
  };
}

describe('connector sync tenant isolation', () => {
  let testServer: Awaited<ReturnType<typeof startTestServer>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    state.findConnector.mockImplementation(async (tenantId: string, userId: string, id: string) =>
      tenantId === TENANT_A && userId === USER_A && id === CONNECTOR_A ? connector(CONNECTOR_A, TENANT_A) : null,
    );
    state.createJob.mockResolvedValue(job(JOB_A, TENANT_A, CONNECTOR_A));
    state.updateJob.mockResolvedValue(job(JOB_A, TENANT_A, CONNECTOR_A));
    state.updateConnector.mockResolvedValue(connector(CONNECTOR_A, TENANT_A));
    state.listJobs.mockResolvedValue([]);
    state.findJob.mockResolvedValue(null);
    testServer = await startTestServer();
  });

  afterEach(async () => {
    vi.useRealTimers();
    await new Promise<void>(resolve => testServer.server.close(() => resolve()));
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('returns 404 and does not create a job for a connector belonging to another tenant', async () => {
    const response = await testServer.request(`/api/connectors/${CONNECTOR_A}/sync`, {
      method: 'POST',
      tenantId: TENANT_B,
    });

    expect(response.status).toBe(404);
    expect(state.findConnector).toHaveBeenCalledWith(TENANT_B, USER_A, CONNECTOR_A);
    expect(state.createJob).not.toHaveBeenCalled();
  });

  it('passes the authenticated tenant to job creation and every asynchronous update', async () => {
    const response = await testServer.request(`/api/connectors/${CONNECTOR_A}/sync`, {
      method: 'POST',
      tenantId: TENANT_A,
    });

    expect(response.status).toBe(201);
    expect(state.findConnector).toHaveBeenCalledWith(TENANT_A, USER_A, CONNECTOR_A);
    expect(state.createJob).toHaveBeenCalledWith(TENANT_A, USER_A, {
      connectorId: CONNECTOR_A,
      status: 'QUEUED',
    });

    await vi.runAllTimersAsync();

    expect(state.updateJob.mock.calls).toEqual([
      [TENANT_A, USER_A, JOB_A, { status: 'RUNNING' }],
      [
        TENANT_A,
        USER_A,
        JOB_A,
        expect.objectContaining({
          status: 'COMPLETED',
          recordsProcessed: expect.any(Number),
        }),
      ],
    ]);
    expect(state.updateConnector).toHaveBeenCalledWith(
      TENANT_A,
      USER_A,
      CONNECTOR_A,
      expect.objectContaining({ lastSyncStatus: 'COMPLETED' }),
    );
  });

  it.each(SYNCABLE_CONNECTORS)('queues a %s sync for the authenticated tenant and user', async ({ type }) => {
    state.findConnector.mockResolvedValue(connector(CONNECTOR_A, TENANT_A, type));
    state.createJob.mockResolvedValue({
      ...job(JOB_A, TENANT_A, CONNECTOR_A),
      credential: 'must-not-leak',
    });

    const response = await testServer.request(`/api/connectors/${CONNECTOR_A}/sync`, {
      method: 'POST',
      tenantId: TENANT_A,
      userId: USER_A,
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      id: JOB_A,
      connectorId: CONNECTOR_A,
      status: 'QUEUED',
    });
    expect(response.body).not.toHaveProperty('credential');
    expect(response.body).not.toHaveProperty('tenantId');
    expect(response.body).not.toHaveProperty('ownerUserId');
    expect(state.createJob).toHaveBeenCalledWith(TENANT_A, USER_A, {
      connectorId: CONNECTOR_A,
      status: 'QUEUED',
    });

    await vi.runAllTimersAsync();

    expect(state.updateJob.mock.calls.every(([tenantId, userId]) =>
      tenantId === TENANT_A && userId === USER_A,
    )).toBe(true);
    expect(state.updateConnector).toHaveBeenCalledWith(
      TENANT_A,
      USER_A,
      CONNECTOR_A,
      expect.objectContaining({ lastSyncStatus: 'COMPLETED' }),
    );
  });

  it('scopes job listing and rejects a job id from another tenant', async () => {
    state.listJobs.mockResolvedValue([job(JOB_A, TENANT_A, CONNECTOR_A)]);

    const list = await testServer.request('/api/connectors/jobs', {
      tenantId: TENANT_A,
    });
    expect(list.status).toBe(200);
    expect(state.listJobs).toHaveBeenCalledWith(TENANT_A, USER_A, 50);

    state.findJob.mockImplementation(async (tenantId: string, userId: string, id: string) =>
      tenantId === TENANT_A && userId === USER_A && id === JOB_A ? job(JOB_A, TENANT_A, CONNECTOR_A) : null,
    );

    const foreignJob = await testServer.request(`/api/connectors/jobs/${JOB_B}`, {
      tenantId: TENANT_B,
    });
    expect(foreignJob.status).toBe(404);
    expect(state.findJob).toHaveBeenCalledWith(TENANT_B, USER_A, JOB_B);
  });

  it('does not let another user read or update the owner-scoped job', async () => {
    state.findJob.mockImplementation(async (tenantId: string, userId: string, id: string) =>
      tenantId === TENANT_A && userId === USER_A && id === JOB_A ? job(JOB_A, TENANT_A, CONNECTOR_A) : null,
    );

    const foreignRead = await testServer.request(`/api/connectors/jobs/${JOB_A}`, {
      tenantId: TENANT_A,
      userId: USER_B,
    });

    expect(foreignRead.status).toBe(404);
    expect(state.findJob).toHaveBeenCalledWith(TENANT_A, USER_B, JOB_A);

    await vi.runAllTimersAsync();
    expect(state.updateJob).not.toHaveBeenCalled();
  });

  it('returns 404 and does not sync a connector owned by another user in the same tenant', async () => {
    const response = await testServer.request(`/api/connectors/${CONNECTOR_A}/sync`, {
      method: 'POST',
      tenantId: TENANT_A,
      userId: USER_B,
    });

    expect(response.status).toBe(404);
    expect(state.findConnector).toHaveBeenCalledWith(TENANT_A, USER_B, CONNECTOR_A);
    expect(state.createJob).not.toHaveBeenCalled();
  });
});