import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const migration: Migration = {
  description: 'Tenant-scoped audit history for controlled agent event replays',
  async up(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS agent_event_replay_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        event_id UUID NOT NULL REFERENCES agent_operating_events(id) ON DELETE CASCADE,
        operator_id UUID NOT NULL,
        reason TEXT NOT NULL,
        replay_number INTEGER NOT NULL CHECK (replay_number > 0),
        result_status TEXT NOT NULL DEFAULT 'PENDING'
          CHECK (result_status IN ('PENDING','PROCESSING','DONE','FAILED','DEAD_LETTER')),
        result_error TEXT,
        requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMPTZ,
        UNIQUE (tenant_id, event_id, replay_number)
      );
      ALTER TABLE agent_operating_events
        ADD COLUMN IF NOT EXISTS active_replay_id UUID;
      CREATE INDEX IF NOT EXISTS idx_agent_replay_history_event
        ON agent_event_replay_history (tenant_id, event_id, requested_at DESC);
      CREATE INDEX IF NOT EXISTS idx_agent_replay_history_operator
        ON agent_event_replay_history (tenant_id, operator_id, requested_at DESC);
      ALTER TABLE agent_event_replay_history ENABLE ROW LEVEL SECURITY;
      ALTER TABLE agent_event_replay_history FORCE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS tenant_isolation_v2 ON agent_event_replay_history;
      CREATE POLICY tenant_isolation_v2 ON agent_event_replay_history
        AS PERMISSIVE FOR ALL TO PUBLIC
        USING (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), '')
        )
        WITH CHECK (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), '')
        );
      GRANT SELECT, INSERT, UPDATE, DELETE ON agent_event_replay_history TO sgs_app;
    `);
  },
  async down(client: PoolClient): Promise<void> {
    await client.query(`
      DROP TABLE IF EXISTS agent_event_replay_history;
      ALTER TABLE agent_operating_events DROP COLUMN IF EXISTS active_replay_id;
    `);
  },
};

export default migration;