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
      const pageSize = Math.min(parseInt(req.query.pageSize as string) || 50, 200);
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

  router.get('/bi-marts', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const timeRange = (req.query.timeRange as string) || 'all';
      const result = await analyticsRepository.generateBiMarts(user.tenantId, timeRange);
      res.json(result);
    } catch (error) {
      console.error('Error generating BI marts:', error);
      res.status(500).json({ error: 'Failed to generate BI marts' });
    }
  });

  router.post('/campaign-costs', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'ADMIN' && user.role !== 'TEAM_LEAD') {
        return res.status(403).json({ error: 'Only admins and team leads can create campaign costs' });
      }
      const { campaignName, source, cost, period } = req.body;
      if (!source || cost === undefined || !period) {
        return res.status(400).json({ error: 'source, cost, and period are required' });
      }
      const result = await analyticsRepository.createCampaignCost(user.tenantId, {
        campaignName: campaignName || source,
        source,
        cost: Number(cost),
        period,
      });
      res.status(201).json(result);
    } catch (error) {
      console.error('Error creating campaign cost:', error);
      res.status(500).json({ error: 'Failed to create campaign cost' });
    }
  });

  router.delete('/campaign-costs/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'ADMIN' && user.role !== 'TEAM_LEAD') {
        return res.status(403).json({ error: 'Only admins and team leads can delete campaign costs' });
      }
      const { id } = req.params;
      await analyticsRepository.deleteCampaignCost(user.tenantId, id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting campaign cost:', error);
      res.status(500).json({ error: 'Failed to delete campaign cost' });
    }
  });

  router.put('/campaign-costs/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'ADMIN' && user.role !== 'TEAM_LEAD') {
        return res.status(403).json({ error: 'Only admins and team leads can update campaign costs' });
      }
      const { id } = req.params;
      const { cost } = req.body;
      if (cost === undefined || isNaN(Number(cost))) {
        return res.status(400).json({ error: 'cost is required and must be a number' });
      }
      const result = await analyticsRepository.updateCampaignCost(user.tenantId, id, Number(cost));
      res.json(result);
    } catch (error) {
      console.error('Error updating campaign cost:', error);
      res.status(500).json({ error: 'Failed to update campaign cost' });
    }
  });

  return router;
}
