import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const migration: Migration = {
  description: 'Consent-gated tenant-scoped customer profiles, fact history, outcomes and erasure audit',
  async up(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS customer_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        customer_id TEXT NOT NULL,
        remember_consent TEXT NOT NULL DEFAULT 'PENDING'
          CHECK (remember_consent IN ('PENDING','OPTED_IN','OPTED_OUT')),
        consent_version TEXT,
        consent_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, customer_id)
      );
      CREATE TABLE IF NOT EXISTS customer_profile_facts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        profile_id UUID NOT NULL REFERENCES customer_profiles(id) ON DELETE CASCADE,
        fact TEXT NOT NULL,
        category TEXT NOT NULL,
        source TEXT NOT NULL,
        valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
        valid_until DATE,
        superseded_by UUID REFERENCES customer_profile_facts(id) ON DELETE SET NULL,
        sensitive BOOLEAN NOT NULL DEFAULT FALSE,
        confidence NUMERIC(4,3) NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CHECK (valid_until IS NULL OR valid_until >= valid_from)
      );
      CREATE INDEX IF NOT EXISTS idx_customer_profile_facts_active
        ON customer_profile_facts (tenant_id, profile_id, category, valid_until);
      CREATE TABLE IF NOT EXISTS customer_profile_outcomes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        profile_id UUID NOT NULL REFERENCES customer_profiles(id) ON DELETE CASCADE,
        action_taken TEXT NOT NULL,
        result TEXT NOT NULL,
        learning TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS customer_profile_erasure_audit (
        id BIGSERIAL PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        customer_id TEXT NOT NULL,
        action TEXT NOT NULL CHECK (action IN ('CONSENT_CHANGED','FACT_CREATED','FACT_DELETED','TOPIC_ADDED','TOPIC_DELETED','PROFILE_ERASED','RETENTION_PURGED')),
        actor_id TEXT,
        details_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_customer_profile_erasure_audit_lookup
        ON customer_profile_erasure_audit (tenant_id, customer_id, created_at DESC);
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
    `);
    // The table predates the explicit fact-created audit event in some installs.
    await client.query(`ALTER TABLE customer_profile_erasure_audit DROP CONSTRAINT IF EXISTS customer_profile_erasure_audit_action_check`);
    await client.query(`ALTER TABLE customer_profile_erasure_audit ADD CONSTRAINT customer_profile_erasure_audit_action_check
      CHECK (action IN ('CONSENT_CHANGED','FACT_CREATED','FACT_DELETED','TOPIC_ADDED','TOPIC_DELETED','PROFILE_ERASED','RETENTION_PURGED'))`);
    for (const table of ['customer_profiles', 'customer_profile_facts', 'customer_profile_outcomes', 'customer_profile_erasure_audit', 'customer_profile_topics_to_avoid']) {
      await client.query(`
        ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;
        ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS tenant_isolation_v2 ON ${table};
        CREATE POLICY tenant_isolation_v2 ON ${table} AS PERMISSIVE FOR ALL TO PUBLIC
          USING (NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
            AND tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), ''))
          WITH CHECK (NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
            AND tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), ''));
      `);
    }
  },
  async down(client: PoolClient): Promise<void> {
    await client.query('DROP TABLE IF EXISTS customer_profile_topics_to_avoid, customer_profile_erasure_audit, customer_profile_outcomes, customer_profile_facts, customer_profiles CASCADE');
  },
};

export default migration;