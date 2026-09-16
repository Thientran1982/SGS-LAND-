import { Router, type Request, type Response } from 'express';
import { createHash } from 'node:crypto';
import { pool } from '../db';
import { leadRepository } from '../repositories/leadRepository';
import { approvalRequestRepository } from '../repositories/approvalRequestRepository';
import { createOutreachDraft, type OutreachChannel } from '../services/outreachDraftService';

const OUTREACH_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD', 'MANAGER', 'SALES', 'MARKETING']);

function requestedChannels(value: unknown): OutreachChannel[] {
  if (!Array.isArray(value)) return [];
  return value.filter((channel): channel is OutreachChannel =>
    channel === 'ZALO' || channel === 'EMAIL' || channel === 'CALL_SCRIPT',
  );
}

export function createOutreachRoutes(authenticateToken: any): Router {
  const router = Router();

  router.post('/drafts', authenticateToken, async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!OUTREACH_ROLES.has(String(user?.role || ''))) {
      return res.status(403).json({ error: 'Bạn không có quyền tạo draft outreach.' });
    }

    const leadId = String(req.body?.leadId || '').trim();
    if (!leadId) return res.status(400).json({ error: 'leadId là bắt buộc.' });

    try {
      const lead = await leadRepository.findByIdWithAccess(
        String(user.tenantId),
        leadId,
        String(user.id),
        String(user.role),
      );
      if (!lead) return res.status(404).json({ error: 'Lead không tồn tại hoặc không thuộc quyền truy cập.' });

      const interactions = await pool.query(
        `SELECT direction, channel, content, timestamp
           FROM interactions
          WHERE tenant_id = $1 AND lead_id = $2
          ORDER BY timestamp DESC
          LIMIT 12`,
        [String(user.tenantId), leadId],
      );

      const metadata = lead.metadata && typeof lead.metadata === 'object' ? lead.metadata : {};
      const attributes = lead.attributes && typeof lead.attributes === 'object' ? lead.attributes : {};
      const qualification = lead.score && typeof lead.score === 'object' ? lead.score : {};
      const consentValid = lead.marketingEmailConsent === true || metadata.outreachConsent === true;
      const consentChannels: OutreachChannel[] = [];
      if (lead.marketingEmailConsent === true && !(lead.optOutChannels || []).includes('email')) {
        consentChannels.push('EMAIL');
      }
      if (metadata.outreachConsent === true && !(lead.optOutChannels || []).includes('zalo')) {
        consentChannels.push('ZALO', 'CALL_SCRIPT');
      }

      const draft = createOutreachDraft({
        leadId,
        leadName: lead.name,
        brokerAssigned: lead.assignedTo,
        qualification: {
          status: String(req.body?.qualification?.status || qualification.grade || 'NEEDS_INFO').toUpperCase() as any,
          score: Number(qualification.score || 0),
          buyingSignals: Array.isArray(req.body?.qualification?.buyingSignals)
            ? req.body.qualification.buyingSignals
            : [],
          missingData: Array.isArray(req.body?.qualification?.missingData)
            ? req.body.qualification.missingData
            : [],
          nextBestAction: req.body?.qualification?.nextBestAction || null,
        },
        projectContext: {
          name: req.body?.projectContext?.name || attributes.projectName || metadata.projectName,
          facts: Array.isArray(req.body?.projectContext?.facts) ? req.body.projectContext.facts : [],
          location: req.body?.projectContext?.location || null,
          url: req.body?.projectContext?.url || null,
        },
        interactionHistory: interactions.rows,
        consent: {
          valid: consentValid,
          channels: consentChannels,
          source: lead.marketingEmailConsentSource || metadata.outreachConsentSource || null,
          capturedAt: lead.marketingEmailConsentAt || metadata.outreachConsentAt || null,
        },
        requestedChannels: requestedChannels(req.body?.channels),
      });

      if (draft.status === 'BLOCKED') {
        return res.status(422).json({ draft, approvalRequest: null });
      }

      const fingerprint = createHash('sha256')
        .update(JSON.stringify({ leadId, draft }))
        .digest('hex')
        .slice(0, 32);
      const approvalRequest = await approvalRequestRepository.create({
        tenantId: String(user.tenantId),
        leadId,
        channel: 'OUTREACH',
        actionType: 'DRAFT_OUTREACH',
        payload: {
          ...draft,
          projectContext: req.body?.projectContext || {},
          consentValid: true,
        },
        reasoning: 'Week 8 Outreach Bot tạo draft; broker phải duyệt trước khi gửi thủ công.',
        idempotencyKey: `outreach-draft:${leadId}:${fingerprint}`,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      return res.status(201).json({ draft, approvalRequest });
    } catch (error: any) {
      console.error('[outreach] draft creation failed:', error?.message || error);
      return res.status(500).json({ error: 'Không thể tạo draft outreach.' });
    }
  });

  return router;
}