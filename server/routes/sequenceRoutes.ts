import { Router, Request, Response } from 'express';
import { sequenceRepository } from '../repositories/sequenceRepository';

export function createSequenceRoutes(authenticateToken: any) {
  const router = Router();

  router.get('/', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const sequences = await sequenceRepository.findAllSequences(user.tenantId);
      res.json(sequences);
    } catch (error) {
      console.error('Error fetching sequences:', error);
      res.status(500).json({ error: 'Failed to fetch sequences' });
    }
  });

  router.post('/', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'ADMIN' && user.role !== 'TEAM_LEAD') {
        return res.status(403).json({ error: 'Only admins and team leads can create sequences' });
      }

      const { name, triggerEvent, steps, isActive } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'Name is required' });
      }

      const sequence = await sequenceRepository.create(user.tenantId, {
        name, triggerEvent, steps, isActive,
      });
      res.status(201).json(sequence);
    } catch (error) {
      console.error('Error creating sequence:', error);
      res.status(500).json({ error: 'Failed to create sequence' });
    }
  });

  router.put('/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'ADMIN' && user.role !== 'TEAM_LEAD') {
        return res.status(403).json({ error: 'Only admins and team leads can update sequences' });
      }

      const sequence = await sequenceRepository.update(user.tenantId, req.params.id as string, req.body);
      if (!sequence) return res.status(404).json({ error: 'Sequence not found' });
      res.json(sequence);
    } catch (error) {
      console.error('Error updating sequence:', error);
      res.status(500).json({ error: 'Failed to update sequence' });
    }
  });

  router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'ADMIN' && user.role !== 'TEAM_LEAD') {
        return res.status(403).json({ error: 'Only admins and team leads can delete sequences' });
      }

      const deleted = await sequenceRepository.deleteById(user.tenantId, req.params.id as string);
      if (!deleted) return res.status(404).json({ error: 'Sequence not found' });
      res.json({ message: 'Sequence deleted' });
    } catch (error) {
      console.error('Error deleting sequence:', error);
      res.status(500).json({ error: 'Failed to delete sequence' });
    }
  });

  return router;
}
