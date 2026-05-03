import type { Migration } from './runner';
import type { PoolClient } from 'pg';

const migration: Migration = {
  description:
    'Sprint #64 follow-up — seo_geo_snapshots: daily AI mention rates, top-20 SERP positions, backlinks, lighthouse',

  async up(client: PoolClient) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS seo_geo_snapshots (
        id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        date              DATE         NOT NULL,
        ai_mentions_json  JSONB        NOT NULL DEFAULT '{}'::jsonb,
        gsc_top20_json    JSONB        NOT NULL DEFAULT '{}'::jsonb,
        backlinks_json    JSONB        NOT NULL DEFAULT '{}'::jsonb,
        lighthouse_json   JSONB        NOT NULL DEFAULT '{}'::jsonb,
        created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );

      CREATE UNIQUE INDEX IF NOT EXISTS uq_seo_geo_snapshots_date
        ON seo_geo_snapshots(date);

      CREATE INDEX IF NOT EXISTS idx_seo_geo_snapshots_date_desc
        ON seo_geo_snapshots(date DESC);
    `);
  },

  async down(client: PoolClient) {
    await client.query(`DROP TABLE IF EXISTS seo_geo_snapshots;`);
  },
};

export default migration;
