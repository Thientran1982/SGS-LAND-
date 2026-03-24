import type { Migration } from './runner';

const migration: Migration = {
  description: 'Add theme_config JSONB column to enterprise_config; migrate any existing theme KV row to column',

  async up(client) {
    await client.query(`
      ALTER TABLE enterprise_config
        ADD COLUMN IF NOT EXISTS theme_config JSONB NOT NULL DEFAULT '{}'::jsonb;
    `);
  },

  async down(client) {
    await client.query(`
      ALTER TABLE enterprise_config DROP COLUMN IF EXISTS theme_config;
    `);
  },
};

export default migration;
