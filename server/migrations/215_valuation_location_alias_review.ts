import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const migration: Migration = {
  description: 'Reviewable tenant-scoped valuation location aliases',

  async up(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS valuation_location_aliases (
        id TEXT PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        level TEXT NOT NULL CHECK (level IN ('province', 'district', 'project')),
        canonical TEXT NOT NULL,
        alias TEXT NOT NULL,
        normalized_alias TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'approved', 'rejected')),
        proposed_by TEXT,
        reviewed_by TEXT,
        reviewed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, level, normalized_alias)
      );
      CREATE INDEX IF NOT EXISTS idx_valuation_location_aliases_review
        ON valuation_location_aliases (tenant_id, status, created_at DESC);
      ALTER TABLE valuation_location_aliases ENABLE ROW LEVEL SECURITY;
      ALTER TABLE valuation_location_aliases FORCE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS tenant_isolation_v2 ON valuation_location_aliases;
      CREATE POLICY tenant_isolation_v2 ON valuation_location_aliases AS PERMISSIVE FOR ALL TO PUBLIC
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
    await client.query('DROP TABLE IF EXISTS valuation_location_aliases CASCADE');
  },
};

export default migration;