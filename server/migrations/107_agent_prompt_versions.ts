import { PoolClient } from 'pg';

export async function up(client: PoolClient): Promise<void> {
  // Create agent_prompt_versions table
  await client.query(`
    CREATE TABLE IF NOT EXISTS agent_prompt_versions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id VARCHAR(255) NOT NULL,
      agent_id VARCHAR(100) NOT NULL,
      version VARCHAR(50) NOT NULL,
      system_instruction TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT false,
      change_note TEXT,
      created_by VARCHAR(255),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Partial unique index: only one active version per (tenant, agent)
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_agent_prompt_active
      ON agent_prompt_versions (tenant_id, agent_id)
      WHERE (is_active = true);
  `);

  // Index for version history lookup
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_agent_prompt_versions_lookup
      ON agent_prompt_versions (tenant_id, agent_id, is_active);
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_agent_prompt_versions_agent
      ON agent_prompt_versions (agent_id, version);
  `);
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`DROP TABLE IF EXISTS agent_prompt_versions;`);
}

export default {
  up,
  down,
  description: 'Add agent_prompt_versions table for dynamic prompt versioning with DB-level rollback support'
};
