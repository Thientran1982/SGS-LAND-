/**
 * Migration 085 — Departments dedupe + UNIQUE(tenant_id, name) + backfill seed
 *
 * Sửa 2 vấn đề Task Management:
 *  1. Tenant default đang có 12 dòng departments (6 tên × 2 trùng). Dedupe
 *     bằng cách giữ id cũ nhất (theo created_at, id), repoint mọi
 *     wf_tasks.department_id sang id giữ lại, rồi xoá các dòng trùng.
 *  2. Tenant CĐT mới (12 tenant) chưa có departments → seed lại 6 default.
 *
 * Sau dedupe, thêm UNIQUE(tenant_id, name) để chặn trùng vĩnh viễn — phục vụ
 * INSERT ... ON CONFLICT (tenant_id, name) DO NOTHING ở tenant signup hook.
 */

import type { Migration } from './runner';

const DEFAULT_DEPARTMENTS = [
  { name: 'Kinh doanh',               description: 'Phòng kinh doanh và bán hàng' },
  { name: 'Pháp lý & Hợp đồng',       description: 'Phòng pháp lý và soạn thảo hợp đồng' },
  { name: 'Marketing & Truyền thông', description: 'Phòng marketing và truyền thông' },
  { name: 'Kỹ thuật & Thẩm định',     description: 'Phòng kỹ thuật và thẩm định dự án' },
  { name: 'Chăm sóc Khách hàng',      description: 'Phòng chăm sóc khách hàng' },
  { name: 'Ban Giám đốc',             description: 'Ban giám đốc điều hành' },
];

const migration: Migration = {
  description: 'Dedupe departments, add UNIQUE(tenant_id,name), backfill seed for new tenants',

  async up(client) {
    // 1. Repoint wf_tasks.department_id từ id duplicate → id keeper (oldest)
    await client.query(`
      WITH ranked AS (
        SELECT
          id,
          tenant_id,
          name,
          ROW_NUMBER() OVER (PARTITION BY tenant_id, name
                             ORDER BY created_at ASC, id ASC) AS rn,
          FIRST_VALUE(id) OVER (PARTITION BY tenant_id, name
                                ORDER BY created_at ASC, id ASC) AS keep_id
        FROM departments
      )
      UPDATE wf_tasks t
         SET department_id = r.keep_id
        FROM ranked r
       WHERE t.department_id = r.id
         AND r.rn > 1
         AND r.id <> r.keep_id
    `);

    // 2. Xoá các dòng departments trùng (giữ row cũ nhất)
    await client.query(`
      DELETE FROM departments
       WHERE id IN (
         SELECT id FROM (
           SELECT id,
                  ROW_NUMBER() OVER (PARTITION BY tenant_id, name
                                     ORDER BY created_at ASC, id ASC) AS rn
             FROM departments
         ) s
         WHERE rn > 1
       )
    `);

    // 3. Thêm UNIQUE constraint (tenant_id, name) — idempotent
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
           WHERE conname = 'departments_tenant_name_unique'
        ) THEN
          ALTER TABLE departments
            ADD CONSTRAINT departments_tenant_name_unique UNIQUE (tenant_id, name);
        END IF;
      END $$;
    `);

    // 4. Backfill: seed 6 default departments cho mọi tenant đang có 0 dept
    const tenantsRes = await client.query(`
      SELECT t.id
        FROM tenants t
       WHERE NOT EXISTS (
         SELECT 1 FROM departments d WHERE d.tenant_id = t.id
       )
    `);

    for (const row of tenantsRes.rows) {
      for (const dept of DEFAULT_DEPARTMENTS) {
        await client.query(
          `INSERT INTO departments (tenant_id, name, description)
           VALUES ($1, $2, $3)
           ON CONFLICT (tenant_id, name) DO NOTHING`,
          [row.id, dept.name, dept.description]
        );
      }
    }
  },

  async down(client) {
    // Drop UNIQUE constraint (không thể khôi phục các dòng đã xoá khi dedupe)
    await client.query(`
      ALTER TABLE departments
        DROP CONSTRAINT IF EXISTS departments_tenant_name_unique
    `);
  },
};

export default migration;
