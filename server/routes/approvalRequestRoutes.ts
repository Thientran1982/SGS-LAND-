import { Router, Request, Response } from 'express';
import { approvalRequestRepository } from '../repositories/approvalRequestRepository';
import { validateUUIDParam } from '../middleware/validation';

/**
 * Permission Broker API: danh sach + duyet/tu choi cac approval_requests
 * (hanh dong AI high-impact dang cho duyet). Dung cho tab moi trong Inbox.
 */
export function createApprovalRequestRoutes(authenticateToken: any) {
  const router = Router();

  router.get('/', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(user?.role)) {
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
    try {
      const user = (req as any).user;
      const note = typeof req.body?.note === 'string' ? req.body.note.slice(0, 1000) : undefined;
      const updated = await approvalRequestRepository.setStatus(user.tenantId, String(req.params.id), 'APPROVED', user.id, note);
      if (!updated) return res.status(404).json({ error: 'Approval request not found or already reviewed' });
      const { executeApprovedAction } = await import('../services/approvalActionExecutor');
      const result = await executeApprovedAction(user.tenantId, updated.id, user.id);
      res.json({ ...updated, resumeStatus: result.executed ? 'EXECUTED' : 'ALREADY_EXECUTED', result });
    } catch (error) {
      console.error('[approval-requests] approve error:', error);
      res.status(500).json({ error: 'Failed to approve request' });
    }
  });

  router.post('/:id/reject', authenticateToken, validateUUIDParam(), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(user?.role)) {
        return res.status(403).json({ error: 'Only authorized managers can reject AI actions' });
      }
      const note = typeof req.body?.note === 'string' ? req.body.note.slice(0, 1000) : undefined;
      const updated = await approvalRequestRepository.setStatus(user.tenantId, String(req.params.id), 'REJECTED', user.id, note);
      if (!updated) return res.status(404).json({ error: 'Approval request not found or already reviewed' });
      res.json(updated);
    } catch (error) {
      console.error('[approval-requests] reject error:', error);
      res.status(500).json({ error: 'Failed to reject request' });
    }
  });

  return router;
}
