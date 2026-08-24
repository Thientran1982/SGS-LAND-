import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const migration: Migration = {
  description: 'Track Care email opens, clicks and replies for immediate sequence stopping',
  async up(client: PoolClient) {
    await client.query(`
      ALTER TABLE care_followup_log
        ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS engagement_status TEXT NOT NULL DEFAULT 'SENT',
        ADD COLUMN IF NOT EXISTS engaged_at TIMESTAMPTZ;
      ALTER TABLE care_followup_log
        DROP CONSTRAINT IF EXISTS care_followup_log_engagement_status_check;
      ALTER TABLE care_followup_log
        ADD CONSTRAINT care_followup_log_engagement_status_check
        CHECK (engagement_status IN ('SENT','OPENED','CLICKED'));
      CREATE INDEX IF NOT EXISTS idx_care_followup_delivery_key ON care_followup_log (tenant_id, delivery_key);
      CREATE INDEX IF NOT EXISTS idx_leads_care_status ON leads (tenant_id, care_status);
    `);
  },
  async down(client: PoolClient) {
    await client.query(`
      DROP INDEX IF EXISTS idx_care_followup_delivery_key;
      DROP INDEX IF EXISTS idx_leads_care_status;
      ALTER TABLE care_followup_log DROP CONSTRAINT IF EXISTS care_followup_log_engagement_status_check;
      ALTER TABLE care_followup_log
        DROP COLUMN IF EXISTS opened_at, DROP COLUMN IF EXISTS clicked_at, DROP COLUMN IF EXISTS replied_at,
        DROP COLUMN IF EXISTS engagement_status, DROP COLUMN IF EXISTS engaged_at;
    `);
  },
};
export default migration;