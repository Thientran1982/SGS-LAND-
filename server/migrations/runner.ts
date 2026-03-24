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
 *
 * BUNDLING NOTE: Migration files are imported statically so that esbuild can
 * bundle them into server.js. Dynamic filesystem discovery (readdirSync) is NOT
 * used because __dirname resolves to the bundle output directory in production.
 */

import { Pool, PoolClient } from 'pg';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import m001 from './001_baseline_schema';
import m002 from './002_audit_logs_and_tasks';
import m003 from './003_ai_and_billing';
import m004 from './004_rbac_creator_columns';
import m005 from './005_projects_and_b2b2c';
import m006 from './006_fix_schema_mismatches';
import m007 from './007_performance_indexes';
import m008 from './008_listing_access';
import m009 from './009_extended_schema';
import m010 from './010_payment_schedule_column';
import m011 from './011_dispute_resolution_column';
import m012 from './012_signed_place';
import m013 from './013_subscription_columns';
import m014 from './014_listing_assigned_to';
import m015 from './015_theme_config';
import m016 from './016_migrate_theme_to_enterprise_config';
import m017 from './017_enterprise_config_theme_column';
import m018 from './018_user_page_views';
import m019 from './019_tenant_config_defaults';

dotenv.config();

export interface Migration {
  up: (client: PoolClient) => Promise<void>;
  down?: (client: PoolClient) => Promise<void>;
  description: string;
}

/**
 * Static registry of all migrations keyed by filename.
 * Add new migrations here in addition to creating the .ts file.
 * Order is determined by the sorted filename keys.
 */
const MIGRATION_REGISTRY: Record<string, Migration> = {
  '001_baseline_schema.ts': m001,
  '002_audit_logs_and_tasks.ts': m002,
  '003_ai_and_billing.ts': m003,
  '004_rbac_creator_columns.ts': m004,
  '005_projects_and_b2b2c.ts': m005,
  '006_fix_schema_mismatches.ts': m006,
  '007_performance_indexes.ts': m007,
  '008_listing_access.ts': m008,
  '009_extended_schema.ts': m009,
  '010_payment_schedule_column.ts': m010,
  '011_dispute_resolution_column.ts': m011,
  '012_signed_place.ts': m012,
  '013_subscription_columns.ts': m013,
  '014_listing_assigned_to.ts': m014,
  '015_theme_config.ts': m015,
  '016_migrate_theme_to_enterprise_config.ts': m016,
  '017_enterprise_config_theme_column.ts': m017,
  '018_user_page_views.ts': m018,
  '019_tenant_config_defaults.ts': m019,
};

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
  return Object.keys(MIGRATION_REGISTRY).sort();
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
      const migration = MIGRATION_REGISTRY[file];
      if (!migration || typeof migration.up !== 'function') {
        throw new Error(`[migrations] Invalid migration module for ${file} — missing up() function`);
      }

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
    const migration = MIGRATION_REGISTRY[lastVersion];

    if (!migration) {
      throw new Error(`[migrations] Unknown migration version: ${lastVersion}`);
    }
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
