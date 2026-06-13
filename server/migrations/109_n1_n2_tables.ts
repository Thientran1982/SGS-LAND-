import { PoolClient } from 'pg';

export default {
  description: 'N1: tenant_prompt_overrides table; N2: prompt_performance_log table',

  async up(client: PoolClient): Promise<void> {
    // N1: Tenant-level prompt customization overrides
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenant_prompt_overrides (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id   TEXT NOT NULL UNIQUE,
        brand_name  TEXT,
        focus_area  TEXT,
        language    TEXT DEFAULT 'vi',
        custom_instructions TEXT,
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tenant_prompt_overrides_tenant ON tenant_prompt_overrides(tenant_id)`);

    // N2: Prompt performance logging
    await client.query(`
      CREATE TABLE IF NOT EXISTS prompt_performance_log (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id        TEXT NOT NULL,
        agent_id         TEXT NOT NULL,
        prompt_version   TEXT NOT NULL,
        session_id       TEXT,
        confidence_score NUMERIC(5,3),
        was_escalated    BOOLEAN DEFAULT FALSE,
        response_time_ms INTEGER,
        tokens_used      INTEGER,
        logged_at        TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ppl_tenant_agent ON prompt_performance_log(tenant_id, agent_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ppl_version ON prompt_performance_log(prompt_version)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ppl_logged_at ON prompt_performance_log(logged_at DESC)`);
  },

  async down(client: PoolClient): Promise<void> {
    await client.query('DROP TABLE IF EXISTS prompt_performance_log');
    await client.query('DROP TABLE IF EXISTS tenant_prompt_overrides');
  },
};
