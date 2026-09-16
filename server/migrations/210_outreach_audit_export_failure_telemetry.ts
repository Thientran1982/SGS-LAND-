import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const TENANT_EXPR = `(
  NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
  AND tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), '')
)`;

const migration: Migration = {
  description: 'Record bounded tenant-scoped outreach audit export failure telemetry',

  async up(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS outreach_audit_export_failure_telemetry (
        tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        failure_category TEXT NOT NULL CHECK (failure_category IN (
          'APPROVAL_LOOKUP',
          'AUDIT_HISTORY_LOOKUP',
          'CSV_SERIALIZATION',
          'UNKNOWN'
        )),
        bucket_start     TIMESTAMPTZ NOT NULL,
        failure_count    INTEGER NOT NULL DEFAULT 0 CHECK (failure_count >= 0 AND failure_count <= 10000),
        first_failed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_failed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (tenant_id, failure_category, bucket_start)
      );

      CREATE INDEX IF NOT EXISTS idx_outreach_audit_export_failure_recent
        ON outreach_audit_export_failure_telemetry (tenant_id, bucket_start DESC);

      ALTER TABLE outreach_audit_export_failure_telemetry ENABLE ROW LEVEL SECURITY;
      ALTER TABLE outreach_audit_export_failure_telemetry FORCE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS tenant_isolation_v2 ON outreach_audit_export_failure_telemetry;
      CREATE POLICY tenant_isolation_v2 ON outreach_audit_export_failure_telemetry
        AS PERMISSIVE FOR ALL TO PUBLIC
        USING (${TENANT_EXPR})
        WITH CHECK (${TENANT_EXPR});
    `);
  },

  async down(client: PoolClient): Promise<void> {
    await client.query('DROP TABLE IF EXISTS outreach_audit_export_failure_telemetry;');
  },
};

export default migration;