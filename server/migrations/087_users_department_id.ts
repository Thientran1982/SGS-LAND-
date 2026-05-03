/**
 * Migration 087 — users.department_id (gắn nhân viên với phòng ban)
 *
 * Bối cảnh: trước đây dept chỉ tồn tại trên wf_tasks.department_id; user không
 * thuộc phòng ban nào. Report workload/summary phải derive dept qua task
 * assignment đầu tiên — sai khi user làm task nhiều phòng và rỗng khi user
 * chưa được giao task.
 *
 * Sau migration: users gắn trực tiếp 1 phòng ban (nullable, ON DELETE SET NULL).
 * Backfill từ task assignments (mode = phòng ban xuất hiện nhiều nhất trong
 * các task user được giao).
 */

import type { Migration } from './runner';

const migration: Migration = {
  description: 'users: add department_id FK + index + backfill from task assignments',

  async up(client) {
    // 1. Add column + FK + index (idempotent)
    await client.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS department_id UUID
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'users_department_id_fkey'
        ) THEN
          ALTER TABLE users
            ADD CONSTRAINT users_department_id_fkey
            FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_tenant_department
        ON users(tenant_id, department_id)
        WHERE department_id IS NOT NULL
    `);

    // 2. Backfill: với mỗi user chưa có dept, lấy phòng ban xuất hiện nhiều
    //    nhất trong các task user được giao (mode). Nếu hoà thì lấy id nhỏ nhất.
    await client.query(`
      WITH user_dept_counts AS (
        SELECT
          ta.user_id,
          t.department_id,
          COUNT(*) AS cnt,
          ROW_NUMBER() OVER (
            PARTITION BY ta.user_id
            ORDER BY COUNT(*) DESC, t.department_id ASC
          ) AS rn
        FROM task_assignments ta
        JOIN wf_tasks t ON t.id = ta.task_id
        WHERE t.department_id IS NOT NULL
        GROUP BY ta.user_id, t.department_id
      )
      UPDATE users u
         SET department_id = udc.department_id
        FROM user_dept_counts udc
       WHERE u.id = udc.user_id
         AND udc.rn = 1
         AND u.department_id IS NULL
    `);
  },

  async down(client) {
    await client.query(`DROP INDEX IF EXISTS idx_users_tenant_department`);
    await client.query(`
      ALTER TABLE users
        DROP CONSTRAINT IF EXISTS users_department_id_fkey
    `);
    await client.query(`ALTER TABLE users DROP COLUMN IF EXISTS department_id`);
  },
};

export default migration;
