import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const migration: Migration = {
  description: 'Phase 3 automatic social draft settings, source metadata, and project priority',

  async up(client: PoolClient) {
    await client.query(`
      ALTER TABLE projects
        ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 0;

      ALTER TABLE social_publications
        ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
        ADD COLUMN IF NOT EXISTS auto_posting_key VARCHAR(200);

      ALTER TABLE social_publications
        DROP CONSTRAINT IF EXISTS social_publications_source_ck;
      ALTER TABLE social_publications
        ADD CONSTRAINT social_publications_source_ck
        CHECK (source IN ('MANUAL', 'AUTO'));

      CREATE UNIQUE INDEX IF NOT EXISTS idx_social_publications_auto_key
        ON social_publications(tenant_id, auto_posting_key)
        WHERE auto_posting_key IS NOT NULL;

      CREATE TABLE IF NOT EXISTS auto_posting_settings (
        tenant_id             VARCHAR(36) PRIMARY KEY,
        enabled               BOOLEAN NOT NULL DEFAULT FALSE,
        posts_per_day         INTEGER NOT NULL DEFAULT 1,
        time_windows          JSONB NOT NULL DEFAULT '[{"start":"08:00","end":"11:00"}]'::jsonb,
        recycle_after_days    INTEGER NOT NULL DEFAULT 7,
        platforms             JSONB NOT NULL DEFAULT '["FACEBOOK_PAGE"]'::jsonb,
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT auto_posting_settings_posts_per_day_ck CHECK (posts_per_day BETWEEN 1 AND 50),
        CONSTRAINT auto_posting_settings_recycle_days_ck CHECK (recycle_after_days >= 0)
      );

      CREATE INDEX IF NOT EXISTS idx_projects_auto_posting_priority
        ON projects(tenant_id, is_featured DESC, priority DESC, updated_at DESC);
    `);
  },

  async down(client: PoolClient) {
    await client.query(`
      DROP INDEX IF EXISTS idx_projects_auto_posting_priority;
      DROP TABLE IF EXISTS auto_posting_settings;
      DROP INDEX IF EXISTS idx_social_publications_auto_key;
      ALTER TABLE social_publications DROP CONSTRAINT IF EXISTS social_publications_source_ck;
      ALTER TABLE social_publications
        DROP COLUMN IF EXISTS auto_posting_key,
        DROP COLUMN IF EXISTS source;
      ALTER TABLE projects
        DROP COLUMN IF EXISTS is_featured,
        DROP COLUMN IF EXISTS priority;
    `);
  },
};

export default migration;