import type { Migration } from './runner';
import type { PoolClient } from 'pg';

const migration: Migration = {
  description: 'Tạo bảng lead_email_log để theo dõi email tự động gửi cho khách hàng tiềm năng từ landing page',

  async up(client: PoolClient) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS lead_email_log (
        id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id   VARCHAR(36)   NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
        lead_id     UUID          NOT NULL,
        email       VARCHAR(255)  NOT NULL,
        campaign    VARCHAR(50)   NOT NULL,
        sent_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_lel_lead_campaign
        ON lead_email_log(lead_id, campaign, sent_at DESC);

      CREATE INDEX IF NOT EXISTS idx_lel_email_campaign
        ON lead_email_log(email, campaign, sent_at DESC);

      CREATE INDEX IF NOT EXISTS idx_lel_tenant_sent
        ON lead_email_log(tenant_id, sent_at DESC);
    `);
  },

  async down(client: PoolClient) {
    await client.query(`DROP TABLE IF EXISTS lead_email_log;`);
  },
};

export default migration;
