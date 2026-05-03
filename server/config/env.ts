/**
 * Centralised env-var loader for VNPay (and any future payment gateway).
 *
 * Why a separate file: VNPay credentials are required at request time inside
 * route handlers / services. Pulling them through one accessor lets us
 * fail-fast with a single, clear error instead of returning `undefined`
 * deep inside the signing routine.
 *
 * `VNPAY_ENV` controls which gateway URL we hit:
 *   - `sandbox` → https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
 *   - `prod`    → https://pay.vnpay.vn/vpcpay.html
 *
 * Switching to production is a pure env change — no code change required.
 */

export type VnpayEnv = 'sandbox' | 'prod';

export interface VnpayConfig {
  env: VnpayEnv;
  tmnCode: string;
  hashSecret: string;
  /** Public URL where VNPay redirects the buyer's browser after payment. */
  returnUrl: string;
  /**
   * Public URL VNPay POSTs the IPN to (server-to-server).
   *
   * Note: VNPay does NOT accept `vnp_IpnUrl` as a per-request parameter —
   * the gateway uses the IPN URL registered in the merchant portal. We
   * still load+validate this here so:
   *   1. Boot fails fast if ops forgot to set it (parity with portal).
   *   2. We can echo it on startup for ops to cross-check against the
   *      portal config (see boot log in server.ts).
   *   3. Future helper scripts can use it to register the URL via
   *      VNPay's merchant API once that surface is wired.
   */
  ipnUrl: string;
  /** Gateway URL we redirect the buyer to. */
  gatewayUrl: string;
  /** Default deposit amount (VND) when caller doesn't override. */
  defaultDepositVnd: number;
}

const SANDBOX_GATEWAY = 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
const PROD_GATEWAY = 'https://pay.vnpay.vn/vpcpay.html';

export function isVnpayConfigured(): boolean {
  return !!(process.env.VNPAY_TMN_CODE && process.env.VNPAY_HASH_SECRET);
}

/**
 * Load + validate VNPay config. Throws when `VNPAY_ENV` is set but the
 * required credentials are missing. Returns `null` when the gateway is not
 * configured at all (so callers can short-circuit with a clear 503 in dev).
 */
export function loadVnpayConfig(): VnpayConfig | null {
  const env = (process.env.VNPAY_ENV || '').toLowerCase() as VnpayEnv;
  const hasAny = env || process.env.VNPAY_TMN_CODE || process.env.VNPAY_HASH_SECRET;
  if (!hasAny) return null;

  if (env !== 'sandbox' && env !== 'prod') {
    throw new Error(
      `VNPAY_ENV must be 'sandbox' or 'prod' (got "${process.env.VNPAY_ENV || ''}")`,
    );
  }
  const tmnCode = (process.env.VNPAY_TMN_CODE || '').trim();
  const hashSecret = (process.env.VNPAY_HASH_SECRET || '').trim();
  const returnUrl = (process.env.VNPAY_RETURN_URL || '').trim();
  const ipnUrl = (process.env.VNPAY_IPN_URL || '').trim();
  if (!tmnCode || !hashSecret || !returnUrl || !ipnUrl) {
    throw new Error(
      'VNPAY_ENV is set but VNPAY_TMN_CODE / VNPAY_HASH_SECRET / VNPAY_RETURN_URL / VNPAY_IPN_URL are missing.',
    );
  }
  const defaultDepositVnd = Math.max(
    100_000,
    Math.min(500_000_000, Number(process.env.VNPAY_DEFAULT_DEPOSIT_VND || 50_000_000)),
  );

  return {
    env,
    tmnCode,
    hashSecret,
    returnUrl,
    ipnUrl,
    gatewayUrl: env === 'prod' ? PROD_GATEWAY : SANDBOX_GATEWAY,
    defaultDepositVnd,
  };
}
