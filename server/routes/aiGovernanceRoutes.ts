import { Router, Request, Response } from 'express';
import { aiGovernanceRepository } from '../repositories/aiGovernanceRepository';

export function createAiGovernanceRoutes(authenticateToken: any) {
  const router = Router();

  router.get('/safety-logs', authenticateToken, async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).tenantId || (req as any).user?.tenantId;
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 50;
      const result = await aiGovernanceRepository.getSafetyLogs(tenantId, page, pageSize);
      res.json(result);
    } catch (error) {
      console.error('Error fetching AI safety logs:', error);
      res.status(500).json({ error: 'Failed to fetch AI safety logs' });
    }
  });

  router.get('/prompt-templates', authenticateToken, async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).tenantId || (req as any).user?.tenantId;
      const templates = await aiGovernanceRepository.getPromptTemplates(tenantId);
      res.json(templates);
    } catch (error) {
      console.error('Error fetching prompt templates:', error);
      res.status(500).json({ error: 'Failed to fetch prompt templates' });
    }
  });

  router.post('/prompt-templates', authenticateToken, async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).tenantId || (req as any).user?.tenantId;
      const user = (req as any).user;
      if (user?.role !== 'ADMIN' && user?.role !== 'TEAM_LEAD') {
        return res.status(403).json({ error: 'Only admins can create prompt templates' });
      }
      const template = await aiGovernanceRepository.createPromptTemplate(tenantId, req.body);
      res.status(201).json(template);
    } catch (error) {
      console.error('Error creating prompt template:', error);
      res.status(500).json({ error: 'Failed to create prompt template' });
    }
  });

  router.put('/prompt-templates/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).tenantId || (req as any).user?.tenantId;
      const user = (req as any).user;
      if (user?.role !== 'ADMIN' && user?.role !== 'TEAM_LEAD') {
        return res.status(403).json({ error: 'Only admins can update prompt templates' });
      }
      const template = await aiGovernanceRepository.updatePromptTemplate(tenantId, req.params.id as string, req.body);
      if (!template) return res.status(404).json({ error: 'Template not found' });
      res.json(template);
    } catch (error) {
      console.error('Error updating prompt template:', error);
      res.status(500).json({ error: 'Failed to update prompt template' });
    }
  });

  router.delete('/prompt-templates/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).tenantId || (req as any).user?.tenantId;
      const user = (req as any).user;
      if (user?.role !== 'ADMIN' && user?.role !== 'TEAM_LEAD') {
        return res.status(403).json({ error: 'Only admins can delete prompt templates' });
      }
      const deleted = await aiGovernanceRepository.deletePromptTemplate(tenantId, req.params.id as string);
      if (!deleted) return res.status(404).json({ error: 'Template not found' });
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting prompt template:', error);
      res.status(500).json({ error: 'Failed to delete prompt template' });
    }
  });

  router.get('/config', authenticateToken, async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).tenantId || (req as any).user?.tenantId;
      const config = await aiGovernanceRepository.getAiConfig(tenantId);
      res.json(config);
    } catch (error) {
      console.error('Error fetching AI config:', error);
      res.status(500).json({ error: 'Failed to fetch AI config' });
    }
  });

  router.put('/config', authenticateToken, async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).tenantId || (req as any).user?.tenantId;
      const user = (req as any).user;
      if (user?.role !== 'ADMIN' && user?.role !== 'TEAM_LEAD') {
        return res.status(403).json({ error: 'Only admins can update AI config' });
      }
      const config = await aiGovernanceRepository.upsertAiConfig(tenantId, req.body);
      res.json(config);
    } catch (error) {
      console.error('Error updating AI config:', error);
      res.status(500).json({ error: 'Failed to update AI config' });
    }
  });

  return router;
}
