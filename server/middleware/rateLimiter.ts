import { Request, Response, NextFunction } from 'express';

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
    return user?.id || req.ip || 'anonymous';
  });

  return async (req: Request, res: Response, next: NextFunction) => {
    const key = keyFn(req);
    let count: number;
    let resetAt: number;

    const redis = await getUpstashClient();
    if (redis) {
      const redisKey = `rl:${name}:${key}`;
      try {
        count = await upstashIncr(redis, redisKey, windowSecs);
        const ttl = await redis.ttl(redisKey) as number;
        resetAt = Date.now() + (ttl > 0 ? ttl * 1000 : windowMs);
      } catch {
        // Upstash error — fall through to in-memory
        const store = getStore(name);
        const now = Date.now();
        let entry = store.get(key);
        if (!entry || now > entry.resetAt) {
          entry = { count: 0, resetAt: now + windowMs };
          store.set(key, entry);
        }
        entry.count++;
        count = entry.count;
        resetAt = entry.resetAt;
      }
    } else {
      // In-memory fallback (single-process only)
      const store = getStore(name);
      const now = Date.now();
      let entry = store.get(key);
      if (!entry || now > entry.resetAt) {
        entry = { count: 0, resetAt: now + windowMs };
        store.set(key, entry);
      }
      entry.count++;
      count = entry.count;
      resetAt = entry.resetAt;
    }

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(resetAt / 1000));

    if (count > maxRequests) {
      const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
      res.setHeader('Retry-After', retryAfter);
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
  maxRequests: 15,
  keyFn: (req) => req.ip || 'anonymous',
  message: 'Too many login attempts. Please try again later.',
});

export const apiRateLimit = rateLimit({
  name: 'api',
  windowMs: 60_000,
  maxRequests: 600,
});

export const webhookRateLimit = rateLimit({
  name: 'webhook',
  windowMs: 60_000,
  maxRequests: 100,
  keyFn: (req) => req.ip || 'anonymous',
});

export const publicLeadRateLimit = rateLimit({
  name: 'public_lead',
  windowMs: 60_000,
  maxRequests: 5,
  keyFn: (req) => req.ip || 'anonymous',
  message: 'Too many lead submissions from this IP. Please try again later.',
});

// Separate, more generous limiter for livechat messaging (message save + AI reply)
// A normal conversation: ~10-15 messages per minute is reasonable
export const livechatRateLimit = rateLimit({
  name: 'livechat',
  windowMs: 60_000,
  maxRequests: 60,
  keyFn: (req) => req.ip || 'anonymous',
  message: 'Bạn đang gửi tin nhắn quá nhanh. Vui lòng đợi một chút.',
});

// Guest valuation requests: 1/day per IP (free tier).
// Authenticated users use userValuationRateLimit (3/day per user ID) instead.
export const guestValuationRateLimit = rateLimit({
  name: 'guest_valuation',
  windowMs: 24 * 60 * 60_000,
  maxRequests: 1,
  keyFn: (req) => `gv:${req.ip || 'anon'}`,
  message: 'Bạn đã dùng hết 1 lượt định giá miễn phí hôm nay. Đăng nhập để tiếp tục.',
});

// Authenticated user valuation requests: 3/day per user ID.
export const userValuationRateLimit = rateLimit({
  name: 'user_valuation',
  windowMs: 24 * 60 * 60_000,
  maxRequests: 3,
  keyFn: (req) => `uv:${(req as any).user?.id || (req as any).user?.tenantId || req.ip || 'user'}`,
  message: 'Bạn đã dùng hết 3 lượt định giá hôm nay. Vui lòng thử lại vào ngày mai.',
});
