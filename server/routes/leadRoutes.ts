import { validateUUIDParam } from '../middleware/validation';
import { Router, Request, Response } from 'express';
import { leadRepository } from '../repositories/leadRepository';
import { auditRepository } from '../repositories/auditRepository';
import { routingRuleRepository } from '../repositories/routingRuleRepository';

export function createLeadRoutes(authenticateToken: any) {
  const router = Router();

  const PARTNER_ROLES = ['PARTNER_ADMIN', 'PARTNER_AGENT'];

  router.get('/', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (PARTNER_ROLES.includes(user.role)) {
        return res.status(403).json({ error: 'Không có quyền truy cập' });
      }
      const tenantId = user.tenantId;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      // Allow up to 500 for Kanban board view (client sends 500); default cap is 200
      const pageSize = Math.max(1, Math.min(parseInt(req.query.pageSize as string) || 20, 500));

      const filters: any = {};
      if (req.query.stage) filters.stage = req.query.stage;
      if (req.query.stages) filters.stage_in = (req.query.stages as string).split(',');
      if (req.query.assignedTo) filters.assignedTo = req.query.assignedTo;
      if (req.query.source) filters.source = req.query.source;
      if (req.query.search) filters.search = req.query.search;
      if (req.query.slaBreached) filters.slaBreached = req.query.slaBreached === 'true';
      if (req.query.sort) filters.sort = req.query.sort as string;
      if (req.query.order) filters.order = req.query.order as 'asc' | 'desc';
      const scoreGte = parseFloat(req.query.score_gte as string);
      const scoreLte = parseFloat(req.query.score_lte as string);
      if (req.query.score_gte && !isNaN(scoreGte)) filters.score_gte = scoreGte;
      if (req.query.score_lte && !isNaN(scoreLte)) filters.score_lte = scoreLte;

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

  router.get('/:id', authenticateToken, validateUUIDParam(), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const lead = await leadRepository.findByIdWithAccess(
        user.tenantId, String(req.params.id), user.id, user.role
      );
      if (!lead) return res.status(404).json({ error: 'Lead not found' });
      res.json(lead);
    } catch (error) {
      console.error('Error fetching lead:', error);
      res.status(500).json({ error: 'Failed to fetch lead' });
    }
  });

  router.get('/check-email', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const email = (req.query.email as string)?.trim();
      if (!email) return res.json({ duplicate: null });

      const duplicate = await leadRepository.checkDuplicateEmail(user.tenantId, email);
      if (!duplicate) return res.json({ duplicate: null });

      return res.json({
        duplicate: {
          id: duplicate.id,
          name: duplicate.name,
          phone: duplicate.phone,
          email: duplicate.email ?? null,
          stage: duplicate.stage,
          assignedTo: duplicate.assignedTo ?? null,
        }
      });
    } catch (error) {
      console.error('Error checking email duplicate:', error);
      res.status(500).json({ duplicate: null });
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
          message: `A lead with this phone number already exists`,
          existingLeadId: duplicate.id,
          existingLead: {
            id: duplicate.id,
            name: duplicate.name,
            phone: duplicate.phone,
            email: duplicate.email ?? null,
            stage: duplicate.stage,
            source: duplicate.source ?? null,
            assignedTo: duplicate.assignedTo ?? null,
            tags: duplicate.tags ?? [],
            notes: duplicate.notes ?? null,
            address: duplicate.address ?? null,
            preferences: duplicate.preferences ?? null,
            createdAt: duplicate.createdAt,
            updatedAt: duplicate.updatedAt,
          },
        });
      }

      const RESTRICTED_ROLES = ['SALES', 'MARKETING', 'VIEWER'];
      const isRestricted = RESTRICTED_ROLES.includes(user.role);

      let finalAssignedTo = assignedTo || null;
      // Restricted roles (SALES/MARKETING/VIEWER) always own their leads so they can see them.
      // Skip routing rules for these roles — routing rules could assign to another user, making
      // the lead invisible to the creator under their RBAC filter.
      if (!assignedTo && !isRestricted) {
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

  // Merge endpoint: additive-only update (append notes/tags). No ownership restriction —
  // the caller detected a duplicate and is contributing their data to the existing lead.
  router.patch('/:id/merge', authenticateToken, validateUUIDParam(), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { notes, tags, name, email, address } = req.body;

      // Only allow appending — never changing ownership, stage, or phone
      const mergeData: Record<string, any> = {};
      if (name !== undefined) mergeData.name = name;
      if (email !== undefined) mergeData.email = email;
      if (address !== undefined) mergeData.address = address;
      if (notes !== undefined) mergeData.notes = notes;
      if (tags !== undefined) mergeData.tags = tags;

      // Bypass RBAC ownership check by passing ADMIN as effective role for this operation
      const lead = await leadRepository.update(
        user.tenantId, String(req.params.id), mergeData, user.id, 'ADMIN'
      );
      if (!lead) return res.status(404).json({ error: 'Lead not found' });

      await auditRepository.log(user.tenantId, {
        actorId: user.id,
        action: 'MERGE',
        entityType: 'LEAD',
        entityId: String(req.params.id),
        details: `Merged lead data into: ${lead.name}`,
        ipAddress: req.ip,
      });

      res.json(lead);
    } catch (error) {
      console.error('Error merging lead:', error);
      res.status(500).json({ error: 'Failed to merge lead' });
    }
  });

  router.put('/:id', authenticateToken, validateUUIDParam(), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const lead = await leadRepository.update(
        user.tenantId, String(req.params.id), req.body, user.id, user.role
      );
      if (!lead) return res.status(404).json({ error: 'Lead not found or access denied' });

      await auditRepository.log(user.tenantId, {
        actorId: user.id,
        action: 'UPDATE',
        entityType: 'LEAD',
        entityId: String(req.params.id),
        details: `Updated lead fields: ${Object.keys(req.body).join(', ')}`,
        ipAddress: req.ip,
      });

      res.json(lead);
    } catch (error) {
      console.error('Error updating lead:', error);
      res.status(500).json({ error: 'Failed to update lead' });
    }
  });

  router.delete('/:id', authenticateToken, validateUUIDParam(), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'ADMIN' && user.role !== 'TEAM_LEAD') {
        return res.status(403).json({ error: 'Only admins and team leads can delete leads' });
      }

      const deleted = await leadRepository.deleteById(user.tenantId, String(req.params.id));
      if (!deleted) return res.status(404).json({ error: 'Lead not found' });

      await auditRepository.log(user.tenantId, {
        actorId: user.id,
        action: 'DELETE',
        entityType: 'LEAD',
        entityId: String(req.params.id),
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
        user.tenantId, String(req.params.id), undefined, user.id, user.role
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
        user.tenantId, String(req.params.id), user.id, user.role
      );
      if (!lead) return res.status(404).json({ error: 'Lead not found or access denied' });

      // ── Attempt outbound delivery for social channels ──────────────────────
      let deliveryStatus = 'SENT';
      let deliveryError: string | undefined;

      const resolvedChannel = (channel || 'INTERNAL').toUpperCase();

      if (resolvedChannel === 'ZALO' && lead.socialIds?.zalo) {
        try {
          const { sendZaloTextMessage, getZaloAccessToken } = await import('../services/zaloService');
          const accessToken = await getZaloAccessToken(user.tenantId);
          if (accessToken) {
            const result = await sendZaloTextMessage(accessToken, lead.socialIds.zalo, content);
            if (!result.success) {
              deliveryStatus = 'FAILED';
              deliveryError = result.error;
            }
          } else {
            deliveryStatus = 'PENDING'; // No token configured yet
            deliveryError = 'Zalo OA Access Token chưa được cấu hình';
          }
        } catch (err: any) {
          deliveryStatus = 'FAILED';
          deliveryError = err.message;
          console.error('[Zalo] Outbound send error:', err);
        }
      }

      if (resolvedChannel === 'FACEBOOK' && lead.socialIds?.facebook) {
        try {
          const { sendFacebookTextMessage, getFacebookDefaultPage } = await import('../services/facebookService');
          const page = await getFacebookDefaultPage(user.tenantId);
          if (page) {
            const result = await sendFacebookTextMessage(page.accessToken, lead.socialIds.facebook, content);
            if (!result.success) {
              deliveryStatus = 'FAILED';
              deliveryError = result.error;
            }
          } else {
            deliveryStatus = 'PENDING';
            deliveryError = 'Chưa có Facebook Page nào được kết nối với Access Token';
          }
        } catch (err: any) {
          deliveryStatus = 'FAILED';
          deliveryError = err.message;
          console.error('[Facebook] Outbound send error:', err);
        }
      }
      // ── End outbound delivery ───────────────────────────────────────────────

      const { interactionRepository } = await import('../repositories/interactionRepository');
      const interaction = await interactionRepository.create(user.tenantId, {
        leadId: String(req.params.id),
        channel: resolvedChannel,
        direction: 'OUTBOUND',
        type: type || 'TEXT',
        content,
        metadata: {
          ...metadata,
          ...(deliveryError ? { deliveryError } : {}),
        },
        senderId: user.id,
        status: deliveryStatus,
      });

      // Return 201 even when delivery fails — the message is still recorded.
      // The client can detect failure via interaction.status === 'FAILED'.
      res.status(201).json({
        ...interaction,
        ...(deliveryError ? { deliveryWarning: deliveryError } : {}),
      });
    } catch (error) {
      console.error('Error creating interaction:', error);
      res.status(500).json({ error: 'Failed to create interaction' });
    }
  });

  return router;
}
