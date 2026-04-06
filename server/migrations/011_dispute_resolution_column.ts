import type { Migration } from './runner';

const migration: Migration = {
  description: 'Add dispute_resolution column to contracts table',

  async up(client) {
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'contracts' AND column_name = 'dispute_resolution'
        ) THEN
          ALTER TABLE contracts ADD COLUMN dispute_resolution TEXT;
        END IF;
      END
      $$;
    `);
  },

  async down(client) {
    await client.query(`
      ALTER TABLE contracts DROP COLUMN IF EXISTS dispute_resolution;
    `);
  },
};

export default migration;
