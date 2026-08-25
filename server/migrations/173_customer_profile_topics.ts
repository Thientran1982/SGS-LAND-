import type { PoolClient } from 'pg';
import type { Migration } from './runner';

/** Backfills controls added after the initial customer-profile migration. */
const migration: Migration = {
  description: 'Customer profile sensitive topics and complete audit action contract',
  async up(client: PoolClient): Promise<void> {
    await client.query(`
      ALTER TABLE customer_profile_erasure_audit
        DROP CONSTRAINT IF EXISTS customer_profile_erasure_audit_action_check;
      ALTER TABLE customer_profile_erasure_audit
        ADD CONSTRAINT customer_profile_erasure_audit_action_check CHECK
        (action IN ('CONSENT_CHANGED','FACT_CREATED','FACT_DELETED','TOPIC_ADDED','TOPIC_DELETED','PROFILE_ERASED','RETENTION_PURGED'));
      CREATE TABLE IF NOT EXISTS customer_profile_topics_to_avoid (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        profile_id UUID NOT NULL REFERENCES customer_profiles(id) ON DELETE CASCADE,
        topic TEXT NOT NULL CHECK (char_length(topic) BETWEEN 1 AND 500),
        source TEXT NOT NULL CHECK (char_length(source) BETWEEN 1 AND 500),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, profile_id, topic)
      );
      CREATE INDEX IF NOT EXISTS idx_customer_profile_topics_lookup
        ON customer_profile_topics_to_avoid (tenant_id, profile_id);
      ALTER TABLE customer_profile_topics_to_avoid ENABLE ROW LEVEL SECURITY;
      ALTER TABLE customer_profile_topics_to_avoid FORCE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS tenant_isolation_v2 ON customer_profile_topics_to_avoid;
      CREATE POLICY tenant_isolation_v2 ON customer_profile_topics_to_avoid AS PERMISSIVE FOR ALL TO PUBLIC
        USING (NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), ''))
        WITH CHECK (NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), ''));
    `);
  },
  async down(client: PoolClient): Promise<void> {
    await client.query('DROP TABLE IF EXISTS customer_profile_topics_to_avoid CASCADE');
  },
};

export default migration;