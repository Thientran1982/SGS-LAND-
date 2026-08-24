import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const migration: Migration = {
  description: 'Customer Care D1-D7 delivery history and inactivity alert idempotency',
  async up(client: PoolClient) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS care_followup_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
        day_mark TEXT NOT NULL CHECK (day_mark IN ('D1','D3','D5','D7')),
        delivery_key TEXT NOT NULL,
        subject TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('SENT','FAILED','UNKNOWN','SKIPPED')),
        sent_at TIMESTAMPTZ,
        error TEXT,
        UNIQUE (tenant_id, lead_id, day_mark)
      );
      ALTER TABLE leads
        ADD COLUMN IF NOT EXISTS care_status TEXT NOT NULL DEFAULT 'ACTIVE';
      CREATE INDEX IF NOT EXISTS idx_leads_care_status ON leads (tenant_id, care_status);
      CREATE INDEX IF NOT EXISTS idx_care_followup_due ON care_followup_log (tenant_id, lead_id, day_mark, status);
      CREATE TABLE IF NOT EXISTS care_inactivity_alert_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        last_login_at TIMESTAMPTZ NOT NULL,
        escalation_level TEXT NOT NULL CHECK (escalation_level IN ('first_notice','reminder_7d','reminder_14d')),
        delivery_key TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('SENT','FAILED','UNKNOWN','SKIPPED')),
        sent_at TIMESTAMPTZ,
        UNIQUE (tenant_id, user_id, last_login_at, escalation_level)
      );
      CREATE INDEX IF NOT EXISTS idx_care_inactivity_lookup ON care_inactivity_alert_log (tenant_id, user_id, last_login_at DESC);
    `);
    for (const table of ['care_followup_log', 'care_inactivity_alert_log']) {
      await client.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY; ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;`);
      await client.query(`DROP POLICY IF EXISTS tenant_isolation_v2 ON ${table}`);
      await client.query(`CREATE POLICY tenant_isolation_v2 ON ${table} AS PERMISSIVE FOR ALL TO PUBLIC
        USING (tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), ''))
        WITH CHECK (tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), ''))`);
    }
  },
  async down(client: PoolClient) {
    await client.query('DROP TABLE IF EXISTS care_inactivity_alert_log, care_followup_log CASCADE');
  },
};
export default migration;