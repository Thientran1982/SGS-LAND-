import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const migration: Migration = {
  description: 'Preserve fractional Search Console average positions',

  async up(client: PoolClient) {
    await client.query(`
      ALTER TABLE seo_target_keywords
        ALTER COLUMN current_position TYPE NUMERIC(10, 2)
        USING current_position::numeric
    `);
  },

  async down(client: PoolClient) {
    await client.query(`
      ALTER TABLE seo_target_keywords
        ALTER COLUMN current_position TYPE INTEGER
        USING ROUND(current_position)::integer
    `);
  },
};

export default migration;