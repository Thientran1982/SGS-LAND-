import { Router, Request, Response } from 'express';
import { withTenantContext } from '../db';

export function createDepartmentRoutes(authenticateToken: any) {
  const router = Router();

  // GET /api/departments — list all departments for tenant
  router.get('/', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const tenantId = user.tenantId;

      const departments = await withTenantContext(tenantId, async (client) => {
        const r = await client.query(`
          SELECT d.*, COUNT(DISTINCT t.id) AS task_count
          FROM departments d
          LEFT JOIN wf_tasks t ON t.department_id = d.id
          GROUP BY d.id
          ORDER BY d.name ASC
        `);
        return r.rows;
      });

      res.json(departments);
    } catch (error) {
      console.error('Error fetching departments:', error);
      res.status(500).json({ error: true, code: 'FETCH_FAILED', message: 'Failed to fetch departments' });
    }
  });

  // GET /api/users/:id/workload — workload stats for a user
  router.get('/users/:userId/workload', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const tenantId = user.tenantId;
      const { userId } = req.params;

      const workload = await withTenantContext(tenantId, async (client) => {
        const activeRes = await client.query(`
          SELECT COUNT(*) FROM wf_tasks t
          JOIN task_assignments ta ON ta.task_id = t.id AND ta.user_id = $1
          WHERE t.status = 'in_progress'
        `, [userId]);

        const overdueRes = await client.query(`
          SELECT COUNT(*) FROM wf_tasks t
          JOIN task_assignments ta ON ta.task_id = t.id AND ta.user_id = $1
          WHERE t.status NOT IN ('done','cancelled') AND t.deadline < CURRENT_DATE
        `, [userId]);

        const weekRes = await client.query(`
          SELECT COUNT(*) FROM wf_tasks t
          JOIN task_assignments ta ON ta.task_id = t.id AND ta.user_id = $1
          WHERE t.status = 'done' AND t.updated_at >= NOW() - INTERVAL '7 days'
        `, [userId]);

        const monthRes = await client.query(`
          SELECT COUNT(*) FROM wf_tasks t
          JOIN task_assignments ta ON ta.task_id = t.id AND ta.user_id = $1
          WHERE t.status = 'done' AND t.updated_at >= NOW() - INTERVAL '30 days'
        `, [userId]);

        const urgentRes = await client.query(`
          SELECT COUNT(*) FROM wf_tasks t
          JOIN task_assignments ta ON ta.task_id = t.id AND ta.user_id = $1
          WHERE t.priority = 'urgent' AND t.status NOT IN ('done','cancelled')
        `, [userId]);

        const active = parseInt(activeRes.rows[0].count);
        const overdue = parseInt(overdueRes.rows[0].count);
        const urgent = parseInt(urgentRes.rows[0].count);
        const workload_score = active * 1 + overdue * 2 + urgent * 1.5;

        return {
          active_tasks: active,
          overdue_tasks: overdue,
          completed_this_week: parseInt(weekRes.rows[0].count),
          completed_this_month: parseInt(monthRes.rows[0].count),
          workload_score,
        };
      });

      res.json(workload);
    } catch (error) {
      console.error('Error fetching workload:', error);
      res.status(500).json({ error: true, code: 'FETCH_FAILED', message: 'Failed to fetch workload' });
    }
  });

  return router;
}
