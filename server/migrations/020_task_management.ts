/**
 * Migration 020 — Task Management Module
 *
 * Adds tables for task management, employee assignment, departments,
 * comments, activity logs, and reminders. All tables include tenant_id
 * for multi-tenant RLS isolation.
 */

import type { Migration } from './runner';

const migration: Migration = {
  description: 'Task Management module: departments, tasks, assignments, comments, activity_logs, reminders',

  async up(client) {
    // --- Departments ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name        VARCHAR(255) NOT NULL,
        description TEXT,
        created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // --- Tasks ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS wf_tasks (
        id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        title            VARCHAR(500) NOT NULL,
        description      TEXT,
        project_id       UUID REFERENCES projects(id) ON DELETE SET NULL,
        department_id    UUID REFERENCES departments(id) ON DELETE SET NULL,
        category         VARCHAR(50) CHECK(category IN (
                           'sales','legal','marketing','site_visit',
                           'customer_care','finance','construction','admin','other'
                         )),
        status           VARCHAR(50) NOT NULL DEFAULT 'todo'
                         CHECK(status IN ('todo','in_progress','review','done','cancelled')),
        priority         VARCHAR(20) NOT NULL DEFAULT 'medium'
                         CHECK(priority IN ('low','medium','high','urgent')),
        deadline         DATE,
        estimated_hours  NUMERIC(6,2),
        actual_hours     NUMERIC(6,2),
        completion_note  TEXT,
        created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // --- Task Assignments ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS task_assignments (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        task_id     UUID NOT NULL REFERENCES wf_tasks(id) ON DELETE CASCADE,
        user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
        assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        due_note    TEXT,
        is_primary  BOOLEAN NOT NULL DEFAULT false,
        UNIQUE(task_id, user_id)
      );
    `);

    // --- Task Comments ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS task_comments (
        id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        task_id    UUID NOT NULL REFERENCES wf_tasks(id) ON DELETE CASCADE,
        user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content    TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // --- Activity Logs ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS task_activity_logs (
        id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        task_id    UUID REFERENCES wf_tasks(id) ON DELETE CASCADE,
        user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
        action     VARCHAR(50) NOT NULL,
        old_value  JSONB,
        new_value  JSONB,
        detail     TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // --- Task Reminders ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS task_reminders (
        id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        task_id      UUID NOT NULL REFERENCES wf_tasks(id) ON DELETE CASCADE,
        remind_date  DATE NOT NULL,
        remind_note  TEXT,
        is_sent      BOOLEAN NOT NULL DEFAULT false,
        created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // --- Indexes ---
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_wf_tasks_tenant ON wf_tasks(tenant_id)',
      'CREATE INDEX IF NOT EXISTS idx_wf_tasks_tenant_status ON wf_tasks(tenant_id, status)',
      'CREATE INDEX IF NOT EXISTS idx_wf_tasks_tenant_priority ON wf_tasks(tenant_id, priority)',
      'CREATE INDEX IF NOT EXISTS idx_wf_tasks_project ON wf_tasks(project_id)',
      'CREATE INDEX IF NOT EXISTS idx_wf_tasks_department ON wf_tasks(department_id)',
      'CREATE INDEX IF NOT EXISTS idx_wf_tasks_deadline ON wf_tasks(deadline)',
      'CREATE INDEX IF NOT EXISTS idx_wf_tasks_created_by ON wf_tasks(created_by)',
      'CREATE INDEX IF NOT EXISTS idx_task_assignments_task ON task_assignments(task_id)',
      'CREATE INDEX IF NOT EXISTS idx_task_assignments_user ON task_assignments(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments(task_id)',
      'CREATE INDEX IF NOT EXISTS idx_task_activity_task ON task_activity_logs(task_id)',
      'CREATE INDEX IF NOT EXISTS idx_departments_tenant ON departments(tenant_id)',
    ];
    for (const idx of indexes) {
      await client.query(idx);
    }

    // --- RLS ---
    const tables = ['departments', 'wf_tasks', 'task_assignments', 'task_comments', 'task_activity_logs', 'task_reminders'];
    for (const t of tables) {
      await client.query(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY;`);
      await client.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_policies WHERE tablename = '${t}' AND policyname = '${t}_tenant_isolation'
          ) THEN
            CREATE POLICY ${t}_tenant_isolation ON ${t}
              USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
          END IF;
        END $$;
      `);
    }

    // --- Trigger: auto-update updated_at on wf_tasks ---
    await client.query(`
      CREATE OR REPLACE FUNCTION update_wf_task_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS update_wf_task_timestamp ON wf_tasks;
      CREATE TRIGGER update_wf_task_timestamp
        BEFORE UPDATE ON wf_tasks
        FOR EACH ROW EXECUTE FUNCTION update_wf_task_timestamp();
    `);

    // --- Seed Data ---
    const DEFAULT_TENANT = '00000000-0000-0000-0000-000000000001';

    // Seed departments
    await client.query(`
      INSERT INTO departments (id, tenant_id, name, description) VALUES
        ('d1000000-0000-0000-0000-000000000001', $1, 'Kinh doanh', 'Phòng kinh doanh và bán hàng'),
        ('d1000000-0000-0000-0000-000000000002', $1, 'Pháp lý & Hợp đồng', 'Phòng pháp lý và soạn thảo hợp đồng'),
        ('d1000000-0000-0000-0000-000000000003', $1, 'Marketing & Truyền thông', 'Phòng marketing và truyền thông'),
        ('d1000000-0000-0000-0000-000000000004', $1, 'Kỹ thuật & Thẩm định', 'Phòng kỹ thuật và thẩm định dự án'),
        ('d1000000-0000-0000-0000-000000000005', $1, 'Chăm sóc Khách hàng', 'Phòng chăm sóc khách hàng'),
        ('d1000000-0000-0000-0000-000000000006', $1, 'Ban Giám đốc', 'Ban giám đốc điều hành')
      ON CONFLICT (id) DO NOTHING;
    `, [DEFAULT_TENANT]);

    // Fetch the admin user id to use as created_by
    const adminRes = await client.query(
      `SELECT id FROM users WHERE tenant_id = $1 ORDER BY created_at ASC LIMIT 1`,
      [DEFAULT_TENANT]
    );

    // Need to set tenant context to read RLS-protected tables
    // We use pool-level query here so we bypass RLS for seeding
    const adminId = adminRes.rows[0]?.id || null;
    if (!adminId) return; // No users yet, skip task seed

    // Fetch project IDs
    const projectsRes = await client.query(
      `SELECT id FROM projects WHERE tenant_id = $1 LIMIT 5`,
      [DEFAULT_TENANT]
    );
    const projectIds = projectsRes.rows.map((r: any) => r.id);
    const proj = (i: number) => projectIds[i % projectIds.length] || null;

    // Seed 20 tasks
    const today = new Date();
    const daysFromNow = (d: number) => {
      const dt = new Date(today);
      dt.setDate(dt.getDate() + d);
      return dt.toISOString().split('T')[0];
    };

    const tasks = [
      { title: 'Gặp gỡ khách hàng quan tâm căn hộ tầng 15-20 tại Riverside Tower', category: 'sales', status: 'in_progress', priority: 'high', deadline: daysFromNow(3), estimated_hours: 2, dept: 1, proj: 0 },
      { title: 'Soạn thảo hợp đồng đặt cọc lô shophouse S-05', category: 'legal', status: 'review', priority: 'urgent', deadline: daysFromNow(1), estimated_hours: 4, dept: 2, proj: 2 },
      { title: 'Xác minh pháp lý quyền sử dụng đất dự án Green Villa', category: 'legal', status: 'todo', priority: 'high', deadline: daysFromNow(7), estimated_hours: 8, dept: 2, proj: 1 },
      { title: 'Chạy chiến dịch quảng cáo Facebook tháng này cho Riverside Tower', category: 'marketing', status: 'in_progress', priority: 'medium', deadline: daysFromNow(10), estimated_hours: 16, dept: 3, proj: 0 },
      { title: 'Khảo sát thực địa và đo đạc lô đất B12 dự án Green Villa', category: 'site_visit', status: 'todo', priority: 'medium', deadline: daysFromNow(5), estimated_hours: 4, dept: 4, proj: 1 },
      { title: 'Hỗ trợ khách hàng Nguyễn Văn A hoàn tất thủ tục vay ngân hàng', category: 'customer_care', status: 'in_progress', priority: 'high', deadline: daysFromNow(-2), estimated_hours: 3, dept: 5, proj: 0 },
      { title: 'Đối soát bảng thanh toán đợt 3 dự án Shophouse Central', category: 'finance', status: 'done', priority: 'urgent', deadline: daysFromNow(-5), estimated_hours: 6, dept: 2, proj: 2 },
      { title: 'Chuẩn bị hồ sơ trình Sở xây dựng xin phép bán hàng', category: 'admin', status: 'in_progress', priority: 'urgent', deadline: daysFromNow(2), estimated_hours: 8, dept: 6, proj: 2 },
      { title: 'Nghiệm thu tiến độ thi công tầng 12-15 Riverside Tower', category: 'construction', status: 'review', priority: 'high', deadline: daysFromNow(4), estimated_hours: 4, dept: 4, proj: 0 },
      { title: 'Thiết kế brochure và bảng giá mới cho Highland Resort', category: 'marketing', status: 'todo', priority: 'medium', deadline: daysFromNow(14), estimated_hours: 12, dept: 3, proj: 3 },
      { title: 'Tư vấn khách hàng mua villa tại dự án Green Villa', category: 'sales', status: 'in_progress', priority: 'high', deadline: daysFromNow(3), estimated_hours: 3, dept: 1, proj: 1 },
      { title: 'Kiểm tra hồ sơ pháp lý căn hộ tầng 20 Riverside Tower', category: 'legal', status: 'todo', priority: 'medium', deadline: daysFromNow(6), estimated_hours: 4, dept: 2, proj: 0 },
      { title: 'Tổ chức sự kiện mở bán giai đoạn 2 Green Villa', category: 'marketing', status: 'todo', priority: 'high', deadline: daysFromNow(20), estimated_hours: 40, dept: 3, proj: 1 },
      { title: 'Cập nhật dữ liệu giá thị trường khu vực Quận 7', category: 'admin', status: 'done', priority: 'low', deadline: daysFromNow(-10), estimated_hours: 2, dept: 4, proj: 0 },
      { title: 'Gọi điện tư vấn 50 khách hàng tiềm năng Highland Resort', category: 'customer_care', status: 'in_progress', priority: 'medium', deadline: daysFromNow(8), estimated_hours: 10, dept: 5, proj: 3 },
      { title: 'Soạn thảo phụ lục hợp đồng mua bán căn hộ B-1205', category: 'legal', status: 'review', priority: 'high', deadline: daysFromNow(-1), estimated_hours: 3, dept: 2, proj: 0 },
      { title: 'Kiểm tra hệ thống PCCC tầng hầm Riverside Tower', category: 'construction', status: 'todo', priority: 'medium', deadline: daysFromNow(12), estimated_hours: 6, dept: 4, proj: 0 },
      { title: 'Chăm sóc và theo dõi khách hàng đã ký hợp đồng tháng 3', category: 'customer_care', status: 'in_progress', priority: 'medium', deadline: daysFromNow(5), estimated_hours: 5, dept: 5, proj: 1 },
      { title: 'Lập báo cáo doanh số tháng cho Ban Giám đốc', category: 'admin', status: 'cancelled', priority: 'low', deadline: daysFromNow(-3), estimated_hours: 3, dept: 6, proj: null },
      { title: 'Thẩm định giá trị bất động sản lô đất khu vực Bình Dương', category: 'site_visit', status: 'todo', priority: 'high', deadline: daysFromNow(9), estimated_hours: 8, dept: 4, proj: 4 },
    ];

    const deptIds = [
      'd1000000-0000-0000-0000-000000000001',
      'd1000000-0000-0000-0000-000000000002',
      'd1000000-0000-0000-0000-000000000003',
      'd1000000-0000-0000-0000-000000000004',
      'd1000000-0000-0000-0000-000000000005',
      'd1000000-0000-0000-0000-000000000006',
    ];

    const insertedTaskIds: string[] = [];
    for (const task of tasks) {
      const departmentId = deptIds[task.dept - 1];
      const projectId = task.proj !== null ? proj(task.proj) : null;
      const actualHours = task.status === 'done' ? (task.estimated_hours * 0.9).toFixed(1) : null;

      const res = await client.query(`
        INSERT INTO wf_tasks (
          tenant_id, title, description, project_id, department_id,
          category, status, priority, deadline, estimated_hours, actual_hours, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id
      `, [
        DEFAULT_TENANT,
        task.title,
        `Chi tiết công việc: ${task.title}. Thực hiện đúng quy trình và báo cáo kết quả kịp thời.`,
        projectId,
        departmentId,
        task.category,
        task.status,
        task.priority,
        task.deadline,
        task.estimated_hours,
        actualHours,
        adminId,
      ]);

      insertedTaskIds.push(res.rows[0].id);
    }

    // Assign tasks to admin user (primary)
    for (const taskId of insertedTaskIds) {
      await client.query(`
        INSERT INTO task_assignments (tenant_id, task_id, user_id, assigned_by, is_primary)
        VALUES ($1, $2, $3, $4, true)
        ON CONFLICT (task_id, user_id) DO NOTHING
      `, [DEFAULT_TENANT, taskId, adminId, adminId]);
    }

    // Seed activity logs for first few tasks
    for (let i = 0; i < Math.min(5, insertedTaskIds.length); i++) {
      await client.query(`
        INSERT INTO task_activity_logs (tenant_id, task_id, user_id, action, detail)
        VALUES ($1, $2, $3, 'created', 'Công việc được tạo')
      `, [DEFAULT_TENANT, insertedTaskIds[i], adminId]);
    }
  },

  async down(client) {
    await client.query('DROP TRIGGER IF EXISTS update_wf_task_timestamp ON wf_tasks;');
    await client.query('DROP FUNCTION IF EXISTS update_wf_task_timestamp();');
    const tables = ['task_reminders', 'task_activity_logs', 'task_comments', 'task_assignments', 'wf_tasks', 'departments'];
    for (const t of tables) {
      await client.query(`DROP TABLE IF EXISTS ${t} CASCADE;`);
    }
  },
};

export default migration;
