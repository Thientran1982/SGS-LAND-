import { validateUUIDParam } from '../middleware/validation';
import { Router, Request, Response } from 'express';
import { proposalRepository } from '../repositories/proposalRepository';
import { auditRepository } from '../repositories/auditRepository';

export function createProposalRoutes(authenticateToken: any) {
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
      const proposal = await proposalRepository.findByTokenGlobal(req.params.token);
      if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
      res.json(proposal);
    } catch (error) {
      console.error('Error fetching proposal by token:', error);
      res.status(500).json({ error: 'Failed to fetch proposal' });
    }
  });

  router.get('/:id', authenticateToken, validateUUIDParam(), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const proposal = await proposalRepository.findById(user.tenantId, req.params.id);
      if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
      res.json(proposal);
    } catch (error) {
      console.error('Error fetching proposal:', error);
      res.status(500).json({ error: 'Failed to fetch proposal' });
    }
  });

  router.post('/', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { leadId, listingId, basePrice, discountAmount, finalPrice, currency, validUntil, metadata } = req.body;

      if (!leadId || !listingId || !basePrice || !finalPrice) {
        return res.status(400).json({ error: 'Missing required fields: leadId, listingId, basePrice, finalPrice' });
      }

      const bpNum = Number(basePrice);
      const fpNum = Number(finalPrice);
      const discNum = Number(discountAmount || 0);
      if (isNaN(bpNum) || bpNum < 0) return res.status(400).json({ error: 'Invalid basePrice: must be a non-negative number' });
      if (isNaN(fpNum) || fpNum < 0) return res.status(400).json({ error: 'Invalid finalPrice: must be a non-negative number' });
      if (isNaN(discNum) || discNum < 0) return res.status(400).json({ error: 'Invalid discountAmount: must be a non-negative number' });

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
        details: `Created proposal for lead ${leadId} - Status: ${proposal.status}`,
        ipAddress: req.ip,
      });

      res.status(201).json(proposal);
    } catch (error) {
      console.error('Error creating proposal:', error);
      res.status(500).json({ error: 'Failed to create proposal' });
    }
  });

  router.put('/:id/status', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { status } = req.body;

      if (!['APPROVED', 'REJECTED', 'SENT', 'EXPIRED'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      if (status === 'APPROVED' && user.role !== 'ADMIN' && user.role !== 'TEAM_LEAD') {
        return res.status(403).json({ error: 'Only admins and team leads can approve proposals' });
      }

      const proposal = await proposalRepository.updateStatus(user.tenantId, req.params.id, status);
      if (!proposal) return res.status(404).json({ error: 'Proposal not found' });

      await auditRepository.log(user.tenantId, {
        actorId: user.id,
        action: 'UPDATE_STATUS',
        entityType: 'PROPOSAL',
        entityId: req.params.id,
        details: `Changed proposal status to: ${status}`,
        ipAddress: req.ip,
      });

      res.json(proposal);
    } catch (error) {
      console.error('Error updating proposal status:', error);
      res.status(500).json({ error: 'Failed to update proposal' });
    }
  });

  router.delete('/:id', authenticateToken, validateUUIDParam(), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const proposal = await proposalRepository.findById(user.tenantId, req.params.id);
      if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
      if (proposal.status !== 'DRAFT') {
        return res.status(400).json({ error: 'Only draft proposals can be deleted' });
      }

      await proposalRepository.deleteById(user.tenantId, req.params.id);

      await auditRepository.log(user.tenantId, {
        actorId: user.id,
        action: 'DELETE',
        entityType: 'PROPOSAL',
        entityId: req.params.id,
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
