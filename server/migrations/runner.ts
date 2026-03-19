/**
 * Database Migration Runner
 *
 * Replaces the monolithic initializeDatabase() with versioned, trackable migrations.
 * Each migration file exports `up()` (and optionally `down()`).
 * Executed migrations are recorded in schema_versions to prevent re-runs.
 *
 * Usage:
 *   npx tsx server/migrations/runner.ts          # run pending migrations
 *   npx tsx server/migrations/runner.ts --dry-run # preview without executing
 *
 * In server startup: call runPendingMigrations() before the app starts listening.
 */

import { Pool, PoolClient } from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import { readdirSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface Migration {
  up: (client: PoolClient) => Promise<void>;
  down?: (client: PoolClient) => Promise<void>;
  description: string;
}

async function ensureSchemaVersionsTable(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_versions (
      id          SERIAL PRIMARY KEY,
      version     VARCHAR(255) UNIQUE NOT NULL,
      description TEXT,
      applied_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function getAppliedVersions(client: PoolClient): Promise<Set<string>> {
  const result = await client.query('SELECT version FROM schema_versions ORDER BY id');
  return new Set(result.rows.map((r: any) => r.version));
}

function getMigrationFiles(): string[] {
  return readdirSync(__dirname)
    .filter(f => /^\d{3}_.*\.ts$/.test(f) && f !== 'runner.ts')
    .sort();
}

export async function runPendingMigrations(pool: Pool, isDryRun = false): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await ensureSchemaVersionsTable(client);

    const applied = await getAppliedVersions(client);
    const files = getMigrationFiles();
    const pending = files.filter(f => !applied.has(f));

    if (pending.length === 0) {
      console.log('[migrations] All up to date.');
      await client.query('COMMIT');
      return;
    }

    console.log(`[migrations] ${pending.length} pending migration(s):`);
    for (const file of pending) {
      console.log(`  → ${file}`);
    }

    if (isDryRun) {
      console.log('[migrations] Dry run — no changes applied.');
      await client.query('ROLLBACK');
      return;
    }

    for (const file of pending) {
      const mod = await import(`./${file}`);
      const migration: Migration = mod.default || mod;

      console.log(`[migrations] Applying ${file}: ${migration.description || ''}`);
      await migration.up(client);
      await client.query(
        'INSERT INTO schema_versions (version, description) VALUES ($1, $2)',
        [file, migration.description || null]
      );
      console.log(`[migrations] ✓ ${file}`);
    }

    await client.query('COMMIT');
    console.log('[migrations] All migrations applied successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[migrations] FAILED — rolled back:', err);
    throw err;
  } finally {
    client.release();
  }
}

export async function rollbackLastMigration(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await ensureSchemaVersionsTable(client);

    const result = await client.query(
      'SELECT version FROM schema_versions ORDER BY id DESC LIMIT 1'
    );
    if (result.rows.length === 0) {
      console.log('[migrations] Nothing to rollback.');
      await client.query('COMMIT');
      return;
    }

    const lastVersion: string = result.rows[0].version;
    const mod = await import(`./${lastVersion}`);
    const migration: Migration = mod.default || mod;

    if (!migration.down) {
      throw new Error(`Migration ${lastVersion} has no down() — cannot rollback`);
    }

    console.log(`[migrations] Rolling back ${lastVersion}...`);
    await migration.down(client);
    await client.query('DELETE FROM schema_versions WHERE version = $1', [lastVersion]);

    await client.query('COMMIT');
    console.log(`[migrations] ✓ Rolled back ${lastVersion}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[migrations] Rollback FAILED:', err);
    throw err;
  } finally {
    client.release();
  }
}

// CLI entrypoint
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const isDryRun = process.argv.includes('--dry-run');
  const isRollback = process.argv.includes('--rollback');

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const action = isRollback
    ? rollbackLastMigration(pool)
    : runPendingMigrations(pool, isDryRun);

  action
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
