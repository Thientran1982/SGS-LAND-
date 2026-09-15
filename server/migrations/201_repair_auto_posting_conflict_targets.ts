import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const migration: Migration = {
  description: 'Repair auto-posting conflict indexes after schema drift',

  async up(client: PoolClient) {
    await client.query(`
      ALTER TABLE marketing_facebook_daily_runs
        ADD COLUMN IF NOT EXISTS slot_index INTEGER NOT NULL DEFAULT 0;

      DROP INDEX IF EXISTS idx_marketing_facebook_daily_runs_day;
      DROP INDEX IF EXISTS idx_marketing_facebook_daily_runs_day_slot;

      -- Preserve every historical run while making the ledger key unique again.
      -- This only changes slot labels for rows that could not previously be
      -- protected by the missing unique index.
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

      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
            FROM social_publication_targets
           GROUP BY publication_id, platform, account_id
          HAVING COUNT(*) > 1
        ) THEN
          RAISE EXCEPTION
            'Cannot repair social_publication_targets_unique_target while duplicate targets exist';
        END IF;
      END $$;

      CREATE UNIQUE INDEX IF NOT EXISTS social_publication_targets_unique_target
        ON social_publication_targets(publication_id, platform, account_id);
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