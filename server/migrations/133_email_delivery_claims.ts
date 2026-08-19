import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const migration: Migration = {
  description: 'Atomic email delivery claims for stable agent outbound keys',
  async up(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS email_delivery_claims (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        delivery_key TEXT NOT NULL,
        recipient TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'SENDING'
          CHECK (status IN ('SENDING','SENT','UNKNOWN','FAILED')),
        provider TEXT,
        provider_message_id TEXT,
        error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, delivery_key)
      );
      CREATE INDEX IF NOT EXISTS idx_email_delivery_claims_tenant_status
        ON email_delivery_claims (tenant_id, status, updated_at DESC);
      ALTER TABLE email_delivery_claims ENABLE ROW LEVEL SECURITY;
      ALTER TABLE email_delivery_claims FORCE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS tenant_isolation_v2 ON email_delivery_claims;
      CREATE POLICY tenant_isolation_v2 ON email_delivery_claims AS PERMISSIVE FOR ALL TO PUBLIC
        USING (NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), ''))
        WITH CHECK (NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), ''));
    `);
  },
  async down(client: PoolClient): Promise<void> {
    await client.query('DROP TABLE IF EXISTS email_delivery_claims');
  },
};

export default migration;