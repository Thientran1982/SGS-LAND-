import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the pg pool so writeAuditLog does not hit a real DB.
const queryMock = vi.fn().mockResolvedValue({ rows: [] });
vi.mock('../../../server/db', () => ({ pool: { query: (...a: any[]) => queryMock(...a) } }));
vi.mock('../../../server/middleware/logger', () => ({
  logger: { audit: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import { writeAuditLog, globalMutationAudit } from '../../../server/middleware/auditLog';

function makeReq(overrides: any = {}) {
  return {
    method: 'DELETE',
    path: '/api/users/abc',
    originalUrl: '/api/users/abc',
    params: { id: 'abc' },
    ip: '10.0.0.1',
    user: { id: 'u1', tenantId: 't1' },
    ...overrides,
  } as any;
}
function makeRes() {
  const listeners: Record<string, Function[]> = {};
  return {
    statusCode: 200,
    on(ev: string, cb: Function) { (listeners[ev] ||= []).push(cb); },
    removeListener(ev: string, cb: Function) {
      listeners[ev] = (listeners[ev] || []).filter((f) => f !== cb);
    },
    emit(ev: string) { (listeners[ev] || []).slice().forEach((f) => f()); },
  } as any;
}

beforeEach(() => queryMock.mockClear());
afterEach(() => vi.clearAllMocks());

describe('audit: writeAuditLog', () => {
  it('inserts a row into audit_logs', async () => {
    await writeAuditLog('t1', 'u1', 'USER_DELETE', 'users', 'abc', { x: 1 }, '1.2.3.4');
    expect(queryMock).toHaveBeenCalledOnce();
    const sql = queryMock.mock.calls[0][0] as string;
    expect(sql).toMatch(/INSERT INTO audit_logs/i);
  });

  it('never throws even if the DB rejects', async () => {
    queryMock.mockRejectedValueOnce(new Error('db down'));
    await expect(
      writeAuditLog('t1', 'u1', 'USER_DELETE', 'users', 'abc'),
    ).resolves.toBeUndefined();
  });
});

describe('audit: globalMutationAudit (DELETE gap)', () => {
  it('logs a successful DELETE on finish', async () => {
    const req = makeReq();
    const res = makeRes();
    const next = vi.fn();
    globalMutationAudit(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    res.emit('finish');
    await Promise.resolve();
    expect(queryMock).toHaveBeenCalledOnce();
  });

  it('derives USER_DELETE action + users entity from the URL', async () => {
    const req = makeReq({ path: '/api/users/xyz', params: { id: 'xyz' } });
    const res = makeRes();
    globalMutationAudit(req, res, vi.fn());
    res.emit('finish');
    await Promise.resolve();
    const args = queryMock.mock.calls[0][1];
    expect(args).toContain('USER_DELETE');
    expect(args).toContain('users');
  });

  it('does NOT log failed DELETEs (4xx/5xx)', async () => {
    const req = makeReq();
    const res = makeRes();
    res.statusCode = 500;
    globalMutationAudit(req, res, vi.fn());
    res.emit('finish');
    await Promise.resolve();
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('skips non-DELETE methods entirely', () => {
    const req = makeReq({ method: 'GET' });
    const res = makeRes();
    const next = vi.fn();
    globalMutationAudit(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    res.emit('finish');
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('skips unauthenticated requests (no user/tenant)', async () => {
    const req = makeReq({ user: undefined });
    const res = makeRes();
    globalMutationAudit(req, res, vi.fn());
    res.emit('finish');
    await Promise.resolve();
    expect(queryMock).not.toHaveBeenCalled();
  });
});
