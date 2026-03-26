import { PoolClient } from 'pg';
import { Migration } from './runner';

const migration: Migration = {
  description: 'Add won_at to leads for accurate revenue date attribution',
  async up(client: PoolClient) {
    await client.query(`
      ALTER TABLE leads
        ADD COLUMN IF NOT EXISTS won_at TIMESTAMP WITH TIME ZONE;
    `);
    await client.query(`
      UPDATE leads
        SET won_at = updated_at
        WHERE stage = 'WON' AND won_at IS NULL;
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_leads_won_at
        ON leads (tenant_id, won_at)
        WHERE won_at IS NOT NULL;
    `);
  },
  async down(client: PoolClient) {
    await client.query(`DROP INDEX IF EXISTS idx_leads_won_at;`);
    await client.query(`ALTER TABLE leads DROP COLUMN IF EXISTS won_at;`);
  },
};

export default migration;
