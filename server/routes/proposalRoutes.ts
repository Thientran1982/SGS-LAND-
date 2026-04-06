import { validateUUIDParam } from '../middleware/validation';
import { Router, Request, Response } from 'express';
import { proposalRepository } from '../repositories/proposalRepository';
import { auditRepository } from '../repositories/auditRepository';
import { notificationRepository } from '../repositories/notificationRepository';
import { amlProposalCheck, requireAmlClearance } from '../middleware/aml';

export function createProposalRoutes(authenticateToken: any, getBroadcast?: () => any) {
  const router = Router();

  router.get('/', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize = Math.max(1, Math.min(parseInt(req.query.pageSize as string) || 20, 200));

      const filters: any = {};
      if (req.query.status) filters.status = req.query.status;
      if (req.query.statuses) filters.status_in = (req.query.statuses as string).split(',');
      if (req.query.leadId) filters.leadId = req.query.leadId;
      if (req.query.listingId) filters.listingId = req.query.listingId;

      const result = await proposalRepository.findProposals(
        user.tenantId, { page, pageSize }, filters, user.id, user.role
      );
      res.json(result);
    } catch (error) {
      console.error('Error fetching proposals:', error);
      res.status(500).json({ error: 'Failed to fetch proposals' });
    }
  });

  router.get('/pending', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const proposals = await proposalRepository.getPendingApprovals(user.tenantId, user.id, user.role);
      res.json(proposals);
    } catch (error) {
      console.error('Error fetching pending proposals:', error);
      res.status(500).json({ error: 'Failed to fetch pending proposals' });
    }
  });

  router.get('/token/:token', async (req: Request, res: Response) => {
    try {
      // Global lookup — token is the only credential needed (no tenantId from caller).
      const proposal = await proposalRepository.findByTokenGlobal(String(req.params.token));
      // Always return 200 even when not found — prevents token enumeration attacks
      if (!proposal) return res.status(200).json({ found: false });
      res.json({ found: true, ...proposal });
    } catch (error) {
      console.error('Error fetching proposal by token:', error);
      res.status(500).json({ error: 'Failed to fetch proposal' });
    }
  });

  // Public endpoint — customer signals interest. No auth required; token is the credential.
  router.post('/token/:token/interest', async (req: Request, res: Response) => {
    try {
      const proposal = await proposalRepository.findByTokenGlobal(String(req.params.token));
      if (!proposal) return res.status(404).json({ error: 'Proposal not found' });

      // Only allow interest on approved (sent-to-customer) proposals that are not expired
      const now = new Date();
      const isExpired = proposal.validUntil && new Date(proposal.validUntil) < now;
      if (isExpired) return res.status(400).json({ error: 'Proposal has expired' });
      if (proposal.status === 'ACCEPTED') return res.status(200).json({ alreadyAccepted: true });

      // Update to ACCEPTED using the proposal's own tenantId
      await proposalRepository.updateStatus((proposal as any).tenantId, proposal.id, 'ACCEPTED');

      const leadName = (proposal as any).leadName || 'Khách hàng';
      const listingTitle = (proposal as any).listingTitle || '';

      // Persist notification to DB so agent can review it later
      if ((proposal as any).createdById && (proposal as any).tenantId) {
        await notificationRepository.create({
          tenantId: (proposal as any).tenantId,
          userId: (proposal as any).createdById,
          type: 'PROPOSAL_INTEREST',
          title: leadName,
          body: listingTitle,
          metadata: {
            proposalId: proposal.id,
            leadId: (proposal as any).leadId,
            leadName,
            listingTitle,
          },
        });
      }

      // Notify the agent who created this proposal via Socket.io (real-time)
      const io = getBroadcast?.();
      if (io && (proposal as any).createdById) {
        io.to(`user:${(proposal as any).createdById}`).emit('proposal_interest', {
          proposalId: proposal.id,
          leadId: (proposal as any).leadId,
          leadName,
          listingTitle,
        });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error recording proposal interest:', error);
      res.status(500).json({ error: 'Failed to record interest' });
    }
  });

  router.get('/:id', authenticateToken, validateUUIDParam(), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const proposal = await proposalRepository.findById(user.tenantId, String(req.params.id));
      if (!proposal) return res.status(404).json({ error: 'Proposal not found' });

      const RESTRICTED = ['SALES', 'MARKETING', 'VIEWER'];
      if (RESTRICTED.includes(user.role) && (proposal as any).createdById !== user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      res.json(proposal);
    } catch (error) {
      console.error('Error fetching proposal:', error);
      res.status(500).json({ error: 'Failed to fetch proposal' });
    }
  });

  router.post('/', authenticateToken, amlProposalCheck, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { leadId, listingId, basePrice, discountAmount, finalPrice, currency, validUntil, metadata } = req.body;

      if (!leadId || !listingId || !basePrice || !finalPrice) {
        return res.status(400).json({ error: 'Missing required fields: leadId, listingId, basePrice, finalPrice' });
      }

      const bpNum = Number(basePrice);
      const fpNum = Number(finalPrice);
      const discNum = Number(discountAmount || 0);
      if (isNaN(bpNum) || bpNum <= 0) return res.status(400).json({ error: 'Invalid basePrice: must be a positive number' });
      if (isNaN(fpNum) || fpNum <= 0) return res.status(400).json({ error: 'Invalid finalPrice: must be a positive number' });
      if (isNaN(discNum) || discNum < 0) return res.status(400).json({ error: 'Invalid discountAmount: must be a non-negative number' });
      if (discNum >= bpNum) return res.status(400).json({ error: 'discountAmount must be less than basePrice' });
      if (fpNum > bpNum) return res.status(400).json({ error: 'finalPrice cannot exceed basePrice' });

      const amlCheck = (req as any).amlCheck;

      const proposal = await proposalRepository.create(user.tenantId, {
        leadId, listingId, basePrice,
        discountAmount: discountAmount || 0,
        finalPrice, currency,
        validUntil,
        createdBy: user.name || user.email,
        createdById: user.id,
        metadata,
      });

      await auditRepository.log(user.tenantId, {
        actorId: user.id,
        action: 'CREATE',
        entityType: 'PROPOSAL',
        entityId: proposal.id,
        details: `Created proposal for lead ${leadId} - Status: ${proposal.status}${amlCheck?.required ? ` [AML: ${amlCheck.status}, score=${amlCheck.riskScore}]` : ''}`,
        ipAddress: req.ip,
      });

      const responseBody: any = { ...proposal };
      if (amlCheck?.required) {
        responseBody.amlCheck = {
          status: amlCheck.status,
          riskScore: amlCheck.riskScore,
          reasons: amlCheck.reasons,
          message: amlCheck.status === 'PENDING'
            ? 'Giao dịch giá trị cao — cần xem xét AML trước khi phê duyệt.'
            : amlCheck.status === 'FLAGGED'
              ? 'Cảnh báo AML: giao dịch có dấu hiệu rủi ro cao, cần kiểm tra thủ công.'
              : undefined,
        };
      }

      res.status(201).json(responseBody);
    } catch (error) {
      console.error('Error creating proposal:', error);
      res.status(500).json({ error: 'Failed to create proposal' });
    }
  });

  router.put('/:id/status', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { status, reason } = req.body;

      if (!['APPROVED', 'REJECTED', 'SENT', 'EXPIRED'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      if (status === 'APPROVED' && user.role !== 'ADMIN' && user.role !== 'TEAM_LEAD') {
        return res.status(403).json({ error: 'Only admins and team leads can approve proposals' });
      }

      // AML clearance check before APPROVED
      if (status === 'APPROVED') {
        const existing = await proposalRepository.findById(user.tenantId, String(req.params.id));
        if (existing) {
          (req as any).proposalForAml = existing;
          const { requireAmlClearance: checkAml } = await import('../middleware/aml');
          const blocked = await new Promise<boolean>((resolve) => {
            checkAml(req, res, () => resolve(false));
            // If res.headersSent after calling checkAml, it blocked the request
            if (res.headersSent) resolve(true);
          });
          if (blocked || res.headersSent) return;
        }
      }

      const proposal = await proposalRepository.updateStatus(user.tenantId, String(req.params.id), status);
      if (!proposal) return res.status(404).json({ error: 'Proposal not found' });

      await auditRepository.log(user.tenantId, {
        actorId: user.id,
        action: 'UPDATE_STATUS',
        entityType: 'PROPOSAL',
        entityId: String(req.params.id),
        details: status === 'REJECTED' && reason ? `Changed proposal status to: ${status}. Reason: ${reason}` : `Changed proposal status to: ${status}`,
        ipAddress: req.ip,
      });

      if (status === 'APPROVED' && (proposal as any).createdById) {
        // Persist to DB so the bell shows it even when agent was offline
        notificationRepository.create({
          tenantId: user.tenantId,
          userId: (proposal as any).createdById,
          type: 'PROPOSAL_APPROVED',
          title: 'Proposal được duyệt',
          body: (proposal as any).leadName || undefined,
          metadata: {
            proposalId: (proposal as any).id,
            leadId: (proposal as any).leadId,
            token: (proposal as any).token,
          },
        }).catch(() => {});

        const io = getBroadcast?.();
        if (io) {
          io.to(`user:${(proposal as any).createdById}`).emit('proposal_approved', {
            proposalId: (proposal as any).id,
            token: (proposal as any).token,
            leadId: (proposal as any).leadId,
          });
        }
      }

      res.json(proposal);
    } catch (error) {
      console.error('Error updating proposal status:', error);
      res.status(500).json({ error: 'Failed to update proposal' });
    }
  });

  // PATCH /:id/aml — allow ADMIN/TEAM_LEAD to manually set AML clearance
  router.patch('/:id/aml', authenticateToken, validateUUIDParam(), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'ADMIN' && user.role !== 'TEAM_LEAD') {
        return res.status(403).json({ error: 'Only admins and team leads can update AML status' });
      }

      const { amlVerified, amlNotes } = req.body;
      if (typeof amlVerified !== 'boolean') {
        return res.status(400).json({ error: 'amlVerified (boolean) is required' });
      }

      const proposal = await proposalRepository.updateAml(user.tenantId, String(req.params.id), { amlVerified, amlNotes });
      if (!proposal) return res.status(404).json({ error: 'Proposal not found' });

      await auditRepository.log(user.tenantId, {
        actorId: user.id,
        action: 'AML_REVIEW',
        entityType: 'PROPOSAL',
        entityId: String(req.params.id),
        details: `AML review: amlVerified=${amlVerified}${amlNotes ? `, notes: ${amlNotes}` : ''}`,
        ipAddress: req.ip,
      });

      res.json(proposal);
    } catch (error) {
      console.error('Error updating AML status:', error);
      res.status(500).json({ error: 'Failed to update AML status' });
    }
  });

  router.delete('/:id', authenticateToken, validateUUIDParam(), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const proposal = await proposalRepository.findById(user.tenantId, String(req.params.id));
      if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
      if (proposal.status !== 'DRAFT') {
        return res.status(400).json({ error: 'Only draft proposals can be deleted' });
      }

      await proposalRepository.deleteById(user.tenantId, String(req.params.id));

      await auditRepository.log(user.tenantId, {
        actorId: user.id,
        action: 'DELETE',
        entityType: 'PROPOSAL',
        entityId: String(req.params.id),
        ipAddress: req.ip,
      });

      res.json({ message: 'Proposal deleted' });
    } catch (error) {
      console.error('Error deleting proposal:', error);
      res.status(500).json({ error: 'Failed to delete proposal' });
    }
  });

  return router;
}
