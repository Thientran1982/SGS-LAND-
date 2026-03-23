import { PoolClient } from 'pg';
import { Migration } from './runner';

const migration: Migration = {
  description: 'Add signed_place and contract_date columns to contracts',
  async up(client: PoolClient): Promise<void> {
    await client.query(`
      ALTER TABLE contracts
        ADD COLUMN IF NOT EXISTS signed_place TEXT,
        ADD COLUMN IF NOT EXISTS contract_date DATE;
    `);
  },
  async down(client: PoolClient): Promise<void> {
    await client.query(`
      ALTER TABLE contracts
        DROP COLUMN IF EXISTS signed_place,
        DROP COLUMN IF EXISTS contract_date;
    `);
  },
};

export default migration;
