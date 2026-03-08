import { Router, Request, Response } from 'express';
import { routingRuleRepository } from '../repositories/routingRuleRepository';

export function createRoutingRuleRoutes(authenticateToken: any) {
  const router = Router();

  router.get('/', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const rules = await routingRuleRepository.findAllRules(user.tenantId);
      res.json(rules);
    } catch (error) {
      console.error('Error fetching routing rules:', error);
      res.status(500).json({ error: 'Failed to fetch routing rules' });
    }
  });

  router.post('/', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'ADMIN' && user.role !== 'TEAM_LEAD') {
        return res.status(403).json({ error: 'Only admins and team leads can create routing rules' });
      }

      const { name, conditions, action, priority, isActive } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'Name is required' });
      }

      const rule = await routingRuleRepository.create(user.tenantId, {
        name, conditions, action, priority, isActive,
      });
      res.status(201).json(rule);
    } catch (error) {
      console.error('Error creating routing rule:', error);
      res.status(500).json({ error: 'Failed to create routing rule' });
    }
  });

  router.put('/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'ADMIN' && user.role !== 'TEAM_LEAD') {
        return res.status(403).json({ error: 'Only admins and team leads can update routing rules' });
      }

      const rule = await routingRuleRepository.update(user.tenantId, req.params.id as string, req.body);
      if (!rule) return res.status(404).json({ error: 'Routing rule not found' });
      res.json(rule);
    } catch (error) {
      console.error('Error updating routing rule:', error);
      res.status(500).json({ error: 'Failed to update routing rule' });
    }
  });

  router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'ADMIN' && user.role !== 'TEAM_LEAD') {
        return res.status(403).json({ error: 'Only admins and team leads can delete routing rules' });
      }

      const deleted = await routingRuleRepository.deleteById(user.tenantId, req.params.id as string);
      if (!deleted) return res.status(404).json({ error: 'Routing rule not found' });
      res.json({ message: 'Routing rule deleted' });
    } catch (error) {
      console.error('Error deleting routing rule:', error);
      res.status(500).json({ error: 'Failed to delete routing rule' });
    }
  });

  return router;
}
