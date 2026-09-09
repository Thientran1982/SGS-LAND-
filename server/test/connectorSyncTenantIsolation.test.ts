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
    findById: state.findConnector,
    update: state.updateConnector,
  },
  syncJobRepository: {
    create: state.createJob,
    update: state.updateJob,
    listByTenant: state.listJobs,
    findById: state.findJob,
  },
}));

import { createConnectorRoutes } from '../routes/connectorRoutes';

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';
const CONNECTOR_A = 'connector-a';
const JOB_A = 'job-a';
const JOB_B = 'job-b';

type TestResponse = {
  status: number;
  body: any;
};

function connector(id: string, tenantId: string) {
  return {
    id,
    tenantId,
    type: 'HUBSPOT',
    name: `${tenantId} connector`,
    config: { apiKey: 'test-key' },
  };
}

function job(id: string, tenantId: string, connectorId: string) {
  return {
    id,
    tenantId,
    connectorId,
    status: 'QUEUED',
    errors: [],
  };
}

async function startTestServer() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = {
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
    request: (path: string, options: { method?: string; tenantId?: string } = {}) =>
      new Promise<TestResponse>((resolve, reject) => {
        const req = httpRequest(
          {
            hostname: '127.0.0.1',
            port: address.port,
            path,
            method: options.method ?? 'GET',
            headers: {
              'x-tenant-id': options.tenantId ?? TENANT_A,
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
    state.findConnector.mockImplementation(async (tenantId: string, id: string) =>
      tenantId === TENANT_A && id === CONNECTOR_A ? connector(CONNECTOR_A, TENANT_A) : null,
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
    expect(state.findConnector).toHaveBeenCalledWith(TENANT_B, CONNECTOR_A);
    expect(state.createJob).not.toHaveBeenCalled();
  });

  it('passes the authenticated tenant to job creation and every asynchronous update', async () => {
    const response = await testServer.request(`/api/connectors/${CONNECTOR_A}/sync`, {
      method: 'POST',
      tenantId: TENANT_A,
    });

    expect(response.status).toBe(201);
    expect(state.findConnector).toHaveBeenCalledWith(TENANT_A, CONNECTOR_A);
    expect(state.createJob).toHaveBeenCalledWith(TENANT_A, {
      connectorId: CONNECTOR_A,
      status: 'QUEUED',
    });

    await vi.runAllTimersAsync();

    expect(state.updateJob.mock.calls).toEqual([
      [TENANT_A, JOB_A, { status: 'RUNNING' }],
      [
        TENANT_A,
        JOB_A,
        expect.objectContaining({
          status: 'COMPLETED',
          recordsProcessed: expect.any(Number),
        }),
      ],
    ]);
    expect(state.updateConnector).toHaveBeenCalledWith(
      TENANT_A,
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
    expect(state.listJobs).toHaveBeenCalledWith(TENANT_A, 50);

    state.findJob.mockImplementation(async (tenantId: string, id: string) =>
      tenantId === TENANT_A && id === JOB_A ? job(JOB_A, TENANT_A, CONNECTOR_A) : null,
    );

    const foreignJob = await testServer.request(`/api/connectors/jobs/${JOB_B}`, {
      tenantId: TENANT_B,
    });
    expect(foreignJob.status).toBe(404);
    expect(state.findJob).toHaveBeenCalledWith(TENANT_B, JOB_B);
  });
});