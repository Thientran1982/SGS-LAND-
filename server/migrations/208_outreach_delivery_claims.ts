import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const migration: Migration = {
  description: 'Allow durable provider delivery claims for approved outreach variants',

  async up(client: PoolClient): Promise<void> {
    await client.query(`
      ALTER TABLE agent_outbound_deliveries
        ALTER COLUMN execution_id DROP NOT NULL;
      ALTER TABLE agent_outbound_deliveries
        ADD COLUMN IF NOT EXISTS approval_request_id UUID
          REFERENCES approval_requests(id) ON DELETE CASCADE,
        ADD COLUMN IF NOT EXISTS variant_id TEXT;
      CREATE UNIQUE INDEX IF NOT EXISTS uq_agent_outbound_outreach_variant
        ON agent_outbound_deliveries (tenant_id, approval_request_id, variant_id)
        WHERE approval_request_id IS NOT NULL AND variant_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_agent_outbound_outreach_approval
        ON agent_outbound_deliveries (tenant_id, approval_request_id, updated_at DESC)
        WHERE approval_request_id IS NOT NULL;
    `);
  },

  async down(client: PoolClient): Promise<void> {
    await client.query(`
      DROP INDEX IF EXISTS idx_agent_outbound_outreach_approval;
      DROP INDEX IF EXISTS uq_agent_outbound_outreach_variant;
      ALTER TABLE agent_outbound_deliveries
        DROP COLUMN IF EXISTS variant_id,
        DROP COLUMN IF EXISTS approval_request_id;
      ALTER TABLE agent_outbound_deliveries
        ALTER COLUMN execution_id SET NOT NULL;
    `);
  },
};

export default migration;