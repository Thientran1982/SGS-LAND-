import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const migration: Migration = {
  description: 'Restore the unique multi-slot key for the Marketing Facebook run ledger',

  async up(client: PoolClient) {
    await client.query(`
      ALTER TABLE marketing_facebook_daily_runs
        ADD COLUMN IF NOT EXISTS slot_index INTEGER NOT NULL DEFAULT 0;

      DROP INDEX IF EXISTS idx_marketing_facebook_daily_runs_day;
      DROP INDEX IF EXISTS idx_marketing_facebook_daily_runs_day_slot;

      -- A previous migration was recorded while this index was absent in the
      -- runtime database. Preserve every run and assign deterministic slots
      -- before recreating the idempotency boundary.
      WITH ranked_runs AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY tenant_id, logical_day
            ORDER BY started_at ASC, id ASC
          ) - 1 AS repaired_slot
        FROM marketing_facebook_daily_runs
      )
      UPDATE marketing_facebook_daily_runs AS runs
         SET slot_index = ranked_runs.repaired_slot
        FROM ranked_runs
       WHERE runs.id = ranked_runs.id
         AND runs.slot_index IS DISTINCT FROM ranked_runs.repaired_slot;

      CREATE UNIQUE INDEX idx_marketing_facebook_daily_runs_day_slot
        ON marketing_facebook_daily_runs(tenant_id, logical_day, slot_index);
    `);
  },

  async down(client: PoolClient) {
    await client.query(`
      DROP INDEX IF EXISTS idx_marketing_facebook_daily_runs_day_slot;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_facebook_daily_runs_day
        ON marketing_facebook_daily_runs(tenant_id, logical_day);
    `);
  },
};

export default migration;