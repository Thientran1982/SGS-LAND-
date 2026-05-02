import type { Migration } from './runner';
import type { PoolClient } from 'pg';

const migration: Migration = {
  description:
    'Engine hoa hồng v1: bảng commission_policies (FLAT/TIERED/MILESTONE per project, versioning) và commission_ledger (auto-sinh khi listing→SOLD, idempotent qua UNIQUE(listing_id)).',

  async up(client: PoolClient) {
    // ── commission_policies ──────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS commission_policies (
        id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id     VARCHAR(36)  NOT NULL,
        project_id    UUID         NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        version       INTEGER      NOT NULL DEFAULT 1,
        type          VARCHAR(20)  NOT NULL CHECK (type IN ('FLAT','TIERED','MILESTONE')),
        config        JSONB        NOT NULL DEFAULT '{}'::jsonb,
        active_from   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        active_to     TIMESTAMPTZ,
        created_by    UUID,
        created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_cpol_project_active
        ON commission_policies(project_id, active_from DESC);

      CREATE INDEX IF NOT EXISTS idx_cpol_tenant
        ON commission_policies(tenant_id, project_id);

      -- Đảm bảo chỉ 1 policy ACTIVE (active_to IS NULL) per project tại 1 thời điểm.
      CREATE UNIQUE INDEX IF NOT EXISTS uq_cpol_one_active_per_project
        ON commission_policies(project_id) WHERE active_to IS NULL;
    `);

    await client.query(`
      ALTER TABLE commission_policies ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS tenant_isolation_v2 ON commission_policies;
      CREATE POLICY tenant_isolation_v2 ON commission_policies
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

    // ── commission_ledger ────────────────────────────────────────────────────
    // tenant_id = tenant chủ dự án (đứng tên policy + payable).
    // partner_tenant_id = đại lý hưởng hoa hồng (NULL nếu là sale nội bộ).
    // UNIQUE(listing_id) đảm bảo idempotent — chuyển SOLD nhiều lần không sinh trùng.
    await client.query(`
      CREATE TABLE IF NOT EXISTS commission_ledger (
        id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id         VARCHAR(36)  NOT NULL,
        project_id        UUID         NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        listing_id        UUID         NOT NULL UNIQUE,
        policy_id         UUID         REFERENCES commission_policies(id) ON DELETE SET NULL,
        policy_version    INTEGER,
        policy_type       VARCHAR(20),
        sale_date         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        sales_user_id     UUID,
        partner_tenant_id UUID,
        sale_price        NUMERIC(18,2) NOT NULL DEFAULT 0,
        gross_amount      NUMERIC(18,2) NOT NULL DEFAULT 0,
        rate_pct          NUMERIC(7,4),
        milestones        JSONB        NOT NULL DEFAULT '[]'::jsonb,
        status            VARCHAR(20)  NOT NULL DEFAULT 'PENDING'
                          CHECK (status IN ('PENDING','DUE','PAID','CANCELLED')),
        paid_at           TIMESTAMPTZ,
        paid_note         TEXT,
        paid_by           UUID,
        created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_cled_project_status
        ON commission_ledger(project_id, status);
      CREATE INDEX IF NOT EXISTS idx_cled_partner_status
        ON commission_ledger(partner_tenant_id, status) WHERE partner_tenant_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_cled_tenant_sale_date
        ON commission_ledger(tenant_id, sale_date DESC);
      CREATE INDEX IF NOT EXISTS idx_cled_sales_user
        ON commission_ledger(sales_user_id);
    `);

    // RLS: tenant chủ thấy mọi dòng của tenant_id mình; partner đọc qua bypass +
    // WHERE partner_tenant_id = $partnerTenantId trong repository (cross-tenant đọc
    // hợp pháp, giống pattern project_floor_plans).
    await client.query(`
      ALTER TABLE commission_ledger ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS tenant_isolation_v2 ON commission_ledger;
      CREATE POLICY tenant_isolation_v2 ON commission_ledger
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
    await client.query(`DROP TABLE IF EXISTS commission_ledger CASCADE;`);
    await client.query(`DROP TABLE IF EXISTS commission_policies CASCADE;`);
  },
};

export default migration;
