/**
 * VNPay service (Task #56).
 *
 * Implements the three primitives required for the buyer-deposit flow:
 *
 *   buildPaymentUrl()  → constructs the signed redirect URL we hand to the
 *                        mobile WebBrowser session.
 *   verifyReturn()     → re-hashes the browser callback so we can show the
 *                        buyer "Thành công / Thất bại" before the IPN lands.
 *   verifyIpn()        → re-hashes the server-to-server IPN POST. THIS is
 *                        the source of truth — we only set bookings.PAID
 *                        from a verified IPN, never from the browser
 *                        callback (browser callbacks can be tampered with).
 *
 * Algorithm (per VNPay API v2.1.0):
 *   1. Take all `vnp_*` params except `vnp_SecureHash` and `vnp_SecureHashType`.
 *   2. Sort them alphabetically by key.
 *   3. URL-encode each value with the EXACT scheme VNPay uses (RFC 3986,
 *      see `vnpEncode` below — strict RFC3986, `%20` for spaces) and
 *      join as `k=v&k=v…`.
 *   4. HMAC-SHA512 the resulting string with `hashSecret` → hex (lowercase
 *      from Node, but VNPay accepts both cases — we compare case-insensitively).
 *
 * Reference: https://sandbox.vnpayment.vn/apis/docs/huong-dan-tich-hop/
 */

import crypto from 'crypto';
import type { VnpayConfig } from '../config/env';

export interface BuildPaymentInput {
  txnRef: string;
  /** Amount in VND (whole đồng — we multiply by 100 for VNPay). */
  amount: number;
  orderInfo: string;
  ipAddr: string;
  locale?: 'vn' | 'en';
  /** Optional override (e.g. force "VNBANK" / "INTCARD" / "QRCODE"). */
  bankCode?: string;
  /** Force a return URL different from the env default (used when buyer
   *  app needs the per-booking deep-link). Defaults to config.returnUrl. */
  returnUrl?: string;
}

/**
 * Strict RFC 3986 percent-encoding for the VNPay signature canonical form.
 *
 * `encodeURIComponent` covers most reserved chars but leaves `!*'()`
 * untouched — escape those explicitly. Spaces remain as `%20` (NOT `+`):
 * the gateway's signature canonicalisation expects RFC3986, and using
 * `+` produces signatures the production gateway rejects with code 70.
 */
function vnpEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/!/g, '%21')
    .replace(/\*/g, '%2A')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29');
}

/** YYYYMMDDHHmmss in Asia/Ho_Chi_Minh (UTC+7). VNPay rejects other tz. */
export function vnpFormatDate(d: Date = new Date()): string {
  // Convert to UTC+7 by adding the offset, then format components from UTC parts.
  const t = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    t.getUTCFullYear().toString() +
    pad(t.getUTCMonth() + 1) +
    pad(t.getUTCDate()) +
    pad(t.getUTCHours()) +
    pad(t.getUTCMinutes()) +
    pad(t.getUTCSeconds())
  );
}

function buildSignedQuery(
  params: Record<string, string>,
  hashSecret: string,
): { query: string; secureHash: string } {
  // 1. Strip empty + the hash params themselves.
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    if (k === 'vnp_SecureHash' || k === 'vnp_SecureHashType') continue;
    clean[k] = String(v);
  }
  // 2. Sort keys alphabetically.
  const keys = Object.keys(clean).sort();
  // 3. Build canonical string with VNPay encoding.
  const canonical = keys.map((k) => `${k}=${vnpEncode(clean[k])}`).join('&');
  // 4. HMAC-SHA512 → hex.
  const secureHash = crypto
    .createHmac('sha512', hashSecret)
    .update(Buffer.from(canonical, 'utf-8'))
    .digest('hex');
  return { query: canonical, secureHash };
}

export function buildPaymentUrl(
  config: VnpayConfig,
  input: BuildPaymentInput,
): string {
  const params: Record<string, string> = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: config.tmnCode,
    vnp_Locale: input.locale === 'en' ? 'en' : 'vn',
    vnp_CurrCode: 'VND',
    vnp_TxnRef: input.txnRef,
    vnp_OrderInfo: input.orderInfo,
    vnp_OrderType: 'other',
    vnp_Amount: String(Math.round(input.amount * 100)),
    vnp_ReturnUrl: input.returnUrl || config.returnUrl,
    vnp_IpAddr: input.ipAddr || '127.0.0.1',
    vnp_CreateDate: vnpFormatDate(),
  };
  if (input.bankCode) params.vnp_BankCode = input.bankCode;

  const { query, secureHash } = buildSignedQuery(params, config.hashSecret);
  return `${config.gatewayUrl}?${query}&vnp_SecureHash=${secureHash}`;
}

export interface VerifyResult {
  valid: boolean;
  responseCode: string | null;
  txnRef: string | null;
  amount: number | null;
  bankCode: string | null;
  payDate: string | null;
  raw: Record<string, string>;
}

/**
 * Verify a callback (return or IPN). Both share the same signing rule, only
 * differ in transport (GET query vs POST body). Caller hands us a flat
 * string-keyed object.
 */
export function verifyCallback(
  config: VnpayConfig,
  query: Record<string, unknown>,
): VerifyResult {
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null) continue;
    flat[k] = Array.isArray(v) ? String(v[0]) : String(v);
  }
  const provided = flat.vnp_SecureHash || '';
  const { secureHash } = buildSignedQuery(flat, config.hashSecret);
  // Constant-time compare to avoid timing oracles.
  const a = Buffer.from(secureHash.toLowerCase(), 'utf-8');
  const b = Buffer.from(provided.toLowerCase(), 'utf-8');
  const valid = a.length === b.length && crypto.timingSafeEqual(a, b);

  const amountRaw = flat.vnp_Amount ? Number(flat.vnp_Amount) : null;
  return {
    valid,
    responseCode: flat.vnp_ResponseCode || null,
    txnRef: flat.vnp_TxnRef || null,
    amount: amountRaw !== null && Number.isFinite(amountRaw) ? amountRaw / 100 : null,
    bankCode: flat.vnp_BankCode || null,
    payDate: flat.vnp_PayDate || null,
    raw: flat,
  };
}

/** Aliases mandated by the task description for clarity at call-sites. */
export const verifyReturn = verifyCallback;
export const verifyIpn = verifyCallback;
