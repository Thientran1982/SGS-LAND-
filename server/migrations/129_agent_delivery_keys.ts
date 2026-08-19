import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const migration: Migration = {
  description: 'Persist stable delivery keys for provider dedupe and reconciliation',

  async up(client: PoolClient): Promise<void> {
    await client.query(`
      ALTER TABLE agent_outbound_deliveries
      ADD COLUMN IF NOT EXISTS delivery_key TEXT
    `);
    await client.query(`
      UPDATE agent_outbound_deliveries
         SET delivery_key = 'agent-outbound:' || id::text
       WHERE delivery_key IS NULL
    `);
    await client.query(`
      ALTER TABLE agent_outbound_deliveries
      ALTER COLUMN delivery_key SET NOT NULL
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_agent_outbound_delivery_key
      ON agent_outbound_deliveries (tenant_id, delivery_key)
    `);
  },

  async down(client: PoolClient): Promise<void> {
    await client.query(`DROP INDEX IF EXISTS uq_agent_outbound_delivery_key`);
    await client.query(`ALTER TABLE agent_outbound_deliveries DROP COLUMN IF EXISTS delivery_key`);
  },
};

export default migration;