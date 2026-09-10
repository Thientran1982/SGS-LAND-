import express from 'express';
import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.hoisted(() => vi.fn());

vi.mock('../db', () => ({ pool: { query } }));
vi.mock('../middleware/rateLimiter', () => ({
  apiRateLimit: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import { agentSkillsRouter } from '../routes/agentSkillsRoutes';

async function startServer(user: { id: string; tenantId: string; role: string }) {
  const app = express();
  app.use(express.json());
  app.use('/api/admin/agent-skills', (req, _res, next) => {
    (req as any).user = user;
    next();
  }, agentSkillsRouter);
  const server = await new Promise<Server>(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not expose a port');
  return { server, origin: `http://127.0.0.1:${address.port}` };
}

describe('agent skills route authorization and visibility', () => {
  let server: Server;
  let origin: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    ({ server, origin } = await startServer({
      id: 'manager-1',
      tenantId: 'tenant-1',
      role: 'MARKETING',
    }));
  });

  afterEach(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
  });

  it('rejects skill creation by a non-manager', async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
    ({ server, origin } = await startServer({
      id: 'agent-1',
      tenantId: 'tenant-1',
      role: 'AGENT',
    }));

    const response = await fetch(`${origin}/api/admin/agent-skills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skill_key: 'custom-skill', title: 'Custom', prompt_template: 'prompt' }),
    });

    expect(response.status).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });

  it('does not allow a manager to mutate a public skill owned by another tenant', async () => {
    query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const response = await fetch(`${origin}/api/admin/agent-skills/public-id`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ published: false, visibility: 'PRIVATE' }),
    });

    expect(response.status).toBe(404);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE id = $1 AND tenant_id = $4'),
      ['public-id', false, 'PRIVATE', 'tenant-1'],
    );
  });

  it('does not allow installing a private skill from another tenant', async () => {
    query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const response = await fetch(`${origin}/api/admin/agent-skills/private-id/install`, {
      method: 'POST',
    });

    expect(response.status).toBe(404);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("visibility = 'PUBLIC' AND published = TRUE"),
      ['private-id', 'tenant-1'],
    );
  });

  it('allows installing a published public skill', async () => {
    query.mockResolvedValueOnce({
      rows: [{ id: 'public-id', skill_key: 'shared-skill', install_count: 2 }],
      rowCount: 1,
    });

    const response = await fetch(`${origin}/api/admin/agent-skills/public-id/install`, {
      method: 'POST',
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      installed: { id: 'public-id', skill_key: 'shared-skill', install_count: 2 },
    });
  });
});