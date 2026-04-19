import { Router, Request, Response } from 'express';
import { sessionRepository } from '../repositories/sessionRepository';
import { templateRepository } from '../repositories/templateRepository';

export function createSessionRoutes(authenticateToken: any) {
  const router = Router();

  router.get('/', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const sessions = await sessionRepository.findAllActive(user.tenantId);
      res.json(sessions);
    } catch (error) {
      console.error('Error fetching sessions:', error);
      res.status(500).json({ error: 'Failed to fetch sessions' });
    }
  });

  router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const deleted = await sessionRepository.revoke(user.tenantId, req.params.id as string);
      if (!deleted) return res.status(404).json({ error: 'Session not found' });
      res.json({ message: 'Session revoked' });
    } catch (error) {
      console.error('Error revoking session:', error);
      res.status(500).json({ error: 'Failed to revoke session' });
    }
  });

  return router;
}

export function createTemplateRoutes(authenticateToken: any) {
  const router = Router();

  router.get('/', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const category = req.query.category as string | undefined;
      const templates = await templateRepository.findAllTemplates(user.tenantId, category);
      res.json(templates);
    } catch (error) {
      console.error('Error fetching templates:', error);
      res.status(500).json({ error: 'Failed to fetch templates' });
    }
  });

  router.post('/', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD'].includes(user.role)) {
        return res.status(403).json({ error: 'Only admins and team leads can create templates' });
      }

      const { name, category, content, variables } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'Name is required' });
      }

      const template = await templateRepository.create(user.tenantId, {
        name, category, content, variables,
      });
      res.status(201).json(template);
    } catch (error) {
      console.error('Error creating template:', error);
      res.status(500).json({ error: 'Failed to create template' });
    }
  });

  router.put('/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD'].includes(user.role)) {
        return res.status(403).json({ error: 'Only admins and team leads can update templates' });
      }

      const template = await templateRepository.update(user.tenantId, req.params.id as string, req.body);
      if (!template) return res.status(404).json({ error: 'Template not found' });
      res.json(template);
    } catch (error) {
      console.error('Error updating template:', error);
      res.status(500).json({ error: 'Failed to update template' });
    }
  });

  router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD'].includes(user.role)) {
        return res.status(403).json({ error: 'Only admins and team leads can delete templates' });
      }

      const deleted = await templateRepository.deleteById(user.tenantId, req.params.id as string);
      if (!deleted) return res.status(404).json({ error: 'Template not found' });
      res.json({ message: 'Template deleted' });
    } catch (error) {
      console.error('Error deleting template:', error);
      res.status(500).json({ error: 'Failed to delete template' });
    }
  });

  return router;
}
