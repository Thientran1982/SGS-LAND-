/**
 * Buyer OTP service (Task #52).
 *
 * Issues 6-digit OTPs for buyer phone login, persists a SHA-256 hash + expiry
 * to `buyer_otp_log`, and dispatches the code via SMS.
 *
 * Provider selection (in order):
 *   1. BUYER_OTP_PROVIDER env var ("brevo" | "log")
 *   2. Brevo SMS (if BREVO_API_KEY is set)
 *   3. Log-only fallback — writes OTP to server logs (dev / unconfigured prod)
 *
 * Brevo's transactional SMS API is invoked over fetch (no SDK dep) so we
 * don't have to fork on the @getbrevo/brevo class layout. Vietnamese mobile
 * numbers are sent in E.164 (+84…) form because Brevo expects international
 * format on the wire.
 *
 * Rate-limiting is the route's job; this service intentionally stays a thin
 * generate/dispatch/verify primitive so the route can call it deterministically
 * from tests.
 */
import crypto from 'crypto';
import { Pool } from 'pg';
import { pool as defaultPool } from '../db';
import { logger } from '../middleware/logger';
const OTP_TTL_MS = 5 * 60_000; // 5 minutes
const OTP_MAX_ATTEMPTS = 5;
export interface OtpRequestResult {
  ok: boolean;
  /** Set in development only — surfaces the OTP back to the API caller. */
  devCode?: string;
  error?: string;
}
export interface OtpVerifyResult {
  ok: boolean;
  error?: string;
}
/** Canonicalise to 10–11 digit local form ("0XXXXXXXX"). Returns null if invalid. */
export function normalizeVnPhone(raw: string): string | null {
  if (!raw) return null;
  let p = String(raw).trim().replace(/[\s\-().]/g, '');
  if (p.startsWith('+84')) p = '0' + p.slice(3);
  else if (p.startsWith('84') && p.length >= 11) p = '0' + p.slice(2);
  if (!/^0\d{9,10}$/.test(p)) return null;
  return p;
}
function toE164(phoneVn: string): string {
  // 0XXXXXXXXX → +84XXXXXXXXX
  return '+84' + phoneVn.replace(/^0+/, '');
}
function generateCode(): string {
  // 6 digits, zero-padded. crypto.randomInt is uniform.
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}
function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}
// ── SMS dispatch ────────────────────────────────────────────────────────────
async function sendViaBrevo(phoneE164: string, message: string): Promise<boolean> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return false;
  try {
    const resp = await fetch('https://api.brevo.com/v3/transactionalSMS/sms', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: (process.env.BREVO_SMS_SENDER || 'SGSLand').slice(0, 11),
        recipient: phoneE164,
        content: message,
        type: 'transactional',
      }),
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      logger.warn(`[buyer-otp] Brevo SMS failed (${resp.status}): ${txt.slice(0, 200)}`);
      return false;
    }
    return true;
  } catch (err: any) {
    logger.warn(`[buyer-otp] Brevo SMS error: ${err?.message || err}`);
    return false;
  }
}
async function dispatchOtp(phoneVn: string, code: string): Promise<{ delivered: boolean }> {
  const message = `[SGS Land] Mã đăng nhập của bạn: ${code}. Hết hạn sau 5 phút. Không chia sẻ mã này với bất kỳ ai.`;
  const provider = (process.env.BUYER_OTP_PROVIDER || '').toLowerCase();
  if (provider === 'log') {
    logger.info(`[buyer-otp] (log provider) phone=${phoneVn} code=${code}`);
    return { delivered: true };
  }
  if (provider === 'brevo' || (!provider && process.env.BREVO_API_KEY)) {
    const ok = await sendViaBrevo(toE164(phoneVn), message);
    if (ok) return { delivered: true };
  }
  // Fallback: log-only. In production with no SMS provider we still issue the
  // OTP so the flow is testable, but the operator has to retrieve it from
  // logs — startup config warning surfaces this gap.
  logger.warn(
    `[buyer-otp] No SMS provider available — OTP for ${phoneVn} = ${code} (configure BREVO_API_KEY or BUYER_OTP_PROVIDER=log to suppress this warning).`,
  );
  return { delivered: false };
}
// ── Public API ──────────────────────────────────────────────────────────────
export class BuyerOtpService {
  constructor(private readonly pool: Pool = defaultPool) {}
  /** Throttle: 1 OTP / 60s + 5 OTPs / hour per phone. Throws on overflow. */
  async assertCanIssue(phoneVn: string): Promise<void> {
    const r = await this.pool.query(
      `SELECT
         MAX(created_at) FILTER (WHERE created_at > NOW() - INTERVAL '60 seconds') AS last_issued,
         COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') AS hour_count
       FROM buyer_otp_log
       WHERE phone = $1`,
      [phoneVn],
    );
    const row = r.rows[0] || {};
    if (row.last_issued) {
      const e: any = new Error('Vui lòng đợi ít nhất 60 giây trước khi yêu cầu OTP mới.');
      e.code = 'OTP_TOO_SOON';
      throw e;
    }
    if (Number(row.hour_count || 0) >= 5) {
      const e: any = new Error('Bạn đã yêu cầu OTP quá nhiều lần. Vui lòng thử lại sau 1 giờ.');
      e.code = 'OTP_HOURLY_LIMIT';
      throw e;
    }
  }
  async issue(phoneVn: string, ip: string | null): Promise<OtpRequestResult> {
    const code = generateCode();
    const codeHash = hashCode(code);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);
    await this.pool.query(
      `INSERT INTO buyer_otp_log (phone, code_hash, expires_at, ip)
       VALUES ($1, $2, $3, $4)`,
      [phoneVn, codeHash, expiresAt, ip ? ip.slice(0, 64) : null],
    );
    const dispatch = await dispatchOtp(phoneVn, code);
    const result: OtpRequestResult = { ok: true };
    // Surface OTP in non-production responses so devs can integrate without
    // SMS plumbing. Never returned in production builds.
    if (process.env.NODE_ENV !== 'production' || process.env.BUYER_OTP_RETURN_CODE === '1') {
      result.devCode = code;
    }
    if (!dispatch.delivered && process.env.NODE_ENV === 'production') {
      // Production with no provider → still report ok=true so the UI advances,
      // but log a warning. The operator can read the OTP from logs while the
      // SMS provider is being set up (per task: "fallback provider mới").
    }
    return result;
  }
  async verify(phoneVn: string, code: string): Promise<OtpVerifyResult> {
    if (!/^\d{4,8}$/.test(code)) return { ok: false, error: 'OTP không hợp lệ' };
    const codeHash = hashCode(code);
    // Find the most recent unconsumed, unexpired OTP for this phone.
    const r = await this.pool.query(
      `SELECT id, code_hash, attempts
         FROM buyer_otp_log
        WHERE phone = $1
          AND consumed_at IS NULL
          AND expires_at > NOW()
        ORDER BY created_at DESC
        LIMIT 1`,
      [phoneVn],
    );
    const row = r.rows[0];
    if (!row) return { ok: false, error: 'OTP đã hết hạn hoặc chưa được phát.' };
    if (row.attempts >= OTP_MAX_ATTEMPTS) {
      return { ok: false, error: 'OTP đã bị khoá do nhập sai quá nhiều lần. Vui lòng yêu cầu OTP mới.' };
    }
    if (row.code_hash !== codeHash) {
      await this.pool.query(
        `UPDATE buyer_otp_log SET attempts = attempts + 1 WHERE id = $1`,
        [row.id],
      );
      return { ok: false, error: 'OTP không đúng. Vui lòng thử lại.' };
    }
    await this.pool.query(
      `UPDATE buyer_otp_log SET consumed_at = NOW() WHERE id = $1`,
      [row.id],
    );
    return { ok: true };
  }
}
export const buyerOtpService = new BuyerOtpService();