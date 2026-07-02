import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import type { Server } from 'http';
import { csrfTokenIssuer, csrfProtection, csrfTokenHandler } from '../../../server/middleware/security';

// Real Express app wired exactly like server.ts (cookieParser -> csrf issuer ->
// /api/csrf-token -> csrf guard -> routes), exercised over real HTTP.
let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(csrfTokenIssuer);
  app.get('/api/csrf-token', csrfTokenHandler);
  app.use(csrfProtection);
  app.post('/api/leads', (_req, res) => res.json({ created: true }));
  app.delete('/api/users/:id', (req, res) => res.json({ deleted: req.params.id }));
  app.post('/api/webhooks/zalo', (_req, res) => res.json({ ok: true }));
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      base = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

afterAll(() => new Promise<void>((r) => server.close(() => r())));

function parseCsrfCookie(setCookie: string | null): string | null {
  if (!setCookie) return null;
  const m = setCookie.match(/csrf_token=([^;]+)/);
  return m ? m[1] : null;
}

describe('INTEGRATION: CSRF over real HTTP', () => {
  it('GET /api/csrf-token issues a token + cookie', async () => {
    const res = await fetch(`${base}/api/csrf-token`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.csrfToken).toBeTruthy();
    expect(parseCsrfCookie(res.headers.get('set-cookie'))).toBeTruthy();
  });

  it('rejects POST /api/leads without a CSRF token (403)', async () => {
    const res = await fetch(`${base}/api/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'x' }),
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('EBADCSRFTOKEN');
  });

  it('accepts POST /api/leads when cookie + header match', async () => {
    const t = await fetch(`${base}/api/csrf-token`);
    const token = (await t.json()).csrfToken;
    const cookie = t.headers.get('set-cookie')!.split(';')[0];
    const res = await fetch(`${base}/api/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token, Cookie: cookie },
      body: JSON.stringify({ name: 'x' }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).created).toBe(true);
  });

  it('rejects DELETE /api/users/:id without token (403)', async () => {
    const res = await fetch(`${base}/api/users/42`, { method: 'DELETE' });
    expect(res.status).toBe(403);
  });

  it('accepts DELETE with matching token', async () => {
    const t = await fetch(`${base}/api/csrf-token`);
    const token = (await t.json()).csrfToken;
    const cookie = t.headers.get('set-cookie')!.split(';')[0];
    const res = await fetch(`${base}/api/users/42`, {
      method: 'DELETE',
      headers: { 'X-CSRF-Token': token, Cookie: cookie },
    });
    expect(res.status).toBe(200);
    expect((await res.json()).deleted).toBe('42');
  });

  it('lets webhook POSTs through without CSRF (exempt)', async () => {
    const res = await fetch(`${base}/api/webhooks/zalo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'msg' }),
    });
    expect(res.status).toBe(200);
  });
});
