import type { Migration } from './runner';

const migration: Migration = {
  description: 'Add tenant-scoped daily admin report log',
  async up(client) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS agent_report_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        report_date DATE NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending','sent','failed')),
        recipients JSONB NOT NULL DEFAULT '[]'::jsonb,
        summary_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
        error_detail TEXT,
        sent_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, report_date)
      );
      CREATE INDEX IF NOT EXISTS idx_agent_report_log_tenant_date
        ON agent_report_log (tenant_id, report_date DESC);
      ALTER TABLE agent_report_log ENABLE ROW LEVEL SECURITY;
      ALTER TABLE agent_report_log FORCE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS agent_report_log_tenant_isolation ON agent_report_log;
      CREATE POLICY agent_report_log_tenant_isolation ON agent_report_log
        USING (tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), ''))
        WITH CHECK (tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), ''));
    `);
  },
  async down(client) {
    await client.query('DROP TABLE IF EXISTS agent_report_log CASCADE');
  },
};

export default migration;