import crypto from 'crypto';
import { withRlsBypass } from '../db';

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_ISSUES = 3;
const ISSUE_WINDOW_MS = 15 * 60 * 1000;

export type OtpLocale = 'vn' | 'en';

function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export async function issueEmailOtp(input: {
  tenantId: string;
  userId: string;
  email: string;
  locale?: string;
}): Promise<
  | { ok: true; code: string; expiresAt: Date; remaining: number }
  | { ok: false; reason: 'RATE_LIMITED'; retryAfterSeconds: number }
> {
  const email = input.email.trim().toLowerCase();
  return withRlsBypass(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`email-otp:${email}`]);
    const recent = await client.query(
      `SELECT COUNT(*)::int AS count, MIN(created_at) AS oldest
         FROM email_otp_challenges
        WHERE LOWER(email) = $1 AND created_at > NOW() - INTERVAL '15 minutes'`,
      [email],
    );
    const count = Number(recent.rows[0]?.count || 0);
    if (count >= MAX_ISSUES) {
      const oldest = recent.rows[0]?.oldest ? new Date(recent.rows[0].oldest).getTime() : Date.now();
      return {
        ok: false,
        reason: 'RATE_LIMITED',
        retryAfterSeconds: Math.max(1, Math.ceil((oldest + ISSUE_WINDOW_MS - Date.now()) / 1000)),
      };
    }

    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);
    await client.query(
      `UPDATE email_otp_challenges
          SET consumed_at = NOW()
        WHERE user_id = $1 AND consumed_at IS NULL`,
      [input.userId],
    );
    await client.query(
      `INSERT INTO email_otp_challenges
        (tenant_id, user_id, email, code_hash, locale, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [input.tenantId, input.userId, email, hashCode(code), input.locale === 'en' ? 'en' : 'vn', expiresAt],
    );
    return { ok: true, code, expiresAt, remaining: MAX_ISSUES - count - 1 };
  });
}

export async function verifyEmailOtp(input: {
  email: string;
  code: string;
}): Promise<
  | { ok: true; tenantId: string; userId: string }
  | { ok: false; reason: 'INVALID' | 'EXPIRED' | 'TOO_MANY_ATTEMPTS' | 'NOT_FOUND'; attemptsRemaining?: number }
> {
  const email = input.email.trim().toLowerCase();
  const code = input.code.trim();
  return withRlsBypass(async (client) => {
      const result = await client.query(
        `SELECT * FROM email_otp_challenges
          WHERE LOWER(email) = $1 AND consumed_at IS NULL
          ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
        [email],
      );
      const row = result.rows[0];
      if (!row) {
        return { ok: false, reason: 'NOT_FOUND' as const };
      }
      if (new Date(row.expires_at).getTime() <= Date.now()) {
        await client.query('UPDATE email_otp_challenges SET consumed_at = NOW() WHERE id = $1', [row.id]);
        return { ok: false, reason: 'EXPIRED' as const };
      }
      if (Number(row.attempts) >= MAX_ATTEMPTS) {
        await client.query('UPDATE email_otp_challenges SET consumed_at = NOW() WHERE id = $1', [row.id]);
        return { ok: false, reason: 'TOO_MANY_ATTEMPTS' as const };
      }
      const valid = /^[0-9]{6}$/.test(code) && safeEqualHex(hashCode(code), row.code_hash);
      if (!valid) {
        const attempts = Number(row.attempts) + 1;
        await client.query(
          `UPDATE email_otp_challenges
              SET attempts = $2, consumed_at = CASE WHEN $2 >= $3 THEN NOW() ELSE consumed_at END
            WHERE id = $1`,
          [row.id, attempts, MAX_ATTEMPTS],
        );
        return attempts >= MAX_ATTEMPTS
          ? { ok: false, reason: 'TOO_MANY_ATTEMPTS' as const }
          : { ok: false, reason: 'INVALID' as const, attemptsRemaining: MAX_ATTEMPTS - attempts };
      }
      await client.query('UPDATE email_otp_challenges SET consumed_at = NOW() WHERE id = $1', [row.id]);
      return { ok: true, tenantId: row.tenant_id as string, userId: row.user_id as string };
  });
}

export const emailOtpLimits = { maxAttempts: MAX_ATTEMPTS, ttlSeconds: OTP_TTL_MS / 1000 };