import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import type { Server } from 'http';
import { csrfTokenIssuer, csrfProtection, csrfTokenHandler } from '../../../server/middleware/security';

// Mock DB so the audit middleware records without a real Postgres.
const queryMock = vi.fn().mockResolvedValue({ rows: [] });
vi.mock('../../../server/db', () => ({ pool: { query: (...a: any[]) => queryMock(...a) } }));
vi.mock('../../../server/middleware/logger', () => ({
  logger: { audit: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));
import { globalMutationAudit } from '../../../server/middleware/auditLog';

let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(csrfTokenIssuer);
  app.get('/api/csrf-token', csrfTokenHandler);
  app.use(csrfProtection);
  // Fake per-route auth that sets req.user AFTER csrf, as in production.
  const auth = (req: any, _res: any, next: any) => {
    req.user = { id: 'user-1', tenantId: 'tenant-1' };
    req.tenantId = 'tenant-1';
    next();
  };
  app.use(globalMutationAudit);
  app.delete('/api/users/:id', auth, (req, res) => res.json({ deleted: req.params.id }));
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const a = server.address();
      base = `http://127.0.0.1:${typeof a === 'object' && a ? a.port : 0}`;
      resolve();
    });
  });
});

afterAll(() => new Promise<void>((r) => server.close(() => r())));

describe('E2E: bootstrap CSRF -> authorized DELETE -> audit trail', () => {
  it('completes the full happy-path flow and writes an audit record', async () => {
    queryMock.mockClear();

    // Step 1: SPA bootstraps its CSRF token.
    const boot = await fetch(`${base}/api/csrf-token`);
    const token = (await boot.json()).csrfToken;
    const cookie = boot.headers.get('set-cookie')!.split(';')[0];
    expect(token).toBeTruthy();

    // Step 2: perform a sensitive DELETE with the token echoed back.
    const del = await fetch(`${base}/api/users/user-99`, {
      method: 'DELETE',
      headers: { 'X-CSRF-Token': token, Cookie: cookie },
    });
    expect(del.status).toBe(200);
    expect((await del.json()).deleted).toBe('user-99');

    // Step 3: audit trail was written for the DELETE (allow finish handler).
    await new Promise((r) => setTimeout(r, 30));
    expect(queryMock).toHaveBeenCalled();
    const params = queryMock.mock.calls[0][1];
    expect(params).toContain('USER_DELETE');
    expect(params).toContain('tenant-1');
  });

  it('a forged DELETE (no token) is blocked and leaves no audit trail', async () => {
    queryMock.mockClear();
    const res = await fetch(`${base}/api/users/user-99`, { method: 'DELETE' });
    expect(res.status).toBe(403);
    await new Promise((r) => setTimeout(r, 30));
    expect(queryMock).not.toHaveBeenCalled();
  });
});
