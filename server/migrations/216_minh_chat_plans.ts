import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const migration: Migration = {
  description: 'Persist authenticated Minh guide plans and per-step progress',

  async up(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS minh_chat_plans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        session_id TEXT NOT NULL CHECK (length(session_id) BETWEEN 1 AND 200),
        title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
        steps JSONB NOT NULL CHECK (jsonb_typeof(steps) = 'array'),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, user_id, session_id)
      );
      CREATE INDEX IF NOT EXISTS idx_minh_chat_plans_user_recent
        ON minh_chat_plans (tenant_id, user_id, updated_at DESC);
      ALTER TABLE minh_chat_plans ENABLE ROW LEVEL SECURITY;
      ALTER TABLE minh_chat_plans FORCE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS tenant_isolation_v2 ON minh_chat_plans;
      CREATE POLICY tenant_isolation_v2 ON minh_chat_plans
        AS PERMISSIVE FOR ALL TO PUBLIC
        USING (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), '')
        )
        WITH CHECK (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), '')
        );
      GRANT SELECT, INSERT, UPDATE, DELETE ON minh_chat_plans TO sgs_app;
    `);
  },

  async down(client: PoolClient): Promise<void> {
    await client.query('DROP TABLE IF EXISTS minh_chat_plans CASCADE');
  },
};

export default migration;