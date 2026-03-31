import { PoolClient } from 'pg';
import { Migration } from './runner';

const migration: Migration = {
  description: 'Create seo_overrides table for server-side meta tag injection',
  async up(client: PoolClient) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS seo_overrides (
        route_key   VARCHAR(128) PRIMARY KEY,
        title       TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        og_image    TEXT,
        updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_by  UUID
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_seo_overrides_updated
        ON seo_overrides (updated_at DESC);
    `);
  },
  async down(client: PoolClient) {
    await client.query(`DROP TABLE IF EXISTS seo_overrides;`);
  },
};

export default migration;
