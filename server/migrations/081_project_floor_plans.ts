import type { Migration } from './runner';
import type { PoolClient } from 'pg';

const migration: Migration = {
  description:
    'Tạo bảng project_floor_plans (sa bàn tương tác cho dự án căn hộ — SVG theo tower/floor + ánh xạ data-code → listing.code)',

  async up(client: PoolClient) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_floor_plans (
        id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id       VARCHAR(36)   NOT NULL,
        project_id      UUID          NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        tower           VARCHAR(50)   NOT NULL DEFAULT 'ALL',
        floor           VARCHAR(20)   NOT NULL DEFAULT 'ALL',
        svg_url         TEXT          NOT NULL,
        svg_filename    VARCHAR(255)  NOT NULL,
        parsed_codes    JSONB         NOT NULL DEFAULT '[]'::jsonb,
        notes           TEXT,
        uploaded_by     UUID,
        created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      );

      CREATE UNIQUE INDEX IF NOT EXISTS uq_pfp_project_tower_floor
        ON project_floor_plans(project_id, tower, floor);

      CREATE INDEX IF NOT EXISTS idx_pfp_tenant_updated
        ON project_floor_plans(tenant_id, updated_at DESC);
    `);

    // RLS: same pattern as project_price_matrix — tenant-scoped + bypass channel.
    await client.query(`
      ALTER TABLE project_floor_plans ENABLE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS tenant_isolation_v2 ON project_floor_plans;
      CREATE POLICY tenant_isolation_v2 ON project_floor_plans
        USING (
          (NULLIF(current_setting('app.current_tenant_id', true), '')::text IS NOT NULL
           AND tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), ''))
          OR current_setting('app.bypass_rls', true) = 'on'
        )
        WITH CHECK (
          (NULLIF(current_setting('app.current_tenant_id', true), '')::text IS NOT NULL
           AND tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), ''))
          OR current_setting('app.bypass_rls', true) = 'on'
        );
    `);
  },

  async down(client: PoolClient) {
    await client.query(`DROP TABLE IF EXISTS project_floor_plans CASCADE;`);
  },
};

export default migration;
