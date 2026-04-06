import { PoolClient } from 'pg';

const migration = {
  description: 'Add composite cursor index on leads(tenant_id, updated_at DESC, id DESC) for O(log N) keyset pagination',
  async up(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_leads_cursor
        ON leads(tenant_id, updated_at DESC, id DESC);
    `);
  },
  async down(client: PoolClient): Promise<void> {
    await client.query(`DROP INDEX IF EXISTS idx_leads_cursor;`);
  },
};

export default migration;
