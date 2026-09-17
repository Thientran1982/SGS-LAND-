import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const migration: Migration = {
  description: 'Explicit public listing flag for signed valuation teaser capabilities',

  async up(client: PoolClient) {
    await client.query(`
      ALTER TABLE listings
        ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE;

      CREATE INDEX IF NOT EXISTS idx_listings_public_teaser
        ON listings(tenant_id, id)
        WHERE is_public = TRUE;
    `);
  },
};

export default migration;