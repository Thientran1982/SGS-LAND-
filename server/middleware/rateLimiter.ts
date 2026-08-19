import { Request, Response, NextFunction } from 'express';
import { createHash } from 'node:crypto';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// ---------------------------------------------------------------------------
// In-memory store (single-process / dev fallback)
// ---------------------------------------------------------------------------

const stores = new Map<string, Map<string, RateLimitEntry>>();

function getStore(name: string): Map<string, RateLimitEntry> {
  if (!stores.has(name)) {
    stores.set(name, new Map());
  }
  return stores.get(name)!;
}

function cleanupStore(store: Map<string, RateLimitEntry>) {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}

setInterval(() => {
  for (const store of stores.values()) {
    cleanupStore(store);
  }
}, 60_000);

// ---------------------------------------------------------------------------
// RELIABILITY FIX (audit): in-memory counting duoc tach ra thanh helper de
// dung lai lam FALLBACK khi Upstash het quota hoac khong reachable.
// ---------------------------------------------------------------------------
let redisFallbackCount = 0;
let lastRedisFallbackLogMs = 0;
const REDIS_FALLBACK_LOG_COOLDOWN_MS = 60_000;

function countInMemory(name: string, key: string, windowMs: number): { count: number; resetAt: number } {
  const store = getStore(name);
  const now = Date.now();
  let entry = store.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    store.set(key, entry);
  }
  entry.count++;
  return { count: entry.count, resetAt: entry.resetAt };
}

// ---------------------------------------------------------------------------
// Upstash Redis REST store (production — used when UPSTASH_REDIS_REST_URL is set)
// Uses HTTP REST API, no TCP connection required.
// ---------------------------------------------------------------------------

let upstashClient: any | null = null;

async function getUpstashClient(): Promise<any | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  if (upstashClient) return upstashClient;
  try {
    const { Redis } = await import('@upstash/redis');
    upstashClient = new Redis({ url, token });
    return upstashClient;
  } catch (e) {
    upstashClient = null;
    return null;
  }
}

async function upstashIncr(client: any, key: string, windowSecs: number): Promise<number> {
  const count = await client.incr(key);
  if (count === 1) {
    await client.expire(key, windowSecs);
  }
  return count as number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Client IP resolution (behind Cloudflare -> Replit edge -> Express)
// ---------------------------------------------------------------------------
// With a proxy chain, Express's req.ip can resolve to an INFRASTRUCTURE IP
// instead of the real visitor (it depends on 'trust proxy' matching the exact
// hop count). When that happens every visitor shares ONE rate-limit bucket, so
// a few requests lock out the entire site -- observed in production:
// POST /api/auth/forgot-password answered 429 "thu lai sau 60 phut" to users
// who had never sent a single request.
// Resolve the visitor IP explicitly, most trustworthy header first.
export function getClientIp(req: Request): string {
  const h: any = (req && req.headers) || {};
  const first = (v: any): string => {
    const raw = Array.isArray(v) ? v[0] : v;
    return typeof raw === 'string' ? raw.split(',')[0].trim() : '';
  };
  return (
    first(h['cf-connecting-ip']) ||
    first(h['x-real-ip']) ||
    first(h['x-forwarded-for']) ||
    req.ip ||
    (req.socket && req.socket.remoteAddress) ||
    'anonymous'
  );
}

export function rateLimit(options: {
  name: string;
  windowMs: number;
  maxRequests: number;
  keyFn?: (req: Request) => string;
  message?: string;
}) {
  const { name, windowMs, maxRequests, message } = options;
  const windowSecs = Math.ceil(windowMs / 1000);
  const keyFn = options.keyFn || ((req: Request) => {
    const user = (req as any).user;
    return user?.id || getClientIp(req);
  });

  return async (req: Request, res: Response, next: NextFunction) => {
    const key = keyFn(req);
    let count: number;
    let resetAt: number;

    const redis = await getUpstashClient();
    if (redis) {
      // COST FIX (audit Medium): truoc day moi request ton 2 lenh Upstash (INCR + TTL).
      // Gan so hieu cua so vao key (fixed window) => resetAt tinh duoc tai cho,
      // bo han lenh TTL. Con 1 lenh/request (+1 EXPIRE cho request dau moi cua so).
      const windowIndex = Math.floor(Date.now() / windowMs);
      const redisKey = `rl:${name}:${key}:${windowIndex}`;
      try {
        count = await upstashIncr(redis, redisKey, windowSecs);
        resetAt = (windowIndex + 1) * windowMs;
        } catch (redisErr: any) {
        // H2 FIX: Distinguish quota errors (Upstash free tier) from network errors.
        const msg = String(redisErr?.message || redisErr || '');
        const isQuotaError =
          msg.includes('max requests limit exceeded') ||
          msg.includes('QUOTA') ||
          msg.includes('ERR max');
        // RELIABILITY FIX (audit):
        //  - Truoc day quota exhausted => return next() IM LANG: rate limiting
        //    tu tat hoan toan, khong log/metric nen khong the phat hien.
        //  - Truoc day loi mang Redis => 503 cho MOI request co apiRateLimit,
        //    tuc 1 su co Upstash = downtime API toan phan, du app chay
        //    single-instance (server.ts:1487 socket.io in-memory adapter).
        // Gio ca 2 truong hop degrade sang in-memory store + log ro rang
        // (level error, cooldown 60s, kem so request bi anh huong).
        redisFallbackCount++;
        const nowMs = Date.now();
        if (nowMs - lastRedisFallbackLogMs >= REDIS_FALLBACK_LOG_COOLDOWN_MS) {
          lastRedisFallbackLogMs = nowMs;
          console.error(
            `[RateLimit] ${isQuotaError ? 'UPSTASH QUOTA EXHAUSTED' : 'REDIS UNAVAILABLE'}  ` +
            `degrade sang in-memory store (${redisFallbackCount} request ke tu lan log truoc). ` +
            `name=${name} err=${msg}`
          );
          redisFallbackCount = 0;
        }
        const fb = countInMemory(name, key, windowMs);
        count = fb.count;
        resetAt = fb.resetAt;
      }
    } else {
      // No Redis configured: use in-memory store (dev/single-process only).
        // WARNING: unsafe in multi-instance deployments.
      const fb = countInMemory(name, key, windowMs);
      count = fb.count;
      resetAt = fb.resetAt;
    }

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(resetAt / 1000));

    if (count > maxRequests) {
      const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
      res.setHeader('Retry-After', retryAfter);
    // Log every block so a mis-resolved client IP (all traffic collapsing into
    // one bucket) is visible in the server logs instead of silently 429-ing.
    console.warn(
      `[rateLimit] BLOCKED name=${name} key=${key} count=${count}/${maxRequests} ` +
      `reqIp=${req.ip} xff=${req.headers['x-forwarded-for'] || '-'} ` +
      `cfip=${req.headers['cf-connecting-ip'] || '-'} path=${req.originalUrl}`
    );
      return res.status(429).json({
        error: message || 'Too many requests. Please try again later.',
        retryAfter,
      });
    }

    next();
  };
}

export const aiRateLimit = rateLimit({
  name: 'ai',
  windowMs: 60_000,
  maxRequests: 20,
  message: 'AI request limit exceeded. Please wait before making more AI requests.',
});

export const authRateLimit = rateLimit({
  name: 'auth',
  windowMs: 15 * 60_000,
  maxRequests: 20,
  keyFn: (req) => getClientIp(req),
  message: 'Quá nhiều yêu cầu. Vui lòng thử lại sau 15 phút.',
});

// H3 FIX: Stricter rate limit specifically for login & password endpoints.
// Prevents brute-force attacks: 10 attempts / 15 min per IP + email identity.
export const loginRateLimit = rateLimit({
  // v2 intentionally invalidates the old IP-only Redis buckets. Those buckets
  // could be shared by every visitor behind the same proxy/NAT.
  name: 'login_v2',
  windowMs: 15 * 60_000,
  maxRequests: 10,
  keyFn: (req) => {
    const email = String((req.body as any)?.email || '').trim().toLowerCase();
    const emailKey = email
      ? createHash('sha256').update(email).digest('hex').slice(0, 24)
      : 'anonymous';
    return `${getClientIp(req)}|${emailKey}`;
  },
  message: 'Quá nhiều lần thử đăng nhập. Vui lòng thử lại sau 15 phút.',
});

// H3 FIX: Rate limit for password-reset / forgot-password endpoints.
// Prevents email-flooding: 5 requests / 60 min per (IP + email).
// Keying on the email as well as the IP means one visitor (or one shared
// corporate NAT / mobile carrier IP) can no longer lock everybody else out,
// while still blocking someone flooding a single mailbox.
export const passwordResetRateLimit = rateLimit({
  name: 'password_reset',
  windowMs: 60 * 60_000,
  maxRequests: 5,
  keyFn: (req) => {
    const email = String((req.body as any)?.email || '').trim().toLowerCase();
    const ip = getClientIp(req);
    return email ? `${ip}|${email}` : ip;
  },
  message: 'Quá nhiều yêu cầu đặt lại mật khẩu. Vui lòng thử lại sau 60 phút.',
});

export const apiRateLimit = rateLimit({
  name: 'api',
  windowMs: 60_000,
  // Bumped 1200 -> 3000: this ONE bucket is shared by ~26 different /api/*
  // route groups, PLUS several always-on frontend poll loops (dashboard
  // metrics every 30s, notifications every 60s in the global Layout, reports
  // silent-refresh every 60s) that run continuously per logged-in user, on
  // top of normal clicking and multiple open tabs/sessions for the same
  // account. 1200/min was tipping over from background polling alone.
  maxRequests: 3000,
  message: 'Quá nhiều yêu cầu. Vui lòng thử lại sau ít phút.',
});

export const webhookRateLimit = rateLimit({
  name: 'webhook',
  windowMs: 60_000,
  maxRequests: 100,
  keyFn: (req) => getClientIp(req),
});

export const publicLeadRateLimit = rateLimit({
  name: 'public_lead',
  windowMs: 60_000,
  maxRequests: 5,
  keyFn: (req) => getClientIp(req),
  message: 'Too many lead submissions from this IP. Please try again later.',
});

// Separate, more generous limiter for livechat messaging (message save + AI reply)
// A normal conversation: ~10-15 messages per minute is reasonable
export const livechatRateLimit = rateLimit({
  name: 'livechat',
  windowMs: 60_000,
  maxRequests: 60,
  keyFn: (req) => getClientIp(req),
  message: 'Bạn đang gửi tin nhắn quá nhanh. Vui lòng đợi một chút.',
});

// Guest valuation requests: 2/day per IP (free tier).
// Authenticated users use monthlyValuationQuota (plan-based) instead.
export const guestValuationRateLimit = rateLimit({
  name: 'guest_valuation',
  windowMs: 24 * 60 * 60_000,
  maxRequests: 2,
  keyFn: (req) => `gv:${getClientIp(req)}`,
  message: 'Bạn đã dùng hết 2 lượt định giá miễn phí hôm nay. Đăng nhập để tiếp tục.',
});

// ---------------------------------------------------------------------------
// Monthly AI Quota — plan-based, Redis-backed
// Covers: Valuation (thẩm định) + ARIA persona analysis
// INDIVIDUAL (free): 5/month each  |  TEAM: 50/month each  |  ENTERPRISE: unlimited
// ---------------------------------------------------------------------------

export const VALUATION_PLAN_LIMITS: Record<string, number> = {
  INDIVIDUAL: 5,
  TEAM: 50,
  ENTERPRISE: -1,  // -1 = unlimited
};

export const ARIA_PLAN_LIMITS: Record<string, number> = {
  INDIVIDUAL: 5,
  TEAM: 50,
  ENTERPRISE: -1,
};

function monthlyResetTs(): number {
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export async function getUserPlan(tenantId: string): Promise<string> {
  try {
    const { pool } = await import('../db');
    const result = await pool.query(
      `SELECT plan_id FROM subscriptions WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [tenantId]
    );
    return result.rows[0]?.plan_id || 'INDIVIDUAL';
  } catch {
    return 'INDIVIDUAL';
  }
}

// Read-only quota check — for GET /api/valuation/quota (no increment)
export async function getMonthlyQuotaStatus(userId: string, tenantId: string): Promise<{
  used: number; limit: number; remaining: number; plan: string;
  resetAt: string; isUnlimited: boolean;
}> {
  const period = new Date().toISOString().slice(0, 7);
  const plan = await getUserPlan(tenantId);
  const limit = VALUATION_PLAN_LIMITS[plan] ?? VALUATION_PLAN_LIMITS.INDIVIDUAL;
  const isUnlimited = limit === -1;
  const resetAt = new Date(monthlyResetTs()).toISOString();

  if (isUnlimited) {
    return { used: 0, limit: -1, remaining: -1, plan, resetAt, isUnlimited: true };
  }

  const redisKey = `mq:val:${userId}:${period}`;
  let used = 0;

  const redis = await getUpstashClient();
  if (redis) {
    try {
      const val = await redis.get(redisKey);
      used = val ? parseInt(String(val), 10) : 0;
    } catch { /* ignore */ }
  } else {
    const store = getStore('monthly_quota');
    const entry = store.get(redisKey);
    used = entry ? entry.count : 0;
  }

  const remaining = Math.max(0, limit - used);
  return { used, limit, remaining, plan, resetAt, isUnlimited: false };
}

// Middleware: increment + enforce monthly quota for authenticated users.
// Call AFTER optionalAuth so req.user is available.
// Guests fall through to guestValuationRateLimit — do NOT stack both.
export function monthlyValuationQuota(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).user;
  if (!user) { next(); return; } // Guest handled separately

  const userId: string = user.id || user.userId || 'unknown';
  const tenantId: string = user.tenantId || userId;
  const period = new Date().toISOString().slice(0, 7);

  (async () => {
    const plan = await getUserPlan(tenantId);
    const limit = VALUATION_PLAN_LIMITS[plan] ?? VALUATION_PLAN_LIMITS.INDIVIDUAL;
    const isUnlimited = limit === -1;
    const resetTs = monthlyResetTs();
    const resetAt = new Date(resetTs).toISOString();

    if (isUnlimited) {
      (req as any).quotaInfo = { used: 0, limit: -1, remaining: -1, plan, resetAt, isUnlimited: true };
      res.setHeader('X-Quota-Limit', 'unlimited');
      next();
      return;
    }

    const redisKey = `mq:val:${userId}:${period}`;
    const ttlSecs = Math.max(1, Math.ceil((resetTs - Date.now()) / 1000));
    let used: number;

    const redis = await getUpstashClient();
    if (redis) {
      try {
        used = await upstashIncr(redis, redisKey, ttlSecs);
      } catch {
        const store = getStore('monthly_quota');
        const now = Date.now();
        let entry = store.get(redisKey);
        if (!entry || now > entry.resetAt) entry = { count: 0, resetAt: resetTs };
        entry.count++;
        store.set(redisKey, entry);
        used = entry.count;
      }
    } else {
      const store = getStore('monthly_quota');
      const now = Date.now();
      let entry = store.get(redisKey);
      if (!entry || now > entry.resetAt) entry = { count: 0, resetAt: resetTs };
      entry.count++;
      store.set(redisKey, entry);
      used = entry.count;
    }

    const remaining = Math.max(0, limit - used);
    res.setHeader('X-Quota-Limit', limit);
    res.setHeader('X-Quota-Used', used);
    res.setHeader('X-Quota-Remaining', remaining);
    res.setHeader('X-Quota-Reset', Math.ceil(resetTs / 1000));
    (req as any).quotaInfo = { used, limit, remaining, plan, resetAt, isUnlimited: false };

    if (used > limit) {
      res.status(429).json({
        error: 'monthly_quota_exceeded',
        message: `Bạn đã sử dụng hết ${limit} lượt định giá AI tháng này (gói ${plan}). Nâng cấp để tiếp tục.`,
        quota: { used, limit, remaining: 0, plan, resetAt },
      });
      return;
    }

    next();
  })().catch((err) => {
    // Fail open — if quota check errors, let request through
    console.error('[monthlyValuationQuota] Error:', err);
    next();
  });
}

// Keep for backward compatibility (no longer used in routes but exported)
export const userValuationRateLimit = rateLimit({
  name: 'user_valuation_legacy',
  windowMs: 24 * 60 * 60_000,
  maxRequests: 20,
  keyFn: (req) => `uv:${(req as any).user?.id || getClientIp(req)}`,
  message: 'Vui lòng thử lại sau.',
});

// ---------------------------------------------------------------------------
// Monthly ARIA Quota — same Redis-backed pattern as valuation quota
// Tracks per-user monthly usage of ARIA persona analysis (summarizeLead)
// ---------------------------------------------------------------------------

export async function getMonthlyAriaQuotaStatus(userId: string, tenantId: string): Promise<{
  used: number; limit: number; remaining: number; plan: string;
  resetAt: string; isUnlimited: boolean;
}> {
  const period = new Date().toISOString().slice(0, 7);
  const plan = await getUserPlan(tenantId);
  const limit = ARIA_PLAN_LIMITS[plan] ?? ARIA_PLAN_LIMITS.INDIVIDUAL;
  const isUnlimited = limit === -1;
  const resetAt = new Date(monthlyResetTs()).toISOString();

  if (isUnlimited) {
    return { used: 0, limit: -1, remaining: -1, plan, resetAt, isUnlimited: true };
  }

  const redisKey = `mq:aria:${userId}:${period}`;
  let used = 0;

  const redis = await getUpstashClient();
  if (redis) {
    try {
      const val = await redis.get(redisKey);
      used = val ? parseInt(String(val), 10) : 0;
    } catch { /* ignore */ }
  } else {
    const store = getStore('monthly_quota');
    const entry = store.get(redisKey);
    used = entry ? entry.count : 0;
  }

  const remaining = Math.max(0, limit - used);
  return { used, limit, remaining, plan, resetAt, isUnlimited: false };
}

export function monthlyAriaQuota(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).user;
  if (!user) { next(); return; }

  const userId: string = user.id || user.userId || 'unknown';
  const tenantId: string = user.tenantId || userId;
  const period = new Date().toISOString().slice(0, 7);

  (async () => {
    const plan = await getUserPlan(tenantId);
    const limit = ARIA_PLAN_LIMITS[plan] ?? ARIA_PLAN_LIMITS.INDIVIDUAL;
    const isUnlimited = limit === -1;
    const resetTs = monthlyResetTs();
    const resetAt = new Date(resetTs).toISOString();

    if (isUnlimited) {
      (req as any).ariaQuotaInfo = { used: 0, limit: -1, remaining: -1, plan, resetAt, isUnlimited: true };
      res.setHeader('X-Aria-Quota-Limit', 'unlimited');
      next();
      return;
    }

    const redisKey = `mq:aria:${userId}:${period}`;
    const ttlSecs = Math.max(1, Math.ceil((resetTs - Date.now()) / 1000));
    let used: number;

    const redis = await getUpstashClient();
    if (redis) {
      try {
        used = await upstashIncr(redis, redisKey, ttlSecs);
      } catch {
        const store = getStore('monthly_quota');
        const now = Date.now();
        let entry = store.get(redisKey);
        if (!entry || now > entry.resetAt) entry = { count: 0, resetAt: resetTs };
        entry.count++;
        store.set(redisKey, entry);
        used = entry.count;
      }
    } else {
      const store = getStore('monthly_quota');
      const now = Date.now();
      let entry = store.get(redisKey);
      if (!entry || now > entry.resetAt) entry = { count: 0, resetAt: resetTs };
      entry.count++;
      store.set(redisKey, entry);
      used = entry.count;
    }

    const remaining = Math.max(0, limit - used);
    res.setHeader('X-Aria-Quota-Limit', limit);
    res.setHeader('X-Aria-Quota-Used', used);
    res.setHeader('X-Aria-Quota-Remaining', remaining);
    res.setHeader('X-Aria-Quota-Reset', Math.ceil(resetTs / 1000));
    (req as any).ariaQuotaInfo = { used, limit, remaining, plan, resetAt, isUnlimited: false };

    if (used > limit) {
      res.status(429).json({
        error: 'aria_quota_exceeded',
        message: `Bạn đã dùng hết ${limit} lượt phân tích ARIA tháng này (gói ${plan}). Nâng cấp để tiếp tục.`,
        quota: { used, limit, remaining: 0, plan, resetAt },
      });
      return;
    }

    next();
  })().catch((err) => {
    console.error('[monthlyAriaQuota] Error:', err);
    next();
  });
}
