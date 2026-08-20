import { PoolClient } from 'pg';

/**
 * Tenant-scoped monthly and quarterly KPI targets used by the CRM dashboard.
 * Actual values remain derived from analytics; this table stores only the
 * manager-configured targets.
 */
export default {
  id: '136_dashboard_kpi_targets',
  description: 'Create tenant-scoped monthly and quarterly dashboard KPI targets',

  async up(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS dashboard_kpi_targets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        metric VARCHAR(64) NOT NULL CHECK (metric IN ('revenue', 'pipeline', 'salesVelocity')),
        target_year INTEGER NOT NULL CHECK (target_year BETWEEN 2020 AND 2100),
        target_month INTEGER NOT NULL CHECK (target_month BETWEEN 1 AND 12),
        monthly_target NUMERIC(20, 2) NOT NULL DEFAULT 0 CHECK (monthly_target >= 0),
        quarter_target NUMERIC(20, 2) NOT NULL DEFAULT 0 CHECK (quarter_target >= 0),
        updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, metric, target_year, target_month)
      )
    `);
    await client.query(`
      ALTER TABLE dashboard_kpi_targets ENABLE ROW LEVEL SECURITY;
      ALTER TABLE dashboard_kpi_targets FORCE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS tenant_isolation_v2 ON dashboard_kpi_targets;
      CREATE POLICY tenant_isolation_v2 ON dashboard_kpi_targets
        AS PERMISSIVE FOR ALL TO PUBLIC
        USING (
          tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), '')
          OR current_setting('app.bypass_rls', true) = 'on'
        )
        WITH CHECK (
          tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), '')
          OR current_setting('app.bypass_rls', true) = 'on'
        )
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_dashboard_kpi_targets_scope ON dashboard_kpi_targets (tenant_id, target_year, target_month)');
  },

  async down(client: PoolClient): Promise<void> {
    await client.query('DROP TABLE IF EXISTS dashboard_kpi_targets');
  },
};