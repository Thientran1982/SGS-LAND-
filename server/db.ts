import { Pool, PoolClient, types } from 'pg';
import dotenv from 'dotenv';
dotenv.config();
// Parse numeric (OID 1700) and int8 (OID 20) columns as JS numbers instead of strings
types.setTypeParser(1700, (val: string) => parseFloat(val));
types.setTypeParser(20, (val: string) => parseInt(val, 10));
// NEON_DATABASE_URL là nguồn dữ liệu duy nhất (đã đồng bộ đầy đủ từ PROD 20/04/2026).
// Ưu tiên NEON_DATABASE_URL → PROD_DATABASE_URL (backup) → DATABASE_URL (runtime).
// Strip libpq-only params (e.g. channel_binding) that node-pg does not recognise.
function sanitiseConnectionString(raw: string | undefined): string | undefined {
  if (!raw) return raw;
  return raw.replace(/[?&]channel_binding=[^&]*/g, (m) => (m.startsWith('?') ? '?' : '')).replace(/\?&/, '?').replace(/\?$/, '');
}
const DB_CONNECTION_STRING = sanitiseConnectionString(
  process.env.NEON_DATABASE_URL || process.env.PROD_DATABASE_URL || process.env.DATABASE_URL
);
if (process.env.NEON_DATABASE_URL) {
  console.log('[DB] Using NEON_DATABASE_URL — nguồn dữ liệu chính thức duy nhất');
} else if (process.env.PROD_DATABASE_URL) {
  console.log('[DB] Using PROD_DATABASE_URL (fallback)');
}
export const pool = new Pool({
  connectionString: DB_CONNECTION_STRING,
  max: 20,                       // 20 connections — supports 1000+ concurrent users (Neon allows 25-100 depending on plan)
  idleTimeoutMillis: 240000,     // 4 min — evict idle connections before Neon's 5-min hard timeout
  connectionTimeoutMillis: 15000,
  statement_timeout: 30000,
  keepAlive: true,               // Send TCP keepalive packets to detect dead connections
  keepAliveInitialDelayMillis: 10000,
  application_name: 'sgs-land-api',
});
// Log pool errors so they appear in production logs rather than crashing silently
pool.on('error', (err) => {
  console.error('[DB Pool] Unexpected client error:', err.message);
});

// ── Quota-exceeded fallback ───────────────────────────────────────────────
// When Neon's free-tier compute quota is exhausted every pool.connect() fails.
// We transparently switch to the local Replit PostgreSQL (DATABASE_URL) so
// the dev server keeps running. Migrations run on the local DB on first
// connection, setting up the schema there automatically.
export function isQuotaError(err: any): boolean {
  return typeof err?.message === 'string' && (
    err.message.includes('compute time quota') ||
    err.message.includes('exceeded the compute')
  );
}
const _localDbUrl = sanitiseConnectionString(process.env.DATABASE_URL);
const _hasFallback = !!_localDbUrl && _localDbUrl !== DB_CONNECTION_STRING;
let _fallbackActive = false;
let _fallbackPool: Pool | null = null;
if (_hasFallback && _localDbUrl) {
  _fallbackPool = new Pool({
    connectionString: _localDbUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 30_000,
    application_name: 'sgs-land-api-local',
  });
  _fallbackPool.on('error', (err) => {
    console.error('[DB Local Pool] Error:', err.message);
  });
}
// Patch pool.connect so every caller (withTenantContext, withTransaction,
// withRlsBypass, raw pool.query) automatically uses the fallback once active.
const _origConnect = pool.connect.bind(pool);
(pool as any).connect = async function () {
  if (_fallbackActive && _fallbackPool) return _fallbackPool.connect();
  try {
    return await _origConnect();
  } catch (err: any) {
    if (isQuotaError(err) && _fallbackPool && !_fallbackActive) {
      console.warn('[DB] Neon compute quota exceeded — switching to local DATABASE_URL. Migrations will run on local DB automatically.');
      _fallbackActive = true;
      // Re-run migrations on the local DB so the schema is ready.
      // Import lazily to avoid circular deps at module load time.
      import('./migrations/runner').then(({ runPendingMigrations }) => {
        runPendingMigrations(_fallbackPool!).catch((e) => {
          console.error('[DB] Local DB migration failed:', e?.message || e);
        });
      }).catch(() => {});
      return _fallbackPool.connect();
    }
    throw err;
  }
};
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
    // CRITICAL: neondb_owner có row_security=off mặc định (do BYPASSRLS).
    // Sau khi SET LOCAL ROLE sgs_app (không có BYPASSRLS), phải bật lại row_security=on
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
    // Bật lại row_security=on cho sgs_app (session default của neondb_owner là off).
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