import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const migration: Migration = {
  description: 'Add durable approval interrupts and persisted AI rollout state',

  async up(client: PoolClient): Promise<void> {
    await client.query(`
      ALTER TABLE agent_executions
        ADD COLUMN IF NOT EXISTS approval_request_id UUID,
        ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ
    `);
    await client.query(`
      ALTER TABLE agent_executions
        DROP CONSTRAINT IF EXISTS agent_executions_status_check
    `);
    await client.query(`
      ALTER TABLE agent_executions
        ADD CONSTRAINT agent_executions_status_check
        CHECK (status IN ('RUNNING','SUCCESS','ERROR','BLOCKED','WAITING_APPROVAL'))
    `);
    await client.query(`
      ALTER TABLE approval_requests
        ADD COLUMN IF NOT EXISTS execution_id UUID REFERENCES agent_executions(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS step_key TEXT,
        ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
        ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 minutes',
        ADD COLUMN IF NOT EXISTS resumed_at TIMESTAMPTZ
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_approval_requests_idempotency
        ON approval_requests (tenant_id, idempotency_key)
        WHERE idempotency_key IS NOT NULL
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_approval_requests_execution
        ON approval_requests (tenant_id, execution_id)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_rollouts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        agent_key TEXT NOT NULL,
        baseline_prompt_hash TEXT NOT NULL,
        candidate_prompt_hash TEXT NOT NULL,
        baseline_model TEXT,
        candidate_model TEXT,
        baseline_eval_run_id UUID,
        candidate_eval_run_id UUID,
        status TEXT NOT NULL DEFAULT 'SHADOW'
          CHECK (status IN ('SHADOW','CANARY','ACTIVE','ROLLED_BACK','KILLED')),
        canary_percent INTEGER NOT NULL DEFAULT 0 CHECK (canary_percent BETWEEN 0 AND 100),
        shadow_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        gate_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
        rollback_reason TEXT,
        created_by UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_rollouts_tenant_agent
        ON ai_rollouts (tenant_id, agent_key, updated_at DESC)
    `);
    await client.query(`
      ALTER TABLE ai_rollouts ENABLE ROW LEVEL SECURITY;
      ALTER TABLE ai_rollouts FORCE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS tenant_isolation_v2 ON ai_rollouts;
      CREATE POLICY tenant_isolation_v2 ON ai_rollouts
        AS PERMISSIVE FOR ALL TO PUBLIC
        USING (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), '')
        )
        WITH CHECK (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), '')
        )
    `);
    await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ai_rollouts TO sgs_app`).catch(() => {});
  },

  async down(client: PoolClient): Promise<void> {
    await client.query('DROP TABLE IF EXISTS ai_rollouts');
    await client.query('DROP INDEX IF EXISTS idx_approval_requests_execution');
    await client.query('DROP INDEX IF EXISTS idx_approval_requests_idempotency');
    await client.query(`
      ALTER TABLE approval_requests
        DROP COLUMN IF EXISTS resumed_at,
        DROP COLUMN IF EXISTS expires_at,
        DROP COLUMN IF EXISTS idempotency_key,
        DROP COLUMN IF EXISTS step_key,
        DROP COLUMN IF EXISTS execution_id
    `);
    await client.query(`ALTER TABLE agent_executions DROP COLUMN IF EXISTS paused_at`);
    await client.query(`ALTER TABLE agent_executions DROP COLUMN IF EXISTS approval_request_id`);
  },
};

export default migration;