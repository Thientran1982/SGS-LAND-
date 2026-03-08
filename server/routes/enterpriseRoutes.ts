import { Router, Request, Response } from 'express';
import { enterpriseConfigRepository } from '../repositories/enterpriseConfigRepository';
import { auditRepository } from '../repositories/auditRepository';

export function createEnterpriseRoutes(authenticateToken: any) {
  const router = Router();

  router.get('/config', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Only admins can view enterprise config' });
      }
      const config = await enterpriseConfigRepository.getConfig(user.tenantId);
      res.json(config);
    } catch (error) {
      console.error('Error fetching enterprise config:', error);
      res.status(500).json({ error: 'Failed to fetch enterprise config' });
    }
  });

  router.put('/config', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Only admins can update enterprise config' });
      }
      const updated = await enterpriseConfigRepository.upsertConfig(user.tenantId, req.body);
      res.json(updated);
    } catch (error) {
      console.error('Error updating enterprise config:', error);
      res.status(500).json({ error: 'Failed to update enterprise config' });
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
      if (req.query.actorId) filters.actorId = req.query.actorId;

      const result = await auditRepository.findLogs(user.tenantId, { page, pageSize }, filters);
      res.json(result);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
  });

  return router;
}
