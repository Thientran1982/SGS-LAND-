import { Router, Request, Response } from 'express';
import { leadRepository } from '../repositories/leadRepository';
import { auditRepository } from '../repositories/auditRepository';
import { routingRuleRepository } from '../repositories/routingRuleRepository';

export function createLeadRoutes(authenticateToken: any) {
  const router = Router();

  router.get('/', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const tenantId = user.tenantId;
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;

      const filters: any = {};
      if (req.query.stage) filters.stage = req.query.stage;
      if (req.query.stages) filters.stage_in = (req.query.stages as string).split(',');
      if (req.query.assignedTo) filters.assignedTo = req.query.assignedTo;
      if (req.query.source) filters.source = req.query.source;
      if (req.query.search) filters.search = req.query.search;
      if (req.query.slaBreached) filters.slaBreached = req.query.slaBreached === 'true';
      if (req.query.sort) filters.sort = req.query.sort as string;
      if (req.query.order) filters.order = req.query.order as 'asc' | 'desc';
      if (req.query.score_gte) filters.score_gte = parseFloat(req.query.score_gte as string);
      if (req.query.score_lte) filters.score_lte = parseFloat(req.query.score_lte as string);

      const result = await leadRepository.findLeads(
        tenantId,
        { page, pageSize },
        filters,
        user.id,
        user.role
      );

      res.json(result);
    } catch (error) {
      console.error('Error fetching leads:', error);
      res.status(500).json({ error: 'Failed to fetch leads' });
    }
  });

  router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const lead = await leadRepository.findByIdWithAccess(
        user.tenantId, req.params.id, user.id, user.role
      );
      if (!lead) return res.status(404).json({ error: 'Lead not found' });
      res.json(lead);
    } catch (error) {
      console.error('Error fetching lead:', error);
      res.status(500).json({ error: 'Failed to fetch lead' });
    }
  });

  router.post('/', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { name, phone, email, address, source, stage, assignedTo, tags, notes, preferences } = req.body;

      if (!name || !phone) {
        return res.status(400).json({ error: 'Name and phone are required' });
      }

      const duplicate = await leadRepository.checkDuplicatePhone(user.tenantId, phone);
      if (duplicate) {
        return res.status(409).json({
          error: 'DUPLICATE_LEAD',
          message: `A lead with phone ${phone} already exists: ${duplicate.name}`,
          existingLead: duplicate,
        });
      }

      let finalAssignedTo = assignedTo || null;
      if (!assignedTo) {
        try {
          const autoAssignId = await routingRuleRepository.matchLead(user.tenantId, {
            source, address, tags, preferences,
          });
          if (autoAssignId) finalAssignedTo = autoAssignId;
        } catch (routingErr) {
          console.warn('Routing rules match failed, falling back to creator:', routingErr);
        }
      }

      const lead = await leadRepository.create(user.tenantId, {
        name, phone, email, address, source, stage,
        assignedTo: finalAssignedTo || user.id,
        tags, notes, preferences,
      });

      await auditRepository.log(user.tenantId, {
        actorId: user.id,
        action: 'CREATE',
        entityType: 'LEAD',
        entityId: lead.id,
        details: `Created lead: ${name}`,
        ipAddress: req.ip,
      });

      res.status(201).json(lead);
    } catch (error) {
      console.error('Error creating lead:', error);
      res.status(500).json({ error: 'Failed to create lead' });
    }
  });

  router.put('/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const lead = await leadRepository.update(
        user.tenantId, req.params.id, req.body, user.id, user.role
      );
      if (!lead) return res.status(404).json({ error: 'Lead not found or access denied' });

      await auditRepository.log(user.tenantId, {
        actorId: user.id,
        action: 'UPDATE',
        entityType: 'LEAD',
        entityId: req.params.id,
        details: `Updated lead fields: ${Object.keys(req.body).join(', ')}`,
        ipAddress: req.ip,
      });

      res.json(lead);
    } catch (error) {
      console.error('Error updating lead:', error);
      res.status(500).json({ error: 'Failed to update lead' });
    }
  });

  router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'ADMIN' && user.role !== 'TEAM_LEAD') {
        return res.status(403).json({ error: 'Only admins and team leads can delete leads' });
      }

      const deleted = await leadRepository.deleteById(user.tenantId, req.params.id);
      if (!deleted) return res.status(404).json({ error: 'Lead not found' });

      await auditRepository.log(user.tenantId, {
        actorId: user.id,
        action: 'DELETE',
        entityType: 'LEAD',
        entityId: req.params.id,
        ipAddress: req.ip,
      });

      res.json({ message: 'Lead deleted' });
    } catch (error) {
      console.error('Error deleting lead:', error);
      res.status(500).json({ error: 'Failed to delete lead' });
    }
  });

  router.get('/:id/interactions', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { interactionRepository } = await import('../repositories/interactionRepository');
      const interactions = await interactionRepository.findByLead(
        user.tenantId, req.params.id, undefined, user.id, user.role
      );
      res.json(interactions);
    } catch (error) {
      console.error('Error fetching interactions:', error);
      res.status(500).json({ error: 'Failed to fetch interactions' });
    }
  });

  router.post('/:id/interactions', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { channel, content, type, metadata } = req.body;

      if (!content) {
        return res.status(400).json({ error: 'Content is required' });
      }

      const lead = await leadRepository.findByIdWithAccess(
        user.tenantId, req.params.id, user.id, user.role
      );
      if (!lead) return res.status(404).json({ error: 'Lead not found or access denied' });

      const { interactionRepository } = await import('../repositories/interactionRepository');
      const interaction = await interactionRepository.create(user.tenantId, {
        leadId: req.params.id,
        channel: channel || 'INTERNAL',
        direction: 'OUTBOUND',
        type: type || 'TEXT',
        content,
        metadata,
        senderId: user.id,
        status: 'SENT',
      });

      res.status(201).json(interaction);
    } catch (error) {
      console.error('Error creating interaction:', error);
      res.status(500).json({ error: 'Failed to create interaction' });
    }
  });

  return router;
}
