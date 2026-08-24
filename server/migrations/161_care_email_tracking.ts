import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const migration: Migration = {
  description: 'Track Care email opens, clicks and replies for immediate sequence stopping',
  async up(client: PoolClient) {
    await client.query(`
      ALTER TABLE care_followup_log
        ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ;
      CREATE INDEX IF NOT EXISTS idx_care_followup_delivery_key ON care_followup_log (tenant_id, delivery_key);
    `);
  },
  async down(client: PoolClient) {
    await client.query(`DROP INDEX IF EXISTS idx_care_followup_delivery_key; ALTER TABLE care_followup_log DROP COLUMN IF EXISTS opened_at, DROP COLUMN IF EXISTS clicked_at, DROP COLUMN IF EXISTS replied_at;`);
  },
};
export default migration;