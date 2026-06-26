import { PoolClient } from 'pg';

/**
 * GĐ1 (GEO/AEO): Chủ đầu tư (developers) entity + liên kết với projects.
 * - Bảng `developers`: thực thể Chủ đầu tư, chứa các trường "citable" cho AI engines.
 * - Cột `developer_id` trên `projects`: liên kết dự án -> chủ đầu tư.
 * Tuân thủ multi-tenant + RLS giống các bảng hiện có.
 */
export default {
  description: 'GEO: developers (chu dau tu) entity table + projects.developer_id FK',
  async up(client: PoolClient): Promise<void> {
    // --- developers table ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS developers (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        slug            VARCHAR(160) NOT NULL,
        name            VARCHAR(255) NOT NULL,
        legal_name      VARCHAR(255),
        brand           VARCHAR(160),
        stock_code      VARCHAR(20),
        founded_year    INTEGER,
        headquarters    VARCHAR(500),
        website         VARCHAR(500),
        logo_url        VARCHAR(500),
        charter_capital BIGINT,
        projects_delivered INTEGER,
        land_bank_ha    NUMERIC(12,2),
        awards          JSONB NOT NULL DEFAULT '[]',
        summary         TEXT,
        description     TEXT,
        faq             JSONB NOT NULL DEFAULT '[]',
        metadata        JSONB NOT NULL DEFAULT '{}',
        created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_developers_tenant_slug ON developers(tenant_id, slug);
      CREATE INDEX IF NOT EXISTS idx_developers_tenant_name ON developers(tenant_id, name);
    `);

    // Enable RLS
    await client.query(`ALTER TABLE developers ENABLE ROW LEVEL SECURITY;`);
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'developers' AND policyname = 'tenant_isolation') THEN
          CREATE POLICY tenant_isolation ON developers
            USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
        END IF;
      END $$;
    `);

    // --- link projects -> developers ---
    await client.query(`
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS developer_id UUID REFERENCES developers(id) ON DELETE SET NULL;
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_projects_developer ON projects(developer_id);
    `);
  },
};
