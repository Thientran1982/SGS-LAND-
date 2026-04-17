import type { Migration } from './runner';
import type { PoolClient } from 'pg';

const migration: Migration = {
  description: 'GEO/AI Search — seo_target_keywords for top-3 + LLM citation tracking',

  async up(client: PoolClient) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS seo_target_keywords (
        id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id         VARCHAR(36)   NOT NULL,
        keyword           VARCHAR(300)  NOT NULL,
        target_url        TEXT,
        current_position  INTEGER,
        target_position   INTEGER       NOT NULL DEFAULT 3,
        search_volume     INTEGER,
        notes             TEXT,
        last_checked_at   TIMESTAMPTZ,
        ai_visibility     JSONB         NOT NULL DEFAULT '{}'::jsonb,
        created_by        UUID,
        created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      );

      CREATE UNIQUE INDEX IF NOT EXISTS uq_seo_target_keywords_tenant_kw
        ON seo_target_keywords(tenant_id, lower(keyword));

      CREATE INDEX IF NOT EXISTS idx_seo_target_keywords_tenant_updated
        ON seo_target_keywords(tenant_id, updated_at DESC);
    `);
  },

  async down(client: PoolClient) {
    await client.query(`DROP TABLE IF EXISTS seo_target_keywords;`);
  },
};

export default migration;
