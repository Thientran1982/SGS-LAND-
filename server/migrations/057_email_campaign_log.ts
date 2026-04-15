import type { Migration } from './runner';
import type { PoolClient } from 'pg';

const migration: Migration = {
  description: 'Tạo bảng email_campaign_log để theo dõi email tự động gửi cho user',

  async up(client: PoolClient) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS email_campaign_log (
        id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id   VARCHAR(36)   NOT NULL,
        user_id     UUID          NOT NULL,
        email       VARCHAR(255)  NOT NULL,
        campaign    VARCHAR(50)   NOT NULL,
        sent_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_ecl_user_campaign
        ON email_campaign_log(user_id, campaign, sent_at DESC);

      CREATE INDEX IF NOT EXISTS idx_ecl_tenant_sent
        ON email_campaign_log(tenant_id, sent_at DESC);
    `);
  },

  async down(client: PoolClient) {
    await client.query(`DROP TABLE IF EXISTS email_campaign_log;`);
  },
};

export default migration;
