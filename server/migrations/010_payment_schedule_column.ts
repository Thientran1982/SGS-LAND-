import type { Migration } from './runner';

const migration: Migration = {
  description: 'Add payment_schedule JSONB column to contracts table',

  async up(client) {
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'contracts' AND column_name = 'payment_schedule'
        ) THEN
          ALTER TABLE contracts ADD COLUMN payment_schedule JSONB;
        END IF;
      END
      $$;
    `);
  },

  async down(client) {
    await client.query(`
      ALTER TABLE contracts DROP COLUMN IF EXISTS payment_schedule;
    `);
  },
};

export default migration;
