import { validateUUIDParam } from '../middleware/validation';
import { Router, Request, Response } from 'express';
import { sequenceRepository } from '../repositories/sequenceRepository';
import { emailService } from '../services/emailService';

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

  router.put('/:id', authenticateToken, validateUUIDParam(), async (req: Request, res: Response) => {
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

  router.post('/:id/execute', authenticateToken, validateUUIDParam(), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'ADMIN' && user.role !== 'TEAM_LEAD') {
        return res.status(403).json({ error: 'Only admins and team leads can execute sequences' });
      }
      const sequence = await sequenceRepository.findById(user.tenantId, req.params.id as string);
      if (!sequence) return res.status(404).json({ error: 'Sequence not found' });
      if (!sequence.isActive) return res.status(400).json({ error: 'Sequence is not active' });

      const { lead } = req.body;
      if (!lead || !lead.email) {
        return res.status(400).json({ error: 'Lead with email is required' });
      }

      const results: Array<{ step: number; type: string; status: string; error?: string }> = [];

      for (let i = 0; i < (sequence.steps || []).length; i++) {
        const step = sequence.steps[i];
        try {
          if (step.type === 'EMAIL') {
            const subject = (step.subject || step.template || 'SGS LAND Notification')
              .replace(/\{\{name\}\}/g, lead.name || '')
              .replace(/\{\{email\}\}/g, lead.email || '');
            const content = (step.content || step.body || '')
              .replace(/\{\{name\}\}/g, lead.name || '')
              .replace(/\{\{email\}\}/g, lead.email || '');

            const emailResult = await emailService.sendSequenceEmail(
              user.tenantId, lead.email, subject, content
            );
            results.push({ step: i, type: 'EMAIL', status: emailResult.success ? 'sent' : 'failed', error: emailResult.error });
          } else if (step.type === 'WAIT') {
            results.push({ step: i, type: 'WAIT', status: 'skipped' });
          } else {
            results.push({ step: i, type: step.type, status: 'skipped' });
          }
        } catch (err: any) {
          results.push({ step: i, type: step.type, status: 'error', error: err.message });
        }
      }

      res.json({ message: 'Sequence executed', results });
    } catch (error) {
      console.error('Error executing sequence:', error);
      res.status(500).json({ error: 'Failed to execute sequence' });
    }
  });

  router.delete('/:id', authenticateToken, validateUUIDParam(), async (req: Request, res: Response) => {
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
