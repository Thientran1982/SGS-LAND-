import { PoolClient } from 'pg';

/**
 * GĐ (GEO/AEO) - Fix RLS policy cho bảng `developers`.
 *
 * Vấn đề: policy `tenant_isolation` (tạo ở m110) dùng
 *   tenant_id = current_setting('app.current_tenant_id', true)::uuid
 * Khi không có tenant context (route public dùng withRlsBypass), current_setting
 * trả về '' và '' ::uuid ném lỗi "invalid input syntax for type uuid".
 * Hậu quả: GET /api/public/developers (list) và /:slug (detail) đều 500.
 *
 * Sửa: thay bằng policy giống `projects.tenant_isolation_v2`:
 *  - NULLIF(...,'') để chặn chuỗi rỗng
 *  - OR current_setting('app.bypass_rls', true) = 'on' để route public bypass được.
 */
export default {
  description: 'Fix RLS developers: NULLIF guard + bypass_rls (sua loi 500 public microsite)',
  async up(client: PoolClient): Promise<void> {
    await client.query(`
      DO $$ BEGIN
        -- Bỏ policy cũ bị lỗi (nếu còn)
        IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'developers' AND policyname = 'tenant_isolation') THEN
          DROP POLICY tenant_isolation ON developers;
        END IF;
        -- Tạo policy mới an toàn (idempotent)
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'developers' AND policyname = 'tenant_isolation_v2') THEN
          CREATE POLICY tenant_isolation_v2 ON developers
            USING (
              (
                NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
                AND tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
              )
              OR current_setting('app.bypass_rls', true) = 'on'
            );
        END IF;
      END $$;
    `);
  },
  async down(client: PoolClient): Promise<void> {
    await client.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'developers' AND policyname = 'tenant_isolation_v2') THEN
          DROP POLICY tenant_isolation_v2 ON developers;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'developers' AND policyname = 'tenant_isolation') THEN
          CREATE POLICY tenant_isolation ON developers
            USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
        END IF;
      END $$;
    `);
  },
};
