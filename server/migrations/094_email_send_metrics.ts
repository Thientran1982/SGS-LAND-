import type { PoolClient } from 'pg';

const up = async (client: PoolClient): Promise<void> => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS email_send_metrics (
      id           BIGSERIAL PRIMARY KEY,
      tenant_id    UUID        NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
                                REFERENCES tenants(id) ON DELETE CASCADE,
      kind         VARCHAR(40) NOT NULL,
      success      BOOLEAN     NOT NULL,
      reason       TEXT,
      provider     VARCHAR(20) NOT NULL DEFAULT 'brevo',
      message_id   VARCHAR(120),
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_esm_tenant_created
      ON email_send_metrics(tenant_id, created_at DESC);
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_esm_kind_created
      ON email_send_metrics(kind, created_at DESC);
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_esm_success_created
      ON email_send_metrics(success, created_at DESC);
  `);
};

const down = async (client: PoolClient): Promise<void> => {
  await client.query(`DROP TABLE IF EXISTS email_send_metrics;`);
};

export default {
  up,
  down,
  description:
    'Track per-tenant email send success/failure rate (lead notification + auto-reply) for ops monitoring',
};
