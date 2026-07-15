/**
 * Distributed rate limiting + locking backed by Upstash Redis (REST client).
 *
 * Even though this pipeline is first-party / partner-feed based (no aggressive
 * scraping), we still throttle outbound calls per external domain (e.g. the
 * Mapbox geocoder, a partner API, image CDNs) to stay well within provider
 * rate limits and to coordinate across parallel jobs/instances.
 */
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export { redis };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Sliding-window limiter: allow at most `max` operations per `windowMs` for a
 * given key. Returns true if allowed now. Uses INCR + PEXPIRE (atomic-ish; the
 * first caller in a window sets the TTL).
 */
export async function tryAcquire(
  key: string,
  max: number,
  windowMs: number,
): Promise<boolean> {
  const redisKey = `mkt:rl:${key}`;
  const count = await redis.incr(redisKey);
  if (count === 1) {
    await redis.pexpire(redisKey, windowMs);
  }
  return count <= max;
}

/**
 * Block until a slot is available for `key`, then proceed. Guarantees the
 * per-domain min interval by waiting instead of dropping the request.
 *
 * Default policy: 1 request per 2.5s per domain.
 */
export async function throttleDomain(
  domain: string,
  opts: { minIntervalMs?: number; maxWaitMs?: number } = {},
): Promise<void> {
  const minIntervalMs = opts.minIntervalMs ?? 2500;
  const maxWaitMs = opts.maxWaitMs ?? 60_000;
  const started = Date.now();

  // Use a 1-op-per-interval window as a token bucket of size 1.
  while (true) {
    const ok = await tryAcquire(`domain:${domain}`, 1, minIntervalMs);
    if (ok) return;
    if (Date.now() - started > maxWaitMs) {
      throw new Error(`[market:rl] throttleDomain timed out for ${domain}`);
    }
    // Jittered wait to avoid thundering herd across instances.
    await sleep(Math.min(minIntervalMs, 500 + Math.floor(Math.random() * 500)));
  }
}

/**
 * Acquire a distributed lock (SET NX PX). Returns a release() fn, or null if
 * the lock is held. Prefer withLock() which waits + auto-releases.
 */
export async function acquireLock(
  name: string,
  ttlMs = 30_000,
): Promise<null | (() => Promise<void>)> {
  const key = `mkt:lock:${name}`;
  const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const res = await redis.set(key, token, { nx: true, px: ttlMs });
  if (res !== 'OK') return null;

  return async () => {
    // Only release if we still own the lock (compare-and-delete via Lua).
    const lua = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end`;
    try {
      await redis.eval(lua, [key], [token]);
    } catch {
      /* best-effort release */
    }
  };
}

/**
 * Run `fn` while holding a named lock. Waits (does not skip) until the lock is
 * free or maxWaitMs elapses. Always releases the lock afterward.
 */
export async function withLock<T>(
  name: string,
  fn: () => Promise<T>,
  opts: { ttlMs?: number; maxWaitMs?: number } = {},
): Promise<T> {
  const ttlMs = opts.ttlMs ?? 30_000;
  const maxWaitMs = opts.maxWaitMs ?? 60_000;
  const started = Date.now();

  let release: null | (() => Promise<void>) = null;
  while (!(release = await acquireLock(name, ttlMs))) {
    if (Date.now() - started > maxWaitMs) {
      throw new Error(`[market:lock] could not acquire "${name}" within ${maxWaitMs}ms`);
    }
    await sleep(250 + Math.floor(Math.random() * 250));
  }
  try {
    return await fn();
  } finally {
    await release();
  }
}
