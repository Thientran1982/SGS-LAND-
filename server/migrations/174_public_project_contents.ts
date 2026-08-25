import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const migration: Migration = {
  description: 'Create tenant-scoped CMS content for public project introduction pages',
  async up(client: PoolClient) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS public_project_contents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        slug VARCHAR(160) NOT NULL,
        name VARCHAR(255) NOT NULL,
        content JSONB NOT NULL DEFAULT '{}'::jsonb,
        status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PUBLISHED')),
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
        published_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, slug)
      );
      CREATE INDEX IF NOT EXISTS idx_public_project_contents_published
        ON public_project_contents (status, updated_at DESC);
      ALTER TABLE public_project_contents ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public_project_contents FORCE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS tenant_isolation_v1 ON public_project_contents;
      CREATE POLICY tenant_isolation_v1 ON public_project_contents AS PERMISSIVE FOR ALL TO PUBLIC
        USING (NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), ''))
        WITH CHECK (NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), ''));
    `);
  },
  async down(client: PoolClient) {
    await client.query('DROP TABLE IF EXISTS public_project_contents CASCADE');
  },
};

export default migration;