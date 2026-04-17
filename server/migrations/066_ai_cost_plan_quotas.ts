import { PoolClient } from 'pg';
import { Migration } from './runner';

const migration: Migration = {
  description: '065: Per-plan monthly AI cost quotas (USD) for valuation AI',

  async up(client: PoolClient) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_cost_plan_quotas (
        tenant_id              UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        plan_id                VARCHAR(50) NOT NULL,
        monthly_cost_limit_usd NUMERIC(10,2) NOT NULL DEFAULT 0,
        updated_at             TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (tenant_id, plan_id)
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_cost_plan_quotas_tenant
        ON ai_cost_plan_quotas (tenant_id);
    `);
  },

  async down(client: PoolClient) {
    await client.query(`DROP TABLE IF EXISTS ai_cost_plan_quotas CASCADE`);
  },
};

export default migration;
