import { PoolClient } from 'pg';
import { Migration } from './runner';

const migration: Migration = {
  description: 'Add missing current_period_start and current_period_end columns to subscriptions table',
  async up(client: PoolClient) {
    await client.query(`
      ALTER TABLE subscriptions
        ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        ADD COLUMN IF NOT EXISTS current_period_end   TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days');
    `);

    await client.query(`
      UPDATE subscriptions
      SET
        current_period_start = created_at,
        current_period_end   = created_at + INTERVAL '30 days'
      WHERE current_period_start IS NULL;
    `);
  },
  async down(client: PoolClient) {
    await client.query(`
      ALTER TABLE subscriptions
        DROP COLUMN IF EXISTS current_period_start,
        DROP COLUMN IF EXISTS current_period_end;
    `);
  }
};

export default migration;
