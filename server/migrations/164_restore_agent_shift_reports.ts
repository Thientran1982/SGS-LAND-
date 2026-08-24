import { PoolClient } from 'pg';

export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS agent_shift_reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      report_date DATE NOT NULL,
      shift TEXT NOT NULL DEFAULT 'ALL_DAY',
      metrics_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      summary TEXT NOT NULL DEFAULT '',
      reviewed BOOLEAN NOT NULL DEFAULT FALSE,
      reviewed_by UUID,
      reviewed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (tenant_id, report_date, shift)
    );
    CREATE INDEX IF NOT EXISTS idx_agent_shift_reports_tenant_date
      ON agent_shift_reports (tenant_id, report_date DESC);
    ALTER TABLE agent_shift_reports ENABLE ROW LEVEL SECURITY;
    ALTER TABLE agent_shift_reports FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation_v2 ON agent_shift_reports;
    CREATE POLICY tenant_isolation_v2 ON agent_shift_reports AS PERMISSIVE FOR ALL TO PUBLIC
      USING (NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
        AND tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), ''))
      WITH CHECK (NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
        AND tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), ''));
  `);
}

export async function down(client: PoolClient): Promise<void> {
  await client.query('DROP TABLE IF EXISTS agent_shift_reports CASCADE');
}

export default {
  up,
  down,
  description: 'Restore the tenant-scoped shift reports table required by Admin Cockpit',
};