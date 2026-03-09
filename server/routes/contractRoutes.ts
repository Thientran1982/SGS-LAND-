import { Router, Request, Response } from 'express';
import { contractRepository } from '../repositories/contractRepository';
import { auditRepository } from '../repositories/auditRepository';

export function createContractRoutes(authenticateToken: any) {
  const router = Router();

  router.get('/', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;

      const filters: any = {};
      if (req.query.status) filters.status = req.query.status;
      if (req.query.type) filters.type = req.query.type;
      if (req.query.leadId) filters.leadId = req.query.leadId;
      if (req.query.search) filters.search = req.query.search;

      const result = await contractRepository.findContracts(user.tenantId, { page, pageSize }, filters);
      res.json(result);
    } catch (error) {
      console.error('Error fetching contracts:', error);
      res.status(500).json({ error: 'Failed to fetch contracts' });
    }
  });

  router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const contract = await contractRepository.findById(user.tenantId, req.params.id);
      if (!contract) return res.status(404).json({ error: 'Contract not found' });
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

  router.put('/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const contract = await contractRepository.update(user.tenantId, req.params.id, req.body);
      if (!contract) return res.status(404).json({ error: 'Contract not found' });

      await auditRepository.log(user.tenantId, {
        actorId: user.id,
        action: 'UPDATE',
        entityType: 'CONTRACT',
        entityId: req.params.id,
        details: `Updated contract fields: ${Object.keys(req.body).join(', ')}`,
        ipAddress: req.ip,
      });

      res.json(contract);
    } catch (error) {
      console.error('Error updating contract:', error);
      res.status(500).json({ error: 'Failed to update contract' });
    }
  });

  return router;
}
