import { Router, Request, Response } from 'express';
import { analyticsRepository } from '../repositories/analyticsRepository';
import { visitorRepository } from '../repositories/visitorRepository';

export function createAnalyticsRoutes(authenticateToken: any) {
  const router = Router();

  const PARTNER_ROLES = ['PARTNER_ADMIN', 'PARTNER_AGENT'];

  router.get('/summary', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (PARTNER_ROLES.includes(user.role)) {
        return res.status(403).json({ error: 'Không có quyền truy cập' });
      }
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

  router.get('/kpi-targets', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (PARTNER_ROLES.includes(user.role)) return res.status(403).json({ error: 'Không có quyền truy cập' });
      const now = new Date();
      const year = Math.min(2100, Math.max(2020, Number(req.query.year) || now.getFullYear()));
      const month = Math.min(12, Math.max(1, Number(req.query.month) || now.getMonth() + 1));
      res.json(await analyticsRepository.getKpiTargets(user.tenantId, year, month));
    } catch (error) {
      console.error('Error fetching KPI targets:', error);
      res.status(500).json({ error: 'Failed to fetch KPI targets' });
    }
  });

  router.put('/kpi-targets', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD'].includes(user.role)) {
        return res.status(403).json({ error: 'Only admins and team leads can update KPI targets' });
      }
      const now = new Date();
      const year = Math.min(2100, Math.max(2020, Number(req.body?.year) || now.getFullYear()));
      const month = Math.min(12, Math.max(1, Number(req.body?.month) || now.getMonth() + 1));
      const input = Array.isArray(req.body?.targets) ? req.body.targets : [];
      const allowed = new Set(['revenue', 'pipeline', 'salesVelocity']);
      if (input.length !== 3 || new Set(input.map((item: any) => item?.metric)).size !== 3 || input.some((item: any) => !allowed.has(item?.metric))) {
        return res.status(400).json({ error: 'targets must include revenue, pipeline, and salesVelocity exactly once' });
      }
      const targets = input.map((item: any) => {
        const monthlyTarget = Number(item.monthlyTarget);
        const quarterTarget = Number(item.quarterTarget);
        if (!Number.isFinite(monthlyTarget) || monthlyTarget < 0 || !Number.isFinite(quarterTarget) || quarterTarget < 0) {
          throw new Error('KPI targets must be non-negative numbers');
        }
        return { metric: item.metric, monthlyTarget, quarterTarget };
      });
      res.json(await analyticsRepository.upsertKpiTargets(user.tenantId, user.id, year, month, targets));
    } catch (error: any) {
      if (error?.message?.includes('KPI targets')) return res.status(400).json({ error: error.message });
      console.error('Error updating KPI targets:', error);
      res.status(500).json({ error: 'Failed to update KPI targets' });
    }
  });

  // audit-logs endpoint lives in enterpriseRoutes (/api/enterprise/audit-logs)
  // to avoid duplicate routes and to keep enterprise/compliance endpoints together

  router.get('/bi-marts', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (PARTNER_ROLES.includes(user.role)) {
        return res.status(403).json({ error: 'Không có quyền truy cập' });
      }
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
      if (!['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD'].includes(user.role)) {
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
      if (!['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD'].includes(user.role)) {
        return res.status(403).json({ error: 'Only admins and team leads can delete campaign costs' });
      }
      const { id: _id } = req.params; const id = String(_id);
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
      if (!['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD'].includes(user.role)) {
        return res.status(403).json({ error: 'Only admins and team leads can update campaign costs' });
      }
      const { id: _id } = req.params; const id = String(_id);
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

  // GET /api/analytics/agent-stats/:userId
  // Returns lead KPIs + workload for one agent.
  // RBAC: each user can see their own stats; ADMIN and TEAM_LEAD can see anyone's.
  router.get('/agent-stats/:userId', authenticateToken, async (req: Request, res: Response) => {
    try {
      const caller = (req as any).user;
      const targetId = String(req.params.userId);

      if (PARTNER_ROLES.includes(caller.role)) {
        return res.status(403).json({ error: 'Không có quyền truy cập' });
      }
      if (caller.id !== targetId && !['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD'].includes(caller.role)) {
        return res.status(403).json({ error: 'Không có quyền xem số liệu của người dùng khác' });
      }

      const stats = await analyticsRepository.getAgentStats(caller.tenantId, targetId);
      res.json(stats);
    } catch (error) {
      console.error('Error fetching agent stats:', error);
      res.status(500).json({ error: 'Failed to fetch agent stats' });
    }
  });

  router.get('/visitors', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (PARTNER_ROLES.includes(user.role)) {
        return res.status(403).json({ error: 'Không có quyền truy cập' });
      }
      const days = Math.max(1, Math.min(parseInt(req.query.days as string) || 30, 365));
      const stats = await visitorRepository.getStats(user.tenantId, days);
      res.json(stats);
    } catch (error) {
      console.error('Error fetching visitor stats:', error);
      res.status(500).json({ error: 'Failed to fetch visitor stats' });
    }
  });

  router.get('/visitor-funnel', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (PARTNER_ROLES.includes(user.role)) {
        return res.status(403).json({ error: 'Không có quyền truy cập' });
      }
      const days = Math.max(1, Math.min(parseInt(req.query.days as string) || 30, 365));
      const projectCode = typeof req.query.projectCode === 'string' ? req.query.projectCode.trim().slice(0, 200) : undefined;
      const source = typeof req.query.source === 'string' ? req.query.source.trim().slice(0, 500) : undefined;
      const stats = await visitorRepository.getFunnelStats(user.tenantId, days, { projectCode, source });
      res.json(stats);
    } catch (error) {
      console.error('Error fetching visitor funnel:', error);
      res.status(500).json({ error: 'Failed to fetch visitor funnel' });
    }
  });

  return router;
}
