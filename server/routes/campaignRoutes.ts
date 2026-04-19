/**
 * campaignRoutes.ts
 *
 * REST API cho module Chiến dịch tự động.
 *
 * Admin endpoints (yêu cầu authenticateToken + tenant):
 *   GET    /api/campaigns                   — Danh sách + KPI
 *   POST   /api/campaigns                   — Tạo mới (DRAFT)
 *   GET    /api/campaigns/:id               — Chi tiết
 *   PATCH  /api/campaigns/:id               — Cập nhật (DRAFT/PAUSED only)
 *   DELETE /api/campaigns/:id               — Xóa (DRAFT/PAUSED/COMPLETED)
 *   POST   /api/campaigns/:id/activate      — Kích hoạt (DRAFT/PAUSED → ACTIVE, gửi nếu schedule_type=NOW)
 *   POST   /api/campaigns/:id/pause         — Tạm dừng (ACTIVE → PAUSED)
 *   POST   /api/campaigns/:id/run-now       — Chạy thủ công ngay (yêu cầu ACTIVE)
 *   GET    /api/campaigns/:id/recipients    — Danh sách người nhận
 *   POST   /api/campaigns/preview-audience  — Đếm thử audience theo filter
 *
 * Public tracking (không auth, dùng trong email):
 *   GET    /api/track/open/:recipientId.gif — Pixel mở mail
 *   GET    /api/track/click/:recipientId    — Redirect track click (?url=...)
 */

import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { Pool } from 'pg';
import { logger } from '../middleware/logger';
import { runCampaign, countAudience, signTrackingUrl, AudienceFilter, AbTestConfig } from '../services/campaignSenderService';

const ALLOWED_CHANNELS = new Set(['EMAIL']);
const ALLOWED_SCHEDULE = new Set(['NOW', 'SCHEDULED']);

function requireAdminOrLead(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user || !['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD'].includes(user.role)) {
    return res.status(403).json({ error: 'Cần quyền ADMIN hoặc TEAM_LEAD' });
  }
  next();
}

function getTenantId(req: Request): string {
  return (req as any).tenantId || (req as any).user?.tenantId || '00000000-0000-0000-0000-000000000001';
}

function publicBaseUrl(): string {
  const prod = process.env.REPLIT_DOMAINS?.split(',')[0]?.trim() || process.env.APP_DOMAIN;
  const dev = process.env.REPLIT_DEV_DOMAIN;
  const host = prod || dev;
  return host ? `https://${host}` : 'http://localhost:5000';
}

export function createCampaignRouter(pool: Pool, authenticateToken: RequestHandler): Router {
  const router = Router();

  // ── Public tracking (đặt TRƯỚC để tránh bị authenticateToken can thiệp) ────
  const TRANSPARENT_GIF = Buffer.from(
    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    'base64',
  );

  router.get('/api/track/open/:recipientId.gif', async (req: Request, res: Response) => {
    const id = String(req.params.recipientId || '');
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.end(TRANSPARENT_GIF);

    if (!/^[0-9a-f-]{36}$/i.test(id)) return;
    pool.query(
      `UPDATE campaign_recipients
          SET opened_at = COALESCE(opened_at, NOW()),
              status = CASE WHEN status IN ('SENT','OPENED','CLICKED') THEN 'OPENED' ELSE status END
        WHERE id = $1`,
      [id],
    ).then(async (r) => {
      if (r.rowCount) {
        await pool.query(
          `UPDATE campaigns SET open_count = open_count + 1
             WHERE id = (SELECT campaign_id FROM campaign_recipients WHERE id = $1)
               AND NOT EXISTS (
                 SELECT 1 FROM campaign_recipients WHERE id = $1 AND opened_at < NOW() - INTERVAL '1 second'
               )`,
          [id],
        ).catch(() => null);
      }
    }).catch(() => null);
  });

  router.get('/api/track/click/:recipientId', async (req: Request, res: Response) => {
    const id = String(req.params.recipientId || '');
    const url = String(req.query.url || '');
    const sig = String(req.query.sig || '');

    const validUuid = /^[0-9a-f-]{36}$/i.test(id);
    const validUrl = /^https?:\/\//i.test(url);
    const expectedSig = validUuid && validUrl ? signTrackingUrl(id, url) : '';
    const sigOk = expectedSig.length > 0 && sig.length === expectedSig.length && sig === expectedSig;
    const safeUrl = sigOk ? url : '/';

    if (sigOk) {
      pool.query(
        `UPDATE campaign_recipients
            SET clicked_at = COALESCE(clicked_at, NOW()),
                opened_at  = COALESCE(opened_at, NOW()),
                status = 'CLICKED'
          WHERE id = $1`,
        [id],
      ).then(async (r) => {
        if (r.rowCount) {
          await pool.query(
            `UPDATE campaigns SET click_count = click_count + 1
               WHERE id = (SELECT campaign_id FROM campaign_recipients WHERE id = $1)`,
            [id],
          ).catch(() => null);
        }
      }).catch(() => null);
    }

    res.redirect(302, safeUrl);
  });

  // ── Admin: List ────────────────────────────────────────────────────────────
  router.get('/api/campaigns', authenticateToken, requireAdminOrLead, async (req, res) => {
    const tenantId = getTenantId(req);
    const r = await pool.query(
      `SELECT id, name, description, channel, status, audience, subject,
              schedule_type, scheduled_at, ab_test,
              send_count, open_count, click_count,
              last_run_at, last_error, created_at, updated_at
         FROM campaigns
        WHERE tenant_id = $1
        ORDER BY created_at DESC
        LIMIT 200`,
      [tenantId],
    );
    res.json({ data: r.rows, total: r.rowCount });
  });

  // ── Admin: Preview audience size ───────────────────────────────────────────
  router.post('/api/campaigns/preview-audience', authenticateToken, requireAdminOrLead, async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      const filter = (req.body?.audience || {}) as AudienceFilter;
      const count = await countAudience(pool, tenantId, filter);
      res.json({ count });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // ── Admin: Create ──────────────────────────────────────────────────────────
  router.post('/api/campaigns', authenticateToken, requireAdminOrLead, async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = (req as any).user?.id || (req as any).user?.userId || null;
      const body = req.body || {};

      const channel = ALLOWED_CHANNELS.has(body.channel) ? body.channel : 'EMAIL';
      const scheduleType = ALLOWED_SCHEDULE.has(body.schedule_type) ? body.schedule_type : 'NOW';

      if (!body.name || typeof body.name !== 'string') {
        return res.status(400).json({ error: 'Thiếu tên chiến dịch' });
      }

      const r = await pool.query(
        `INSERT INTO campaigns
           (tenant_id, name, description, channel, status, audience,
            subject, body_html, schedule_type, scheduled_at, ab_test, created_by)
         VALUES ($1,$2,$3,$4,'DRAFT',$5,$6,$7,$8,$9,$10,$11)
         RETURNING *`,
        [
          tenantId,
          body.name.trim().slice(0, 200),
          (body.description || '').toString().slice(0, 2000) || null,
          channel,
          JSON.stringify(body.audience || {}),
          (body.subject || '').toString().slice(0, 300) || null,
          body.body_html || null,
          scheduleType,
          body.scheduled_at || null,
          JSON.stringify(body.ab_test || { enabled: false }),
          userId,
        ],
      );

      res.status(201).json(r.rows[0]);
    } catch (err: any) {
      logger.error('[Campaign] Lỗi tạo:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Admin: Detail ──────────────────────────────────────────────────────────
  router.get('/api/campaigns/:id', authenticateToken, requireAdminOrLead, async (req, res) => {
    const tenantId = getTenantId(req);
    const r = await pool.query(
      `SELECT * FROM campaigns WHERE id = $1 AND tenant_id = $2`,
      [req.params.id, tenantId],
    );
    if (!r.rowCount) return res.status(404).json({ error: 'Không tìm thấy' });

    const stats = await pool.query(
      `SELECT
          COUNT(*)                                                 AS total,
          COUNT(*) FILTER (WHERE status='SENT')                    AS sent_only,
          COUNT(*) FILTER (WHERE status='FAILED')                  AS failed,
          COUNT(*) FILTER (WHERE opened_at IS NOT NULL)            AS opened,
          COUNT(*) FILTER (WHERE clicked_at IS NOT NULL)           AS clicked,
          COUNT(*) FILTER (WHERE variant='A')                      AS variant_a,
          COUNT(*) FILTER (WHERE variant='B')                      AS variant_b
         FROM campaign_recipients WHERE campaign_id = $1`,
      [req.params.id],
    );
    res.json({ ...r.rows[0], stats: stats.rows[0] });
  });

  // ── Admin: Update ──────────────────────────────────────────────────────────
  router.patch('/api/campaigns/:id', authenticateToken, requireAdminOrLead, async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      const exist = await pool.query(
        `SELECT status FROM campaigns WHERE id = $1 AND tenant_id = $2`,
        [req.params.id, tenantId],
      );
      if (!exist.rowCount) return res.status(404).json({ error: 'Không tìm thấy' });
      if (!['DRAFT', 'PAUSED'].includes(exist.rows[0].status)) {
        return res.status(409).json({ error: 'Chỉ có thể sửa khi DRAFT hoặc PAUSED' });
      }

      const body = req.body || {};
      const fields: string[] = [];
      const params: any[] = [];
      const set = (col: string, val: any) => { params.push(val); fields.push(`${col} = $${params.length}`); };

      if (body.name !== undefined) set('name', String(body.name).trim().slice(0, 200));
      if (body.description !== undefined) set('description', body.description ? String(body.description).slice(0, 2000) : null);
      if (body.subject !== undefined) set('subject', body.subject ? String(body.subject).slice(0, 300) : null);
      if (body.body_html !== undefined) set('body_html', body.body_html || null);
      if (body.audience !== undefined) set('audience', JSON.stringify(body.audience || {}));
      if (body.ab_test !== undefined) set('ab_test', JSON.stringify(body.ab_test || { enabled: false }));
      if (body.schedule_type !== undefined && ALLOWED_SCHEDULE.has(body.schedule_type)) set('schedule_type', body.schedule_type);
      if (body.scheduled_at !== undefined) set('scheduled_at', body.scheduled_at || null);

      if (!fields.length) return res.status(400).json({ error: 'Không có thay đổi' });

      params.push(req.params.id, tenantId);
      const r = await pool.query(
        `UPDATE campaigns SET ${fields.join(', ')}, updated_at = NOW()
          WHERE id = $${params.length - 1} AND tenant_id = $${params.length}
          RETURNING *`,
        params,
      );
      res.json(r.rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Admin: Delete ──────────────────────────────────────────────────────────
  router.delete('/api/campaigns/:id', authenticateToken, requireAdminOrLead, async (req, res) => {
    const tenantId = getTenantId(req);
    const r = await pool.query(
      `DELETE FROM campaigns
        WHERE id = $1 AND tenant_id = $2 AND status IN ('DRAFT','PAUSED','COMPLETED')`,
      [req.params.id, tenantId],
    );
    if (!r.rowCount) return res.status(409).json({ error: 'Không thể xóa khi chiến dịch đang ACTIVE' });
    res.json({ ok: true });
  });

  // ── Admin: Activate ────────────────────────────────────────────────────────
  router.post('/api/campaigns/:id/activate', authenticateToken, requireAdminOrLead, async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      const cur = await pool.query(
        `SELECT id, status, schedule_type, subject, body_html FROM campaigns
          WHERE id = $1 AND tenant_id = $2`,
        [req.params.id, tenantId],
      );
      if (!cur.rowCount) return res.status(404).json({ error: 'Không tìm thấy' });
      const c = cur.rows[0];
      if (c.status === 'ACTIVE') return res.status(409).json({ error: 'Đã ACTIVE' });
      if (!c.subject || !c.body_html) return res.status(400).json({ error: 'Cần điền subject và nội dung trước khi kích hoạt' });

      await pool.query(`UPDATE campaigns SET status='ACTIVE', updated_at=NOW() WHERE id=$1`, [c.id]);

      let runResult: any = null;
      if (c.schedule_type === 'NOW') {
        runResult = await runCampaign(pool, c.id, publicBaseUrl());
        if (runResult.queued === 0 || runResult.failed > 0 && runResult.sent === 0) {
          // Không có ai để gửi → đánh dấu COMPLETED
          if (runResult.queued === 0) {
            await pool.query(`UPDATE campaigns SET status='COMPLETED', updated_at=NOW() WHERE id=$1`, [c.id]);
          }
        } else {
          await pool.query(`UPDATE campaigns SET status='COMPLETED', updated_at=NOW() WHERE id=$1`, [c.id]);
        }
      }

      const fresh = await pool.query(`SELECT * FROM campaigns WHERE id=$1`, [c.id]);
      res.json({ ok: true, campaign: fresh.rows[0], run: runResult });
    } catch (err: any) {
      logger.error('[Campaign] Lỗi activate:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Admin: Pause ───────────────────────────────────────────────────────────
  router.post('/api/campaigns/:id/pause', authenticateToken, requireAdminOrLead, async (req, res) => {
    const tenantId = getTenantId(req);
    const r = await pool.query(
      `UPDATE campaigns SET status='PAUSED', updated_at=NOW()
        WHERE id=$1 AND tenant_id=$2 AND status='ACTIVE'
        RETURNING *`,
      [req.params.id, tenantId],
    );
    if (!r.rowCount) return res.status(409).json({ error: 'Chiến dịch không ở trạng thái ACTIVE' });
    res.json(r.rows[0]);
  });

  // ── Admin: Run now ─────────────────────────────────────────────────────────
  router.post('/api/campaigns/:id/run-now', authenticateToken, requireAdminOrLead, async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      const cur = await pool.query(
        `SELECT id, status FROM campaigns WHERE id=$1 AND tenant_id=$2`,
        [req.params.id, tenantId],
      );
      if (!cur.rowCount) return res.status(404).json({ error: 'Không tìm thấy' });
      // Cho phép chạy thủ công nếu ACTIVE (không cần activate lại)
      if (cur.rows[0].status !== 'ACTIVE') {
        // Tự động kích hoạt tạm thời để chạy
        await pool.query(`UPDATE campaigns SET status='ACTIVE', updated_at=NOW() WHERE id=$1`, [cur.rows[0].id]);
      }
      const result = await runCampaign(pool, cur.rows[0].id, publicBaseUrl());
      res.json(result);
    } catch (err: any) {
      logger.error('[Campaign] Lỗi run-now:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Admin: Recipients ──────────────────────────────────────────────────────
  router.get('/api/campaigns/:id/recipients', authenticateToken, requireAdminOrLead, async (req, res) => {
    const tenantId = getTenantId(req);
    const exist = await pool.query(
      `SELECT 1 FROM campaigns WHERE id=$1 AND tenant_id=$2`,
      [req.params.id, tenantId],
    );
    if (!exist.rowCount) return res.status(404).json({ error: 'Không tìm thấy' });

    const r = await pool.query(
      `SELECT id, email, name, variant, status, sent_at, opened_at, clicked_at, error
         FROM campaign_recipients
        WHERE campaign_id = $1
        ORDER BY created_at DESC
        LIMIT 500`,
      [req.params.id],
    );
    res.json({ data: r.rows, total: r.rowCount });
  });

  return router;
}
