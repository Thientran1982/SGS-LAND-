import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

/**
 * @deprecated Schema initialization is handled exclusively by the migration runner.
 * Call runPendingMigrations(pool) from server/migrations/runner.ts instead.
 * This stub is kept for backward compatibility only.
 */
export async function initializeDatabase(): Promise<void> {
  const { runPendingMigrations } = await import('./migrations/runner.js');
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
