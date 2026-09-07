import { Redis } from '@upstash/redis';
import { logger } from '../middleware/logger';

const PREFIX = 'sgs:cache:v2:';
const COORDINATION_PREFIX = 'sgs:coordination:v1:';
const MAX_LOCAL_ENTRIES = 1000;
const local = new Map<string, { value: unknown; expiresAt: number }>();
type RedisClient = Pick<Redis, 'get' | 'set' | 'del' | 'scan'> & {
  eval?: (script: string, keys: string[], args: string[]) => Promise<unknown>;
};
let redis: RedisClient | null | undefined;
let redisFailures = 0;
let hits = 0;
let misses = 0;
let fallbackReads = 0;
let fallbackWrites = 0;
let invalidations = 0;
let ttlWrites = 0;

function getRedis(): RedisClient | null {
  if (redis !== undefined) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

/** Test-only dependency injection for deterministic Redis outage coverage. */
export function setSharedCacheRedisForTesting(client: RedisClient | null | undefined): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('setSharedCacheRedisForTesting is only available in tests');
  }
  redis = client;
}

function fullKey(key: string): string {
  return `${PREFIX}${key}`;
}

function coordinationKey(key: string): string {
  return `${COORDINATION_PREFIX}${key}`;
}

export type SharedCoordinationResult<T> =
  | { status: 'acquired'; value: T }
  | { status: 'held'; value: T | null }
  | { status: 'missing'; value: null }
  | { status: 'unavailable'; value: null };

const CLAIM_OPERATIONAL_INCIDENT_SCRIPT = `
local current = redis.call("get", KEYS[1])
if not current then
  redis.call("set", KEYS[1], ARGV[1], "PX", ARGV[2])
  return {1, ARGV[1]}
end

local state = cjson.decode(current)
if state["phase"] == "resolved" then
  redis.call("set", KEYS[1], ARGV[1], "PX", ARGV[2])
  return {1, ARGV[1]}
end

return {0, current}
`;

const RESOLVE_OPERATIONAL_INCIDENT_SCRIPT = `
local current = redis.call("get", KEYS[1])
if not current then
  return {-1, ""}
end

local state = cjson.decode(current)
if state["phase"] ~= "active" then
  return {0, current}
end

state["phase"] = "resolved"
state["resolvedAt"] = ARGV[1]
local resolved = cjson.encode(state)
redis.call("set", KEYS[1], resolved, "PX", ARGV[2])
return {1, resolved}
`;

function coordinationResult<T>(
  result: unknown,
): SharedCoordinationResult<T> {
  if (!Array.isArray(result) || result.length < 2) {
    return { status: 'unavailable', value: null };
  }
  const [flag, rawValue] = result;
  let value: T | null = null;
  if (typeof rawValue === 'string' && rawValue.length > 0) {
    try {
      value = JSON.parse(rawValue) as T;
    } catch {
      return { status: 'unavailable', value: null };
    }
  }
  if (flag === -1 || flag === '-1') return { status: 'missing', value: null };
  return flag === 1 || flag === '1'
    ? { status: 'acquired', value: value as T }
    : { status: 'held', value };
}

/**
 * Atomically claim an operational incident in Redis.
 *
 * Coordination intentionally has no local fallback. A local cache value cannot
 * coordinate independent backend processes, so callers must fail open when
 * Redis is unavailable and continue their local transition.
 */
export async function claimSharedOperationalIncident<T>(
  key: string,
  value: T,
  ttlMs: number,
): Promise<SharedCoordinationResult<T>> {
  const client = getRedis();
  if (!client?.eval) return { status: 'unavailable', value: null };
  try {
    const result = await client.eval(
      CLAIM_OPERATIONAL_INCIDENT_SCRIPT,
      [coordinationKey(key)],
      [JSON.stringify(value), String(Math.max(1, Math.floor(ttlMs)))],
    );
    return coordinationResult<T>(result);
  } catch (error: any) {
    redisFailures++;
    logger.warn(`[SharedCache] Operational coordination unavailable: ${error?.message || error}`);
    return { status: 'unavailable', value: null };
  }
}

/**
 * Atomically transition the active operational incident to resolved.
 *
 * The resolved value remains for a short bounded retention window. A new
 * outage can replace it atomically, preventing a stale recovery marker from
 * suppressing the next incident.
 */
export async function resolveSharedOperationalIncident<T>(
  key: string,
  resolvedAt: string,
  ttlMs: number,
): Promise<SharedCoordinationResult<T>> {
  const client = getRedis();
  if (!client?.eval) return { status: 'unavailable', value: null };
  try {
    const result = await client.eval(
      RESOLVE_OPERATIONAL_INCIDENT_SCRIPT,
      [coordinationKey(key)],
      [resolvedAt, String(Math.max(1, Math.floor(ttlMs)))],
    );
    return coordinationResult<T>(result);
  } catch (error: any) {
    redisFailures++;
    logger.warn(`[SharedCache] Operational recovery coordination unavailable: ${error?.message || error}`);
    return { status: 'unavailable', value: null };
  }
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

export type SharedCacheRead<T> = {
  value: T | null;
  source: 'redis' | 'fallback' | 'miss';
};

export async function sharedCacheRead<T>(key: string): Promise<SharedCacheRead<T>> {
  const namespaced = fullKey(key);
  const client = getRedis();
  if (client) {
    try {
      const value = await client.get<T>(namespaced);
      if (value !== null && value !== undefined) {
        hits++;
        localSet(namespaced, value, 30_000);
        return { value, source: 'redis' };
      }
      // A successful Redis miss is authoritative. A value left in this
      // process's fallback cache may have been invalidated by another
      // instance, so it must never be returned in this case.
      local.delete(namespaced);
      misses++;
      return { value: null, source: 'miss' };
    } catch (error: any) {
      redisFailures++;
      fallbackReads++;
      logger.warn(`[SharedCache] Redis GET fallback: ${error?.message || error}`);
    }
  }
  const value = localGet<T>(namespaced);
  value === null ? misses++ : hits++;
  return { value, source: 'fallback' };
}

export async function sharedCacheGet<T>(key: string): Promise<T | null> {
  return (await sharedCacheRead<T>(key)).value;
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
