import type { Migration } from './runner';
import type { PoolClient } from 'pg';

const migration: Migration = {
  description: 'Add explicit marketing email consent fields for campaign and sequence safety',

  async up(client: PoolClient) {
    await client.query(`
      ALTER TABLE leads
        ADD COLUMN IF NOT EXISTS marketing_email_consent BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS marketing_email_consent_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS marketing_email_consent_source TEXT;

      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS marketing_email_consent BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS marketing_email_consent_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS marketing_email_consent_source TEXT;

      CREATE INDEX IF NOT EXISTS idx_leads_marketing_email_consent
        ON leads (tenant_id, marketing_email_consent);
      CREATE INDEX IF NOT EXISTS idx_users_marketing_email_consent
        ON users (tenant_id, marketing_email_consent);
    `);
  },

  async down(client: PoolClient) {
    await client.query(`
      DROP INDEX IF EXISTS idx_leads_marketing_email_consent;
      DROP INDEX IF EXISTS idx_users_marketing_email_consent;
      ALTER TABLE leads
        DROP COLUMN IF EXISTS marketing_email_consent,
        DROP COLUMN IF EXISTS marketing_email_consent_at,
        DROP COLUMN IF EXISTS marketing_email_consent_source;
      ALTER TABLE users
        DROP COLUMN IF EXISTS marketing_email_consent,
        DROP COLUMN IF EXISTS marketing_email_consent_at,
        DROP COLUMN IF EXISTS marketing_email_consent_source;
    `);
  },
};

export default migration;