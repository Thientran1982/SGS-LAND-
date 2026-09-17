import express from 'express';
import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  generateContent: vi.fn(),
}));

vi.mock('../db', () => ({
  pool: { query: mocks.query },
}));
vi.mock('../middleware/rateLimiter', () => ({
  apiRateLimit: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent: mocks.generateContent };
  },
}));

import { agentTeachRouter, agentVoiceRouter } from '../routes/agentVoiceTeachRoutes';

type TestUser = {
  id?: string;
  name?: string;
  tenantId?: string;
};

async function startServer(user: TestUser) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = user;
    next();
  });
  app.use('/voice', agentVoiceRouter);
  app.use('/teach', agentTeachRouter);

  const server = await new Promise<Server>(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not expose a port');
  return { server, origin: `http://127.0.0.1:${address.port}` };
}

describe('voice and teach tenant boundaries', () => {
  let server: Server;
  let origin: string;

  beforeEach(async () => {
    mocks.query.mockReset();
    mocks.generateContent.mockReset();
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    ({ server, origin } = await startServer({ id: 'user-a', name: 'User A', tenantId: 'tenant-a' }));
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await new Promise<void>(resolve => server.close(() => resolve()));
  });

  it('fails closed for voice, teach, and teach extraction when tenant identity is missing', async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
    ({ server, origin } = await startServer({ id: 'user-a', name: 'User A' }));

    const responses = await Promise.all([
      fetch(`${origin}/voice`),
      fetch(`${origin}/teach`),
      fetch(`${origin}/teach/recording-a/extract`, { method: 'POST' }),
    ]);

    expect(responses.map(response => response.status)).toEqual([403, 403, 403]);
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.generateContent).not.toHaveBeenCalled();
  });

  it('cannot patch a voice call owned by another tenant', async () => {
    mocks.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const response = await fetch(`${origin}/voice/call-from-tenant-b`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ENDED', duration_sec: 120 }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Cuoc goi khong ton tai' });
    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE id = $1 AND tenant_id = $5'),
      ['call-from-tenant-b', 'ENDED', 120, null, 'tenant-a'],
    );
  });

  it('does not extract a teaching recording from another tenant', async () => {
    mocks.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const response = await fetch(`${origin}/teach/recording-from-tenant-b/extract`, { method: 'POST' });

    expect(response.status).toBe(404);
    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE tenant_id = $1 AND id = $2'),
      ['tenant-a', 'recording-from-tenant-b'],
    );
    expect(mocks.generateContent).not.toHaveBeenCalled();
  });

  it('keeps extraction writes tenant-scoped and hides provider failures', async () => {
    mocks.query.mockResolvedValueOnce({
      rows: [{ id: 'recording-a', title: 'Qualify', transcript: 'Ask budget and timeline.' }],
      rowCount: 1,
    });
    mocks.generateContent.mockResolvedValueOnce({ text: '- Ask budget\n- Confirm timeline' });
    mocks.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const success = await fetch(`${origin}/teach/recording-a/extract`, { method: 'POST' });
    expect(success.status).toBe(200);
    expect(await success.json()).toEqual({ steps: ['Ask budget', 'Confirm timeline'] });
    expect(mocks.query).toHaveBeenLastCalledWith(
      expect.stringContaining("status = 'EXTRACTED' WHERE id = $1 AND tenant_id = $3"),
      ['recording-a', JSON.stringify({ steps: ['Ask budget', 'Confirm timeline'] }), 'tenant-a'],
    );

    mocks.query.mockReset();
    mocks.generateContent.mockReset();
    mocks.query.mockResolvedValueOnce({
      rows: [{ id: 'recording-a', title: 'Qualify', transcript: 'Ask budget and timeline.' }],
      rowCount: 1,
    });
    mocks.generateContent.mockRejectedValueOnce(new Error('provider-secret=must-not-leak'));

    const failure = await fetch(`${origin}/teach/recording-a/extract`, { method: 'POST' });
    const failureBody = await failure.json();
    expect(failure.status).toBe(500);
    expect(failureBody).toEqual({ error: 'Trich buoc that bai' });
    expect(JSON.stringify(failureBody)).not.toContain('provider-secret');
  });

  it('does not promote a teaching recording from another tenant', async () => {
    mocks.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const response = await fetch(`${origin}/teach/recording-from-tenant-b/promote`, {
      method: 'POST',
    });

    expect(response.status).toBe(404);
    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE tenant_id = $1 AND id = $2'),
      ['tenant-a', 'recording-from-tenant-b'],
    );
  });

  it('keeps promoted skills and recording status in the active tenant', async () => {
    mocks.query
      .mockResolvedValueOnce({
        rows: [{
          id: 'recording-a',
          title: 'Qualify',
          scenario: 'Inbound lead',
          transcript: 'Ask budget.',
          extracted_steps: { steps: ['Ask budget'] },
        }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{ id: 'skill-a', skill_key: 'taught-record', title: 'Qualify', version: 1 }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [{ id: 'recording-a' }], rowCount: 1 });

    const response = await fetch(`${origin}/teach/recording-a/promote`, { method: 'POST' });

    expect(response.status).toBe(200);
    expect((await response.json()).skill).toEqual({
      id: 'skill-a',
      skill_key: 'taught-record',
      title: 'Qualify',
      version: 1,
    });
    expect(mocks.query.mock.calls[1][1][0]).toBe('tenant-a');
    expect(mocks.query).toHaveBeenLastCalledWith(
      expect.stringContaining("status = 'APPROVED' WHERE id = $1 AND tenant_id = $3"),
      ['recording-a', 'skill-a', 'tenant-a'],
    );
  });
});