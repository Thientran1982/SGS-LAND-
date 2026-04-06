import { PoolClient } from 'pg';
import { Migration } from './runner';

const migration: Migration = {
  description: 'Add assigned_to_id to contracts for responsible agent tracking',
  async up(client: PoolClient) {
    await client.query(`
      ALTER TABLE contracts
        ADD COLUMN IF NOT EXISTS assigned_to_id UUID REFERENCES users(id) ON DELETE SET NULL;
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_contracts_assigned_to
        ON contracts (tenant_id, assigned_to_id);
    `);
  },
  async down(client: PoolClient) {
    await client.query(`ALTER TABLE contracts DROP COLUMN IF EXISTS assigned_to_id;`);
  },
};

export default migration;
