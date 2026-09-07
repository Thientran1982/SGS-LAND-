import { Router, Request, Response } from 'express';
import {
  agentAuditRepository,
  LANDING_CLASSIFICATION_REVIEW_LABELS,
  LandingClassificationReviewLabel,
} from '../repositories/agentAuditRepository';

export function createAgentAuditRoutes(authenticateToken: any): Router {
  const router = Router();
  const canReview = (user: any) => ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD'].includes(user?.role);

  router.get('/classification-reviews', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!canReview(user)) {
        return res.status(403).json({ error: 'Bạn không có quyền xem hàng đợi review classifier.' });
      }
      const requestedStatus = String(req.query.status || 'pending');
      const status = ['pending', 'reviewed', 'all'].includes(requestedStatus)
        ? requestedStatus as 'pending' | 'reviewed' | 'all'
        : 'pending';
      const requestedLabel = typeof req.query.label === 'string' ? req.query.label : undefined;
      const label = requestedLabel && (LANDING_CLASSIFICATION_REVIEW_LABELS as readonly string[]).includes(requestedLabel)
        ? requestedLabel as LandingClassificationReviewLabel
        : undefined;
      const days = Math.max(1, Math.min(90, Number(req.query.days) || 30));
      const to = new Date();
      const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
      const result = await agentAuditRepository.listLandingClassificationReviews(user.tenantId, {
        from: from.toISOString(),
        to: to.toISOString(),
        language: typeof req.query.language === 'string' ? req.query.language.slice(0, 20) : undefined,
        status,
        label,
        limit: Number(req.query.limit) || 50,
        offset: Number(req.query.offset) || 0,
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Không thể đọc hàng đợi review classifier.' });
    }
  });

  router.get('/classification-reviews/regression-set', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!canReview(user)) {
        return res.status(403).json({ error: 'Bạn không có quyền xem tập regression classifier.' });
      }
      const requestedLabel = typeof req.query.label === 'string' ? req.query.label : undefined;
      const label = requestedLabel && (LANDING_CLASSIFICATION_REVIEW_LABELS as readonly string[]).includes(requestedLabel)
        ? requestedLabel as LandingClassificationReviewLabel
        : undefined;
      const result = await agentAuditRepository.listLandingClassificationReviews(user.tenantId, {
        status: 'reviewed',
        label,
        language: typeof req.query.language === 'string' ? req.query.language.slice(0, 20) : undefined,
        from: typeof req.query.from === 'string' ? req.query.from : '1970-01-01T00:00:00.000Z',
        to: typeof req.query.to === 'string' ? req.query.to : undefined,
        limit: Number(req.query.limit) || 200,
        offset: Number(req.query.offset) || 0,
      });
      res.json({ ...result, purpose: 'classifier-regression' });
    } catch (error) {
      res.status(500).json({ error: 'Không thể đọc tập regression classifier.' });
    }
  });

  router.post('/classification-reviews/:auditEventId', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!canReview(user)) {
        return res.status(403).json({ error: 'Bạn không có quyền gắn nhãn review classifier.' });
      }
      const label = String(req.body?.label || '') as LandingClassificationReviewLabel;
      if (!(LANDING_CLASSIFICATION_REVIEW_LABELS as readonly string[]).includes(label)) {
        return res.status(400).json({
          error: 'Nhãn review không hợp lệ.',
          allowedLabels: LANDING_CLASSIFICATION_REVIEW_LABELS,
        });
      }
      const review = await agentAuditRepository.reviewLandingClassification(
        user.tenantId,
        String(req.params.auditEventId),
        label,
        String(user.id || user.userId),
      );
      if (!review) return res.status(404).json({ error: 'Không tìm thấy ca landing cần review.' });
      res.json({ review });
    } catch (error) {
      res.status(500).json({ error: 'Không thể lưu nhãn review classifier.' });
    }
  });

  router.get('/classification-health', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!canReview(user)) {
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