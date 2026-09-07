import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const TENANT_EXPR = `(
  NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
  AND tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), '')
)`;

const migration: Migration = {
  description: 'Add tenant-scoped human labels for privacy-safe landing classifier candidates',

  async up(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS landing_classification_reviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        audit_event_id UUID NOT NULL REFERENCES agent_audit_events(id) ON DELETE CASCADE,
        label TEXT NOT NULL CHECK (label IN (
          'CONFIRMED_FALSE_NEGATIVE',
          'CONFIRMED_FALSE_POSITIVE',
          'NOT_AN_ERROR'
        )),
        reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, audit_event_id)
      );
      CREATE INDEX IF NOT EXISTS idx_landing_classification_reviews_queue
        ON landing_classification_reviews (tenant_id, reviewed_at DESC);
      CREATE INDEX IF NOT EXISTS idx_landing_classification_reviews_label
        ON landing_classification_reviews (tenant_id, label, reviewed_at DESC);
      ALTER TABLE landing_classification_reviews ENABLE ROW LEVEL SECURITY;
      ALTER TABLE landing_classification_reviews FORCE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS tenant_isolation_v1 ON landing_classification_reviews;
      CREATE POLICY tenant_isolation_v1 ON landing_classification_reviews
        AS PERMISSIVE FOR ALL TO PUBLIC
        USING (${TENANT_EXPR})
        WITH CHECK (${TENANT_EXPR});
      GRANT SELECT, INSERT, UPDATE, DELETE ON landing_classification_reviews TO sgs_app;
    `);
  },

  async down(client: PoolClient): Promise<void> {
    await client.query('DROP TABLE IF EXISTS landing_classification_reviews');
  },
};

export default migration;