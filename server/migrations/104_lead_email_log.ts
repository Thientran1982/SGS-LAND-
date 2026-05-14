import type { Migration } from './runner';
import type { PoolClient } from 'pg';

const migration: Migration = {
  description:
    'Create lead_email_log table for tracking nurture emails sent to leads (used by engagement cron LEAD_NURTURE segment).',

  async up(client: PoolClient) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS lead_email_log (
        id         UUID                     PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id  CHARACTER VARYING        NOT NULL,
        lead_id    UUID,
        email      CHARACTER VARYING        NOT NULL,
        campaign   CHARACTER VARYING        NOT NULL,
        sent_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_lead_email_log_lead_campaign
        ON lead_email_log (lead_id, campaign, sent_at DESC);

      CREATE INDEX IF NOT EXISTS idx_lead_email_log_tenant
        ON lead_email_log (tenant_id, sent_at DESC);
    `);
  },

  async down(client: PoolClient) {
    await client.query(`DROP TABLE IF EXISTS lead_email_log;`);
  },
};

export default migration;
