import { PoolClient } from 'pg';
import { Migration } from './runner';

const migration: Migration = {
  description: 'Add built_area column to listings — DT xây dựng for Townhouse/Villa/House/Office/Factory/Commercial',
  async up(client: PoolClient) {
    await client.query(`
      ALTER TABLE listings
        ADD COLUMN IF NOT EXISTS built_area NUMERIC;
    `);
  },
  async down(client: PoolClient) {
    await client.query(`
      ALTER TABLE listings DROP COLUMN IF EXISTS built_area;
    `);
  },
};

export default migration;
