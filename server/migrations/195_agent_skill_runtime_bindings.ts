import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const migration: Migration = {
  description: 'Governed runtime bindings between tenant agents and catalog skills',
  async up(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS agent_skill_bindings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
        skill_id UUID NOT NULL REFERENCES agent_skills(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'ACTIVE'
          CHECK (status IN ('ACTIVE','PAUSED')),
        activated_by UUID,
        activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, agent_id, skill_id)
      );

      CREATE INDEX IF NOT EXISTS idx_agent_skill_bindings_runtime
        ON agent_skill_bindings (tenant_id, agent_id, status, activated_at DESC);

      ALTER TABLE agent_skill_bindings ENABLE ROW LEVEL SECURITY;
      ALTER TABLE agent_skill_bindings FORCE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS tenant_isolation_v2 ON agent_skill_bindings;
      CREATE POLICY tenant_isolation_v2 ON agent_skill_bindings AS PERMISSIVE FOR ALL TO PUBLIC
        USING (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), '')
        )
        WITH CHECK (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), '')
        );
    `);
  },
  async down(client: PoolClient): Promise<void> {
    await client.query('DROP TABLE IF EXISTS agent_skill_bindings CASCADE');
  },
};

export default migration;