import express from 'express';
import { request as httpRequest } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  listConnectors: vi.fn(),
  createConnector: vi.fn(),
  findConnector: vi.fn(),
  updateConnector: vi.fn(),
  deleteConnector: vi.fn(),
  createJob: vi.fn(),
}));

vi.mock('../repositories/connectorRepository', () => ({
  connectorRepository: {
    listByUser: state.listConnectors,
    create: state.createConnector,
    findByUser: state.findConnector,
    update: state.updateConnector,
    delete: state.deleteConnector,
  },
  syncJobRepository: {
    create: state.createJob,
    update: vi.fn(),
    listByUser: vi.fn(),
    findByUser: vi.fn(),
  },
}));

vi.mock('../repositories/auditRepository', () => ({
  auditRepository: { log: vi.fn() },
}));

import { createConnectorRoutes } from '../routes/connectorRoutes';

const TENANT_ID = 'tenant-a';
const USER_A = 'user-a';
const USER_B = 'user-b';

const CONNECTOR_CASES = [
  { type: 'FACEBOOK_PAGE', config: { pageId: 'page-a', accessToken: 'facebook-token' } },
  { type: 'ZALO_OA', config: { appId: 'app-a', oaId: 'oa-a', accessToken: 'zalo-token' } },
  { type: 'INSTAGRAM', config: { businessAccountId: 'business-a', accessToken: 'instagram-token' } },
  { type: 'TIKTOK', config: { accountId: 'account-a', accessToken: 'tiktok-token' } },
  { type: 'LINKEDIN_PAGE', config: { organizationId: 'org-a', accessToken: 'linkedin-token' } },
  { type: 'GOOGLE_SHEETS', config: { spreadsheetId: 'sheet-a' } },
  { type: 'HUBSPOT', config: { apiKey: 'hubspot-key' } },
  { type: 'WEBHOOK_EXPORT', config: { targetUrl: 'https://hooks.example.test/leads', secret: 'webhook-secret' } },
  { type: 'SALESFORCE', config: { apiKey: 'salesforce-key' } },
] as const;

type RequestOptions = {
  method?: string;
  userId?: string;
  body?: unknown;
};

type TestResponse = {
  status: number;
  body: any;
  text: string;
};

function connectorFor(
  type: string,
  config: Record<string, unknown>,
  overrides: Record<string, unknown> = {},
) {
  return {
    id: `connector-${type.toLowerCase()}`,
    tenantId: TENANT_ID,
    ownerUserId: USER_A,
    type,
    name: `${type} connection`,
    status: 'ACTIVE',
    config,
    ...overrides,
  };
}

async function startTestServer() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = {
      id: req.header('x-user-id') || USER_A,
      tenantId: TENANT_ID,
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
    request: (path: string, options: RequestOptions = {}) =>
      new Promise<TestResponse>((resolve, reject) => {
        const headers: Record<string, string> = {
          'x-user-id': options.userId || USER_A,
        };
        let body: string | undefined;
        if (options.body !== undefined) {
          body = JSON.stringify(options.body);
          headers['content-type'] = 'application/json';
          headers['content-length'] = String(Buffer.byteLength(body));
        }
        const req = httpRequest(
          {
            hostname: '127.0.0.1',
            port: address.port,
            path,
            method: options.method || 'GET',
            headers,
          },
          response => {
            let text = '';
            response.setEncoding('utf8');
            response.on('data', chunk => (text += chunk));
            response.on('end', () => {
              let parsed: any = text;
              try {
                parsed = JSON.parse(text);
              } catch {
                // Keep the raw body for non-JSON failures.
              }
              resolve({ status: response.statusCode || 0, body: parsed, text });
            });
          },
        );
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
      }),
  };
}

describe('connector actions for every supported private connection type', () => {
  let testServer: Awaited<ReturnType<typeof startTestServer>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    testServer = await startTestServer();
  });

  afterEach(async () => {
    await new Promise<void>(resolve => testServer.server.close(() => resolve()));
  });

  it.each(CONNECTOR_CASES)('creates and redacts %s credentials for the current owner', async ({ type, config }) => {
    const saved = connectorFor(type, config);
    state.createConnector.mockResolvedValue(saved);

    const response = await testServer.request('/api/connectors', {
      method: 'POST',
      body: { type, name: `${type} for user A`, config },
    });

    expect(response.status).toBe(201);
    expect(state.createConnector).toHaveBeenCalledWith(TENANT_ID, USER_A, {
      type,
      name: `${type} for user A`,
      config,
    });
    expect(response.body.type).toBe(type);
    expect(response.body.ownerUserId).toBe(USER_A);
    if (type === 'GOOGLE_SHEETS' || type === 'WEBHOOK_EXPORT') {
      expect(response.body.config.targetUrl || response.body.config.spreadsheetId).toBeTruthy();
    }
    expect(response.text).not.toMatch(/facebook-token|zalo-token|instagram-token|tiktok-token|linkedin-token|hubspot-key|webhook-secret|salesforce-key/);
    const sensitiveKeys = ['accessToken', 'apiKey', 'secret'].filter(key => key in config);
    for (const key of sensitiveKeys) {
      expect(response.body.config[key]).toBe('[REDACTED]');
    }
  });

  it('validates webhook URLs while preserving optional secret redaction', async () => {
    const invalid = await testServer.request('/api/connectors', {
      method: 'POST',
      body: {
        type: 'WEBHOOK_EXPORT',
        name: 'Invalid webhook',
        config: { targetUrl: 'javascript:alert(1)', secret: 'must-not-leak' },
      },
    });

    expect(invalid.status).toBe(400);
    expect(invalid.body.error).toContain('HTTP(S)');
    expect(state.createConnector).not.toHaveBeenCalled();

    const validConfig = { targetUrl: 'https://hooks.example.test/valid', secret: 'must-not-leak' };
    state.createConnector.mockResolvedValue(connectorFor('WEBHOOK_EXPORT', validConfig));
    const valid = await testServer.request('/api/connectors', {
      method: 'POST',
      body: { type: 'WEBHOOK_EXPORT', name: 'Valid webhook', config: validConfig },
    });

    expect(valid.status).toBe(201);
    expect(valid.body.config.targetUrl).toBe(validConfig.targetUrl);
    expect(valid.body.config.secret).toBe('[REDACTED]');
    expect(valid.text).not.toContain(validConfig.secret);
  });

  it('lists and checks all nine types using the authenticated owner scope', async () => {
    const connectors = CONNECTOR_CASES.map(({ type, config }) => connectorFor(type, config));
    state.listConnectors.mockResolvedValue(connectors);

    const list = await testServer.request('/api/connectors');
    expect(list.status).toBe(200);
    expect(state.listConnectors).toHaveBeenCalledWith(TENANT_ID, USER_A);
    expect(list.body).toHaveLength(CONNECTOR_CASES.length);
    expect(list.text).not.toMatch(/facebook-token|zalo-token|instagram-token|tiktok-token|linkedin-token|hubspot-key|webhook-secret|salesforce-key/);

    for (const { type, config } of CONNECTOR_CASES) {
      const connector = connectorFor(type, config);
      state.findConnector.mockResolvedValue(connector);

      const check = await testServer.request(`/api/connectors/${connector.id}/check`, { method: 'POST' });

      expect(check.status).toBe(200);
      expect(check.body).toMatchObject({
        ok: true,
        depth: 'CONFIGURATION',
        providerVerified: false,
        status: 'CONFIGURED',
      });
      expect(state.findConnector).toHaveBeenLastCalledWith(TENANT_ID, USER_A, connector.id);
    }
  });

  it.each(CONNECTOR_CASES)('keeps update and delete scoped for %s', async ({ type, config }) => {
    const connector = connectorFor(type, config);
    state.findConnector.mockResolvedValue(connector);
    state.updateConnector.mockResolvedValue({ ...connector, name: 'Updated by user A' });
    state.deleteConnector.mockResolvedValue(true);

    const update = await testServer.request(`/api/connectors/${connector.id}`, {
      method: 'PUT',
      body: { name: 'Updated by user A' },
    });
    expect(update.status).toBe(200);
    expect(state.updateConnector).toHaveBeenCalledWith(TENANT_ID, USER_A, connector.id, {
      name: 'Updated by user A',
    });

    const deletion = await testServer.request(`/api/connectors/${connector.id}`, { method: 'DELETE' });
    expect(deletion.status).toBe(200);
    expect(state.deleteConnector).toHaveBeenCalledWith(TENANT_ID, USER_A, connector.id);
  });

  it('does not let user B see, check, update, delete, or sync user A credentials', async () => {
    const connector = connectorFor('HUBSPOT', { apiKey: 'user-a-secret' });
    state.listConnectors.mockResolvedValue([]);
    state.findConnector.mockResolvedValue(null);
    state.deleteConnector.mockResolvedValue(false);

    const list = await testServer.request('/api/connectors', { userId: USER_B });
    const check = await testServer.request(`/api/connectors/${connector.id}/check`, { method: 'POST', userId: USER_B });
    const update = await testServer.request(`/api/connectors/${connector.id}`, {
      method: 'PUT',
      userId: USER_B,
      body: { name: 'Hijacked' },
    });
    const deletion = await testServer.request(`/api/connectors/${connector.id}`, {
      method: 'DELETE',
      userId: USER_B,
    });
    const sync = await testServer.request(`/api/connectors/${connector.id}/sync`, {
      method: 'POST',
      userId: USER_B,
    });

    expect(list.status).toBe(200);
    expect(list.body).toEqual([]);
    expect(check.status).toBe(404);
    expect(update.status).toBe(404);
    expect(deletion.status).toBe(404);
    expect(sync.status).toBe(404);
    expect(state.listConnectors).toHaveBeenCalledWith(TENANT_ID, USER_B);
    expect(state.findConnector).toHaveBeenCalledWith(TENANT_ID, USER_B, connector.id);
    expect(state.updateConnector).not.toHaveBeenCalled();
    expect(state.deleteConnector).toHaveBeenCalledWith(TENANT_ID, USER_B, connector.id);
    expect(state.createJob).not.toHaveBeenCalled();
  });

  it.each([
    'FACEBOOK_PAGE',
    'ZALO_OA',
    'INSTAGRAM',
    'TIKTOK',
    'LINKEDIN_PAGE',
  ])('does not start a data sync for social connector %s', async type => {
    const connector = connectorFor(type, { accessToken: `${type}-secret`, pageId: 'page-a' });
    state.findConnector.mockResolvedValue(connector);

    const response = await testServer.request(`/api/connectors/${connector.id}/sync`, { method: 'POST' });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('CONNECTOR_SYNC_NOT_SUPPORTED');
    expect(state.createJob).not.toHaveBeenCalled();
  });
});