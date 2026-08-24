import { Pool, PoolClient, types } from 'pg';
import { Redis } from '@upstash/redis';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();
// Parse numeric (OID 1700) and int8 (OID 20) columns as JS numbers instead of strings
types.setTypeParser(1700, (val: string) => parseFloat(val));
types.setTypeParser(20, (val: string) => parseInt(val, 10));
// AIVEN_DATABASE_URL is the only supported database connection string.
// Strip libpq-only params (e.g. channel_binding) that node-pg does not recognise.
function sanitiseConnectionString(raw: string | undefined): string | undefined {
  if (!raw) return raw;
  return raw.replace(/[?&]channel_binding=[^&]*/g, (m) => (m.startsWith('?') ? '?' : '')).replace(/\?&/, '?').replace(/\?$/, '');
}
 function withAivenCaCert(url: string | undefined): string | undefined {
  if (!url) return url;
  if (!url.includes('aivencloud.com')) return url;
  if (url.includes('sslrootcert=')) return url;
  const caPath = path.join(process.cwd(), 'certs', 'aiven-ca.pem');
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}sslrootcert=${caPath}`;
}

const DB_CONNECTION_STRING = withAivenCaCert(sanitiseConnectionString(
  process.env.AIVEN_DATABASE_URL
));
if (!DB_CONNECTION_STRING) {
  throw new Error('[DB] AIVEN_DATABASE_URL is required');
}
console.log('[DB] Using AIVEN_DATABASE_URL');
export const pool = new Pool({
  connectionString: DB_CONNECTION_STRING,
  max: 20,                       // Keep the pool bounded for the Aiven service plan.
  idleTimeoutMillis: 240000,     // 4 min — evict idle connections while keeping the API pool healthy
  connectionTimeoutMillis: 15000,
  statement_timeout: 30000,
  keepAlive: true,               // Send TCP keepalive packets to detect dead connections
  keepAliveInitialDelayMillis: 10000,
  application_name: 'sgs-land-api',
});

type DistributedLockRedis = Pick<Redis, 'set' | 'eval'>;
let distributedLockRedis: DistributedLockRedis | null | undefined;

function getDistributedLockRedis(): DistributedLockRedis | null {
  if (distributedLockRedis !== undefined) return distributedLockRedis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  distributedLockRedis = url && token ? new Redis({ url, token }) : null;
  return distributedLockRedis;
}

/**
 * Execute a critical section under a cross-process Redis lock.
 *
 * A missing Redis configuration or Redis outage is fail-closed: callers get
 * null and can leave durable work untouched for the next scheduler tick.
 * Release is compare-and-delete so an expired lock cannot be deleted by an
 * old worker after another worker has acquired the same key.
 */
export async function withDistributedLock<T>(
  name: string,
  fn: () => Promise<T>,
  options: { ttlMs?: number } = {},
): Promise<T | null> {
  const redis = getDistributedLockRedis();
  if (!redis) return null;

  const ttlMs = options.ttlMs ?? 10 * 60_000;
  const key = `sgs:lock:${name}`;
  const token = `${process.pid}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  try {
    const acquired = await redis.set(key, token, { nx: true, px: ttlMs });
    if (acquired !== 'OK') return null;
  } catch (error: any) {
    console.error(`[DB] distributed lock unavailable: ${error?.message || error}`);
    return null;
  }

  try {
    return await fn();
  } finally {
    try {
      await redis.eval(
        'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end',
        [key],
        [token],
      );
    } catch (error: any) {
      // TTL remains the safety net if release cannot reach Redis.
      console.error(`[DB] distributed lock release failed: ${error?.message || error}`);
    }
  }
}
// Log pool errors so they appear in production logs rather than crashing silently
pool.on('error', (err) => {
  console.error('[DB Pool] Unexpected client error:', err.message);
});
/**
 * @deprecated Schema initialization is handled exclusively by the migration runner.
 * Call runPendingMigrations(pool) from server/migrations/runner.ts instead.
 * This stub is kept for backward compatibility only and should not be called in production code.
 */
export async function initializeDatabase(): Promise<void> {
  // Use a static import to avoid brittle dynamic-import path resolution (.ts vs .js)
  // across different runtime/transpilation modes (tsx, tsc, node with --loader, etc.)
  const { runPendingMigrations } = await import('./migrations/runner');
  await runPendingMigrations(pool);
}
/**
 * Tên role runtime — KHÔNG có BYPASSRLS — để Postgres thực thi RLS thay vì owner bỏ qua.
 * Tạo bởi migration 070. Có thể override qua APP_DB_ROLE nếu cần.
 */
const APP_DB_ROLE = (process.env.APP_DB_ROLE || 'sgs_app').replace(/[^a-z0-9_]/gi, '');
export async function withTenantContext<T>(
  tenantId: string,
  queryFn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const sanitized = tenantId.replace(/[^a-f0-9\-]/gi, '');
  if (sanitized.length !== tenantId.length) {
    throw new Error('Invalid tenant ID format');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // SET LOCAL ROLE: chuyển sang role NOBYPASSRLS để Postgres thực thi policy RLS.
    // Phải SET ROLE TRƯỚC khi đặt app.current_tenant_id để policy đánh giá đúng.
    await client.query(`SET LOCAL ROLE ${APP_DB_ROLE}`);
    // The database owner may have row_security=off by default due to BYPASSRLS.
    // After SET LOCAL ROLE sgs_app (without BYPASSRLS), enable row_security=on
    // để PostgreSQL thực thi RLS policy đúng cách thay vì throw "query would be affected".
    await client.query('SET LOCAL row_security = on');
    await client.query(`SET LOCAL app.current_tenant_id = '${sanitized}'`);
    const result = await queryFn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
export async function withTransaction<T>(
  queryFn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await queryFn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
/**
 * RLS bypass channel — sử dụng cho các truy vấn cross-tenant hợp pháp:
 *   • B2B2C partner đọc inventory của developer (project_access JOIN).
 *   • Webhook hệ thống không có user/tenant context (Stripe, Zalo OA…).
 *   • Tra cứu nội bộ bằng PRIMARY KEY khi đã xác thực ngoài (vd: token public, JWT).
 *
 * Đặt biến phiên `app.bypass_rls = 'on'` chỉ trong phạm vi transaction (SET LOCAL),
 * tự động xóa khi connection trở lại pool. Các policy `tenant_isolation_v2`
 * sẽ cho phép đọc/ghi vượt tenant khi biến này bật.
 *
 * QUAN TRỌNG: Code gọi withRlsBypass PHẢI tự ràng buộc dữ liệu bằng WHERE
 * (id, token, partner_tenant_id, …) — bypass không thay thế kiểm tra logic.
 */
export async function withRlsBypass<T>(
  queryFn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL ROLE ${APP_DB_ROLE}`);
    // Enable row_security=on for sgs_app (the database owner session may default to off).
    // bypass được xử lý bằng app.bypass_rls='on' trong RLS policy, không phải row_security=off.
    await client.query('SET LOCAL row_security = on');
    await client.query("SET LOCAL app.bypass_rls = 'on'");
    const result = await queryFn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}