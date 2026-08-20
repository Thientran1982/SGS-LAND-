import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const TENANT_EXPR = `(
  NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
  AND tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), '')
)`;

const migration: Migration = {
  description: 'Create tenant-scoped Agent Minh audit ledger for chat, tools, and entities',

  async up(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS agent_audit_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        event_key TEXT NOT NULL,
        event_type TEXT NOT NULL CHECK (event_type IN ('CHAT_MESSAGE','TOOL_EXECUTION','ENTITY_OBSERVED')),
        direction TEXT CHECK (direction IN ('INBOUND','OUTBOUND')),
        session_id TEXT,
        lead_id UUID,
        run_id UUID,
        trace_id TEXT,
        tool_name TEXT,
        entity_type TEXT,
        entity_id TEXT,
        entity_code TEXT,
        parent_entity_type TEXT,
        parent_entity_id TEXT,
        status TEXT NOT NULL DEFAULT 'SUCCESS',
        input_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        output_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        latency_ms INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, event_key)
      );
      CREATE INDEX IF NOT EXISTS idx_agent_audit_tenant_recent
        ON agent_audit_events (tenant_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_agent_audit_session
        ON agent_audit_events (tenant_id, session_id, created_at ASC);
      CREATE INDEX IF NOT EXISTS idx_agent_audit_run
        ON agent_audit_events (tenant_id, run_id, created_at ASC);
      CREATE INDEX IF NOT EXISTS idx_agent_audit_entity
        ON agent_audit_events (tenant_id, entity_type, entity_id, created_at DESC);
      ALTER TABLE agent_audit_events ENABLE ROW LEVEL SECURITY;
      ALTER TABLE agent_audit_events FORCE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS tenant_isolation_v2 ON agent_audit_events;
      CREATE POLICY tenant_isolation_v2 ON agent_audit_events
        AS PERMISSIVE FOR ALL TO PUBLIC
        USING (${TENANT_EXPR})
        WITH CHECK (${TENANT_EXPR});
      GRANT SELECT, INSERT, UPDATE, DELETE ON agent_audit_events TO sgs_app;
    `);
  },

  async down(client: PoolClient): Promise<void> {
    await client.query('DROP TABLE IF EXISTS agent_audit_events');
  },
};

export default migration;