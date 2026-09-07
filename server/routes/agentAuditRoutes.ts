import { Router, Request, Response } from 'express';
import { agentAuditRepository } from '../repositories/agentAuditRepository';

export function createAgentAuditRoutes(authenticateToken: any): Router {
  const router = Router();
  router.get('/classification-health', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD'].includes(user?.role)) {
        return res.status(403).json({ error: 'Bạn không có quyền xem telemetry landing.' });
      }
      const days = Math.max(1, Math.min(90, Number(req.query.days) || 7));
      const to = new Date();
      const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
      res.json(await agentAuditRepository.landingClassificationHealth(user.tenantId, {
        from: from.toISOString(),
        to: to.toISOString(),
      }));
    } catch (error) {
      res.status(500).json({ error: 'Không thể đọc telemetry phân loại landing.' });
    }
  });

  router.get('/', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD'].includes(user?.role)) {
        return res.status(403).json({ error: 'Bạn không có quyền xem nhật ký Agent Minh.' });
      }
      const result = await agentAuditRepository.list(user.tenantId, {
        sessionId: typeof req.query.sessionId === 'string' ? req.query.sessionId : undefined,
        runId: typeof req.query.runId === 'string' ? req.query.runId : undefined,
        entityType: typeof req.query.entityType === 'string' ? req.query.entityType : undefined,
        entityId: typeof req.query.entityId === 'string' ? req.query.entityId : undefined,
        from: typeof req.query.from === 'string' ? req.query.from : undefined,
        to: typeof req.query.to === 'string' ? req.query.to : undefined,
        limit: Number(req.query.limit) || 50,
        offset: Number(req.query.offset) || 0,
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Không thể đọc nhật ký Agent Minh.' });
    }
  });
  return router;
}