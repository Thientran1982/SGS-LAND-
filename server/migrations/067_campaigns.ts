import type { Migration } from './runner';
import type { PoolClient } from 'pg';

const migration: Migration = {
  description: 'Module Chiến dịch tự động — campaigns + campaign_recipients',

  async up(client: PoolClient) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id       VARCHAR(36)   NOT NULL,
        name            VARCHAR(200)  NOT NULL,
        description     TEXT,
        channel         VARCHAR(20)   NOT NULL DEFAULT 'EMAIL',
        status          VARCHAR(20)   NOT NULL DEFAULT 'DRAFT',
        audience        JSONB         NOT NULL DEFAULT '{}'::jsonb,
        subject         VARCHAR(300),
        body_html       TEXT,
        schedule_type   VARCHAR(20)   NOT NULL DEFAULT 'NOW',
        scheduled_at    TIMESTAMPTZ,
        ab_test         JSONB         NOT NULL DEFAULT '{"enabled":false}'::jsonb,
        send_count      INTEGER       NOT NULL DEFAULT 0,
        open_count      INTEGER       NOT NULL DEFAULT 0,
        click_count     INTEGER       NOT NULL DEFAULT 0,
        last_run_at     TIMESTAMPTZ,
        last_error      TEXT,
        created_by      UUID,
        created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_campaigns_tenant_status
        ON campaigns(tenant_id, status, created_at DESC);

      CREATE TABLE IF NOT EXISTS campaign_recipients (
        id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_id     UUID          NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
        tenant_id       VARCHAR(36)   NOT NULL,
        lead_id         UUID,
        user_id         UUID,
        email           VARCHAR(255)  NOT NULL,
        name            VARCHAR(200),
        variant         CHAR(1)       NOT NULL DEFAULT 'A',
        status          VARCHAR(20)   NOT NULL DEFAULT 'PENDING',
        sent_at         TIMESTAMPTZ,
        opened_at       TIMESTAMPTZ,
        clicked_at      TIMESTAMPTZ,
        error           TEXT,
        created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_camprec_campaign
        ON campaign_recipients(campaign_id, status);
      CREATE INDEX IF NOT EXISTS idx_camprec_tenant
        ON campaign_recipients(tenant_id, sent_at DESC);
      CREATE INDEX IF NOT EXISTS idx_camprec_email
        ON campaign_recipients(email, campaign_id);
    `);
  },

  async down(client: PoolClient) {
    await client.query(`
      DROP TABLE IF EXISTS campaign_recipients;
      DROP TABLE IF EXISTS campaigns;
    `);
  },
};

export default migration;
