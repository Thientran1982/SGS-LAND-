import type { Migration } from './runner';
import type { PoolClient } from 'pg';

const migration: Migration = {
  description: 'Add recurring daily, weekly, and monthly campaign schedules',

  async up(client: PoolClient) {
    await client.query(`
      ALTER TABLE campaigns
        ADD COLUMN IF NOT EXISTS recurrence_type VARCHAR(20) NOT NULL DEFAULT 'ONCE';

      ALTER TABLE campaigns
        DROP CONSTRAINT IF EXISTS campaigns_recurrence_type_check;

      ALTER TABLE campaigns
        ADD CONSTRAINT campaigns_recurrence_type_check
        CHECK (recurrence_type IN ('ONCE', 'DAILY', 'WEEKLY', 'MONTHLY'));
    `);
  },

  async down(client: PoolClient) {
    await client.query(`
      ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_recurrence_type_check;
      ALTER TABLE campaigns DROP COLUMN IF EXISTS recurrence_type;
    `);
  },
};

export default migration;