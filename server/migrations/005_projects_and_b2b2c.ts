import { PoolClient } from 'pg';
import { Migration } from './runner';

const migration: Migration = {
  description: 'Add projects table, project_access table (B2B2C: developer-to-broker scoped access), and listings.project_id FK',

  async up(client: PoolClient): Promise<void> {
    // --- projects table ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name           VARCHAR(255) NOT NULL,
        code           VARCHAR(100),
        description    TEXT,
        location       VARCHAR(500),
        total_units    INTEGER,
        status         VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
        open_date      DATE,
        handover_date  DATE,
        metadata       JSONB NOT NULL DEFAULT '{}',
        created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_tenant_code ON projects(tenant_id, code) WHERE code IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_projects_tenant_status ON projects(tenant_id, status);
    `);

    // Enable RLS on projects
    await client.query(`ALTER TABLE projects ENABLE ROW LEVEL SECURITY;`);
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies WHERE tablename = 'projects' AND policyname = 'tenant_isolation'
        ) THEN
          CREATE POLICY tenant_isolation ON projects
            USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
        END IF;
      END $$;
    `);

    // --- project_access table (cross-tenant: developer grants broker access to project) ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_access (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        partner_tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        granted_by        UUID REFERENCES users(id) ON DELETE SET NULL,
        granted_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        expires_at        TIMESTAMP WITH TIME ZONE,
        status            VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
        note              TEXT,
        UNIQUE(project_id, partner_tenant_id)
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_project_access_project     ON project_access(project_id);
      CREATE INDEX IF NOT EXISTS idx_project_access_partner     ON project_access(partner_tenant_id, status);
    `);

    // project_access is cross-tenant; no RLS (access controlled at application layer)

    // --- Add project_id FK to listings ---
    await client.query(`
      ALTER TABLE listings
        ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_listings_project_id ON listings(project_id);
    `);
  },

  async down(client: PoolClient): Promise<void> {
    await client.query(`ALTER TABLE listings DROP COLUMN IF EXISTS project_id`);
    await client.query(`DROP TABLE IF EXISTS project_access`);
    await client.query(`DROP TABLE IF EXISTS projects`);
  },
};

export default migration;
