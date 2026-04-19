import type { PoolClient } from 'pg';

const PROTECTED_TABLES = [
  'users',
  'leads',
  'listings',
  'projects',
  'contracts',
  'subscriptions',
] as const;

const POLICY_NAME = 'tenant_isolation_v2';

/**
 * Migration 070 — Tạo role `sgs_app` (NOBYPASSRLS) và làm chính sách RLS NULL-safe.
 *
 * Vì sao cần:
 *   • Trên Neon, role `neondb_owner` có thuộc tính `rolbypassrls = TRUE` mặc định và
 *     KHÔNG thể tự revoke (permission denied). Khi runtime kết nối bằng owner,
 *     mọi policy RLS đều bị bỏ qua, kể cả khi đã `FORCE ROW LEVEL SECURITY`.
 *   • Cách khắc phục: tạo role không có BYPASSRLS, ứng dụng `SET LOCAL ROLE sgs_app`
 *     trong từng transaction (xem `withTenantContext` / `withRlsBypass` ở `server/db.ts`).
 *   • Migration runner vẫn chạy với owner để có quyền DDL.
 *
 * Đồng thời: bọc `current_setting()::uuid` để xử lý empty string an toàn —
 * nếu chuỗi rỗng, coi như "không có tenant context" và policy sẽ chặn (trừ khi bypass on).
 */
export default {
  id: '070_app_role_and_safe_policy',
  description:
    'Create NOBYPASSRLS app role + NULL-safe RLS policy (Neon owner cannot self-revoke BYPASSRLS)',
  async up(client: PoolClient): Promise<void> {
    // 1) Tạo role app (idempotent). KHÔNG ALTER role nếu đã tồn tại — Neon
    //    không cho non-superuser thay đổi thuộc tính SUPERUSER/BYPASSRLS.
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sgs_app') THEN
          CREATE ROLE sgs_app NOLOGIN NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT;
        END IF;
      END $$;
    `);

    // 2) Cho owner quyền SET ROLE sgs_app
    await client.query(`GRANT sgs_app TO CURRENT_USER`);

    // 3) Cấp quyền DML trên schema public + sequences cho sgs_app
    await client.query(`GRANT USAGE ON SCHEMA public TO sgs_app`);
    await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO sgs_app`);
    await client.query(`GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO sgs_app`);
    await client.query(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO sgs_app`);

    // 4) Default privileges để bảng/sequence mới sau này cũng tự nhận quyền
    await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sgs_app`);
    await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO sgs_app`);
    await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO sgs_app`);

    // 5) Tái tạo policy NULL-safe trên 6 bảng được bảo vệ
    const safeExpr = `(
      NULLIF(current_setting('app.current_tenant_id', true), '')::uuid IS NOT NULL
      AND tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    ) OR current_setting('app.bypass_rls', true) = 'on'`;

    for (const table of PROTECTED_TABLES) {
      const exists = await client.query(
        `SELECT 1 FROM pg_class WHERE relname = $1 AND relkind = 'r'`,
        [table]
      );
      if (exists.rowCount === 0) continue;

      // Drop existing policy if any
      await client.query(`DROP POLICY IF EXISTS ${POLICY_NAME} ON ${table}`);

      // RLS đã bật (FORCE) ở migration 069; vẫn đảm bảo idempotent:
      await client.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      await client.query(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);

      await client.query(`
        CREATE POLICY ${POLICY_NAME} ON ${table}
          AS PERMISSIVE
          FOR ALL
          TO PUBLIC
          USING (${safeExpr})
          WITH CHECK (${safeExpr})
      `);
    }

    console.log(
      `[070_app_role_and_safe_policy] Role sgs_app sẵn sàng + policy NULL-safe áp dụng cho ${PROTECTED_TABLES.length} bảng`
    );
  },

  async down(client: PoolClient): Promise<void> {
    for (const table of PROTECTED_TABLES) {
      await client.query(`DROP POLICY IF EXISTS ${POLICY_NAME} ON ${table}`);
    }
    await client.query(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM sgs_app`);
    await client.query(`REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM sgs_app`);
    await client.query(`REVOKE USAGE ON SCHEMA public FROM sgs_app`);
    // Không DROP role để tránh phá môi trường khác đang dùng.
  },
};
