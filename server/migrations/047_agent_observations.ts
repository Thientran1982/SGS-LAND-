import type { Migration } from './runner';
import type { PoolClient } from 'pg';

const migration: Migration = {
  description: 'Add agent_observations table for agent self-learning and system change tracking',

  async up(client: PoolClient): Promise<void> {
    // ── agent_observations ────────────────────────────────────────────────────
    // Each agent logs what it observes during execution (non-blocking).
    // Aggregated by AgentObservationService into ai_reward_signals for RLHF.
    await client.query(`
      CREATE TABLE IF NOT EXISTS agent_observations (
        id               SERIAL PRIMARY KEY,
        tenant_id        VARCHAR(36) NOT NULL,
        agent_node       VARCHAR(50) NOT NULL,
        intent           VARCHAR(60),
        observation_type VARCHAR(40) NOT NULL,
        observation_data JSONB NOT NULL DEFAULT '{}',
        session_id       VARCHAR(64),
        created_at       TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_ao_tenant_node   ON agent_observations (tenant_id, agent_node)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ao_intent        ON agent_observations (tenant_id, intent)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ao_created       ON agent_observations (created_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ao_obs_type      ON agent_observations (observation_type)`);

    // ── agent_system_change_log ───────────────────────────────────────────────
    // Tracks structural changes: prompt updates, model swaps, new intents, schema changes.
    // Agents read this to understand what has changed since they last ran.
    await client.query(`
      CREATE TABLE IF NOT EXISTS agent_system_change_log (
        id            SERIAL PRIMARY KEY,
        tenant_id     VARCHAR(36),
        change_type   VARCHAR(50) NOT NULL,
        change_scope  VARCHAR(100),
        description   TEXT NOT NULL,
        old_value     TEXT,
        new_value     TEXT,
        changed_by    VARCHAR(100),
        created_at    TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_ascl_tenant      ON agent_system_change_log (tenant_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ascl_type        ON agent_system_change_log (change_type)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ascl_created     ON agent_system_change_log (created_at DESC)`);
  },

  async down(client: PoolClient): Promise<void> {
    await client.query(`DROP TABLE IF EXISTS agent_observations CASCADE`);
    await client.query(`DROP TABLE IF EXISTS agent_system_change_log CASCADE`);
  },
};

export default migration;
