import { PoolClient } from 'pg';
import { Migration } from './runner';

const migration: Migration = {
  description: '064: Generic per-call AI usage log (every Gemini call, labelled by feature)',

  async up(client: PoolClient) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_usage_log (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id    UUID REFERENCES tenants(id) ON DELETE CASCADE,
        user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
        feature      VARCHAR(60) NOT NULL,
        model        VARCHAR(80),
        ai_calls     INT DEFAULT 1,
        cost_usd     NUMERIC(12,6) DEFAULT 0,
        latency_ms   INT DEFAULT 0,
        source       VARCHAR(60),
        created_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_usage_created
        ON ai_usage_log (created_at DESC);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_usage_tenant_period
        ON ai_usage_log (tenant_id, created_at DESC);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_usage_feature_period
        ON ai_usage_log (feature, created_at DESC);
    `);
  },

  async down(client: PoolClient) {
    await client.query(`DROP TABLE IF EXISTS ai_usage_log CASCADE`);
  },
};

export default migration;
