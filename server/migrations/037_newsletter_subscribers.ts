import { PoolClient } from 'pg';
import { Migration } from './runner';

const migration: Migration = {
  description: 'Create newsletter_subscribers table',

  async up(client: PoolClient) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS newsletter_subscribers (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email       TEXT NOT NULL,
        subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ip_address  TEXT,
        source      TEXT DEFAULT 'news_page',
        UNIQUE (email)
      )
    `);
  },

  async down(client: PoolClient) {
    await client.query(`DROP TABLE IF EXISTS newsletter_subscribers`);
  },
};

export default migration;
