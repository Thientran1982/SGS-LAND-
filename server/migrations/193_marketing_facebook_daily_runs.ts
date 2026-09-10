import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const migration: Migration = {
  description: 'Daily Marketing Facebook auto-publishing run ledger and fixed Vietnam schedule',

  async up(client: PoolClient) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS marketing_facebook_daily_runs (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id       VARCHAR(36) NOT NULL,
        logical_day     DATE NOT NULL,
        status          VARCHAR(24) NOT NULL DEFAULT 'RUNNING',
        source_type     VARCHAR(20),
        source_id       UUID,
        publication_id  UUID REFERENCES social_publications(id) ON DELETE SET NULL,
        result          JSONB NOT NULL DEFAULT '{}'::jsonb,
        error_code      VARCHAR(120),
        error_message   TEXT,
        started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        finished_at     TIMESTAMPTZ,
        CONSTRAINT marketing_facebook_daily_runs_status_ck
          CHECK (status IN ('RUNNING', 'SUCCESS', 'FAILED', 'SKIPPED')),
        CONSTRAINT marketing_facebook_daily_runs_source_ck
          CHECK (source_type IS NULL OR source_type IN ('LISTING', 'PROJECT'))
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_facebook_daily_runs_day
        ON marketing_facebook_daily_runs(tenant_id, logical_day);
      CREATE INDEX IF NOT EXISTS idx_marketing_facebook_daily_runs_recent
        ON marketing_facebook_daily_runs(tenant_id, started_at DESC);

      UPDATE auto_posting_settings
         SET time_windows = '[{"start":"18:30","end":"23:59"}]'::jsonb,
             updated_at = NOW()
       WHERE time_windows = '[{"start":"08:00","end":"11:00"}]'::jsonb;
    `);
  },

  async down(client: PoolClient) {
    await client.query(`
      DROP INDEX IF EXISTS idx_marketing_facebook_daily_runs_recent;
      DROP INDEX IF EXISTS idx_marketing_facebook_daily_runs_day;
      DROP TABLE IF EXISTS marketing_facebook_daily_runs;
    `);
  },
};

export default migration;