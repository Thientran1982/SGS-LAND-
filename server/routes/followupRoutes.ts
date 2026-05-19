/**
 * followupRoutes.ts
 *
 * REST API for the multi-channel follow-up agent system.
 *
 * POST /api/followup/schedule   — schedule D+1/3/5/7 sequence for a lead
 * POST /api/followup/cancel     — cancel an active sequence
 * GET  /api/followup/sequences  — list sequences (authenticated, paged)
 * GET  /api/followup/sequences/:id/sends — sends for one sequence
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { logger } from '../middleware/logger';
import { followupSequenceRepository } from '../repositories/followupSequenceRepository';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTenantId(req: Request): string | null {
  return (req as any).user?.tenantId || (req as any).tenant?.id || null;
}

// ── Router factory ────────────────────────────────────────────────────────────

export function createFollowUpRoutes(pool: Pool, authenticateToken: any): Router {
  const router = Router();

  // ── POST /api/followup/schedule ─────────────────────────────────────────────
  // Called by AiChatWidget and LiveChat after lead registration / capture.
  // Public-ish: requires tenant resolution (X-Tenant-Id header OR hostname match).
  // Idempotent: if ACTIVE sequence already exists for this lead, returns 200.
  router.post('/api/followup/schedule', async (req: Request, res: Response) => {
    try {
      const {
        leadId,
        leadName,
        leadPhone,
        leadEmail,
        leadZaloId,
        source,
        projectCode,
        tenantId: bodyTenantId,
      } = req.body as Record<string, string | undefined>;

      if (!leadId) {
        return res.status(400).json({ error: 'leadId required' });
      }

      // Resolve tenant: from JWT (authenticated) → body → X-Tenant-Id header
      const tenantId =
        getTenantId(req) ||
        bodyTenantId ||
        (req.headers['x-tenant-id'] as string | undefined) ||
        null;

      if (!tenantId) {
        return res.status(400).json({ error: 'tenantId could not be resolved' });
      }

      // Idempotency: skip if ACTIVE sequence already exists
      const existing = await followupSequenceRepository.getActiveSequenceForLead(
        pool,
        tenantId,
        leadId,
      );
      if (existing) {
        return res.json({ ok: true, sequenceId: existing.id, existing: true });
      }

      const seq = await followupSequenceRepository.createSequence(pool, tenantId, {
        leadId,
        leadName,
        leadPhone,
        leadEmail,
        leadZaloId,
        source: source || 'LIVE_CHAT',
        projectCode,
      });

      logger.info(
        `[FollowUp] Scheduled D+1/3/5/7 for lead=${leadId} tenant=${tenantId} seq=${seq.id}`,
      );
      return res.status(201).json({ ok: true, sequenceId: seq.id });
    } catch (err: any) {
      logger.error('[FollowUp] schedule error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── POST /api/followup/cancel ───────────────────────────────────────────────
  router.post('/api/followup/cancel', authenticateToken, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

      const { sequenceId, leadId, reason } = req.body as {
        sequenceId?: string;
        leadId?: string;
        reason?: string;
      };

      const cancelReason = reason || 'manual_cancel';

      if (sequenceId) {
        await followupSequenceRepository.cancelSequence(
          pool,
          tenantId,
          sequenceId,
          cancelReason,
        );
        return res.json({ ok: true, cancelled: 1 });
      }

      if (leadId) {
        const count = await followupSequenceRepository.cancelByLead(pool, leadId, cancelReason);
        return res.json({ ok: true, cancelled: count });
      }

      return res.status(400).json({ error: 'sequenceId or leadId required' });
    } catch (err: any) {
      logger.error('[FollowUp] cancel error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── GET /api/followup/sequences ─────────────────────────────────────────────
  router.get('/api/followup/sequences', authenticateToken, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

      const page = parseInt(String(req.query.page || '1'), 10);
      const pageSize = parseInt(String(req.query.pageSize || '20'), 10);
      const status = req.query.status as string | undefined;

      const result = await followupSequenceRepository.listSequences(pool, tenantId, {
        page,
        pageSize,
        status,
      });

      return res.json(result);
    } catch (err: any) {
      logger.error('[FollowUp] list sequences error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── GET /api/followup/sequences/:id/sends ──────────────────────────────────
  router.get(
    '/api/followup/sequences/:id/sends',
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        const sends = await followupSequenceRepository.getSends(pool, req.params.id);
        return res.json(sends);
      } catch (err: any) {
        logger.error('[FollowUp] get sends error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  return router;
}
