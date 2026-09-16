import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const TENANT_EXPR = `(
  NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
  AND tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), '')
)`;

const migration: Migration = {
  description: 'Add durable public live-chat reply outbox and response envelope state',

  async up(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS livechat_reply_outbox (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        lead_id UUID NOT NULL,
        inbound_interaction_id UUID NOT NULL,
        execution_id UUID,
        interaction_id UUID,
        status TEXT NOT NULL DEFAULT 'REPLY_PENDING'
          CHECK (status IN ('REPLY_PENDING','DELIVERED','FAILED')),
        response_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        failure_code TEXT,
        failure_text TEXT,
        attempt INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        delivered_at TIMESTAMPTZ,
        UNIQUE (tenant_id, inbound_interaction_id)
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_livechat_reply_outbox_status
        ON livechat_reply_outbox (tenant_id, status, updated_at)
    `);
    await client.query(`
      DROP POLICY IF EXISTS tenant_isolation_v2 ON livechat_reply_outbox
    `);
    await client.query(`
      ALTER TABLE livechat_reply_outbox ENABLE ROW LEVEL SECURITY
    `);
    await client.query(`
      ALTER TABLE livechat_reply_outbox FORCE ROW LEVEL SECURITY
    `);
    await client.query(`
      CREATE POLICY tenant_isolation_v2 ON livechat_reply_outbox
        AS PERMISSIVE FOR ALL TO PUBLIC
        USING (${TENANT_EXPR})
        WITH CHECK (${TENANT_EXPR})
    `);
    await client.query(`
      GRANT SELECT, INSERT, UPDATE, DELETE
        ON livechat_reply_outbox TO sgs_app
    `).catch(() => {});
  },

  async down(client: PoolClient): Promise<void> {
    await client.query(`DROP TABLE IF EXISTS livechat_reply_outbox`);
  },
};

export default migration;