import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { withTenantContext } from '../db';

// ─── Zod Schemas ──────────────────────────────────────────────────────────────
// Broad UUID-shape regex — tolerates non-RFC-4122 department IDs from migration 020
const UUID_SHAPE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const dateRangeQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'from phải là ngày YYYY-MM-DD').optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'to phải là ngày YYYY-MM-DD').optional(),
  department_id: z.string().regex(UUID_SHAPE, 'Phòng ban không hợp lệ').optional(),
  user_id: z.string().uuid().optional(),
}).refine(data => {
  if (data.from && data.to) return new Date(data.from) <= new Date(data.to);
  return true;
}, { message: 'from phải nhỏ hơn hoặc bằng to' });

export function createTaskReportRoutes(authenticateToken: any) {
  const router = Router();

  // GET /api/dashboard/task-stats — dashboard overview stats
  router.get('/task-stats', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const tenantId = user.tenantId;

      const stats = await withTenantContext(tenantId, async (client) => {
        // Overview
        const overviewRes = await client.query(`
          SELECT
            COUNT(*) FILTER (WHERE status = 'todo') AS todo,
            COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress,
            COUNT(*) FILTER (WHERE status = 'review') AS review,
            COUNT(*) FILTER (WHERE status = 'done') AS done,
            COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE status NOT IN ('done','cancelled') AND deadline < CURRENT_DATE) AS overdue_count,
            COUNT(*) FILTER (WHERE deadline = CURRENT_DATE AND status NOT IN ('done','cancelled')) AS due_today_count,
            COUNT(*) FILTER (WHERE deadline BETWEEN CURRENT_DATE AND CURRENT_DATE + 7 AND status NOT IN ('done','cancelled')) AS due_this_week_count
          FROM wf_tasks
        `);

        // Done today / this week
        const doneTimeRes = await client.query(`
          SELECT
            COUNT(*) FILTER (WHERE updated_at >= CURRENT_DATE AND status = 'done') AS done_today,
            COUNT(*) FILTER (WHERE updated_at >= DATE_TRUNC('week', CURRENT_DATE) AND status = 'done') AS done_week
          FROM wf_tasks
        `);

        // By priority
        const priorityRes = await client.query(`
          SELECT priority, COUNT(*) AS cnt FROM wf_tasks WHERE status NOT IN ('done','cancelled') GROUP BY priority
        `);

        // By category
        const categoryRes = await client.query(`
          SELECT category, COUNT(*) AS cnt FROM wf_tasks WHERE status NOT IN ('done','cancelled') GROUP BY category
        `);

        // By project
        const projectRes = await client.query(`
          SELECT
            p.id AS project_id, p.name,
            COUNT(t.id) AS total,
            COUNT(t.id) FILTER (WHERE t.status = 'done') AS done,
            COUNT(t.id) FILTER (WHERE t.status NOT IN ('done','cancelled') AND t.deadline < CURRENT_DATE) AS overdue
          FROM projects p
          LEFT JOIN wf_tasks t ON t.project_id = p.id
          GROUP BY p.id, p.name
          ORDER BY total DESC
          LIMIT 10
        `);

        // Top overdue tasks
        const overdueRes = await client.query(`
          SELECT
            t.*,
            COALESCE(json_agg(DISTINCT jsonb_build_object('id', u.id, 'name', u.name, 'avatar', u.avatar))
              FILTER (WHERE u.id IS NOT NULL), '[]') AS assignees
          FROM wf_tasks t
          LEFT JOIN task_assignments ta ON ta.task_id = t.id
          LEFT JOIN users u ON u.id = ta.user_id
          WHERE t.status NOT IN ('done','cancelled') AND t.deadline < CURRENT_DATE
          GROUP BY t.id
          ORDER BY t.deadline ASC
          LIMIT 5
        `);

        // Upcoming deadlines
        const upcomingRes = await client.query(`
          SELECT
            t.*,
            COALESCE(json_agg(DISTINCT jsonb_build_object('id', u.id, 'name', u.name, 'avatar', u.avatar))
              FILTER (WHERE u.id IS NOT NULL), '[]') AS assignees
          FROM wf_tasks t
          LEFT JOIN task_assignments ta ON ta.task_id = t.id
          LEFT JOIN users u ON u.id = ta.user_id
          WHERE t.status NOT IN ('done','cancelled')
            AND t.deadline BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
          GROUP BY t.id
          ORDER BY t.deadline ASC
          LIMIT 10
        `);

        // Workload by user
        const workloadRes = await client.query(`
          SELECT
            u.id AS user_id,
            u.name,
            d.name AS department,
            COUNT(t.id) FILTER (WHERE t.status = 'in_progress') AS active_tasks,
            COUNT(t.id) FILTER (WHERE t.status NOT IN ('done','cancelled') AND t.deadline < CURRENT_DATE) AS overdue_tasks,
            (COUNT(t.id) FILTER (WHERE t.status = 'in_progress') * 1.0 +
             COUNT(t.id) FILTER (WHERE t.status NOT IN ('done','cancelled') AND t.deadline < CURRENT_DATE) * 2.0 +
             COUNT(t.id) FILTER (WHERE t.priority = 'urgent' AND t.status NOT IN ('done','cancelled')) * 1.5
            ) AS workload_score
          FROM users u
          LEFT JOIN task_assignments ta ON ta.user_id = u.id
          LEFT JOIN wf_tasks t ON t.id = ta.task_id
          LEFT JOIN departments d ON d.id = (
            SELECT department_id FROM wf_tasks wt
            JOIN task_assignments ta2 ON ta2.task_id = wt.id AND ta2.user_id = u.id
            LIMIT 1
          )
          WHERE u.status = 'ACTIVE'
          GROUP BY u.id, u.name, d.name
          ORDER BY workload_score DESC
          LIMIT 10
        `);

        const by_priority: Record<string, number> = { urgent: 0, high: 0, medium: 0, low: 0 };
        priorityRes.rows.forEach((r: any) => { by_priority[r.priority] = parseInt(r.cnt); });

        const by_category: Record<string, number> = {};
        categoryRes.rows.forEach((r: any) => { by_category[r.category || 'other'] = parseInt(r.cnt); });

        const ov = overviewRes.rows[0];
        return {
          overview: {
            total_tasks: parseInt(ov.total),
            todo: parseInt(ov.todo),
            in_progress: parseInt(ov.in_progress),
            review: parseInt(ov.review),
            done: parseInt(ov.done),
            cancelled: parseInt(ov.cancelled),
            overdue_count: parseInt(ov.overdue_count),
            due_today_count: parseInt(ov.due_today_count),
            due_this_week_count: parseInt(ov.due_this_week_count),
          },
          completion_rate_today: parseInt(doneTimeRes.rows[0].done_today),
          completion_rate_week: parseInt(doneTimeRes.rows[0].done_week),
          by_priority,
          by_category,
          by_project: projectRes.rows.map((r: any) => ({
            project_id: r.project_id, name: r.name,
            total: parseInt(r.total), done: parseInt(r.done), overdue: parseInt(r.overdue)
          })),
          top_overdue_tasks: overdueRes.rows,
          upcoming_deadlines: upcomingRes.rows,
          workload_by_user: workloadRes.rows.map((r: any) => ({
            user_id: r.user_id, name: r.name, department: r.department,
            active_tasks: parseInt(r.active_tasks),
            overdue_tasks: parseInt(r.overdue_tasks),
            workload_score: parseFloat(r.workload_score || '0'),
          })),
        };
      });

      res.json(stats);
    } catch (error) {
      console.error('Error fetching task stats:', error);
      res.status(500).json({ error: true, code: 'FETCH_FAILED', message: 'Failed to fetch dashboard stats' });
    }
  });

  // GET /api/reports/task-summary — per-user summary
  router.get('/task-summary', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const tenantId = user.tenantId;

      const summary = await withTenantContext(tenantId, async (client) => {
        const r = await client.query(`
          SELECT
            u.id AS user_id,
            u.name,
            u.email,
            u.avatar,
            d.name AS department,
            COUNT(t.id) FILTER (WHERE t.status = 'todo') AS todo,
            COUNT(t.id) FILTER (WHERE t.status = 'in_progress') AS in_progress,
            COUNT(t.id) FILTER (WHERE t.status = 'done') AS done,
            COUNT(t.id) FILTER (WHERE t.status NOT IN ('done','cancelled') AND t.deadline < CURRENT_DATE) AS overdue,
            COUNT(t.id) AS total_assigned,
            ROUND(
              CASE WHEN COUNT(t.id) > 0
              THEN COUNT(t.id) FILTER (WHERE t.status = 'done')::numeric / COUNT(t.id) * 100
              ELSE 0 END, 1
            ) AS completion_rate
          FROM users u
          LEFT JOIN task_assignments ta ON ta.user_id = u.id
          LEFT JOIN wf_tasks t ON t.id = ta.task_id
          LEFT JOIN departments d ON d.id = (
            SELECT wt2.department_id FROM wf_tasks wt2
            JOIN task_assignments ta2 ON ta2.task_id = wt2.id AND ta2.user_id = u.id
            WHERE wt2.department_id IS NOT NULL
            LIMIT 1
          )
          WHERE u.status = 'ACTIVE'
          GROUP BY u.id, u.name, u.email, u.avatar, d.name
          ORDER BY overdue DESC, total_assigned DESC
        `);
        return r.rows;
      });

      res.json(summary);
    } catch (error) {
      console.error('Error fetching task summary:', error);
      res.status(500).json({ error: true, code: 'FETCH_FAILED', message: 'Failed to fetch summary' });
    }
  });

  // GET /api/reports/task-export/csv — CSV export
  router.get('/task-export/csv', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const tenantId = user.tenantId;

      const rows = await withTenantContext(tenantId, async (client) => {
        const r = await client.query(`
          SELECT
            t.id,
            t.title,
            p.name AS project_name,
            t.category,
            t.priority,
            t.status,
            STRING_AGG(DISTINCT u.name, '; ') AS assignees,
            uc.name AS created_by,
            t.deadline,
            t.updated_at AS completed_at,
            t.estimated_hours,
            t.actual_hours,
            t.completion_note
          FROM wf_tasks t
          LEFT JOIN projects p ON p.id = t.project_id
          LEFT JOIN users uc ON uc.id = t.created_by
          LEFT JOIN task_assignments ta ON ta.task_id = t.id
          LEFT JOIN users u ON u.id = ta.user_id
          GROUP BY t.id, p.name, uc.name
          ORDER BY t.created_at DESC
        `);
        return r.rows;
      });

      const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const headers = ['ID', 'Tiêu đề', 'Dự án', 'Danh mục', 'Ưu tiên', 'Trạng thái',
                       'Người thực hiện', 'Người giao', 'Deadline', 'Ngày hoàn thành',
                       'Giờ ước tính', 'Giờ thực tế', 'Ghi chú'];

      const csvRows = [headers.join(',')];
      for (const row of rows) {
        const vals = [
          row.id,
          `"${(row.title || '').replace(/"/g, '""')}"`,
          `"${(row.project_name || '').replace(/"/g, '""')}"`,
          row.category || '',
          row.priority || '',
          row.status || '',
          `"${(row.assignees || '').replace(/"/g, '""')}"`,
          `"${(row.created_by || '').replace(/"/g, '""')}"`,
          row.deadline ? row.deadline.toString().split('T')[0] : '',
          row.status === 'done' && row.completed_at ? row.completed_at.toISOString().split('T')[0] : '',
          row.estimated_hours || '',
          row.actual_hours || '',
          `"${(row.completion_note || '').replace(/"/g, '""')}"`,
        ];
        csvRows.push(vals.join(','));
      }

      const csv = '\uFEFF' + csvRows.join('\r\n'); // BOM for Excel UTF-8
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="sgs-tasks-export-${today}.csv"`);
      res.send(csv);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      res.status(500).json({ error: true, code: 'EXPORT_FAILED', message: 'Failed to export CSV' });
    }
  });

  // GET /api/reports/task-by-project — per-project summary
  router.get('/task-by-project', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const tenantId = user.tenantId;

      const rows = await withTenantContext(tenantId, async (client) => {
        const r = await client.query(`
          SELECT
            p.id, p.name, p.status AS project_status, p.location,
            COUNT(t.id) AS total,
            COUNT(t.id) FILTER (WHERE t.status = 'done') AS done,
            COUNT(t.id) FILTER (WHERE t.status = 'in_progress') AS in_progress,
            COUNT(t.id) FILTER (WHERE t.status = 'todo') AS todo,
            COUNT(t.id) FILTER (WHERE t.status NOT IN ('done','cancelled') AND t.deadline < CURRENT_DATE) AS overdue,
            ROUND(CASE WHEN COUNT(t.id) > 0
              THEN COUNT(t.id) FILTER (WHERE t.status = 'done')::numeric / COUNT(t.id) * 100
              ELSE 0 END, 1) AS completion_rate
          FROM projects p
          LEFT JOIN wf_tasks t ON t.project_id = p.id
          GROUP BY p.id, p.name, p.status, p.location
          ORDER BY total DESC
        `);
        return r.rows;
      });

      res.json(rows);
    } catch (error) {
      console.error('Error fetching project report:', error);
      res.status(500).json({ error: true, code: 'FETCH_FAILED', message: 'Failed to fetch project report' });
    }
  });

  return router;
}
