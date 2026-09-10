import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const migration: Migration = {
  description: 'Controlled Marketing Facebook backfill requests and audit history',

  async up(client: PoolClient) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS marketing_facebook_backfill_requests (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id       VARCHAR(36) NOT NULL,
        logical_day     DATE NOT NULL,
        reason          TEXT NOT NULL,
        requested_by    VARCHAR(200) NOT NULL,
        status          VARCHAR(24) NOT NULL DEFAULT 'REQUESTED',
        result          JSONB NOT NULL DEFAULT '{}'::jsonb,
        error_code      VARCHAR(120),
        error_message   TEXT,
        requested_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        started_at      TIMESTAMPTZ,
        finished_at     TIMESTAMPTZ,
        CONSTRAINT marketing_facebook_backfill_status_ck
          CHECK (status IN ('REQUESTED', 'RUNNING', 'SUCCESS', 'FAILED', 'SKIPPED', 'BLOCKED')),
        CONSTRAINT marketing_facebook_backfill_reason_ck
          CHECK (length(btrim(reason)) >= 3)
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_facebook_backfills_day
        ON marketing_facebook_backfill_requests(tenant_id, logical_day);
      CREATE INDEX IF NOT EXISTS idx_marketing_facebook_backfills_recent
        ON marketing_facebook_backfill_requests(tenant_id, requested_at DESC);
    `);
  },

  async down(client: PoolClient) {
    await client.query(`
      DROP INDEX IF EXISTS idx_marketing_facebook_backfills_recent;
      DROP INDEX IF EXISTS idx_marketing_facebook_backfills_day;
      DROP TABLE IF EXISTS marketing_facebook_backfill_requests;
    `);
  },
};

export default migration;