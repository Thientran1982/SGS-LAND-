import { createHash, createHmac, timingSafeEqual } from 'crypto';

/**
 * Fallback secret for internal cron/webhook endpoints when a dedicated
 * *_CRON_SECRET env var is not configured.
 *
 * Previously every endpoint fell back to `JWT_SECRET.slice(0, 32)`, which
 * exposed half of the session-signing key to every scheduler caller. This
 * value is an HMAC derived from JWT_SECRET instead: it is stable across
 * restarts (so in-process callers and routers still agree) but reveals
 * nothing about the JWT signing key. Set dedicated secrets in production.
 */
let cached: string | null = null;
let warned = false;
export function internalFallbackSecret(): string {
  if (cached !== null) return cached;
  const base = process.env.JWT_SECRET || '';
  if (!base) { cached = ''; return cached; }
  if (!warned && process.env.NODE_ENV === 'production') {
    warned = true;
    console.warn('[secrets] One or more *_CRON_SECRET env vars are missing; using the derived internal fallback secret. Configure dedicated secrets per endpoint.');
  }
  cached = createHmac('sha256', base).update('sgs-internal-cron-fallback-v1').digest('hex').slice(0, 48);
  return cached;
}

/** Constant-time comparison for shared secrets of any length. */
export function safeSecretEqual(provided: unknown, expected: string | undefined | null): boolean {
  if (typeof provided !== 'string' || !provided || !expected) return false;
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}
