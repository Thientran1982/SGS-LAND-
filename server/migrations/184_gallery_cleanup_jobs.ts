import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const migration: Migration = {
  description: 'Persist tenant-scoped gallery storage cleanup retries',

  async up(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS gallery_cleanup_jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        landing_page_id UUID,
        filename TEXT NOT NULL CHECK (filename ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$'),
        status TEXT NOT NULL DEFAULT 'PENDING'
          CHECK (status IN ('PENDING', 'RUNNING', 'FAILED', 'SUCCEEDED')),
        attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
        last_error_code TEXT,
        last_attempt_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, filename)
      );

      CREATE INDEX IF NOT EXISTS idx_gallery_cleanup_jobs_tenant_status
        ON gallery_cleanup_jobs (tenant_id, status, updated_at DESC);

      ALTER TABLE gallery_cleanup_jobs ENABLE ROW LEVEL SECURITY;
      ALTER TABLE gallery_cleanup_jobs FORCE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS tenant_isolation_v2 ON gallery_cleanup_jobs;
      CREATE POLICY tenant_isolation_v2 ON gallery_cleanup_jobs AS PERMISSIVE FOR ALL TO PUBLIC
        USING (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), '')
        )
        WITH CHECK (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), '')
        );
    `);
  },

  async down(client: PoolClient): Promise<void> {
    await client.query('DROP TABLE IF EXISTS gallery_cleanup_jobs;');
  },
};

export default migration;