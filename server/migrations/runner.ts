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
import m020 from './020_task_management';
import m021 from './021_inbox_performance';
import m022 from './022_sequences_fix_columns';
import m023 from './023_contract_assigned_to';
import m024 from './024_leads_won_at';
import m025 from './025_notifications';
import m026 from './026_email_verification';
import m027 from './027_activate_initial_admin';
import m028 from './028_seo_overrides';
import m029 from './029_seed_initial_admin';
import m030 from './030_seed_news_articles';
import m031 from './031_enrich_article_images';
import m032 from './032_update_articles_to_2026';
import m033 from './033_fix_hcmc_cover_image';
import m034 from './034_update_dates_march_2026';
import m035 from './035_fix_hcmc_images_verified';
import m036 from './036_hanoi_fix_and_dongnai_article';
import m037 from './037_newsletter_subscribers';
import m038 from './038_normalize_user_roles_uppercase';
import m039 from './039_leads_thread_status';
import m040 from './040_ai_feedback';
import m041 from './041_ai_feedback_dedup';
import m042 from './042_uploaded_files_table';
import m043 from './043_cleanup_broken_upload_refs';
import m044 from './044_guest_feedback';
import m045 from './045_feedback_fk_fix';
import m046 from './046_market_price_history';
import m047 from './047_agent_observations';
import m048 from './048_performance_indexes';
import m049 from './049_leads_cursor_index';
import m050 from './050_articles_images_column';
import m051 from './051_articles_videos_column';
import m052 from './052_fix_listing_status_opening';
import m053 from './053_fix_processing_documents';
import m054 from './054_error_logs';
import m055 from './055_seed_market_prices';
import m056 from './056_bank_rates';
import m057 from './057_email_campaign_log';
import m058 from './058_seed_departments_all_tenants';
import m059 from './059_fix_department_uuid';
import m060 from './060_ai_agents';
import m061 from './061_valuation_agent';
import m062 from './062_valuation_usage_log';
import m064 from './064_valuation_cost_alerts_early_warning';
import m065 from './065_ai_usage_log';

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
  '020_task_management.ts': m020,
  '021_inbox_performance.ts': m021,
  '022_sequences_fix_columns.ts': m022,
  '023_contract_assigned_to.ts': m023,
  '024_leads_won_at.ts': m024,
  '025_notifications.ts': m025,
  '026_email_verification.ts': m026,
  '027_activate_initial_admin.ts': m027,
  '028_seo_overrides.ts': m028,
  '029_seed_initial_admin.ts': m029,
  '030_seed_news_articles.ts': m030,
  '031_enrich_article_images.ts': m031,
  '032_update_articles_to_2026.ts': m032,
  '033_fix_hcmc_cover_image.ts': m033,
  '034_update_dates_march_2026.ts': m034,
  '035_fix_hcmc_images_verified.ts': m035,
  '036_hanoi_fix_and_dongnai_article.ts': m036,
  '037_newsletter_subscribers.ts': m037,
  '038_normalize_user_roles_uppercase.ts': m038,
  '039_leads_thread_status.ts': m039,
  '040_ai_feedback.ts': m040,
  '041_ai_feedback_dedup.ts': m041,
  '042_uploaded_files_table.ts': m042,
  '043_cleanup_broken_upload_refs.ts': m043,
  '044_guest_feedback.ts': m044,
  '045_feedback_fk_fix.ts': m045,
  '046_market_price_history.ts': m046,
  '047_agent_observations.ts':   m047,
  '048_performance_indexes.ts':  m048,
  '049_leads_cursor_index.ts':   m049,
  '050_articles_images_column.ts': m050,
  '051_articles_videos_column.ts': m051,
  '052_fix_listing_status_opening.ts': m052,
  '053_fix_processing_documents.ts': m053,
  '054_error_logs.ts': m054,
  '055_seed_market_prices.ts': m055,
  '056_bank_rates.ts': m056,
  '057_email_campaign_log.ts': m057,
  '058_seed_departments_all_tenants.ts': m058,
  '059_fix_department_uuid.ts': m059,
  '060_ai_agents.ts': m060,
  '061_valuation_agent.ts': m061,
  '062_valuation_usage_log.ts': m062,
  '064_valuation_cost_alerts_early_warning.ts': m064,
  '065_ai_usage_log.ts': m065,
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

// Arbitrary unique lock key for this app's migration process
const MIGRATION_ADVISORY_LOCK_KEY = 74839230;

export async function runPendingMigrations(pool: Pool, isDryRun = false): Promise<void> {
  const client = await pool.connect();
  let lockAcquired = false;
  try {
    // Acquire session-level advisory lock so concurrent instances (autoscale)
    // queue up instead of deadlocking on CREATE INDEX / DDL statements.
    console.log('[migrations] Waiting for advisory lock...');
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_ADVISORY_LOCK_KEY]);
    lockAcquired = true;
    console.log('[migrations] Lock acquired.');

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
    if (lockAcquired) {
      try {
        await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_ADVISORY_LOCK_KEY]);
        console.log('[migrations] Advisory lock released.');
      } catch (_) {
        // ignore unlock errors — connection will release the lock anyway
      }
    }
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

