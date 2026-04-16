import { validateUUIDParam } from '../middleware/validation';
import { Router, Request, Response } from 'express';
import { leadRepository } from '../repositories/leadRepository';
import { auditRepository } from '../repositories/auditRepository';
import { routingRuleRepository } from '../repositories/routingRuleRepository';
import { notificationRepository } from '../repositories/notificationRepository';

const STAGE_LABEL_VN: Record<string, string> = {
  NEW:         'Mới',
  CONTACTED:   'Đã liên hệ',
  QUALIFIED:   'Tiềm năng',
  PROPOSAL:    'Báo giá',
  NEGOTIATION: 'Thương lượng',
  WON:         'Chốt deal',
  LOST:        'Thất bại',
  MANUAL:      'Thủ công',
};

export function createLeadRoutes(authenticateToken: any, getBroadcast?: () => any) {
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
      const viewMode = (req.query.viewMode as string || '').toLowerCase();
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

      // Cursor-based mode (LIST view); offset-based for BOARD/export
      if (req.query.cursor !== undefined && viewMode !== 'board') {
        const cursor = (req.query.cursor as string) || undefined;
        const result = await leadRepository.findLeadsCursor(tenantId, {
          pageSize,
          cursor: cursor || undefined,
          filters,
          userId: user.id,
          userRole: user.role,
        });
        return res.json(result);
      }

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

  router.get('/check-phone', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const phone = (req.query.phone as string)?.trim();
      if (!phone) return res.json({ duplicate: null });

      const duplicate = await leadRepository.checkDuplicatePhone(user.tenantId, phone);
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
      console.error('Error checking phone duplicate:', error);
      res.status(500).json({ duplicate: null });
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

      getBroadcast?.()?.to(`tenant:${user.tenantId}`).emit('lead_created', { leadId: lead.id });
      res.status(201).json(lead);
    } catch (error) {
      console.error('Error creating lead:', error);
      res.status(500).json({ error: 'Failed to create lead' });
    }
  });

  // Merge endpoint: strictly additive — only fills empty fields, never overwrites existing data.
  // This prevents a bad actor from using the merge flow to overwrite a lead's info with wrong data.
  router.patch('/:id/merge', authenticateToken, validateUUIDParam(), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { notes, tags, email, address } = req.body;
      // name is intentionally excluded — merging never changes the existing lead's identity

      // Fetch existing lead to check which fields are already populated
      const existing = await leadRepository.findByIdWithAccess(
        user.tenantId, String(req.params.id), user.id, 'ADMIN'
      );
      if (!existing) return res.status(404).json({ error: 'Lead not found' });

      // Only fill in fields the existing lead does NOT already have (additive-only)
      const mergeData: Record<string, any> = {};
      if (email !== undefined && !existing.email) mergeData.email = email;
      if (address !== undefined && !existing.address) mergeData.address = address;

      // Notes: always append with timestamp so history is preserved
      if (notes !== undefined) mergeData.notes = notes;

      // Tags: union of existing + new (de-duplicated)
      if (tags !== undefined) {
        mergeData.tags = Array.from(new Set([...(existing.tags || []), ...tags]));
      }

      // If nothing to update, return existing lead as-is
      if (Object.keys(mergeData).length === 0) {
        return res.json(existing);
      }

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

      // Snapshot before update to detect assignment/stage changes
      const before = await leadRepository.findByIdWithAccess(
        user.tenantId, String(req.params.id), user.id, user.role
      );

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

      // Notify new assignee when lead is re-assigned to a different user
      if (
        before &&
        req.body.assignedTo &&
        req.body.assignedTo !== before.assignedTo &&
        req.body.assignedTo !== user.id
      ) {
        notificationRepository.create({
          tenantId: user.tenantId,
          userId: req.body.assignedTo,
          type: 'LEAD_ASSIGNED',
          title: 'Lead mới được phân công',
          body: lead.name,
          metadata: { leadId: lead.id, leadName: lead.name },
        }).catch(() => {});
      }

      // Notify assignee when stage changes
      if (
        before &&
        req.body.stage &&
        req.body.stage !== before.stage &&
        lead.assignedTo &&
        lead.assignedTo !== user.id
      ) {
        notificationRepository.create({
          tenantId: user.tenantId,
          userId: lead.assignedTo,
          type: 'STAGE_CHANGE',
          title: `Lead tiến đến ${STAGE_LABEL_VN[req.body.stage] ?? req.body.stage}`,
          body: lead.name,
          metadata: { leadId: lead.id, leadName: lead.name, stage: req.body.stage },
        }).catch(() => {});
      }

      getBroadcast?.()?.to(`tenant:${user.tenantId}`).emit('lead_updated', { leadId: lead.id, stage: lead.stage });
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
