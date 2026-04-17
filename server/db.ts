import { Pool, PoolClient, types } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Parse numeric (OID 1700) and int8 (OID 20) columns as JS numbers instead of strings
types.setTypeParser(1700, (val: string) => parseFloat(val));
types.setTypeParser(20, (val: string) => parseInt(val, 10));

// Prefer the user-managed Neon URL when present, fall back to runtime-managed DATABASE_URL.
// This lets us migrate to a customer Neon project without touching the runtime-managed Helium DB var.
// Strip libpq-only params (e.g. channel_binding) that node-pg does not recognise.
function sanitiseConnectionString(raw: string | undefined): string | undefined {
  if (!raw) return raw;
  return raw.replace(/[?&]channel_binding=[^&]*/g, (m) => (m.startsWith('?') ? '?' : '')).replace(/\?&/, '?').replace(/\?$/, '');
}
const DB_CONNECTION_STRING = sanitiseConnectionString(
  process.env.PROD_DATABASE_URL || process.env.NEON_DATABASE_URL || process.env.DATABASE_URL
);
if (process.env.PROD_DATABASE_URL) {
  console.log('[DB] Using PROD_DATABASE_URL (shared production Neon — same DB for dev & prod)');
} else if (process.env.NEON_DATABASE_URL) {
  console.log('[DB] Using NEON_DATABASE_URL (customer Neon project)');
}

export const pool = new Pool({
  connectionString: DB_CONNECTION_STRING,
  max: 10,
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
