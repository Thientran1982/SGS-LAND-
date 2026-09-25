import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('internalSecrets (audit H1)', () => {
  beforeEach(() => { vi.resetModules(); });

  it('derived fallback never exposes the JWT secret prefix', async () => {
    process.env.JWT_SECRET = 'a'.repeat(64);
    const { internalFallbackSecret } = await import('../config/internalSecrets');
    const s = internalFallbackSecret();
    expect(s).toHaveLength(48);
    expect(s).not.toContain('a'.repeat(32));
    expect(internalFallbackSecret()).toBe(s);
  });

  it('safeSecretEqual compares in constant time and rejects empties', async () => {
    const { safeSecretEqual } = await import('../config/internalSecrets');
    expect(safeSecretEqual('abc', 'abc')).toBe(true);
    expect(safeSecretEqual('abc', 'abd')).toBe(false);
    expect(safeSecretEqual('', '')).toBe(false);
    expect(safeSecretEqual(undefined, 'abc')).toBe(false);
    expect(safeSecretEqual(['abc'], 'abc')).toBe(false);
  });
});

describe('requirePlatformAdmin (audit C2)', () => {
  const run = async (user: any) => {
    const { requirePlatformAdmin } = await import('../middleware/requireRole');
    const { DEFAULT_TENANT_ID } = await import('../constants');
    const res: any = { statusCode: 200, status(c: number) { this.statusCode = c; return this; }, json() { return this; } };
    const next = vi.fn();
    requirePlatformAdmin({ user: typeof user === 'function' ? user(DEFAULT_TENANT_ID) : user } as any, res, next);
    return { status: res.statusCode, nextCalled: next.mock.calls.length > 0 };
  };

  it('blocks a vendor workspace ADMIN', async () => {
    const r = await run({ role: 'ADMIN', tenantId: '11111111-1111-1111-1111-111111111111' });
    expect(r).toEqual({ status: 403, nextCalled: false });
  });

  it('blocks SUPER_ADMIN of another tenant', async () => {
    const r = await run({ role: 'SUPER_ADMIN', tenantId: '11111111-1111-1111-1111-111111111111' });
    expect(r.status).toBe(403);
  });

  it('allows host-tenant SUPER_ADMIN', async () => {
    const r = await run((t: string) => ({ role: 'SUPER_ADMIN', tenantId: t }));
    expect(r).toEqual({ status: 200, nextCalled: true });
  });
});
