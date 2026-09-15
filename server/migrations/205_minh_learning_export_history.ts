import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const migration: Migration = {
  description: 'Record tenant-scoped Minh learning export history without snapshot data',
  async up(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS minh_learning_export_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        operator_id UUID NOT NULL,
        window_days INTEGER NOT NULL CHECK (window_days BETWEEN 1 AND 90),
        status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'FAILED')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_minh_learning_export_history_tenant_created
        ON minh_learning_export_history (tenant_id, created_at DESC, id DESC);

      ALTER TABLE minh_learning_export_history ENABLE ROW LEVEL SECURITY;
      ALTER TABLE minh_learning_export_history FORCE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS tenant_isolation_v2 ON minh_learning_export_history;
      CREATE POLICY tenant_isolation_v2 ON minh_learning_export_history AS PERMISSIVE FOR ALL TO PUBLIC
        USING (NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), ''))
        WITH CHECK (NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), ''));
    `);
  },
  async down(client: PoolClient): Promise<void> {
    await client.query('DROP TABLE IF EXISTS minh_learning_export_history CASCADE');
  },
};

export default migration;