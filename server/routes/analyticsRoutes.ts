import { Router, Request, Response } from 'express';
import { analyticsRepository } from '../repositories/analyticsRepository';
import { visitorRepository } from '../repositories/visitorRepository';

export function createAnalyticsRoutes(authenticateToken: any) {
  const router = Router();

  router.get('/summary', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const timeRange = (req.query.timeRange as string) || 'all';
      // Pass userId + role so analytics queries can apply RBAC filtering
      const summary = await analyticsRepository.getSummary(
        user.tenantId,
        timeRange,
        user.id,
        user.role,
      );
      res.json(summary);
    } catch (error) {
      console.error('Error fetching analytics summary:', error);
      res.status(500).json({ error: 'Failed to fetch analytics' });
    }
  });

  // audit-logs endpoint lives in enterpriseRoutes (/api/enterprise/audit-logs)
  // to avoid duplicate routes and to keep enterprise/compliance endpoints together

  router.get('/bi-marts', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const timeRange = (req.query.timeRange as string) || 'all';
      const result = await analyticsRepository.generateBiMarts(
        user.tenantId,
        timeRange,
        user.id,
        user.role,
      );
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
      const parsedCost = Number(cost);
      if (isNaN(parsedCost) || parsedCost < 0) {
        return res.status(400).json({ error: 'cost must be a non-negative number' });
      }
      const result = await analyticsRepository.createCampaignCost(user.tenantId, {
        campaignName: campaignName || source,
        source,
        cost: parsedCost,
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

  router.get('/visitors', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const days = Math.max(1, Math.min(parseInt(req.query.days as string) || 30, 365));
      const stats = await visitorRepository.getStats(user.tenantId, days);
      res.json(stats);
    } catch (error) {
      console.error('Error fetching visitor stats:', error);
      res.status(500).json({ error: 'Failed to fetch visitor stats' });
    }
  });

  return router;
}
