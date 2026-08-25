import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const migration: Migration = {
  description: 'Allow controlled internal email delivery claims under RLS bypass',
  async up(client: PoolClient): Promise<void> {
    await client.query(`
      ALTER TABLE email_delivery_claims ENABLE ROW LEVEL SECURITY;
      ALTER TABLE email_delivery_claims FORCE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS tenant_isolation_v2 ON email_delivery_claims;
      CREATE POLICY tenant_isolation_v2 ON email_delivery_claims
        AS PERMISSIVE
        FOR ALL
        TO PUBLIC
        USING (
          (
            NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
            AND tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), '')
          )
          OR current_setting('app.bypass_rls', true) = 'on'
        )
        WITH CHECK (
          (
            NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
            AND tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), '')
          )
          OR current_setting('app.bypass_rls', true) = 'on'
        );
      GRANT SELECT, INSERT, UPDATE, DELETE ON email_delivery_claims TO sgs_app;
    `);
  },
};

export default migration;