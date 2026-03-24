import { Router, Request, Response } from 'express';
import { pageViewRepository } from '../repositories/pageViewRepository';

export function createActivityRoutes(authenticateToken: any) {
  const router = Router();

  router.post('/pageview', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { path, pageLabel } = req.body;

      if (!path || typeof path !== 'string') {
        return res.status(400).json({ error: 'path is required' });
      }

      const cleanPath = path.slice(0, 255);
      const cleanLabel = (typeof pageLabel === 'string' ? pageLabel : '').slice(0, 255);

      await pageViewRepository.recordView(user.tenantId, {
        userId: user.id,
        path: cleanPath,
        pageLabel: cleanLabel,
        ipAddress: req.ip || (req.socket as any)?.remoteAddress,
      });

      res.json({ ok: true });
    } catch (error) {
      console.error('Error recording page view:', error);
      res.status(500).json({ error: 'Failed to record page view' });
    }
  });

  router.get('/summary', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin only' });
      }

      const fromDate = typeof req.query.fromDate === 'string' ? req.query.fromDate : undefined;
      const data = await pageViewRepository.getUsersActivitySummary(user.tenantId, fromDate);
      res.json(data);
    } catch (error) {
      console.error('Error fetching activity summary:', error);
      res.status(500).json({ error: 'Failed to fetch activity summary' });
    }
  });

  router.get('/user/:userId', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin only' });
      }

      const fromDate = typeof req.query.fromDate === 'string' ? req.query.fromDate : undefined;
      const data = await pageViewRepository.getUserActivity(user.tenantId, req.params.userId as string, fromDate);
      res.json(data);
    } catch (error) {
      console.error('Error fetching user activity:', error);
      res.status(500).json({ error: 'Failed to fetch user activity' });
    }
  });

  return router;
}
