import { PoolClient } from 'pg';
import { Migration } from './runner';

const migration: Migration = {
  description: '062: Track per-call valuation AI usage + admin cost alert config',

  async up(client: PoolClient) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS valuation_usage_log (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
        user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
        plan_id         VARCHAR(50),
        endpoint        VARCHAR(50) NOT NULL,
        source          VARCHAR(40),
        ai_calls        INT DEFAULT 2,
        cost_usd        NUMERIC(10,6) DEFAULT 0,
        latency_ms      INT DEFAULT 0,
        is_guest        BOOLEAN DEFAULT false,
        ip_address      VARCHAR(64),
        address_hint    VARCHAR(120),
        created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_valuation_usage_created
        ON valuation_usage_log (created_at DESC);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_valuation_usage_tenant_period
        ON valuation_usage_log (tenant_id, created_at DESC);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_valuation_usage_user_period
        ON valuation_usage_log (user_id, created_at DESC);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS valuation_cost_alerts (
        tenant_id            UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
        threshold_usd        NUMERIC(10,2) DEFAULT 0,
        alert_email          VARCHAR(255),
        last_alerted_period  VARCHAR(7),
        updated_at           TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
  },

  async down(client: PoolClient) {
    await client.query(`DROP TABLE IF EXISTS valuation_cost_alerts CASCADE`);
    await client.query(`DROP TABLE IF EXISTS valuation_usage_log CASCADE`);
  },
};

export default migration;
