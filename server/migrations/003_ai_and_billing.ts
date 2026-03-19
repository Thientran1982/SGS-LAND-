/**
 * Migration 003 — AI governance, subscriptions, usage tracking, scoring config
 */

import type { Migration } from './runner';

const migration: Migration = {
  description: 'Add AI governance logs, subscriptions, usage_tracking, and scoring_configs',

  async up(client) {
    // --- AI Governance Logs ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_governance_logs (
        id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
        task_type     VARCHAR(100),
        model         VARCHAR(100),
        prompt_tokens INT DEFAULT 0,
        output_tokens INT DEFAULT 0,
        latency_ms    INT DEFAULT 0,
        cost_usd      NUMERIC(10, 6) DEFAULT 0,
        safety_flags  JSONB DEFAULT '[]'::jsonb,
        input_hash    VARCHAR(64),
        timestamp     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // --- Subscriptions ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id      UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
        plan_id        VARCHAR(100) NOT NULL DEFAULT 'INDIVIDUAL',
        status         VARCHAR(50) DEFAULT 'ACTIVE',
        seats_used     INT DEFAULT 1,
        trial_ends_at  TIMESTAMP WITH TIME ZONE,
        renews_at      TIMESTAMP WITH TIME ZONE,
        cancelled_at   TIMESTAMP WITH TIME ZONE,
        metadata       JSONB DEFAULT '{}'::jsonb,
        created_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (tenant_id)
      );
    `);

    // --- Usage Tracking ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS usage_tracking (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
        metric_type VARCHAR(100) NOT NULL,
        count       INT DEFAULT 0,
        period      VARCHAR(7) NOT NULL,  -- YYYY-MM
        created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (tenant_id, metric_type, period)
      );
    `);

    // --- Scoring Configs ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS scoring_configs (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
        weights     JSONB DEFAULT '{}'::jsonb,
        thresholds  JSONB DEFAULT '{}'::jsonb,
        updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (tenant_id)
      );
    `);

    // --- Prompt Templates ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS prompt_templates (
        id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id      UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
        name           VARCHAR(255) NOT NULL,
        task_type      VARCHAR(100),
        content        TEXT NOT NULL,
        active_version INT DEFAULT 1,
        metadata       JSONB DEFAULT '{}'::jsonb,
        created_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_ai_logs_tenant_ts ON ai_governance_logs(tenant_id, timestamp DESC)',
      'CREATE INDEX IF NOT EXISTS idx_usage_tenant_period ON usage_tracking(tenant_id, period)',
    ];
    for (const idx of indexes) {
      await client.query(idx);
    }

    const tables = ['ai_governance_logs', 'subscriptions', 'usage_tracking', 'scoring_configs', 'prompt_templates'];
    for (const t of tables) {
      await client.query(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY;`);
      await client.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_policies WHERE tablename = '${t}' AND policyname = '${t}_tenant_isolation'
          ) THEN
            CREATE POLICY ${t}_tenant_isolation ON ${t}
              USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
          END IF;
        END $$;
      `);
    }
  },
};

export default migration;
