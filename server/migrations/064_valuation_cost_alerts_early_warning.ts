import { PoolClient } from 'pg';
import { Migration } from './runner';

const migration: Migration = {
  description: '064: Early warning + hard cap for valuation AI cost alerts',

  async up(client: PoolClient) {
    await client.query(`
      ALTER TABLE valuation_cost_alerts
        ADD COLUMN IF NOT EXISTS warn_percent INT DEFAULT 80,
        ADD COLUMN IF NOT EXISTS hard_cap_enabled BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS last_warn_alerted_period VARCHAR(7);
    `);
  },

  async down(client: PoolClient) {
    await client.query(`
      ALTER TABLE valuation_cost_alerts
        DROP COLUMN IF EXISTS warn_percent,
        DROP COLUMN IF EXISTS hard_cap_enabled,
        DROP COLUMN IF EXISTS last_warn_alerted_period;
    `);
  },
};

export default migration;
