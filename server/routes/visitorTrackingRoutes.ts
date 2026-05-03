/**
 * Public visitor tracking endpoint.
 *
 * POST /api/public/visitor/track
 *   Body: { visitorId, sessionId, page, pageLabel, referrer,
 *           utm: { source, medium, campaign, term, content },
 *           gclid, fbclid, projectCode }
 *
 * - Public (no auth) — dùng cho khách vãng lai trên landing/microsite.
 * - Tenant resolve qua Host middleware (req.publicTenant). Nếu Host = apex
 *   thì lưu với tenant_id = NULL (chưa biết thuộc CĐT nào) — vẫn track được
 *   nhưng không thuộc CĐT cụ thể.
 * - Rate limited 60 req/phút/IP để tránh spam pageview.
 * - "Best-effort": lỗi DB không bao giờ làm sập client (luôn return 204).
 */

import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { rateLimit } from '../middleware/rateLimiter';
import { logger } from '../middleware/logger';
import type { TenantHostBinding } from '../services/tenantBrandingService';

const trackRateLimit = rateLimit({
  name: 'public_visitor_track',
  windowMs: 60 * 1000,
  maxRequests: 60,
  keyFn: (req) => `vtrk:${req.ip || 'anon'}`,
  message: 'Too many tracking events',
});

function s(v: any, max: number): string | null {
  if (v == null) return null;
  const t = String(v).trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max) : t;
}

const VISITOR_ID_RE = /^[a-zA-Z0-9_-]{8,64}$/;

export function createVisitorTrackingRoutes(): Router {
  const router = Router();

  router.post('/track', trackRateLimit, async (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as Record<string, any>;
      const visitorId = s(body.visitorId, 64);
      if (!visitorId || !VISITOR_ID_RE.test(visitorId)) {
        return res.status(400).json({ ok: false, error: 'visitorId không hợp lệ' });
      }

      const utm = (body.utm && typeof body.utm === 'object') ? body.utm : {};
      const hostBinding: TenantHostBinding | null = (req as any).publicTenant ?? null;

      await pool.query(
        `INSERT INTO visitor_events
           (tenant_id, visitor_id, session_id, event_type, page, page_label, referrer,
            utm_source, utm_medium, utm_campaign, utm_term, utm_content,
            gclid, fbclid, project_code, ip_address, user_agent)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        [
          hostBinding?.tenantId ?? null,
          visitorId,
          s(body.sessionId, 64),
          s(body.eventType, 32) || 'pageview',
          s(body.page, 500),
          s(body.pageLabel, 200),
          s(body.referrer, 500),
          s(utm.source ?? utm.utm_source, 100),
          s(utm.medium ?? utm.utm_medium, 100),
          s(utm.campaign ?? utm.utm_campaign, 200),
          s(utm.term ?? utm.utm_term, 200),
          s(utm.content ?? utm.utm_content, 200),
          s(body.gclid, 200),
          s(body.fbclid, 200),
          s(body.projectCode, 64),
          s(req.ip, 64),
          s(req.headers['user-agent'], 300),
        ]
      );

      res.status(204).end();
    } catch (err: any) {
      logger.warn(`[VisitorTrack] insert failed: ${err?.message || err}`);
      // Tracking không bao giờ block client.
      res.status(204).end();
    }
  });

  return router;
}
