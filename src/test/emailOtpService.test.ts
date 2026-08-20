import { describe, expect, it, vi, beforeEach } from 'vitest';

const withRlsBypass = vi.fn();
vi.mock('../../server/db', () => ({ withRlsBypass }));

async function loadService() {
  return import('../../server/services/emailOtpService');
}

function clientForIssue(count = 0, oldest?: Date) {
  const queries: Array<{ sql: string; params?: unknown[] }> = [];
  const client = {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      queries.push({ sql, params });
      if (sql.includes('COUNT(*)')) return { rows: [{ count, oldest }] };
      return { rows: [] };
    }),
  };
  withRlsBypass.mockImplementationOnce(async (fn: (client: any) => unknown) => fn(client));
  return { client, queries };
}

function clientForVerify(row: Record<string, unknown> | undefined) {
  const queries: Array<{ sql: string; params?: unknown[] }> = [];
  const client = {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      queries.push({ sql, params });
      if (sql.includes('SELECT * FROM email_otp_challenges')) return { rows: row ? [row] : [] };
      return { rows: [] };
    }),
  };
  withRlsBypass.mockImplementationOnce(async (fn: (client: any) => unknown) => fn(client));
  return { client, queries };
}

describe('email OTP service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a six-digit OTP, hashes it, expires it in five minutes, and invalidates prior challenges', async () => {
    const { issueEmailOtp } = await loadService();
    const { client, queries } = clientForIssue();
    const result = await issueEmailOtp({
      tenantId: 'tenant-1',
      userId: 'user-1',
      email: ' User@Example.com ',
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.code).toMatch(/^\d{6}$/);
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now() + 4 * 60 * 1000);
    expect(result.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 5 * 60 * 1000 + 1000);
    const insert = queries.find((query) => query.sql.includes('INSERT INTO email_otp_challenges'));
    expect(insert?.params?.[2]).toBe('user@example.com');
    expect(insert?.params?.[3]).toMatch(/^[a-f0-9]{64}$/);
    expect(insert?.params?.[3]).not.toBe(result.code);
    expect(queries.some((query) => query.sql.includes('pg_advisory_xact_lock'))).toBe(true);
    expect(queries.some((query) => query.sql.includes('SET consumed_at = NOW()'))).toBe(true);
    expect(client.query).toHaveBeenCalled();
  });

  it('blocks the fourth request inside the rolling fifteen-minute window', async () => {
    const { issueEmailOtp } = await loadService();
    const { queries } = clientForIssue(3, new Date(Date.now() - 60_000));
    const result = await issueEmailOtp({
      tenantId: 'tenant-1',
      userId: 'user-1',
      email: 'user@example.com',
    });

    expect(result).toMatchObject({ ok: false, reason: 'RATE_LIMITED' });
    expect(queries.some((query) => query.sql.includes('INSERT INTO email_otp_challenges'))).toBe(false);
  });

  it('accepts the current code once and consumes it so replay is rejected', async () => {
    const { issueEmailOtp, verifyEmailOtp } = await loadService();
    const issued = clientForIssue();
    const created = await issueEmailOtp({ tenantId: 'tenant-1', userId: 'user-1', email: 'user@example.com' });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const codeHash = (issued.queries.find((query) => query.sql.includes('INSERT INTO email_otp_challenges'))?.params?.[3]) as string;

    const first = clientForVerify({
      id: 'otp-1',
      tenant_id: 'tenant-1',
      user_id: 'user-1',
      code_hash: codeHash,
      expires_at: new Date(Date.now() + 60_000),
      attempts: 0,
    });
    await expect(verifyEmailOtp({ email: 'USER@example.com', code: created.code })).resolves.toEqual({
      ok: true,
      tenantId: 'tenant-1',
      userId: 'user-1',
    });
    expect(first.queries.some((query) => query.sql.includes('consumed_at = NOW()'))).toBe(true);

    const replay = clientForVerify(undefined);
    await expect(verifyEmailOtp({ email: 'user@example.com', code: created.code })).resolves.toEqual({
      ok: false,
      reason: 'NOT_FOUND',
    });
    expect(replay.client.query).toHaveBeenCalled();
  });

  it('returns remaining attempts and consumes after the fifth incorrect code', async () => {
    const { verifyEmailOtp } = await loadService();
    for (let attempts = 0; attempts < 5; attempts += 1) {
      const client = clientForVerify({
        id: `otp-${attempts}`,
        tenant_id: 'tenant-1',
        user_id: 'user-1',
        code_hash: '0'.repeat(64),
        expires_at: new Date(Date.now() + 60_000),
        attempts,
      });
      const result = await verifyEmailOtp({ email: 'user@example.com', code: '000000' });
      if (attempts < 4) {
        expect(result).toEqual({ ok: false, reason: 'INVALID', attemptsRemaining: 4 - attempts });
      } else {
        expect(result).toEqual({ ok: false, reason: 'TOO_MANY_ATTEMPTS' });
        expect(client.queries.some((query) => query.sql.includes('consumed_at = CASE'))).toBe(true);
      }
    }
  });

  it('rejects expired challenges and malformed codes without comparing plaintext values', async () => {
    const { verifyEmailOtp } = await loadService();
    const { queries } = clientForVerify({
      id: 'otp-expired',
      tenant_id: 'tenant-1',
      user_id: 'user-1',
      code_hash: '0'.repeat(64),
      expires_at: new Date(Date.now() - 1),
      attempts: 0,
    });

    await expect(verifyEmailOtp({ email: 'user@example.com', code: 'not-a-code' })).resolves.toEqual({
      ok: false,
      reason: 'EXPIRED',
    });
    expect(queries.some((query) => JSON.stringify(query.params || []).includes('not-a-code'))).toBe(false);
    expect(queries.some((query) => query.sql.includes('consumed_at = NOW()'))).toBe(true);
  });
});