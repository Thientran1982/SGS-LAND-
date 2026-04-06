import { PoolClient } from 'pg';
import { Migration } from './runner';

const migration: Migration = {
  description: 'Create ai_feedback table for RLHF self-improvement loop',

  async up(client: PoolClient) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_feedback (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        interaction_id UUID REFERENCES interactions(id) ON DELETE SET NULL,
        lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        rating SMALLINT NOT NULL CHECK (rating IN (-1, 1)),
        correction TEXT,
        agent_node VARCHAR(50),
        intent VARCHAR(50),
        user_message TEXT,
        ai_response TEXT,
        model VARCHAR(100),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      ALTER TABLE ai_feedback ENABLE ROW LEVEL SECURITY
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies WHERE tablename = 'ai_feedback' AND policyname = 'ai_feedback_tenant_isolation'
        ) THEN
          CREATE POLICY ai_feedback_tenant_isolation ON ai_feedback
            USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
        END IF;
      END $$
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_feedback_tenant_rating ON ai_feedback (tenant_id, rating, created_at DESC)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_feedback_intent ON ai_feedback (tenant_id, intent, rating)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_reward_signals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        intent VARCHAR(50) NOT NULL,
        agent_node VARCHAR(50),
        positive_count INT DEFAULT 0,
        negative_count INT DEFAULT 0,
        avg_score NUMERIC(4,2) DEFAULT 0,
        top_examples JSONB DEFAULT '[]',
        negative_patterns JSONB DEFAULT '[]',
        few_shot_cache JSONB DEFAULT '[]',
        last_computed TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (tenant_id, intent)
      )
    `);

    await client.query(`
      ALTER TABLE ai_reward_signals ENABLE ROW LEVEL SECURITY
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies WHERE tablename = 'ai_reward_signals' AND policyname = 'ai_reward_signals_tenant_isolation'
        ) THEN
          CREATE POLICY ai_reward_signals_tenant_isolation ON ai_reward_signals
            USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
        END IF;
      END $$
    `);
  },

  async down(client: PoolClient) {
    await client.query(`DROP TABLE IF EXISTS ai_reward_signals CASCADE`);
    await client.query(`DROP TABLE IF EXISTS ai_feedback CASCADE`);
  },
};

export default migration;
