import type { PoolClient } from 'pg';
import type { Migration } from './runner';

/**
 * Follow-up schema guard for environments where migration 159 was already applied
 * before durable signal failure storage was introduced.
 */
const migration: Migration = {
  description: 'Ensure durable agent signal write failure storage exists',
  async up(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS agent_signal_write_failures (
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        signal_type TEXT NOT NULL,
        failure_count INTEGER NOT NULL DEFAULT 0 CHECK (failure_count >= 0 AND failure_count <= 10000),
        first_failed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_failed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_error TEXT NOT NULL DEFAULT '',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (tenant_id, signal_type)
      );
      CREATE INDEX IF NOT EXISTS idx_agent_signal_write_failures_recent
        ON agent_signal_write_failures (tenant_id, last_failed_at DESC);
      ALTER TABLE agent_signal_write_failures ENABLE ROW LEVEL SECURITY;
      ALTER TABLE agent_signal_write_failures FORCE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS tenant_isolation_v2 ON agent_signal_write_failures;
      CREATE POLICY tenant_isolation_v2 ON agent_signal_write_failures AS PERMISSIVE FOR ALL TO PUBLIC
        USING (NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), ''))
        WITH CHECK (NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), ''));
    `);
  },
  async down(client: PoolClient): Promise<void> {
    await client.query('DROP TABLE IF EXISTS agent_signal_write_failures;');
  },
};

export default migration;