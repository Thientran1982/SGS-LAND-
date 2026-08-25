import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const migration: Migration = {
  description: 'Record unresolved AI spend flush failures for operators',

  async up(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_spend_flush_alerts (
        tenant_id            UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
        pending_amount_usd   NUMERIC(18,6) NOT NULL CHECK (pending_amount_usd >= 0),
        retry_count          INTEGER NOT NULL CHECK (retry_count >= 1),
        first_failed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_failed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        resolved_at          TIMESTAMPTZ,
        updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_ai_spend_flush_alerts_open
        ON ai_spend_flush_alerts (last_failed_at DESC)
        WHERE resolved_at IS NULL;
      ALTER TABLE ai_spend_flush_alerts ENABLE ROW LEVEL SECURITY;
      ALTER TABLE ai_spend_flush_alerts FORCE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS tenant_isolation_v2 ON ai_spend_flush_alerts;
      CREATE POLICY tenant_isolation_v2 ON ai_spend_flush_alerts AS PERMISSIVE FOR ALL TO PUBLIC
        USING (NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), ''))
        WITH CHECK (NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), ''));
    `);
  },

  async down(client: PoolClient): Promise<void> {
    await client.query('DROP TABLE IF EXISTS ai_spend_flush_alerts;');
  },
};

export default migration;