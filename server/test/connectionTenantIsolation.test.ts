import express from 'express';
import { request as httpRequest } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  poolQuery: vi.fn(),
  listConnectors: vi.fn(),
  createConnector: vi.fn(),
  findConnector: vi.fn(),
  updateConnector: vi.fn(),
  deleteConnector: vi.fn(),
}));

vi.mock('../db', () => ({
  pool: { query: state.poolQuery },
}));

vi.mock('../middleware/rateLimiter', () => ({
  apiRateLimit: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../repositories/connectorRepository', () => ({
  connectorRepository: {
    listByTenant: state.listConnectors,
    create: state.createConnector,
    findById: state.findConnector,
    update: state.updateConnector,
    delete: state.deleteConnector,
  },
  syncJobRepository: {
    create: vi.fn(),
    update: vi.fn(),
    listByTenant: vi.fn(),
    findById: vi.fn(),
  },
}));

import { agentMcpRouter } from '../routes/agentMcpRoutes';
import { createConnectorRoutes } from '../routes/connectorRoutes';

const TENANT_A = 'tenant-a';
const MCP_ID = 'mcp-a';
const CONNECTOR_ID = 'connector-a';

type TestResponse = {
  status: number;
  body: any;
  text: string;
};

function connectorWithSecrets(overrides: Record<string, unknown> = {}) {
  return {
    id: CONNECTOR_ID,
    tenantId: TENANT_A,
    type: 'HUBSPOT',
    name: 'Tenant A CRM',
    status: 'ACTIVE',
    config: {
      apiKey: 'api-key-should-never-leave-server',
      accessToken: 'access-token-should-never-leave-server',
      clientSecret: 'client-secret-should-never-leave-server',
      secret: 'secret-should-never-leave-server',
      spreadsheetId: 'safe-public-identifier',
    },
    ...overrides,
  };
}

function mcpQueryResult(text: string, values: unknown[]) {
  if (text.startsWith('SELECT id, url, transport')) {
    return { rows: [{ id: MCP_ID, url: 'https://mcp.example.test', transport: 'http' }] };
  }
  if (text.startsWith('SELECT id, name, url, transport')) {
    return { rows: [{ id: MCP_ID, name: 'Tenant A MCP', url: 'https://mcp.example.test', transport: 'http' }] };
  }
  if (text.startsWith('INSERT INTO agent_mcp_servers')) {
    return {
      rows: [{ id: MCP_ID, name: 'Tenant A MCP', url: 'https://mcp.example.test', transport: 'http', enabled: true }],
    };
  }
  if (text.startsWith('UPDATE agent_mcp_servers')) {
    return { rowCount: 1, rows: [{ id: MCP_ID, name: 'Tenant A MCP', url: 'https://mcp.example.test', enabled: false }] };
  }
  if (text.startsWith('DELETE FROM agent_mcp_servers')) {
    return { rowCount: 1, rows: [] };
  }
  throw new Error(`Unexpected MCP query: ${text} (${JSON.stringify(values)})`);
}

async function startTestServer() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = {
      id: 'user-a',
      tenantId: req.header('x-tenant-id') || TENANT_A,
      role: req.header('x-role') || 'ADMIN',
    };
    next();
  });
  app.use('/api/admin/mcp-servers', agentMcpRouter);
  app.use('/api/connectors', createConnectorRoutes((_req: express.Request, _res: express.Response, next: express.NextFunction) => next()));

  const server = app.listen(0);
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not expose a TCP port');

  return {
    server,
    request: (path: string, options: { method?: string; body?: unknown; role?: string; tenantId?: string } = {}) =>
      new Promise<TestResponse>((resolve, reject) => {
        const body = options.body === undefined ? undefined : JSON.stringify(options.body);
        const req = httpRequest({
          hostname: '127.0.0.1',
          port: address.port,
          path,
          method: options.method || 'GET',
          headers: {
            ...(body ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) } : {}),
            'x-role': options.role || 'ADMIN',
            'x-tenant-id': options.tenantId || TENANT_A,
          },
        }, response => {
          const chunks: Buffer[] = [];
          response.on('data', chunk => chunks.push(Buffer.from(chunk)));
          response.on('end', () => {
            const text = Buffer.concat(chunks).toString('utf8');
            let parsed: any = null;
            try {
              parsed = text ? JSON.parse(text) : null;
            } catch {
              parsed = null;
            }
            resolve({ status: response.statusCode || 0, body: parsed, text });
          });
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
      }),
  };
}

describe('API and MCP connection tenant isolation', () => {
  let testServer: Awaited<ReturnType<typeof startTestServer>>;

  beforeAll(async () => {
    testServer = await startTestServer();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    state.poolQuery.mockImplementation((text: string, values: unknown[]) => mcpQueryResult(text, values));
    state.listConnectors.mockResolvedValue([connectorWithSecrets()]);
    state.createConnector.mockResolvedValue(connectorWithSecrets({ name: 'Created connector' }));
    state.findConnector.mockResolvedValue(connectorWithSecrets());
    state.updateConnector.mockResolvedValue(connectorWithSecrets({ name: 'Updated connector' }));
    state.deleteConnector.mockResolvedValue(true);
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      testServer.server.close(error => error ? reject(error) : resolve()),
    );
  });

  it('uses the authenticated tenant for every MCP GET, POST, PATCH, DELETE, and test query', async () => {
    const list = await testServer.request('/api/admin/mcp-servers');
    expect(list.status).toBe(200);
    expect(state.poolQuery).toHaveBeenCalledWith(expect.stringContaining('FROM agent_mcp_servers WHERE tenant_id = $1'), [TENANT_A]);

    const created = await testServer.request('/api/admin/mcp-servers', {
      method: 'POST',
      body: { name: 'Tenant A MCP', url: 'https://mcp.example.test' },
    });
    expect(created.status).toBe(201);
    expect(state.poolQuery).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO agent_mcp_servers'), [
      TENANT_A,
      'Tenant A MCP',
      'https://mcp.example.test',
      'http',
      null,
      true,
    ]);

    const patched = await testServer.request(`/api/admin/mcp-servers/${MCP_ID}`, {
      method: 'PATCH',
      body: { enabled: false },
    });
    expect(patched.status).toBe(200);
    expect(state.poolQuery).toHaveBeenCalledWith(expect.stringContaining('WHERE id = $1 AND tenant_id = $5'), [
      MCP_ID,
      false,
      null,
      null,
      TENANT_A,
    ]);

    const deleted = await testServer.request(`/api/admin/mcp-servers/${MCP_ID}`, { method: 'DELETE' });
    expect(deleted.status).toBe(200);
    expect(state.poolQuery).toHaveBeenCalledWith(
      'DELETE FROM agent_mcp_servers WHERE id = $1 AND tenant_id = $2',
      [MCP_ID, TENANT_A],
    );

    const providerFetch = vi.fn().mockResolvedValue({
      status: 200,
      text: async () => JSON.stringify({ result: { tools: [{ name: 'search' }] } }),
    });
    vi.stubGlobal('fetch', providerFetch);
    const tested = await testServer.request(`/api/admin/mcp-servers/${MCP_ID}/test`, { method: 'POST' });
    vi.unstubAllGlobals();

    expect(tested.status).toBe(200);
    expect(providerFetch).toHaveBeenCalledOnce();
    const testQueries = state.poolQuery.mock.calls.filter(([text]) =>
      String(text).includes('agent_mcp_servers'),
    );
    expect(testQueries).toContainEqual([
      'SELECT id, url, transport FROM agent_mcp_servers WHERE id = $1 AND tenant_id = $2',
      [MCP_ID, TENANT_A],
    ]);
    expect(testQueries).toContainEqual([
      expect.stringContaining('WHERE id = $1 AND tenant_id = $4'),
      [MCP_ID, '200', ['search'], TENANT_A],
    ]);
  });

  it('does not expose connector API keys, access tokens, or secrets in list, create, or update responses', async () => {
    const list = await testServer.request('/api/connectors');
    const create = await testServer.request('/api/connectors', {
      method: 'POST',
      body: { type: 'HUBSPOT', name: 'Created connector', config: { apiKey: 'new-api-key' } },
    });
    const update = await testServer.request(`/api/connectors/${CONNECTOR_ID}`, {
      method: 'PUT',
      body: { name: 'Updated connector', config: { apiKey: 'updated-api-key' } },
    });

    for (const response of [list, create, update]) {
      expect(response.status).toBeLessThan(300);
      expect(response.text).not.toContain('api-key-should-never-leave-server');
      expect(response.text).not.toContain('access-token-should-never-leave-server');
      expect(response.text).not.toContain('client-secret-should-never-leave-server');
      expect(response.text).not.toContain('secret-should-never-leave-server');
      expect(response.body).toBeTruthy();
    }
    expect(list.body[0].config).toMatchObject({
      apiKey: '[REDACTED]',
      accessToken: '[REDACTED]',
      clientSecret: '[REDACTED]',
      secret: '[REDACTED]',
      spreadsheetId: 'safe-public-identifier',
    });
    expect(create.body.config.apiKey).toBe('[REDACTED]');
    expect(update.body.config.apiKey).toBe('[REDACTED]');

    expect(state.listConnectors).toHaveBeenCalledWith(TENANT_A);
    expect(state.createConnector).toHaveBeenCalledWith(TENANT_A, {
      type: 'HUBSPOT',
      name: 'Created connector',
      config: { apiKey: 'new-api-key' },
    });
    expect(state.findConnector).toHaveBeenCalledWith(TENANT_A, CONNECTOR_ID);
    expect(state.updateConnector).toHaveBeenCalledWith(TENANT_A, CONNECTOR_ID, {
      name: 'Updated connector',
      config: { apiKey: 'updated-api-key' },
    });
  });

  it('uses the authenticated tenant for connector update and delete lookups', async () => {
    const update = await testServer.request(`/api/connectors/${CONNECTOR_ID}`, {
      method: 'PUT',
      body: { name: 'Tenant A update' },
    });
    const deleted = await testServer.request(`/api/connectors/${CONNECTOR_ID}`, { method: 'DELETE' });

    expect(update.status).toBe(200);
    expect(deleted.status).toBe(200);
    expect(state.findConnector).toHaveBeenCalledWith(TENANT_A, CONNECTOR_ID);
    expect(state.updateConnector).toHaveBeenCalledWith(TENANT_A, CONNECTOR_ID, { name: 'Tenant A update' });
    expect(state.deleteConnector).toHaveBeenCalledWith(TENANT_A, CONNECTOR_ID);
  });

  it('returns 403 and does not create an MCP server or connector for non-admin users', async () => {
    const mcp = await testServer.request('/api/admin/mcp-servers', {
      method: 'POST',
      role: 'AGENT',
      body: { name: 'Should be rejected', url: 'https://mcp.example.test' },
    });
    const connector = await testServer.request('/api/connectors', {
      method: 'POST',
      role: 'AGENT',
      body: { type: 'HUBSPOT', name: 'Should be rejected', config: { apiKey: 'not-created' } },
    });

    expect(mcp.status).toBe(403);
    expect(connector.status).toBe(403);
    expect(state.poolQuery).not.toHaveBeenCalled();
    expect(state.createConnector).not.toHaveBeenCalled();
  });
});