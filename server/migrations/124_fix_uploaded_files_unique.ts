import { PoolClient } from 'pg';
import { Migration } from './runner';

/**
 * 042_uploaded_files_table.ts creates `uploaded_files` with
 * UNIQUE(tenant_id, filename) inside its CREATE TABLE IF NOT EXISTS
 * statement. On this database the table already existed from an earlier
 * deploy before that constraint was part of the migration, and
 * CREATE TABLE IF NOT EXISTS is a no-op against an existing table -- so the
 * constraint never actually got applied here.
 *
 * storageService.ts's storeFile() does:
 *   INSERT INTO uploaded_files (...) ON CONFLICT (tenant_id, filename) DO UPDATE ...
 * which requires a real unique constraint/index on (tenant_id, filename) to
 * resolve the conflict target. Without one, every upload (image/video/file)
 * fails with:
 *   error: there is no unique or exclusion constraint matching the ON CONFLICT specification
 * This migration backfills that missing uniqueness so uploads work again.
 */
const up = async (client: PoolClient): Promise<void> => {
  // Defensive: if duplicate (tenant_id, filename) rows already exist (possible
  // since the constraint was never enforced), keep only the most recent one
  // per pair before adding the unique index, otherwise index creation fails.
  const QUERY_A = [
    'DELETE FROM uploaded_files a',
    'USING uploaded_files b',
    'WHERE a.tenant_id = b.tenant_id',
    '  AND a.filename = b.filename',
    '  AND a.id < b.id',
  ].join('\n');
  const dedupe = await client.query(QUERY_A);
  if ((dedupe.rowCount ?? 0) > 0) {
    console.log(`[124] uploaded_files: removed ${dedupe.rowCount} duplicate row(s) before adding unique index`);
  }

  const QUERY_B = [
    'CREATE UNIQUE INDEX IF NOT EXISTS ux_uploaded_files_tenant_filename',
    'ON uploaded_files (tenant_id, filename)',
  ].join('\n');
  await client.query(QUERY_B);

  // The plain (non-unique) lookup index from 042 is now redundant.
  await client.query('DROP INDEX IF EXISTS idx_uploaded_files_lookup');
};

const down = async (client: PoolClient): Promise<void> => {
  await client.query('DROP INDEX IF EXISTS ux_uploaded_files_tenant_filename');
  const QUERY_C = [
    'CREATE INDEX IF NOT EXISTS idx_uploaded_files_lookup',
    'ON uploaded_files (tenant_id, filename)',
  ].join('\n');
  await client.query(QUERY_C);
};

export default {
  up,
  down,
  description: 'Add missing UNIQUE(tenant_id, filename) index on uploaded_files so ON CONFLICT upserts in storageService.storeFile() work (fixes broken image/video uploads)',
} satisfies Migration;
