import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const migration: Migration = {
  description: 'Controlled replay audit for interrupted daily report deliveries',
  async up(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS daily_report_delivery_replays (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        report_date DATE NOT NULL,
        delivery_key TEXT NOT NULL,
        message_id TEXT,
        attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
        status TEXT NOT NULL DEFAULT 'PENDING'
          CHECK (status IN ('PENDING','PROCESSING','SENT','SKIPPED','FAILED','DEAD_LETTER')),
        error TEXT,
        requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMPTZ,
        next_retry_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, delivery_key)
      );
      CREATE INDEX IF NOT EXISTS idx_daily_report_replays_due
        ON daily_report_delivery_replays (status, next_retry_at)
        WHERE status IN ('PENDING','FAILED');
      CREATE INDEX IF NOT EXISTS idx_daily_report_replays_tenant
        ON daily_report_delivery_replays (tenant_id, report_date, requested_at DESC);
      ALTER TABLE daily_report_delivery_replays ENABLE ROW LEVEL SECURITY;
      ALTER TABLE daily_report_delivery_replays FORCE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS tenant_isolation_v2 ON daily_report_delivery_replays;
      CREATE POLICY tenant_isolation_v2 ON daily_report_delivery_replays
        AS PERMISSIVE FOR ALL TO PUBLIC
        USING (NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), ''))
        WITH CHECK (NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), ''));
    `);
  },
  async down(client: PoolClient): Promise<void> {
    await client.query('DROP TABLE IF EXISTS daily_report_delivery_replays');
  },
};

export default migration;