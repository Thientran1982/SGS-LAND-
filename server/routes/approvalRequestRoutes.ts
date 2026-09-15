import { Router, Request, Response } from 'express';
import { approvalRequestRepository } from '../repositories/approvalRequestRepository';
import { validateUUIDParam } from '../middleware/validation';
import { recordMinhDecisionFeedbackSafely } from '../services/minhDecisionLearningService';

/**
 * Permission Broker API: danh sach + duyet/tu choi cac approval_requests
 * (hanh dong AI high-impact dang cho duyet). Dung cho tab moi trong Inbox.
 */
export function createApprovalRequestRoutes(authenticateToken: any) {
  const router = Router();
const APPROVAL_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TEAM_LEAD']);

  router.get('/', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!APPROVAL_ROLES.has(user?.role)) {
        return res.status(403).json({ error: 'Only authorized managers can approve AI actions' });
      }
      const [items, pendingCount] = await Promise.all([
        approvalRequestRepository.findPendingByTenant(user.tenantId, 50),
        approvalRequestRepository.countPending(user.tenantId),
      ]);
      res.json({ items, pendingCount });
    } catch (error) {
      console.error('[approval-requests] list error:', error);
      res.status(500).json({ error: 'Failed to fetch approval requests' });
    }
  });

  router.post('/:id/approve', authenticateToken, validateUUIDParam(), async (req: Request, res: Response) => {
    let updated: any = null;
    try {
      const user = (req as any).user;
      if (!APPROVAL_ROLES.has(user?.role)) {
        return res.status(403).json({ error: 'Only authorized managers can approve AI actions' });
      }
      const note = typeof req.body?.note === 'string' ? req.body.note.slice(0, 1000) : undefined;
      updated = await approvalRequestRepository.setStatus(user.tenantId, String(req.params.id), 'APPROVED', user.id, note);
      if (!updated) return res.status(404).json({ error: 'Approval request not found or already reviewed' });
      if (updated.channel === 'MINH_PROACTIVE') await recordMinhDecisionFeedbackSafely(user.tenantId, {
        eventKey: `approval:${updated.id}:approved`,
        sourceSignalId: updated.sourceSignalId,
        approvalRequestId: updated.id,
        actionType: updated.actionType,
        outcome: 'APPROVED',
        feedbackCategory: 'OPERATOR_APPROVED',
        createdBy: user.id,
      });
      const { executeApprovedAction } = await import('../services/approvalActionExecutor');
      const result = await executeApprovedAction(user.tenantId, updated.id, user.id);
      if (updated.channel === 'MINH_PROACTIVE') await recordMinhDecisionFeedbackSafely(user.tenantId, {
        eventKey: `approval:${updated.id}:executed`,
        sourceSignalId: updated.sourceSignalId,
        approvalRequestId: updated.id,
        actionType: updated.actionType,
        outcome: 'EXECUTED',
        feedbackCategory: 'NO_PROVIDER_SIDE_EFFECT',
        createdBy: user.id,
        metadata: { executed: result.executed === true },
      });
      res.json({ ...updated, resumeStatus: result.executed ? 'EXECUTED' : 'ALREADY_EXECUTED', result });
    } catch (error) {
      if (updated) {
        const user = (req as any).user;
        if (updated.channel === 'MINH_PROACTIVE') await recordMinhDecisionFeedbackSafely(user.tenantId, {
          eventKey: `approval:${updated.id}:execution_failed`,
          sourceSignalId: updated.sourceSignalId,
          approvalRequestId: updated.id,
          actionType: updated.actionType,
          outcome: 'EXECUTION_FAILED',
          feedbackCategory: 'NO_PROVIDER_SIDE_EFFECT',
          createdBy: user.id,
        });
      }
      console.error('[approval-requests] approve error:', error);
      res.status(500).json({ error: 'Failed to approve request' });
    }
  });

  router.post('/:id/reject', authenticateToken, validateUUIDParam(), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!APPROVAL_ROLES.has(user?.role)) {
        return res.status(403).json({ error: 'Only authorized managers can reject AI actions' });
      }
      const note = typeof req.body?.note === 'string' ? req.body.note.slice(0, 1000) : undefined;
      const updated = await approvalRequestRepository.setStatus(user.tenantId, String(req.params.id), 'REJECTED', user.id, note);
      if (!updated) return res.status(404).json({ error: 'Approval request not found or already reviewed' });
      if (updated.channel === 'MINH_PROACTIVE') await recordMinhDecisionFeedbackSafely(user.tenantId, {
        eventKey: `approval:${updated.id}:rejected`,
        sourceSignalId: updated.sourceSignalId,
        approvalRequestId: updated.id,
        actionType: updated.actionType,
        outcome: 'REJECTED',
        feedbackCategory: 'OPERATOR_REJECTED',
        createdBy: user.id,
        metadata: { hasReviewNote: Boolean(note?.trim()) },
      });
      res.json(updated);
    } catch (error) {
      console.error('[approval-requests] reject error:', error);
      res.status(500).json({ error: 'Failed to reject request' });
    }
  });

  return router;
}
