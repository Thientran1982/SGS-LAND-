import type { Migration } from './runner';
import type { PoolClient } from 'pg';

const migration: Migration = {
  description: 'Prevent duplicate recipients within an email campaign',

  async up(client: PoolClient) {
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_campaign_recipients_campaign_email
        ON campaign_recipients (campaign_id, lower(email))
    `);
  },

  async down(client: PoolClient) {
    await client.query(`
      DROP INDEX IF EXISTS uq_campaign_recipients_campaign_email
    `);
  },
};

export default migration;