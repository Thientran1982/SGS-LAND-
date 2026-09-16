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
      const [items, pendingCount, approvedOutreach] = await Promise.all([
        approvalRequestRepository.findPendingByTenant(user.tenantId, 50),
        approvalRequestRepository.countPending(user.tenantId),
        approvalRequestRepository.findApprovedOutreachByTenant(user.tenantId, 50),
      ]);
      res.json({ items, pendingCount, approvedOutreach });
    } catch (error) {
      console.error('[approval-requests] list error:', error);
      res.status(500).json({ error: 'Failed to fetch approval requests' });
    }
  });

  router.post('/:id/send', authenticateToken, validateUUIDParam(), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!APPROVAL_ROLES.has(user?.role)) {
        return res.status(403).json({ error: 'Only authorized managers can send approved AI actions' });
      }
      const variantId = typeof req.body?.variantId === 'string' ? req.body.variantId.trim() : '';
      const { sendApprovedOutreachVariant } = await import('../services/outreachManualSendService');
      const result = await sendApprovedOutreachVariant(
        String(user.tenantId),
        String(req.params.id),
        variantId,
        String(user.id),
      );
      return res.json(result);
    } catch (error: any) {
      const code = String(error?.message || 'OUTREACH_SEND_FAILED');
      const status = new Set([
        'OUTREACH_APPROVAL_NOT_FOUND',
        'OUTREACH_VARIANT_NOT_FOUND',
        'OUTREACH_VARIANT_REQUIRED',
        'OUTREACH_EMAIL_REQUIRED',
        'OUTREACH_ZALO_ID_REQUIRED',
      ]).has(code) ? 404
        : new Set([
          'OUTREACH_APPROVAL_NOT_APPROVED',
          'OUTREACH_APPROVAL_EXPIRED',
          'OUTREACH_CONSENT_REVOKED',
          'OUTREACH_CALL_SCRIPT_MANUAL_ONLY',
          'OUTREACH_CHANNEL_INVALID',
          'OUTREACH_CONTENT_EMPTY',
        ]).has(code) ? 409
          : new Set([
            'OUTREACH_SEND_IN_PROGRESS',
            'OUTREACH_DELIVERY_UNKNOWN',
            'OUTREACH_DELIVERY_FAILED',
          ]).has(code) ? 409
            : 500;
      console.error('[approval-requests] outreach send error:', code);
      return res.status(status).json({ error: code });
    }
  });

  router.post('/:id/delivery-lookup', authenticateToken, validateUUIDParam(), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!APPROVAL_ROLES.has(user?.role)) {
        return res.status(403).json({ error: 'Only authorized managers can reconcile outreach deliveries' });
      }
      const variantId = typeof req.body?.variantId === 'string' ? req.body.variantId.trim() : '';
      if (!variantId) return res.status(400).json({ error: 'OUTREACH_VARIANT_REQUIRED' });
      const { lookupApprovedOutreachDelivery } = await import('../services/outreachManualSendService');
      return res.json(await lookupApprovedOutreachDelivery(
        String(user.tenantId),
        String(req.params.id),
        variantId,
        String(user.id),
      ));
    } catch (error: any) {
      const code = String(error?.message || 'OUTREACH_DELIVERY_LOOKUP_FAILED');
      const status = new Set([
        'OUTREACH_DELIVERY_NOT_FOUND',
        'OUTREACH_VARIANT_REQUIRED',
      ]).has(code) ? 404 : 409;
      console.error('[approval-requests] outreach delivery lookup error:', code);
      return res.status(status).json({ error: code });
    }
  });

  router.post('/:id/reconcile', authenticateToken, validateUUIDParam(), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!APPROVAL_ROLES.has(user?.role)) {
        return res.status(403).json({ error: 'Only authorized managers can reconcile outreach deliveries' });
      }
      const variantId = typeof req.body?.variantId === 'string' ? req.body.variantId.trim() : '';
      const status = req.body?.status;
      const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
      if (!variantId || !['SENT', 'FAILED'].includes(status) || !note) {
        return res.status(400).json({ error: 'variantId, status SENT|FAILED, and note are required' });
      }
      const { reconcileApprovedOutreachDelivery } = await import('../services/outreachManualSendService');
      return res.json(await reconcileApprovedOutreachDelivery({
        tenantId: String(user.tenantId),
        approvalId: String(req.params.id),
        variantId,
        status,
        note,
        providerMessageId: typeof req.body?.providerMessageId === 'string'
          ? req.body.providerMessageId.trim()
          : undefined,
        operatorId: String(user.id),
      }));
    } catch (error: any) {
      const code = String(error?.message || 'OUTREACH_DELIVERY_RECONCILE_FAILED');
      const status = new Set([
        'OUTREACH_DELIVERY_NOT_FOUND',
        'OUTREACH_RECONCILIATION_NOTE_REQUIRED',
      ]).has(code) ? 400
        : new Set(['OUTREACH_DELIVERY_ALREADY_RESOLVED']).has(code) ? 409
          : 500;
      console.error('[approval-requests] outreach delivery reconcile error:', code);
      return res.status(status).json({ error: code });
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
      // Week 5 rule: a Minh proactive suggestion that gets rejected must
      // record why, so the false-positive rate is actually reviewable.
      const existingForReject = await approvalRequestRepository.findById(user.tenantId, String(req.params.id));
      if (existingForReject?.channel === 'MINH_PROACTIVE'
        && existingForReject.status === 'PENDING'
        && !note?.trim()) {
        return res.status(400).json({ error: 'A reason is required when rejecting a Minh proactive suggestion' });
      }
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
