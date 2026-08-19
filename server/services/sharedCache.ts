import { Redis } from '@upstash/redis';
import { logger } from '../middleware/logger';

const PREFIX = 'sgs:cache:v2:';
const MAX_LOCAL_ENTRIES = 1000;
const local = new Map<string, { value: unknown; expiresAt: number }>();
let redis: Redis | null | undefined;
let redisFailures = 0;
let hits = 0;
let misses = 0;
let fallbackReads = 0;
let fallbackWrites = 0;
let invalidations = 0;
let ttlWrites = 0;

function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

function fullKey(key: string): string {
  return `${PREFIX}${key}`;
}

function localGet<T>(key: string): T | null {
  const item = local.get(key);
  if (!item) return null;
  if (item.expiresAt <= Date.now()) {
    local.delete(key);
    return null;
  }
  return item.value as T;
}

function localSet(key: string, value: unknown, ttlMs: number): void {
  if (!local.has(key) && local.size >= MAX_LOCAL_ENTRIES) {
    const oldest = local.keys().next().value;
    if (oldest) local.delete(oldest);
  }
  local.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export async function sharedCacheGet<T>(key: string): Promise<T | null> {
  const namespaced = fullKey(key);
  const client = getRedis();
  if (client) {
    try {
      const value = await client.get<T>(namespaced);
      if (value !== null && value !== undefined) {
        hits++;
        localSet(namespaced, value, 30_000);
        return value;
      }
      misses++;
      return null;
    } catch (error: any) {
      redisFailures++;
      fallbackReads++;
      logger.warn(`[SharedCache] Redis GET fallback: ${error?.message || error}`);
    }
  }
  const value = localGet<T>(namespaced);
  value === null ? misses++ : hits++;
  return value;
}

export async function sharedCacheSet(key: string, value: unknown, ttlMs: number): Promise<void> {
  const namespaced = fullKey(key);
  localSet(namespaced, value, ttlMs);
  ttlWrites++;
  const client = getRedis();
  if (!client) return;
  try {
    await client.set(namespaced, value, { ex: Math.max(1, Math.ceil(ttlMs / 1000)) });
  } catch (error: any) {
    redisFailures++;
    fallbackWrites++;
    logger.warn(`[SharedCache] Redis SET fallback: ${error?.message || error}`);
  }
}

export async function sharedCacheDelete(key: string): Promise<void> {
  const namespaced = fullKey(key);
  local.delete(namespaced);
  const client = getRedis();
  if (!client) return;
  try { await client.del(namespaced); invalidations++; } catch (error: any) {
    redisFailures++;
    logger.warn(`[SharedCache] Redis DEL fallback: ${error?.message || error}`);
  }
}

export async function sharedCacheDeleteByPrefix(prefix: string): Promise<number> {
  for (const key of Array.from(local.keys())) if (key.startsWith(fullKey(prefix))) {
    local.delete(key);
    invalidations++;
  }
  const client = getRedis();
  if (!client) return 0;
  let cursor = 0;
  let deleted = 0;
  try {
    do {
      const result = await client.scan(cursor, { match: `${fullKey(prefix)}*`, count: 100 });
      cursor = Number(result[0]);
      const keys = result[1] as string[];
      if (keys.length) {
         deleted += await client.del(...keys);
         invalidations += keys.length;
      }
    } while (cursor !== 0);
  } catch (error: any) {
    redisFailures++;
    logger.warn(`[SharedCache] Redis prefix invalidation failed: ${error?.message || error}`);
  }
  return deleted;
}

export async function sharedCacheDeleteByPattern(pattern: string): Promise<number> {
  const fullPattern = `${PREFIX}${pattern}`;
  const glob = new RegExp(`^${pattern.split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`);
  for (const key of Array.from(local.keys())) {
    const raw = key.slice(PREFIX.length);
    if (key.startsWith(PREFIX) && glob.test(raw)) {
      local.delete(key);
      invalidations++;
    }
  }
  const client = getRedis();
  if (!client) return 0;
  let cursor = 0;
  let deleted = 0;
  try {
    do {
      const result = await client.scan(cursor, { match: fullPattern, count: 100 });
      cursor = Number(result[0]);
      const keys = result[1] as string[];
      if (keys.length) deleted += await client.del(...keys);
    } while (cursor !== 0);
  } catch (error: any) {
    redisFailures++;
    logger.warn(`[SharedCache] Redis pattern invalidation failed: ${error?.message || error}`);
  }
  return deleted;
}

export function sharedCacheKey(parts: {
  tenantId: string;
  namespace: string;
  projectCode?: string | null;
  listingId?: string | null;
  version?: string | number | null;
  dimensions?: Record<string, string | number | null | undefined>;
}): string {
  const clean = (value: unknown) => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '_');
  const dimensions = Object.entries(parts.dimensions || {})
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${clean(key)}=${clean(value)}`)
    .join('&');
  return [
    clean(parts.tenantId),
    clean(parts.namespace),
    clean(parts.projectCode),
    clean(parts.listingId),
    `v=${clean(parts.version || '0')}`,
    dimensions,
  ].filter(Boolean).join(':');
}

export function sharedCacheStats() {
  return {
    localEntries: local.size, hits, misses, fallbackReads, fallbackWrites,
    invalidations, ttlWrites, redisFailures, redisConfigured: !!getRedis(),
  };
}
