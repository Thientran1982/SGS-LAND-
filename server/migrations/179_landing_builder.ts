import type { PoolClient } from 'pg';
import type { Migration } from './runner';

/**
 * P0 landing-builder tool: bang landing_pages cho user dung chat widget
 * tu dung trang landing cho du an (kem brochure dinh kem).
 *
 * Cau truc "sections" jsonb = noi dung tung phan trang (hero, gallery,
 * legal, price, amenities, contact) do agent sinh ra theo brochure.
 * Quota FREE_LANDING_PAGES = 2 trang / user; qua muc -> PAYWALL.
 * Token budget: moi trang dung theo tung phan, ghi vao tokens_used
 * de chan quay lai vo han (moi phan ~260-420 token theo do phuc tap).
 */

const migration: Migration = {
  description: 'P0 landing-builder: bang landing_pages + quota 2 trang free/user + index theo tenant/status.',

  async up(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS landing_pages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
        owner_user_id UUID,                -- user dang nhap tai widget; NULL = khach
        visitor_key VARCHAR(120) NOT NULL,  -- dinh danh kach chua dang nhap
        project_name VARCHAR(200) NOT NULL,
        slug VARCHAR(220) NOT NULL UNIQUE,
        brochure_name VARCHAR(200),
        brochure_text TEXT,                 -- noi dung trich xuat tu file dinh kem
        sections JSONB NOT NULL DEFAULT '[]'::jsonb,
        status VARCHAR(30) NOT NULL DEFAULT 'draft',  -- draft|published
        tokens_used INTEGER NOT NULL DEFAULT 0,
        language VARCHAR(8) NOT NULL DEFAULT 'vi',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
        CREATE INDEX IF NOT EXISTS idx_landing_pages_tenant_visitor
          ON landing_pages(tenant_id, visitor_key)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_landing_pages_slug
          ON landing_pages(slug)
    `);
  },
};

export default migration;
