import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { withTenantContext } from '../db';

// ─── Zod Schemas ──────────────────────────────────────────────────────────────
const TaskStatuses = ['todo', 'in_progress', 'review', 'done', 'cancelled'] as const;
const TaskPriorities = ['low', 'medium', 'high', 'urgent'] as const;
const TaskCategories = ['sales', 'legal', 'marketing', 'site_visit', 'customer_care', 'finance', 'construction', 'admin', 'other'] as const;

// Zod v4 validates RFC 4122 UUID strictly (version [1-8] + variant [89abAB]).
// Department IDs seeded by migration 020 use a custom format (e.g. d1000000-...) that
// passes the hex-shape check but fails version/variant bits. We use a broad UUID-shape
// regex here to avoid false 400 errors while migration 059 upgrades the IDs in-place.
const UUID_SHAPE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const createTaskSchema = z.object({
  title: z.string().min(5, 'Tiêu đề phải từ 5 ký tự').max(500, 'Tiêu đề tối đa 500 ký tự'),
  description: z.string().max(5000).optional(),
  project_id: z.string().regex(UUID_SHAPE, 'Dự án không hợp lệ').optional().nullable(),
  department_id: z.string().regex(UUID_SHAPE, 'Phòng ban không hợp lệ').optional().nullable(),
  category: z.enum(TaskCategories).optional().nullable(),
  priority: z.enum(TaskPriorities).default('medium'),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  estimated_hours: z.number().positive().optional().nullable(),
  assignee_ids: z.array(z.string().regex(UUID_SHAPE, 'ID người dùng không hợp lệ')).optional(),
});

const updateTaskSchema = z.object({
  title: z.string().min(5).max(500).optional(),
  description: z.string().max(5000).optional().nullable(),
  project_id: z.string().regex(UUID_SHAPE, 'Dự án không hợp lệ').optional().nullable(),
  department_id: z.string().regex(UUID_SHAPE, 'Phòng ban không hợp lệ').optional().nullable(),
  category: z.enum(TaskCategories).optional().nullable(),
  priority: z.enum(TaskPriorities).optional(),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  estimated_hours: z.number().positive().optional().nullable(),
});

const changeStatusSchema = z.object({
  status: z.enum(TaskStatuses),
  actual_hours: z.number().positive().optional(),
  completion_note: z.string().max(1000).optional(),
});

const assignSchema = z.object({
  user_ids: z.array(z.string().uuid()).min(1),
  primary_user_id: z.string().uuid().optional(),
  due_note: z.string().max(500).optional(),
});

const unassignBodySchema = z.object({
  user_id: z.string().uuid(),
});

const commentSchema = z.object({
  content: z.string().min(1, 'Bình luận không được rỗng').max(5000),
});

// ─── Status Transition Map ────────────────────────────────────────────────────
const VALID_TRANSITIONS: Record<string, string[]> = {
  todo:        ['in_progress', 'cancelled'],
  in_progress: ['review', 'todo', 'cancelled'],
  review:      ['done', 'in_progress'],
  done:        [],         // locked; admin can override
  cancelled:   ['todo'],   // reopen
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function calcUrgency(deadline: string | null, status: string): { is_overdue: boolean; days_until_deadline: number | null; urgency_level: string } {
  if (!deadline || status === 'done' || status === 'cancelled') {
    return { is_overdue: false, days_until_deadline: null, urgency_level: 'normal' };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dl = new Date(deadline);
  dl.setHours(0, 0, 0, 0);
  const diffMs = dl.getTime() - today.getTime();
  const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
  const is_overdue = days < 0;
  let urgency_level = 'normal';
  if (is_overdue) urgency_level = 'overdue';
  else if (days <= 1) urgency_level = 'critical';
  else if (days <= 3) urgency_level = 'warning';
  return { is_overdue, days_until_deadline: days, urgency_level };
}

function enrichTask(row: any) {
  const u = calcUrgency(row.deadline, row.status);
  return { ...row, ...u };
}

function parseMultiParam(val: string | undefined): string[] {
  if (!val) return [];
  return val.split(',').map(s => s.trim()).filter(Boolean);
}

// ─── Route Factory ────────────────────────────────────────────────────────────
export function createTaskRoutes(authenticateToken: any) {
  const router = Router();

  // GET /api/tasks — list with filters + pagination
  router.get('/', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const tenantId = user.tenantId;

      const page    = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit   = Math.min(500, Math.max(1, parseInt(req.query.limit as string) || 20));
      const offset  = (page - 1) * limit;

      const statuses    = parseMultiParam(req.query.status as string);
      const priorities  = parseMultiParam(req.query.priority as string);
      const projectId   = req.query.project_id as string || null;
      const deptId      = req.query.department_id as string || null;
      const category    = req.query.category as string || null;
      const assigneeId  = req.query.assignee_id as string || null;
      const createdBy   = req.query.created_by as string || null;
      const isOverdue   = req.query.is_overdue as string || null;
      const deadlineFrom = req.query.deadline_from as string || null;
      const deadlineTo   = req.query.deadline_to as string || null;
      const search      = req.query.search as string || null;
      const sortBy      = ['deadline', 'priority', 'created_at', 'updated_at'].includes(req.query.sort_by as string)
                            ? req.query.sort_by as string : 'created_at';
      const sortDir     = req.query.sort_dir === 'asc' ? 'ASC' : 'DESC';

      const result = await withTenantContext(tenantId, async (client) => {
        const conditions: string[] = [];
        const params: any[]        = [];
        let pi = 1;

        if (statuses.length > 0) {
          conditions.push(`t.status = ANY($${pi}::text[])`);
          params.push(statuses); pi++;
        }
        if (priorities.length > 0) {
          conditions.push(`t.priority = ANY($${pi}::text[])`);
          params.push(priorities); pi++;
        }
        if (projectId) { conditions.push(`t.project_id = $${pi}`); params.push(projectId); pi++; }
        if (deptId)    { conditions.push(`t.department_id = $${pi}`); params.push(deptId); pi++; }
        if (category)  { conditions.push(`t.category = $${pi}`); params.push(category); pi++; }
        if (createdBy) { conditions.push(`t.created_by = $${pi}`); params.push(createdBy); pi++; }
        if (deadlineFrom) { conditions.push(`t.deadline >= $${pi}`); params.push(deadlineFrom); pi++; }
        if (deadlineTo)   { conditions.push(`t.deadline <= $${pi}`); params.push(deadlineTo); pi++; }
        if (search) {
          conditions.push(`(t.title ILIKE $${pi} OR t.description ILIKE $${pi})`);
          params.push(`%${search}%`); pi++;
        }
        if (isOverdue === 'true') {
          conditions.push(`(t.deadline < CURRENT_DATE AND t.status NOT IN ('done','cancelled'))`);
        } else if (isOverdue === 'false') {
          conditions.push(`(t.deadline >= CURRENT_DATE OR t.status IN ('done','cancelled') OR t.deadline IS NULL)`);
        }

        // Filter by assignee (join task_assignments)
        let assigneeJoin = '';
        if (assigneeId) {
          assigneeJoin = `JOIN task_assignments ta_filter ON ta_filter.task_id = t.id AND ta_filter.user_id = $${pi}`;
          params.push(assigneeId); pi++;
        }

        const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

        const countSql = `
          SELECT COUNT(DISTINCT t.id) FROM wf_tasks t ${assigneeJoin}
          ${whereClause}
        `;
        const countRes = await client.query(countSql, params);
        const total = parseInt(countRes.rows[0].count);

        const dataSql = `
          SELECT
            t.*,
            p.name AS project_name,
            d.name AS department_name,
            u.name AS created_by_name,
            COALESCE(json_agg(DISTINCT jsonb_build_object(
              'id', ua.id, 'name', ua.name, 'avatar', ua.avatar,
              'is_primary', ta.is_primary
            )) FILTER (WHERE ua.id IS NOT NULL), '[]') AS assignees,
            COUNT(DISTINCT tc.id) AS comment_count
          FROM wf_tasks t
          ${assigneeJoin}
          LEFT JOIN projects p ON p.id = t.project_id
          LEFT JOIN departments d ON d.id = t.department_id
          LEFT JOIN users u ON u.id = t.created_by
          LEFT JOIN task_assignments ta ON ta.task_id = t.id
          LEFT JOIN users ua ON ua.id = ta.user_id
          LEFT JOIN task_comments tc ON tc.task_id = t.id
          ${whereClause}
          GROUP BY t.id, p.name, d.name, u.name
          ORDER BY t.${sortBy} ${sortDir} NULLS LAST
          LIMIT $${pi} OFFSET $${pi + 1}
        `;
        params.push(limit, offset);

        const dataRes = await client.query(dataSql, params);

        return {
          data: dataRes.rows.map(enrichTask),
          pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
          filters_applied: { statuses, priorities, projectId, deptId, category, assigneeId, search, isOverdue }
        };
      });

      res.json(result);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      res.status(500).json({ error: true, code: 'FETCH_FAILED', message: 'Failed to fetch tasks' });
    }
  });

  // POST /api/tasks — create task
  router.post('/', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const tenantId = user.tenantId;

      const parsed = createTaskSchema.safeParse(req.body);
      if (!parsed.success) {
        const issues = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
        console.warn('[taskRoutes] createTask validation failed:', issues.join(' | '), '| body keys:', Object.keys(req.body));
        const msg = parsed.error.issues[0]?.message || 'Dữ liệu không hợp lệ';
        return res.status(400).json({ error: true, code: 'VALIDATION', message: msg });
      }
      const { title, description, project_id, department_id, category, priority, deadline, estimated_hours, assignee_ids } = parsed.data;

      if (deadline) {
        const dl = new Date(deadline);
        const today = new Date(); today.setHours(0, 0, 0, 0);
        if (dl < today) {
          return res.status(400).json({ error: true, code: 'VALIDATION', message: 'Deadline không được là ngày trong quá khứ' });
        }
      }

      const task = await withTenantContext(tenantId, async (client) => {
        const r = await client.query(`
          INSERT INTO wf_tasks (tenant_id, title, description, project_id, department_id, category, priority, deadline, estimated_hours, created_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING *
        `, [tenantId, title.trim(), description || null, project_id || null, department_id || null,
            category || null, priority, deadline || null, estimated_hours || null, user.id]);

        const newTask = r.rows[0];

        // Log activity
        await client.query(`
          INSERT INTO task_activity_logs (tenant_id, task_id, user_id, action, detail)
          VALUES ($1, $2, $3, 'created', 'Công việc được tạo')
        `, [tenantId, newTask.id, user.id]);

        // Assign if provided
        if (Array.isArray(assignee_ids) && assignee_ids.length > 0) {
          for (let i = 0; i < assignee_ids.length; i++) {
            await client.query(`
              INSERT INTO task_assignments (tenant_id, task_id, user_id, assigned_by, is_primary)
              VALUES ($1, $2, $3, $4, $5)
              ON CONFLICT (task_id, user_id) DO NOTHING
            `, [tenantId, newTask.id, assignee_ids[i], user.id, i === 0]);
          }
        }

        return newTask;
      });

      res.status(201).json(enrichTask(task));
    } catch (error) {
      console.error('Error creating task:', error);
      res.status(500).json({ error: true, code: 'CREATE_FAILED', message: 'Failed to create task' });
    }
  });

  // POST /api/tasks/bulk/status — bulk update task status
  router.post('/bulk/status', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const tenantId = user.tenantId;

      const { ids, status } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: true, code: 'VALIDATION', message: 'ids phải là mảng không rỗng' });
      }
      if (!TaskStatuses.includes(status)) {
        return res.status(400).json({ error: true, code: 'VALIDATION', message: 'status không hợp lệ' });
      }
      if (ids.length > 100) {
        return res.status(400).json({ error: true, code: 'VALIDATION', message: 'Tối đa 100 task mỗi lần' });
      }

      const updated = await withTenantContext(tenantId, async (client) => {
        let count = 0;
        for (const id of ids) {
          const current = await client.query('SELECT status FROM wf_tasks WHERE id = $1', [id]);
          if (!current.rows[0]) continue;
          const currentStatus = current.rows[0].status;
          const allowed = VALID_TRANSITIONS[currentStatus] || [];
          if (!allowed.includes(status) && !(status === currentStatus)) continue;
          await client.query(`UPDATE wf_tasks SET status = $1 WHERE id = $2`, [status, id]);
          await client.query(`
            INSERT INTO task_activity_logs (tenant_id, task_id, user_id, action, old_value, new_value, detail)
            VALUES ($1, $2, $3, 'status_changed', $4, $5, $6)
          `, [tenantId, id, user.id,
              JSON.stringify({ status: currentStatus }),
              JSON.stringify({ status }),
              `Cập nhật hàng loạt: ${currentStatus} → ${status}`]);
          count++;
        }
        return count;
      });

      res.json({ updated });
    } catch (error) {
      console.error('Error bulk updating task status:', error);
      res.status(500).json({ error: true, code: 'BULK_UPDATE_FAILED', message: 'Không thể cập nhật hàng loạt' });
    }
  });

  // POST /api/tasks/bulk/delete — bulk delete tasks (admin/team lead only)
  router.post('/bulk/delete', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const tenantId = user.tenantId;

      if (!['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD'].includes(user.role)) {
        return res.status(403).json({ error: true, code: 'FORBIDDEN', message: 'Chỉ admin mới có thể xóa task hàng loạt' });
      }

      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: true, code: 'VALIDATION', message: 'ids phải là mảng không rỗng' });
      }
      if (ids.length > 100) {
        return res.status(400).json({ error: true, code: 'VALIDATION', message: 'Tối đa 100 task mỗi lần' });
      }

      const deleted = await withTenantContext(tenantId, async (client) => {
        const placeholders = ids.map((_: any, i: number) => `$${i + 1}`).join(', ');
        const r = await client.query(
          `DELETE FROM wf_tasks WHERE id IN (${placeholders}) RETURNING id`,
          ids
        );
        return r.rows.length;
      });

      res.json({ deleted });
    } catch (error) {
      console.error('Error bulk deleting tasks:', error);
      res.status(500).json({ error: true, code: 'BULK_DELETE_FAILED', message: 'Không thể xóa hàng loạt' });
    }
  });

  // GET /api/tasks/:id — task detail with assignees, comments count
  router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const tenantId = user.tenantId;

      const task = await withTenantContext(tenantId, async (client) => {
        const r = await client.query(`
          SELECT
            t.*,
            p.name AS project_name,
            d.name AS department_name,
            u.name AS created_by_name,
            COALESCE(json_agg(DISTINCT jsonb_build_object(
              'id', ua.id, 'name', ua.name, 'avatar', ua.avatar,
              'email', ua.email, 'is_primary', ta.is_primary,
              'assigned_at', ta.assigned_at, 'due_note', ta.due_note
            )) FILTER (WHERE ua.id IS NOT NULL), '[]') AS assignees,
            COUNT(DISTINCT tc.id) AS comment_count
          FROM wf_tasks t
          LEFT JOIN projects p ON p.id = t.project_id
          LEFT JOIN departments d ON d.id = t.department_id
          LEFT JOIN users u ON u.id = t.created_by
          LEFT JOIN task_assignments ta ON ta.task_id = t.id
          LEFT JOIN users ua ON ua.id = ta.user_id
          LEFT JOIN task_comments tc ON tc.task_id = t.id
          WHERE t.id = $1
          GROUP BY t.id, p.name, d.name, u.name
        `, [req.params.id]);
        return r.rows[0] || null;
      });

      if (!task) return res.status(404).json({ error: true, code: 'NOT_FOUND', message: 'Task not found' });
      res.json(enrichTask(task));
    } catch (error) {
      console.error('Error fetching task:', error);
      res.status(500).json({ error: true, code: 'FETCH_FAILED', message: 'Failed to fetch task' });
    }
  });

  // PATCH /api/tasks/:id — update task fields
  router.patch('/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const tenantId = user.tenantId;

      const parsed = updateTaskSchema.safeParse(req.body);
      if (!parsed.success) {
        const msg = parsed.error.issues[0]?.message || 'Dữ liệu không hợp lệ';
        return res.status(400).json({ error: true, code: 'VALIDATION', message: msg });
      }
      const { title, description, project_id, department_id, category, priority, deadline, estimated_hours } = parsed.data;

      const task = await withTenantContext(tenantId, async (client) => {
        const current = await client.query('SELECT * FROM wf_tasks WHERE id = $1', [req.params.id]);
        if (!current.rows[0]) return null;

        const fields: string[] = [];
        const vals: any[] = [];
        let pi = 1;

        if (title !== undefined) { fields.push(`title = $${pi}`); vals.push(title); pi++; }
        if (description !== undefined) { fields.push(`description = $${pi}`); vals.push(description); pi++; }
        if (project_id !== undefined) { fields.push(`project_id = $${pi}`); vals.push(project_id || null); pi++; }
        if (department_id !== undefined) { fields.push(`department_id = $${pi}`); vals.push(department_id || null); pi++; }
        if (category !== undefined) { fields.push(`category = $${pi}`); vals.push(category); pi++; }
        if (priority !== undefined) { fields.push(`priority = $${pi}`); vals.push(priority); pi++; }
        if (deadline !== undefined) { fields.push(`deadline = $${pi}`); vals.push(deadline || null); pi++; }
        if (estimated_hours !== undefined) { fields.push(`estimated_hours = $${pi}`); vals.push(estimated_hours || null); pi++; }

        if (fields.length === 0) return current.rows[0];

        vals.push(req.params.id);
        const r = await client.query(`UPDATE wf_tasks SET ${fields.join(', ')} WHERE id = $${pi} RETURNING *`, vals);

        await client.query(`
          INSERT INTO task_activity_logs (tenant_id, task_id, user_id, action, detail)
          VALUES ($1, $2, $3, 'updated', 'Thông tin công việc được cập nhật')
        `, [tenantId, req.params.id, user.id]);

        return r.rows[0];
      });

      if (!task) return res.status(404).json({ error: true, code: 'NOT_FOUND', message: 'Task not found' });
      res.json(enrichTask(task));
    } catch (error) {
      console.error('Error updating task:', error);
      res.status(500).json({ error: true, code: 'UPDATE_FAILED', message: 'Failed to update task' });
    }
  });

  // DELETE /api/tasks/:id
  router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const tenantId = user.tenantId;

      if (!['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD'].includes(user.role)) {
        return res.status(403).json({ error: true, code: 'FORBIDDEN', message: 'Chỉ admin mới có thể xóa task' });
      }

      const deleted = await withTenantContext(tenantId, async (client) => {
        const r = await client.query('DELETE FROM wf_tasks WHERE id = $1 RETURNING id', [req.params.id]);
        return r.rows[0] || null;
      });

      if (!deleted) return res.status(404).json({ error: true, code: 'NOT_FOUND', message: 'Task not found' });
      res.json({ message: 'Task deleted' });
    } catch (error) {
      console.error('Error deleting task:', error);
      res.status(500).json({ error: true, code: 'DELETE_FAILED', message: 'Failed to delete task' });
    }
  });

  // PATCH /api/tasks/:id/status — status transition
  router.patch('/:id/status', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const tenantId = user.tenantId;

      const parsed = changeStatusSchema.safeParse(req.body);
      if (!parsed.success) {
        const msg = parsed.error.issues[0]?.message || 'Dữ liệu không hợp lệ';
        return res.status(400).json({ error: true, code: 'VALIDATION', message: msg });
      }
      const { status, actual_hours, completion_note } = parsed.data;

      const task = await withTenantContext(tenantId, async (client) => {
        const current = await client.query('SELECT * FROM wf_tasks WHERE id = $1', [req.params.id]);
        if (!current.rows[0]) return null;

        const currentStatus = current.rows[0].status;
        const allowed = VALID_TRANSITIONS[currentStatus] || [];

        if (!allowed.includes(status)) {
          if (status === 'done' && currentStatus === 'done' && ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD'].includes(user.role)) {
            // Admin can re-modify done tasks
          } else {
            throw Object.assign(new Error('INVALID_TRANSITION'), { code: 'INVALID_TRANSITION', from: currentStatus, to: status, allowed });
          }
        }

        if (status === 'cancelled' && !completion_note) {
          throw Object.assign(new Error('VALIDATION'), { code: 'VALIDATION', message: 'Lý do hủy là bắt buộc khi đổi trạng thái sang cancelled' });
        }

        const setClauses: string[] = ['status = $2'];
        const vals: any[] = [req.params.id, status];

        if (status === 'done') {
          if (actual_hours) { setClauses.push(`actual_hours = $${vals.length + 1}`); vals.push(actual_hours); }
          if (completion_note) { setClauses.push(`completion_note = $${vals.length + 1}`); vals.push(completion_note); }
        }
        if (status === 'cancelled' && completion_note) {
          setClauses.push(`completion_note = $${vals.length + 1}`);
          vals.push(completion_note);
        }

        const r = await client.query(`UPDATE wf_tasks SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`, vals);

        await client.query(`
          INSERT INTO task_activity_logs (tenant_id, task_id, user_id, action, old_value, new_value, detail)
          VALUES ($1, $2, $3, 'status_changed', $4, $5, $6)
        `, [tenantId, req.params.id, user.id,
            JSON.stringify({ status: currentStatus }),
            JSON.stringify({ status }),
            `Trạng thái chuyển từ ${currentStatus} sang ${status}`]);

        return r.rows[0];
      });

      if (!task) return res.status(404).json({ error: true, code: 'NOT_FOUND', message: 'Task not found' });
      res.json(enrichTask(task));
    } catch (error: any) {
      if (error.code === 'INVALID_TRANSITION') {
        return res.status(422).json({ error: true, code: 'INVALID_TRANSITION', message: `Không thể chuyển từ ${error.from} sang ${error.to}`, allowed: error.allowed });
      }
      if (error.code === 'VALIDATION') {
        return res.status(400).json({ error: true, code: 'VALIDATION', message: error.message });
      }
      console.error('Error updating task status:', error);
      res.status(500).json({ error: true, code: 'UPDATE_FAILED', message: 'Failed to update status' });
    }
  });

  // POST /api/tasks/:id/assign — assign users to task
  router.post('/:id/assign', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const tenantId = user.tenantId;

      const parsed = assignSchema.safeParse(req.body);
      if (!parsed.success) {
        const msg = parsed.error.issues[0]?.message || 'Dữ liệu không hợp lệ';
        return res.status(400).json({ error: true, code: 'VALIDATION', message: msg });
      }
      const { user_ids, due_note, primary_user_id } = parsed.data;

      const result = await withTenantContext(tenantId, async (client) => {
        const taskRes = await client.query('SELECT * FROM wf_tasks WHERE id = $1', [req.params.id]);
        if (!taskRes.rows[0]) return null;

        for (const uid of user_ids) {
          const userRes = await client.query('SELECT id, status FROM users WHERE id = $1', [uid]);
          if (!userRes.rows[0] || userRes.rows[0].status === 'INACTIVE') {
            throw Object.assign(new Error('INACTIVE_USER'), { code: 'INACTIVE_USER', userId: uid });
          }

          const isPrimary = uid === primary_user_id;
          if (isPrimary) {
            await client.query('UPDATE task_assignments SET is_primary = false WHERE task_id = $1', [req.params.id]);
          }

          await client.query(`
            INSERT INTO task_assignments (tenant_id, task_id, user_id, assigned_by, due_note, is_primary)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (task_id, user_id) DO UPDATE SET due_note = EXCLUDED.due_note, is_primary = EXCLUDED.is_primary
          `, [tenantId, req.params.id, uid, user.id, due_note || null, isPrimary || !primary_user_id]);

          await client.query(`
            INSERT INTO task_activity_logs (tenant_id, task_id, user_id, action, new_value, detail)
            VALUES ($1, $2, $3, 'assigned', $4, $5)
          `, [tenantId, req.params.id, user.id, JSON.stringify({ assigned_user: uid }), `Giao việc cho người dùng`]);
        }

        // Auto in_progress if task was todo
        if (taskRes.rows[0].status === 'todo') {
          await client.query('UPDATE wf_tasks SET status = $1 WHERE id = $2', ['in_progress', req.params.id]);
        }

        // Return updated assignees list
        const assigneesRes = await client.query(`
          SELECT u.id, u.name, u.avatar, u.email, ta.is_primary, ta.assigned_at, ta.due_note
          FROM task_assignments ta JOIN users u ON u.id = ta.user_id
          WHERE ta.task_id = $1
        `, [req.params.id]);

        return assigneesRes.rows;
      });

      if (!result) return res.status(404).json({ error: true, code: 'NOT_FOUND', message: 'Task not found' });
      res.json({ assignees: result });
    } catch (error: any) {
      if (error.code === 'INACTIVE_USER') {
        return res.status(400).json({ error: true, code: 'INACTIVE_USER', message: `User ${error.userId} không còn hoạt động` });
      }
      console.error('Error assigning task:', error);
      res.status(500).json({ error: true, code: 'ASSIGN_FAILED', message: 'Failed to assign task' });
    }
  });

  // DELETE /api/tasks/:id/assign/:userId — unassign user
  router.delete('/:id/assign/:userId', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const tenantId = user.tenantId;
      const { userId } = req.params;

      await withTenantContext(tenantId, async (client) => {
        const assignRes = await client.query(
          'SELECT * FROM task_assignments WHERE task_id = $1 AND user_id = $2',
          [req.params.id, userId]
        );
        if (!assignRes.rows[0]) throw Object.assign(new Error('NOT_FOUND'), { code: 'NOT_FOUND' });

        if (assignRes.rows[0].is_primary) {
          const countRes = await client.query('SELECT COUNT(*) FROM task_assignments WHERE task_id = $1', [req.params.id]);
          if (parseInt(countRes.rows[0].count) > 1) {
            throw Object.assign(new Error('PRIMARY_UNASSIGN'), { code: 'PRIMARY_UNASSIGN',
              message: 'Không thể hủy giao việc người chịu trách nhiệm chính khi vẫn còn người khác. Hãy chỉ định người primary mới trước.' });
          }
        }

        await client.query('DELETE FROM task_assignments WHERE task_id = $1 AND user_id = $2', [req.params.id, userId]);
        await client.query(`
          INSERT INTO task_activity_logs (tenant_id, task_id, user_id, action, detail)
          VALUES ($1, $2, $3, 'unassigned', 'Hủy giao việc')
        `, [tenantId, req.params.id, user.id]);
      });

      res.json({ message: 'Đã hủy giao việc' });
    } catch (error: any) {
      if (error.code === 'PRIMARY_UNASSIGN') {
        return res.status(400).json({ error: true, code: 'PRIMARY_UNASSIGN', message: error.message });
      }
      if (error.code === 'NOT_FOUND') {
        return res.status(404).json({ error: true, code: 'NOT_FOUND', message: 'Assignment not found' });
      }
      console.error('Error unassigning task:', error);
      res.status(500).json({ error: true, code: 'UNASSIGN_FAILED', message: 'Failed to unassign task' });
    }
  });

  // DELETE /api/tasks/:id/assign — unassign user by body { user_id }
  router.delete('/:id/assign', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const tenantId = user.tenantId;

      const parsed = unassignBodySchema.safeParse(req.body);
      if (!parsed.success) {
        const msg = parsed.error.issues[0]?.message || 'user_id là bắt buộc';
        return res.status(400).json({ error: true, code: 'VALIDATION', message: msg });
      }
      const { user_id: userId } = parsed.data;

      await withTenantContext(tenantId, async (client) => {
        const assignRes = await client.query(
          'SELECT * FROM task_assignments WHERE task_id = $1 AND user_id = $2',
          [req.params.id, userId]
        );
        if (!assignRes.rows[0]) throw Object.assign(new Error('NOT_FOUND'), { code: 'NOT_FOUND' });

        if (assignRes.rows[0].is_primary) {
          const countRes = await client.query('SELECT COUNT(*) FROM task_assignments WHERE task_id = $1', [req.params.id]);
          if (parseInt(countRes.rows[0].count) > 1) {
            throw Object.assign(new Error('PRIMARY_UNASSIGN'), { code: 'PRIMARY_UNASSIGN',
              message: 'Không thể hủy giao việc người chịu trách nhiệm chính khi vẫn còn người khác.' });
          }
        }

        await client.query('DELETE FROM task_assignments WHERE task_id = $1 AND user_id = $2', [req.params.id, userId]);
        await client.query(`
          INSERT INTO task_activity_logs (tenant_id, task_id, user_id, action, detail)
          VALUES ($1, $2, $3, 'unassigned', 'Hủy giao việc')
        `, [tenantId, req.params.id, user.id]);
      });

      res.json({ message: 'Đã hủy giao việc' });
    } catch (error: any) {
      if (error.code === 'PRIMARY_UNASSIGN') {
        return res.status(400).json({ error: true, code: 'PRIMARY_UNASSIGN', message: error.message });
      }
      if (error.code === 'NOT_FOUND') {
        return res.status(404).json({ error: true, code: 'NOT_FOUND', message: 'Assignment not found' });
      }
      console.error('Error unassigning task:', error);
      res.status(500).json({ error: true, code: 'UNASSIGN_FAILED', message: 'Failed to unassign task' });
    }
  });

  // GET /api/tasks/:id/comments
  router.get('/:id/comments', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const tenantId = user.tenantId;

      const comments = await withTenantContext(tenantId, async (client) => {
        const r = await client.query(`
          SELECT tc.*, u.name AS user_name, u.avatar AS user_avatar
          FROM task_comments tc
          JOIN users u ON u.id = tc.user_id
          WHERE tc.task_id = $1
          ORDER BY tc.created_at ASC
        `, [req.params.id]);
        return r.rows;
      });

      res.json({ data: comments });
    } catch (error) {
      console.error('Error fetching comments:', error);
      res.status(500).json({ error: true, code: 'FETCH_FAILED', message: 'Failed to fetch comments' });
    }
  });

  // POST /api/tasks/:id/comments
  router.post('/:id/comments', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const tenantId = user.tenantId;

      const parsed = commentSchema.safeParse(req.body);
      if (!parsed.success) {
        const msg = parsed.error.issues[0]?.message || 'Dữ liệu không hợp lệ';
        return res.status(400).json({ error: true, code: 'VALIDATION', message: msg });
      }
      const { content } = parsed.data;

      const comment = await withTenantContext(tenantId, async (client) => {
        const r = await client.query(`
          INSERT INTO task_comments (tenant_id, task_id, user_id, content)
          VALUES ($1, $2, $3, $4)
          RETURNING *
        `, [tenantId, req.params.id, user.id, content.trim()]);

        await client.query(`
          INSERT INTO task_activity_logs (tenant_id, task_id, user_id, action, detail)
          VALUES ($1, $2, $3, 'commented', 'Đã thêm bình luận')
        `, [tenantId, req.params.id, user.id]);

        const full = await client.query(`
          SELECT tc.*, u.name AS user_name, u.avatar AS user_avatar
          FROM task_comments tc JOIN users u ON u.id = tc.user_id
          WHERE tc.id = $1
        `, [r.rows[0].id]);

        return full.rows[0];
      });

      res.status(201).json(comment);
    } catch (error) {
      console.error('Error creating comment:', error);
      res.status(500).json({ error: true, code: 'CREATE_FAILED', message: 'Failed to create comment' });
    }
  });

  // PATCH /api/tasks/:id/comments/:commentId — edit a comment (owner only)
  router.patch('/:id/comments/:commentId', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const tenantId = user.tenantId;
      const parsed = commentSchema.safeParse(req.body);
      if (!parsed.success) {
        const msg = parsed.error.issues[0]?.message || 'Dữ liệu không hợp lệ';
        return res.status(400).json({ error: true, code: 'VALIDATION', message: msg });
      }
      const { content } = parsed.data;

      const comment = await withTenantContext(tenantId, async (client) => {
        const existing = await client.query(
          `SELECT id, user_id FROM task_comments WHERE id = $1 AND task_id = $2`,
          [req.params.commentId, req.params.id]
        );
        if (existing.rows.length === 0) {
          return null;
        }
        if (existing.rows[0].user_id !== user.id) {
          return 'forbidden';
        }
        const r = await client.query(
          `UPDATE task_comments SET content = $1, updated_at = NOW()
           WHERE id = $2 AND task_id = $3
           RETURNING *`,
          [content.trim(), req.params.commentId, req.params.id]
        );
        const full = await client.query(
          `SELECT tc.*, u.name AS user_name FROM task_comments tc JOIN users u ON u.id = tc.user_id WHERE tc.id = $1`,
          [r.rows[0].id]
        );
        return full.rows[0];
      });

      if (!comment) return res.status(404).json({ error: true, code: 'NOT_FOUND', message: 'Comment not found' });
      if (comment === 'forbidden') return res.status(403).json({ error: true, code: 'FORBIDDEN', message: 'Not your comment' });
      res.json(comment);
    } catch (error) {
      console.error('Error updating comment:', error);
      res.status(500).json({ error: true, code: 'UPDATE_FAILED', message: 'Failed to update comment' });
    }
  });

  // DELETE /api/tasks/:id/comments/:commentId — delete a comment (owner only)
  router.delete('/:id/comments/:commentId', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const tenantId = user.tenantId;

      await withTenantContext(tenantId, async (client) => {
        const existing = await client.query(
          `SELECT id, user_id FROM task_comments WHERE id = $1 AND task_id = $2`,
          [req.params.commentId, req.params.id]
        );
        if (existing.rows.length === 0) return;
        if (existing.rows[0].user_id !== user.id) {
          throw new Error('FORBIDDEN');
        }
        await client.query(
          `DELETE FROM task_comments WHERE id = $1`,
          [req.params.commentId]
        );
      });

      res.json({ message: 'Deleted' });
    } catch (error: any) {
      if (error?.message === 'FORBIDDEN') {
        return res.status(403).json({ error: true, code: 'FORBIDDEN', message: 'Not your comment' });
      }
      console.error('Error deleting comment:', error);
      res.status(500).json({ error: true, code: 'DELETE_FAILED', message: 'Failed to delete comment' });
    }
  });

  // GET /api/tasks/:id/activity — activity timeline
  router.get('/:id/activity', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const tenantId = user.tenantId;
      const limit  = Math.min(50, parseInt(req.query.limit as string) || 20);
      const page   = Math.max(1, parseInt(req.query.page as string) || 1);
      const offset = (page - 1) * limit;

      const logs = await withTenantContext(tenantId, async (client) => {
        const count = await client.query(
          `SELECT COUNT(*) FROM task_activity_logs WHERE task_id = $1`,
          [req.params.id]
        );
        const r = await client.query(`
          SELECT al.*, u.name AS user_name, u.avatar AS user_avatar
          FROM task_activity_logs al
          LEFT JOIN users u ON u.id = al.user_id
          WHERE al.task_id = $1
          ORDER BY al.created_at DESC
          LIMIT $2 OFFSET $3
        `, [req.params.id, limit, offset]);
        return { rows: r.rows, total: parseInt(count.rows[0].count) };
      });

      res.json({ data: logs.rows, pagination: { total: logs.total, page, limit } });
    } catch (error) {
      console.error('Error fetching activity:', error);
      res.status(500).json({ error: true, code: 'FETCH_FAILED', message: 'Failed to fetch activity' });
    }
  });

  return router;
}
