import { Router, Request, Response } from 'express';
import { analyticsRepository } from '../repositories/analyticsRepository';
import { auditRepository } from '../repositories/auditRepository';

export function createAnalyticsRoutes(authenticateToken: any) {
  const router = Router();

  router.get('/summary', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const timeRange = (req.query.timeRange as string) || 'all';
      const summary = await analyticsRepository.getSummary(user.tenantId, timeRange);
      res.json(summary);
    } catch (error) {
      console.error('Error fetching analytics summary:', error);
      res.status(500).json({ error: 'Failed to fetch analytics' });
    }
  });

  router.get('/audit-logs', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Only admins can view audit logs' });
      }

      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 50;
      const filters: any = {};
      if (req.query.entityType) filters.entityType = req.query.entityType;
      if (req.query.action) filters.action = req.query.action;
      if (req.query.since) filters.since = req.query.since;

      const result = await auditRepository.findLogs(user.tenantId, { page, pageSize }, filters);
      res.json(result);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
  });

  return router;
}
