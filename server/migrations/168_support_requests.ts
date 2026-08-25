import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const migration: Migration = {
  description: 'Tenant-scoped support requests with status history, consent and staff replies',
  async up(client: PoolClient) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS support_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        tracking_code TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'GENERAL',
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        source_session_id TEXT,
        consent_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
        status TEXT NOT NULL DEFAULT 'RECEIVED'
          CHECK (status IN ('RECEIVED','IN_PROGRESS','WAITING_FOR_USER','RESOLVED','CLOSED')),
        latest_reply TEXT,
        assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
        last_updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        resolved_at TIMESTAMPTZ,
        UNIQUE (tenant_id, tracking_code),
        CHECK (consent_confirmed = TRUE)
      );
      CREATE TABLE IF NOT EXISTS support_request_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        request_id UUID NOT NULL REFERENCES support_requests(id) ON DELETE CASCADE,
        actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
        event_type TEXT NOT NULL CHECK (event_type IN ('CREATED','STATUS_CHANGED','REPLIED')),
        status TEXT CHECK (status IS NULL OR status IN ('RECEIVED','IN_PROGRESS','WAITING_FOR_USER','RESOLVED','CLOSED')),
        message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_support_requests_requester
        ON support_requests (tenant_id, requester_id, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_support_requests_staff
        ON support_requests (tenant_id, status, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_support_request_events_request
        ON support_request_events (tenant_id, request_id, created_at ASC);
      ALTER TABLE support_requests ENABLE ROW LEVEL SECURITY;
      ALTER TABLE support_requests FORCE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS tenant_isolation_v2 ON support_requests;
      CREATE POLICY tenant_isolation_v2 ON support_requests AS PERMISSIVE FOR ALL TO PUBLIC
        USING (tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), ''))
        WITH CHECK (tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), ''));
      ALTER TABLE support_request_events ENABLE ROW LEVEL SECURITY;
      ALTER TABLE support_request_events FORCE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS tenant_isolation_v2 ON support_request_events;
      CREATE POLICY tenant_isolation_v2 ON support_request_events AS PERMISSIVE FOR ALL TO PUBLIC
        USING (tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), ''))
        WITH CHECK (tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), ''));
    `);
  },
  async down(client: PoolClient) {
    await client.query('DROP TABLE IF EXISTS support_request_events, support_requests CASCADE');
  },
};

export default migration;