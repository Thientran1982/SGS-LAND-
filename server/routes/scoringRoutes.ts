import { Router, Request, Response } from 'express';
import { scoringConfigRepository } from '../repositories/scoringConfigRepository';

export function createScoringRoutes(authenticateToken: any) {
  const router = Router();

  router.get('/config', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const config = await scoringConfigRepository.getByTenant(user.tenantId);
      if (!config) {
        return res.json({
          weights: { engagement: 30, budget: 25, timeline: 20, fit: 15, source: 10 },
          thresholds: { A: 80, B: 60, C: 40, D: 20 },
        });
      }
      res.json(config);
    } catch (error) {
      console.error('Error fetching scoring config:', error);
      res.status(500).json({ error: 'Failed to fetch scoring config' });
    }
  });

  router.put('/config', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'ADMIN' && user.role !== 'TEAM_LEAD') {
        return res.status(403).json({ error: 'Only admins can update scoring config' });
      }
      const { weights, thresholds } = req.body;
      const result = await scoringConfigRepository.upsert(user.tenantId, { weights, thresholds });
      res.json(result);
    } catch (error) {
      console.error('Error updating scoring config:', error);
      res.status(500).json({ error: 'Failed to update scoring config' });
    }
  });

  return router;
}
