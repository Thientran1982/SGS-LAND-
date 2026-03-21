import { validateUUIDParam } from '../middleware/validation';
import { Router, Request, Response } from 'express';
import { contractRepository } from '../repositories/contractRepository';
import { auditRepository } from '../repositories/auditRepository';

export function createContractRoutes(authenticateToken: any) {
  const router = Router();

  router.get('/', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize = Math.max(1, Math.min(parseInt(req.query.pageSize as string) || 20, 200));

      const filters: any = {};
      if (req.query.status) filters.status = req.query.status;
      if (req.query.type) filters.type = req.query.type;
      if (req.query.leadId) filters.leadId = req.query.leadId;
      if (req.query.search) filters.search = req.query.search;

      const result = await contractRepository.findContracts(user.tenantId, { page, pageSize }, filters, user.id, user.role);
      res.json(result);
    } catch (error) {
      console.error('Error fetching contracts:', error);
      res.status(500).json({ error: 'Failed to fetch contracts' });
    }
  });

  router.get('/:id', authenticateToken, validateUUIDParam(), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const contract = await contractRepository.findById(user.tenantId, String(req.params.id));
      if (!contract) return res.status(404).json({ error: 'Contract not found' });

      const RESTRICTED = ['SALES', 'MARKETING', 'VIEWER'];
      if (RESTRICTED.includes(user.role) && (contract as any).createdById !== user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      res.json(contract);
    } catch (error) {
      console.error('Error fetching contract:', error);
      res.status(500).json({ error: 'Failed to fetch contract' });
    }
  });

  router.post('/', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { type } = req.body;

      if (!type) {
        return res.status(400).json({ error: 'Missing required fields: type' });
      }

      const contract = await contractRepository.create(user.tenantId, {
        ...req.body,
        createdBy: user.name || user.email,
        createdById: user.id,
      });

      await auditRepository.log(user.tenantId, {
        actorId: user.id,
        action: 'CREATE',
        entityType: 'CONTRACT',
        entityId: contract.id,
        details: `Created ${type} contract`,
        ipAddress: req.ip,
      });

      res.status(201).json(contract);
    } catch (error) {
      console.error('Error creating contract:', error);
      res.status(500).json({ error: 'Failed to create contract' });
    }
  });

  const CONTRACT_VALID_TRANSITIONS: Record<string, string[]> = {
    DRAFT: ['ACTIVE', 'CANCELLED'],
    ACTIVE: ['COMPLETED', 'CANCELLED'],
    COMPLETED: [],
    CANCELLED: [],
  };

  router.put('/:id', authenticateToken, validateUUIDParam(), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const RESTRICTED = ['SALES', 'MARKETING', 'VIEWER'];

      // Fetch the contract for state machine and ownership checks
      const current = await contractRepository.findById(user.tenantId, String(req.params.id));
      if (!current) return res.status(404).json({ error: 'Contract not found' });

      if (RESTRICTED.includes(user.role) && (current as any).createdById !== user.id) {
        return res.status(403).json({ error: 'You can only edit contracts you created' });
      }

      if (req.body.status) {
        const currentStatus = ((current as any).status || 'DRAFT').toUpperCase();
        const newStatus = String(req.body.status).toUpperCase();
        const allowed = CONTRACT_VALID_TRANSITIONS[currentStatus] ?? [];
        if (currentStatus !== newStatus && !allowed.includes(newStatus)) {
          return res.status(422).json({
            error: `Invalid status transition: ${currentStatus} → ${newStatus}`,
            allowed,
          });
        }
      }

      const contract = await contractRepository.update(user.tenantId, String(req.params.id), req.body);
      if (!contract) return res.status(404).json({ error: 'Contract not found' });

      await auditRepository.log(user.tenantId, {
        actorId: user.id,
        action: 'UPDATE',
        entityType: 'CONTRACT',
        entityId: String(req.params.id),
        details: `Updated contract fields: ${Object.keys(req.body).join(', ')}`,
        ipAddress: req.ip,
      });

      res.json(contract);
    } catch (error) {
      console.error('Error updating contract:', error);
      res.status(500).json({ error: 'Failed to update contract' });
    }
  });

  router.delete('/:id', authenticateToken, validateUUIDParam(), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;

      const contract = await contractRepository.findById(user.tenantId, String(req.params.id));
      if (!contract) return res.status(404).json({ error: 'Contract not found' });

      const isAdmin = ['ADMIN', 'MANAGER'].includes(user.role);
      const isOwner = (contract as any).createdById === user.id;
      if (!isAdmin && !isOwner) {
        return res.status(403).json({ error: 'You can only delete contracts you created' });
      }

      await contractRepository.deleteById(user.tenantId, String(req.params.id));

      await auditRepository.log(user.tenantId, {
        actorId: user.id,
        action: 'DELETE',
        entityType: 'CONTRACT',
        entityId: String(req.params.id),
        details: `Deleted contract`,
        ipAddress: req.ip,
      });

      res.status(204).send();
    } catch (error) {
      console.error('Error deleting contract:', error);
      res.status(500).json({ error: 'Failed to delete contract' });
    }
  });

  return router;
}
