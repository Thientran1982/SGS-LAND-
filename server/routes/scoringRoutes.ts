import { Router, Request, Response } from 'express';
import { scoringConfigRepository, DEFAULT_WEIGHTS, DEFAULT_THRESHOLDS } from '../repositories/scoringConfigRepository';

export function createScoringRoutes(authenticateToken: any) {
  const router = Router();

  router.get('/config', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const config = await scoringConfigRepository.getByTenant(user.tenantId);
      if (!config) {
        return res.json({
          weights: DEFAULT_WEIGHTS,
          thresholds: DEFAULT_THRESHOLDS,
          version: 1,
        });
      }
      res.json({
        ...config,
        version: config.version ?? 1,
      });
    } catch (error) {
      console.error('Error fetching scoring config:', error);
      res.status(500).json({ error: 'Failed to fetch scoring config' });
    }
  });

  router.put('/config', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD'].includes(user.role)) {
        return res.status(403).json({ error: 'Only admins can update scoring config' });
      }
      const { weights, thresholds } = req.body;
      if (!weights || typeof weights !== 'object') {
        return res.status(400).json({ error: 'weights is required' });
      }
      const result = await scoringConfigRepository.upsert(user.tenantId, {
        weights,
        thresholds: thresholds ?? DEFAULT_THRESHOLDS,
      });
      res.json({
        ...result,
        version: result.version ?? 1,
      });
    } catch (error) {
      console.error('Error updating scoring config:', error);
      res.status(500).json({ error: 'Failed to update scoring config' });
    }
  });

  return router;
}
