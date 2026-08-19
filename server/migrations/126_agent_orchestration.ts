import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const POLICY_NAME = 'tenant_isolation_v2';
const SAFE_EXPR = `(
  NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
  AND tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), '')
)`;

async function applyTenantPolicy(client: PoolClient, table: string): Promise<void> {
  await client.query(`DROP POLICY IF EXISTS ${POLICY_NAME} ON ${table}`);
  await client.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
  await client.query(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
  await client.query(`
    CREATE POLICY ${POLICY_NAME} ON ${table}
      AS PERMISSIVE FOR ALL TO PUBLIC
      USING (${SAFE_EXPR})
      WITH CHECK (${SAFE_EXPR})
  `);
}

const migration: Migration = {
  description: 'Create durable tenant-scoped agent executions and checkpointed specialist steps',

  async up(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS agent_executions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        idempotency_key TEXT NOT NULL,
        session_id TEXT,
        lead_id UUID,
        agent_name TEXT NOT NULL DEFAULT 'SGS_AGENT',
        trigger_source TEXT NOT NULL DEFAULT 'unknown',
        status TEXT NOT NULL DEFAULT 'RUNNING'
          CHECK (status IN ('RUNNING','SUCCESS','ERROR','BLOCKED')),
        current_step TEXT NOT NULL DEFAULT 'SUPERVISOR',
        attempt INTEGER NOT NULL DEFAULT 1,
        max_steps INTEGER NOT NULL DEFAULT 6,
        trace_id UUID NOT NULL DEFAULT gen_random_uuid(),
        input_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        output_json JSONB,
        guardrail_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        error_text TEXT,
        lease_expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '2 minutes',
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        finished_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, idempotency_key)
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_agent_executions_tenant_recent
      ON agent_executions (tenant_id, created_at DESC)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_agent_executions_lease
      ON agent_executions (status, lease_expires_at)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS agent_execution_steps (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        execution_id UUID NOT NULL REFERENCES agent_executions(id) ON DELETE CASCADE,
        step_key TEXT NOT NULL,
        specialist TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'RUNNING'
          CHECK (status IN ('PENDING','RUNNING','SUCCESS','ERROR','SKIPPED','BLOCKED')),
        attempt INTEGER NOT NULL DEFAULT 1,
        input_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        output_json JSONB,
        error_text TEXT,
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        finished_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (execution_id, step_key)
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_agent_execution_steps_run
      ON agent_execution_steps (execution_id, created_at ASC)
    `);

    await applyTenantPolicy(client, 'agent_executions');
    await applyTenantPolicy(client, 'agent_execution_steps');
    await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON agent_executions, agent_execution_steps TO sgs_app`)
      .catch(() => {});
  },

  async down(client: PoolClient): Promise<void> {
    await client.query(`DROP TABLE IF EXISTS agent_execution_steps`);
    await client.query(`DROP TABLE IF EXISTS agent_executions`);
  },
};

export default migration;