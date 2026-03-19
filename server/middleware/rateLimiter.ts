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
// Redis store (multi-process / production — used when REDIS_URL is set)
// ---------------------------------------------------------------------------

let redisClient: import('ioredis').Redis | null = null;

async function getRedisClient(): Promise<import('ioredis').Redis | null> {
  if (!process.env.REDIS_URL) return null;
  if (redisClient) return redisClient;
  try {
    const { default: Redis } = await import('ioredis');
    redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
    });
    await redisClient.connect();
    return redisClient;
  } catch {
    redisClient = null;
    return null;
  }
}

async function redisIncr(redis: import('ioredis').Redis, key: string, windowSecs: number): Promise<number> {
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, windowSecs);
  }
  return count;
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

    const redis = await getRedisClient();
    if (redis) {
      // Redis-backed: accurate across multiple processes/instances
      const redisKey = `rl:${name}:${key}`;
      try {
        count = await redisIncr(redis, redisKey, windowSecs);
        const ttl = await redis.ttl(redisKey);
        resetAt = Date.now() + (ttl > 0 ? ttl * 1000 : windowMs);
      } catch {
        // Redis error — fall through to in-memory
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
  maxRequests: 120,
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
