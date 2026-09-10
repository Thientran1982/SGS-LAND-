import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const migration: Migration = {
  description: 'Allow manual social publications to target either a listing or a project',

  async up(client: PoolClient) {
    await client.query(`
      ALTER TABLE social_publications
        ALTER COLUMN listing_id DROP NOT NULL;

      ALTER TABLE social_publications
        ADD COLUMN IF NOT EXISTS project_id UUID;

      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1
            FROM pg_constraint
           WHERE conname = 'social_publications_project_id_fkey'
        ) THEN
          ALTER TABLE social_publications
            ADD CONSTRAINT social_publications_project_id_fkey
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE RESTRICT;
        END IF;
      END $$;

      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1
            FROM pg_constraint
           WHERE conname = 'social_publications_exactly_one_source_ck'
        ) THEN
          ALTER TABLE social_publications
            ADD CONSTRAINT social_publications_exactly_one_source_ck
            CHECK (
              (listing_id IS NOT NULL AND project_id IS NULL)
              OR (listing_id IS NULL AND project_id IS NOT NULL)
            );
        END IF;
      END $$;

      CREATE INDEX IF NOT EXISTS idx_social_publications_project
        ON social_publications(tenant_id, project_id)
        WHERE project_id IS NOT NULL;
    `);
  },
};

export default migration;