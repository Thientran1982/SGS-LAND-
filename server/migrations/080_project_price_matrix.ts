import type { Migration } from './runner';
import type { PoolClient } from 'pg';

const migration: Migration = {
  description: 'Tạo bảng project_price_matrix (bảng giá theo tầng/hướng/loại phòng) và listing_price_refresh_log',

  async up(client: PoolClient) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_price_matrix (
        id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id       VARCHAR(36)   NOT NULL,
        project_id      UUID          NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        tower           VARCHAR(50),
        floor_from      SMALLINT      NOT NULL DEFAULT 1,
        floor_to        SMALLINT      NOT NULL DEFAULT 99,
        direction       VARCHAR(20)   NOT NULL DEFAULT 'ALL',
        bedroom_type    VARCHAR(20)   NOT NULL DEFAULT 'ALL',
        base_price_sqm  NUMERIC(14,0) NOT NULL,
        adjustment_pct  NUMERIC(5,2)  NOT NULL DEFAULT 0,
        notes           TEXT,
        created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        updated_by      UUID
      );

      CREATE INDEX IF NOT EXISTS idx_ppm_project
        ON project_price_matrix(project_id, floor_from, floor_to);

      CREATE INDEX IF NOT EXISTS idx_ppm_tenant
        ON project_price_matrix(tenant_id, updated_at DESC);

      CREATE TABLE IF NOT EXISTS listing_price_refresh_log (
        id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id       VARCHAR(36)   NOT NULL,
        listing_id      UUID          NOT NULL,
        old_price       NUMERIC(14,0),
        new_price       NUMERIC(14,0),
        price_per_m2    NUMERIC(14,0),
        confidence      NUMERIC(5,2),
        source          VARCHAR(50)   NOT NULL DEFAULT 'avm_cron',
        refreshed_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_lprl_listing
        ON listing_price_refresh_log(listing_id, refreshed_at DESC);

      CREATE INDEX IF NOT EXISTS idx_lprl_tenant_refreshed
        ON listing_price_refresh_log(tenant_id, refreshed_at DESC);
    `);
  },

  async down(client: PoolClient) {
    await client.query(`
      DROP TABLE IF EXISTS listing_price_refresh_log;
      DROP TABLE IF EXISTS project_price_matrix;
    `);
  },
};

export default migration;
