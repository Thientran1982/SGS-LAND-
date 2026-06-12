/**
 * sequenceRoutes.ts
 *
 * REST API for drip-campaign sequences. Includes:
 *   - CRUD (list, create, update, delete)
 *   - Execute a sequence against a single lead (inserts sequence_enrollments rows)
 *   - Open-pixel tracking  GET /track/open/:enrollmentId.gif  (no auth)
 *   - Click redirect      GET /track/click/:enrollmentId      (no auth)
 *
 * Stats are computed live from sequence_enrollments in findAllSequences().
 */

import { validateUUIDParam } from '../middleware/validation';
import { Router, Request, Response } from 'express';
import type { Pool } from 'pg';
import { sequenceRepository } from '../repositories/sequenceRepository';
import { emailService } from '../services/emailService';
import { SEQUENCE_TEMPLATES } from '../sequenceTemplates';
import { createHmac } from 'crypto';

// ── Helpers ───────────────────────────────────────────────────────────────────

function publicBaseUrl(): string {
  const prod = process.env.REPLIT_DOMAINS?.split(',')[0]?.trim() || process.env.APP_DOMAIN;
  const dev = process.env.REPLIT_DEV_DOMAIN;
  const host = prod || dev;
  return host ? `https://${host}` : 'http://localhost:5000';
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function signSeqUrl(enrollmentId: string, url: string): string {
  const secret = process.env.JWT_SECRET || 'dev-secret';
  return createHmac('sha256', secret)
    .update(`seq|${enrollmentId}|${url}`)
    .digest('hex')
    .slice(0, 32);
}

/**
 * Embed a 1×1 open-tracking pixel and rewrite external links to track clicks.
 * Uses /api/sequences/track/* endpoints (no auth required).
 */
function decorateSequenceBody(html: string, enrollmentId: string, base: string): string {
  const pixel = `<img src="${base}/api/sequences/track/open/${enrollmentId}.gif" width="1" height="1" style="display:none" alt="" />`;

  const rewritten = html.replace(
    /href=("|')(https?:\/\/[^"'<>\s]+)\1/gi,
    (_m, q, url) => {
      const sig = signSeqUrl(enrollmentId, url);
      const tracked = `${base}/api/sequences/track/click/${enrollmentId}?url=${encodeURIComponent(url)}&sig=${sig}`;
      return `href=${q}${tracked}${q}`;
    },
  );

  return `${rewritten}${pixel}`;
}

const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

// ── Router factory ────────────────────────────────────────────────────────────

export function createSequenceRoutes(pool: Pool, authenticateToken: any) {
  const router = Router();

  // ── Open-tracking pixel (no auth, must be before /:id routes) ───────────────
  router.get('/track/open/:enrollmentId.gif', async (req: Request, res: Response) => {
    const enrollmentId = String(req.params.enrollmentId || '');

    if (UUID_RE.test(enrollmentId)) {
      try {
        // Only record first open; also set status OPENED when was SENT
        await pool.query(
          `UPDATE sequence_enrollments
              SET opened_at = COALESCE(opened_at, NOW()),
                  status    = CASE WHEN status = 'SENT' THEN 'OPENED' ELSE status END
            WHERE id = $1`,
          [enrollmentId],
        );
      } catch { /* non-fatal */ }
    }

    res.set({
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    });
    res.send(TRANSPARENT_GIF);
  });

  // ── Click-tracking redirect (no auth) ────────────────────────────────────────
  router.get('/track/click/:enrollmentId', async (req: Request, res: Response) => {
    const enrollmentId = String(req.params.enrollmentId || '');
    const url = decodeURIComponent(String(req.query.url || ''));

    if (UUID_RE.test(enrollmentId) && /^https?:\/\//.test(url)) {
      try {
        await pool.query(
          `UPDATE sequence_enrollments
              SET clicked_at = COALESCE(clicked_at, NOW())
            WHERE id = $1`,
          [enrollmentId],
        );
      } catch { /* non-fatal */ }
    }

    if (/^https?:\/\//.test(url)) {
      return res.redirect(302, url);
    }
    res.redirect(302, 'https://sgsland.vn');
  });

  // ── Templates ────────────────────────────────────────────────────────────────
  router.get('/templates', authenticateToken, (_req: Request, res: Response) => {
    res.json(SEQUENCE_TEMPLATES);
  });

  // ── List sequences (with stats from sequence_enrollments) ────────────────────
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

  // ── Create ───────────────────────────────────────────────────────────────────
  router.post('/', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD'].includes(user.role)) {
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

  // ── Update ───────────────────────────────────────────────────────────────────
  router.put('/:id', authenticateToken, validateUUIDParam(), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD'].includes(user.role)) {
        return res.status(403).json({ error: 'Only admins and team leads can update sequences' });
      }

      // Validate: cannot activate sequence with no steps
        if (req.body.isActive === true) {
          const bodySteps = req.body.steps;
          if (!bodySteps || (Array.isArray(bodySteps) && bodySteps.length === 0)) {
            return res.status(400).json({ error: 'Vui lòng thêm ít nhất 1 bước trước khi kích hoạt chiến dịch' });
          }
        }
        const sequence = await sequenceRepository.update(user.tenantId, req.params.id as string, req.body);
      if (!sequence) return res.status(404).json({ error: 'Sequence not found' });
      res.json(sequence);
    } catch (error) {
      console.error('Error updating sequence:', error);
      res.status(500).json({ error: 'Failed to update sequence' });
    }
  });

  // ── Execute (send all EMAIL steps immediately for one lead) ──────────────────
  router.post('/:id/execute', authenticateToken, validateUUIDParam(), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD'].includes(user.role)) {
        return res.status(403).json({ error: 'Only admins and team leads can execute sequences' });
      }

      const sequence = await sequenceRepository.findById(user.tenantId, req.params.id as string);
      if (!sequence) return res.status(404).json({ error: 'Sequence not found' });
      if (!sequence.isActive) return res.status(400).json({ error: 'Sequence is not active' });

      const { lead } = req.body;
      if (!lead || !lead.email) {
        return res.status(400).json({ error: 'Lead with email is required' });
      }

      const base = publicBaseUrl();
      const results: Array<{ step: number; type: string; status: string; error?: string }> = [];

      for (let i = 0; i < (sequence.steps || []).length; i++) {
        const step = (sequence.steps as any[])[i];

        if (step.type === 'EMAIL') {
          // Insert enrollment row first to get a tracking ID
          let enrollmentId: string | null = null;
          try {
            const ins = await pool.query(
              `INSERT INTO sequence_enrollments
                 (tenant_id, sequence_id, lead_email, lead_name, step_index, status)
               VALUES ($1, $2, $3, $4, $5, 'PENDING')
               RETURNING id`,
              [user.tenantId, sequence.id, lead.email, lead.name || null, i],
            );
            enrollmentId = ins.rows[0]?.id ?? null;
          } catch { /* non-fatal, fall back to untracked send */ }

          const subject = (step.subject || step.template || 'SGS LAND Notification')
            .replace(/\{\{name\}\}/g, lead.name || '')
            .replace(/\{\{email\}\}/g, lead.email || '');

          const rawContent = (step.content || step.body || '')
            .replace(/\{\{name\}\}/g, lead.name || '')
            .replace(/\{\{email\}\}/g, lead.email || '');

          // Embed open-pixel + rewrite links for click tracking
          const trackedContent = enrollmentId
            ? decorateSequenceBody(rawContent, enrollmentId, base)
            : rawContent;

          try {
            const emailResult = await emailService.sendSequenceEmail(
              user.tenantId, lead.email, subject, trackedContent,
            );

            // Update enrollment row with send outcome
            if (enrollmentId) {
              await pool.query(
                `UPDATE sequence_enrollments
                    SET status  = $1,
                        sent_at = $2,
                        error   = $3
                  WHERE id = $4`,
                [
                  emailResult.success ? 'SENT' : 'FAILED',
                  emailResult.success ? new Date() : null,
                  emailResult.error ?? null,
                  enrollmentId,
                ],
              );
            }

            results.push({
              step: i,
              type: 'EMAIL',
              status: emailResult.success ? 'sent' : 'failed',
              error: emailResult.error,
            });
          } catch (err: any) {
            if (enrollmentId) {
              await pool.query(
                `UPDATE sequence_enrollments SET status = 'FAILED', error = $1 WHERE id = $2`,
                [err.message, enrollmentId],
              ).catch(() => {});
            }
            results.push({ step: i, type: 'EMAIL', status: 'error', error: err.message });
          }
        } else if (step.type === 'WAIT') {
          results.push({ step: i, type: 'WAIT', status: 'skipped' });
        } else {
          results.push({ step: i, type: step.type, status: 'skipped' });
        }
      }

      res.json({ message: 'Sequence executed', results });
    } catch (error) {
      console.error('Error executing sequence:', error);
      res.status(500).json({ error: 'Failed to execute sequence' });
    }
  });

  // ── Delete ───────────────────────────────────────────────────────────────────
  router.delete('/:id', authenticateToken, validateUUIDParam(), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD'].includes(user.role)) {
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
