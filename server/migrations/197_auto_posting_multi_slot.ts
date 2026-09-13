import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const migration: Migration = {
  description: 'Allow multiple auto-posting slots per tenant per day (readiness-based cadence 1-3 posts/day)',

  async up(client: PoolClient) {
    await client.query(`
      ALTER TABLE marketing_facebook_daily_runs
        ADD COLUMN IF NOT EXISTS slot_index INTEGER NOT NULL DEFAULT 0;

      DROP INDEX IF EXISTS idx_marketing_facebook_daily_runs_day;

      CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_facebook_daily_runs_day_slot
        ON marketing_facebook_daily_runs(tenant_id, logical_day, slot_index);
    `);
  },

  async down(client: PoolClient) {
    await client.query(`
      DROP INDEX IF EXISTS idx_marketing_facebook_daily_runs_day_slot;

      CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_facebook_daily_runs_day
        ON marketing_facebook_daily_runs(tenant_id, logical_day);

      ALTER TABLE marketing_facebook_daily_runs
        DROP COLUMN IF EXISTS slot_index;
    `);
  },
};

export default migration;
