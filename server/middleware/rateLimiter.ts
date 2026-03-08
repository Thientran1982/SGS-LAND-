import { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

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

export function rateLimit(options: {
  name: string;
  windowMs: number;
  maxRequests: number;
  keyFn?: (req: Request) => string;
  message?: string;
}) {
  const { name, windowMs, maxRequests, message } = options;
  const keyFn = options.keyFn || ((req: Request) => {
    const user = (req as any).user;
    return user?.id || req.ip || 'anonymous';
  });

  return (req: Request, res: Response, next: NextFunction) => {
    const store = getStore(name);
    const key = keyFn(req);
    const now = Date.now();

    let entry = store.get(key);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      store.set(key, entry);
    }

    entry.count++;

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - entry.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000));

    if (entry.count > maxRequests) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
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
