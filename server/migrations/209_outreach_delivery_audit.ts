import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const TENANT_EXPR = `(
  NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
  AND tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), '')
)`;

const migration: Migration = {
  description: 'Keep append-only, tenant-scoped audit history for outreach delivery lookups and decisions',

  async up(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS outreach_delivery_audit_events (
        id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id             UUID NOT NULL,
        delivery_id           UUID NOT NULL REFERENCES agent_outbound_deliveries(id) ON DELETE RESTRICT,
        approval_request_id   UUID NOT NULL REFERENCES approval_requests(id) ON DELETE RESTRICT,
        variant_id            TEXT NOT NULL,
        event_type            TEXT NOT NULL CHECK (event_type IN ('PROVIDER_LOOKUP', 'OPERATOR_DECISION')),
        provider              TEXT NOT NULL CHECK (provider IN ('BREVO', 'ZALO', 'NONE')),
        lookup_status         TEXT CHECK (lookup_status IN ('DELIVERED', 'NOT_RECEIVED', 'UNKNOWN', 'UNSUPPORTED')),
        provider_event        TEXT,
        provider_message_id   TEXT,
        decision_status       TEXT CHECK (decision_status IN ('SENT', 'FAILED')),
        decision_note         TEXT,
        operator_id           UUID,
        operator_name         TEXT,
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_outreach_delivery_audit_history
        ON outreach_delivery_audit_events (tenant_id, delivery_id, created_at ASC, id ASC);

      ALTER TABLE outreach_delivery_audit_events ENABLE ROW LEVEL SECURITY;
      ALTER TABLE outreach_delivery_audit_events FORCE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS tenant_isolation_v2 ON outreach_delivery_audit_events;
      CREATE POLICY tenant_isolation_v2 ON outreach_delivery_audit_events
        AS PERMISSIVE FOR ALL TO PUBLIC
        USING (${TENANT_EXPR})
        WITH CHECK (${TENANT_EXPR});

      REVOKE UPDATE, DELETE ON outreach_delivery_audit_events FROM PUBLIC, sgs_app;
      GRANT SELECT, INSERT ON outreach_delivery_audit_events TO sgs_app;

      CREATE OR REPLACE FUNCTION prevent_outreach_delivery_audit_mutation()
      RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'outreach_delivery_audit_events is append-only';
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS outreach_delivery_audit_append_only
        ON outreach_delivery_audit_events;
      CREATE TRIGGER outreach_delivery_audit_append_only
        BEFORE UPDATE OR DELETE ON outreach_delivery_audit_events
        FOR EACH ROW EXECUTE FUNCTION prevent_outreach_delivery_audit_mutation();
    `);
  },

  async down(client: PoolClient): Promise<void> {
    await client.query(`
      DROP TRIGGER IF EXISTS outreach_delivery_audit_append_only
        ON outreach_delivery_audit_events;
      DROP FUNCTION IF EXISTS prevent_outreach_delivery_audit_mutation();
      DROP TABLE IF EXISTS outreach_delivery_audit_events;
    `);
  },
};

export default migration;