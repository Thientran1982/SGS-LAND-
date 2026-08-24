import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { rateLimit } from '../middleware/rateLimiter';
import { logger } from '../middleware/logger';
import type { TenantHostBinding } from '../services/tenantBrandingService';
import { notificationRepository } from '../repositories/notificationRepository';
import { brevoSendEmail, isBrevoConfigured } from '../services/brevoService';
import { emailBase } from '../services/emailService';
import { userRepository } from '../repositories/userRepository';

/**
 * Visitor tracking + consent + data-erasure routes.
 * Mounted publicly at /api/public/visitor (see server.ts).
 *
 * Phap ly (Nghi dinh 13/2023/ND-CP, Luat 91/2025/QH15):
 * - Theo doi hanh vi (BEHAVIORAL) chi duoc ghi nhan neu khach da dong y (opt-in ro rang).
 *   "Im lang" hoac chua tuong tac voi banner KHONG duoc coi la dong y.
 * - Moi lan dong y / tu choi deu duoc ghi vao so sach append-only `consent_records`
 *   de co bang chung khi bi thanh tra/khieu nai.
 * - Yeu cau xoa du lieu (`data_erasure_requests`) phai duoc xu ly trong 72 gio.
 */

const trackRateLimit = rateLimit({
  name: 'public_visitor_track',
  windowMs: 60 * 1000,
  maxRequests: 60,
  keyFn: (req) => `vtrk:${req.ip || 'anon'}`,
  message: 'Too many tracking events',
});

const consentRateLimit = rateLimit({
  name: 'public_visitor_consent',
  windowMs: 60 * 1000,
  maxRequests: 30,
  keyFn: (req) => `vcon:${req.ip || 'anon'}`,
  message: 'Too many consent requests',
});

const erasureRateLimit = rateLimit({
  name: 'public_visitor_erasure',
  windowMs: 60 * 60 * 1000,
  maxRequests: 5,
  keyFn: (req) => `vera:${req.ip || 'anon'}`,
  message: 'Too many data erasure requests',
});

function s(v: any, max: number): string | null {
  if (v == null) return null;
  const t = String(v).trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max) : t;
}

const VISITOR_ID_RE = /^[a-zA-Z0-9_-]{8,64}$/;
const CONSENT_CATEGORIES = ['ESSENTIAL', 'BEHAVIORAL', 'ADVERTISING'] as const;
type ConsentCategory = (typeof CONSENT_CATEGORIES)[number];

// Đủ 3 lần xem lại cùng 1 BĐS trong 48h => coi là "lead nóng"
const HOT_LEAD_REVISIT_THRESHOLD = 3;
const HOT_LEAD_WINDOW_HOURS = 48;
const ERASURE_SLA_HOURS = 72;

async function hasBehavioralConsent(tenantId: string | null, visitorId: string): Promise<boolean> {
  const r = await pool.query(
    `SELECT granted FROM consent_records
       WHERE visitor_id = $1 AND category = 'BEHAVIORAL'
         AND (tenant_id = $2 OR ($2::uuid IS NULL AND tenant_id IS NULL))
       ORDER BY created_at DESC LIMIT 1`,
    [visitorId, tenantId]
  );
  return r.rows.length > 0 && r.rows[0].granted === true;
}

/**
 * Sau khi ghi nhan 1 property_view, kiem tra xem visitor co dang "nong" khong
 * (xem lai cung 1 BDS >= HOT_LEAD_REVISIT_THRESHOLD lan trong HOT_LEAD_WINDOW_HOURS).
 * Neu co, va visitor da duoc gan voi 1 Lead co nguoi phu trach (assigned_to),
 * day 1 notification noi bo vao CRM (khong tu dong nhan tin ra ngoai cho khach).
 */
async function maybeNotifyHotLead(
  tenantId: string | null,
  visitorId: string,
  listingCode: string | null
): Promise<void> {
  if (!listingCode) return;
  try {
    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS c FROM visitor_events
         WHERE visitor_id = $1
           AND event_type = 'property_view'
           AND metadata->>'listingCode' = $2
           AND created_at > NOW() - ($3 || ' hours')::interval`,
      [visitorId, listingCode, HOT_LEAD_WINDOW_HOURS]
    );
    const revisitCount = countRes.rows[0]?.c ?? 0;
    if (revisitCount < HOT_LEAD_REVISIT_THRESHOLD) return;

    const leadRes = await pool.query(
      `SELECT id, tenant_id, assigned_to, name, phone FROM leads
         WHERE visitor_id = $1 AND assigned_to IS NOT NULL
         ORDER BY created_at DESC LIMIT 1`,
      [visitorId]
    );
    if (leadRes.rows.length === 0) return;
    const lead = leadRes.rows[0];

    // Tránh spam: chỉ tạo notification hot-lead 1 lần mỗi 6 giờ cho cùng 1 lead + listing.
    const recentNotif = await pool.query(
      `SELECT 1 FROM notifications
         WHERE tenant_id = $1 AND user_id = $2 AND type = 'hot_lead_revisit'
           AND metadata->>'leadId' = $3 AND metadata->>'listingCode' = $4
           AND created_at > NOW() - interval '6 hours'
         LIMIT 1`,
      [lead.tenant_id, lead.assigned_to, lead.id, listingCode]
    );
    if ((recentNotif.rowCount ?? 0) > 0) return;

    await notificationRepository.create({
      tenantId: lead.tenant_id,
      userId: lead.assigned_to,
      type: 'hot_lead_revisit',
      title: `Lead nóng: ${lead.name || 'Khách hàng'} đã xem lại BĐS ${listingCode} ${revisitCount} lần`,
      body: `Khách đã xem BĐS ${listingCode} ${revisitCount} lần trong ${HOT_LEAD_WINDOW_HOURS} giờ qua. Nên liên hệ ngay.`,
      metadata: { leadId: lead.id, listingCode, revisitCount, source: 'visitor_tracking' },
    });

    // Gui email canh bao cho broker duoc gan (best-effort, khong chan luong chinh)
    try {
      if (isBrevoConfigured()) {
        const assignee = await userRepository.findByIdDirect(lead.assigned_to, lead.tenant_id);
        if (assignee?.email) {
          const leadName = lead.name || 'Khách hàng';
          const phoneLine = lead.phone ? ` (SĐT: ${lead.phone})` : '';
          const html = `<p>Chào ${assignee.name || 'bạn'},</p><p>Khách hàng <b>${leadName}</b>${phoneLine} vừa xem lại bất động sản <b>${listingCode}</b> ${revisitCount} lần trong ${HOT_LEAD_WINDOW_HOURS} giờ qua. Đây là lead nóng, nên liên hệ ngay.</p>`;
          const text = `Khách hàng ${leadName}${phoneLine} vừa xem lại BĐS ${listingCode} ${revisitCount} lần trong ${HOT_LEAD_WINDOW_HOURS} giờ qua. Nên liên hệ ngay.`;
          const emailResult = await brevoSendEmail({
            to: [{ email: assignee.email, name: assignee.name || undefined }],
            subject: `Lead nóng: ${leadName} đã xem lại BĐS ${listingCode}`,
            html: emailBase(html, 'Cảnh báo tự động từ SGS LAND.'),
            text,
            tags: ['hot-lead-revisit'],
          });
          if (!emailResult.success) {
            logger.warn(`[VisitorTrack] hot-lead email failed for ${assignee.email}: ${emailResult.error}`);
          }
        }
      }
    } catch (emailErr: any) {
      logger.warn(`[VisitorTrack] hot-lead email send error: ${emailErr?.message || emailErr}`);
    }
  } catch (err: any) {
    logger.warn(`[VisitorTrack] hot-lead check failed: ${err?.message || err}`);
  }
}

export function createVisitorTrackingRoutes(): Router {
  const router = Router();

  // ─── POST /track — ghi nhận 1 sự kiện hành vi (chỉ khi đã có BEHAVIORAL consent) ───
  router.post('/track', trackRateLimit, async (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as Record<string, any>;
      const visitorId = s(body.visitorId, 64);
      if (!visitorId || !VISITOR_ID_RE.test(visitorId)) {
        return res.status(400).json({ ok: false, error: 'visitorId không hợp lệ' });
      }

      const hostBinding: TenantHostBinding | null = (req as any).publicTenant ?? null;
      const tenantId = hostBinding?.tenantId ?? null;

      const consented = await hasBehavioralConsent(tenantId, visitorId);
      if (!consented) {
        // Không insert, không lỗi — client không cần biết chi tiết, chỉ cần biết là chưa track.
        return res.status(204).end();
      }

      const utm = (body.utm && typeof body.utm === 'object') ? body.utm : {};
      const metadata = (body.metadata && typeof body.metadata === 'object') ? body.metadata : {};
      const listingCode = s(metadata.listingCode, 64);

      await pool.query(
        `INSERT INTO visitor_events
           (tenant_id, visitor_id, session_id, event_type, page, page_label, referrer,
            utm_source, utm_medium, utm_campaign, utm_term, utm_content,
            gclid, fbclid, project_code, ip_address, user_agent, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
        [
          tenantId,
          visitorId,
          s(body.sessionId, 64),
          s(body.eventType, 32) || 'pageview',
          s(body.page, 500),
          s(body.pageLabel, 200),
          s(body.referrer, 500),
          s(utm.utm_source ?? utm.utmSource, 100),
          s(utm.utm_medium ?? utm.utmMedium, 100),
          s(utm.utm_campaign ?? utm.utmCampaign, 200),
          s(utm.utm_term ?? utm.utmTerm, 200),
          s(utm.utm_content ?? utm.utmContent, 200),
          s(body.gclid, 200),
          s(body.fbclid, 200),
          s(body.projectCode, 64),
          s(req.ip, 64),
          s(req.headers['user-agent'], 300),
          JSON.stringify(metadata),
        ]
      );

      res.status(204).end();

      if (s(body.eventType, 32) === 'property_view' && listingCode) {
        void maybeNotifyHotLead(tenantId, visitorId, listingCode);
      }
    } catch (err: any) {
      logger.warn(`[VisitorTrack] insert failed: ${err?.message || err}`);
      // Tracking không bao giờ block client.
      res.status(204).end();
    }
  });

  // ─── POST /consent — ghi 1 dòng mới vào sổ đồng ý (append-only, không update) ───
  router.post('/consent', consentRateLimit, async (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as Record<string, any>;
      const visitorId = s(body.visitorId, 64);
      const category = s(body.category, 20) as ConsentCategory | null;
      if (!visitorId || !VISITOR_ID_RE.test(visitorId)) {
        return res.status(400).json({ ok: false, error: 'visitorId không hợp lệ' });
      }
      if (!category || !CONSENT_CATEGORIES.includes(category)) {
        return res.status(400).json({ ok: false, error: 'category không hợp lệ' });
      }
      if (category === 'ESSENTIAL' && body.granted === false) {
        return res.status(400).json({ ok: false, error: 'ESSENTIAL không thể từ chối' });
      }

      const hostBinding: TenantHostBinding | null = (req as any).publicTenant ?? null;

      await pool.query(
        `INSERT INTO consent_records
           (tenant_id, visitor_id, category, granted, consent_version, ip_address, user_agent)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          hostBinding?.tenantId ?? null,
          visitorId,
          category,
          Boolean(body.granted),
          s(body.consentVersion, 32),
          s(req.ip, 64),
          s(req.headers['user-agent'], 300),
        ]
      );

      res.status(200).json({ ok: true });
    } catch (err: any) {
      logger.warn(`[VisitorConsent] insert failed: ${err?.message || err}`);
      res.status(500).json({ ok: false, error: 'Không thể ghi nhận sự đồng ý' });
    }
  });

  // ─── GET /consent/:visitorId — trạng thái đồng ý mới nhất theo từng category ───
  router.get('/consent/:visitorId', consentRateLimit, async (req: Request, res: Response) => {
    try {
      const visitorId = s(req.params.visitorId, 64);
      if (!visitorId || !VISITOR_ID_RE.test(visitorId)) {
        return res.status(400).json({ ok: false, error: 'visitorId không hợp lệ' });
      }

      const r = await pool.query(
        `SELECT DISTINCT ON (category) category, granted, consent_version, created_at
           FROM consent_records
           WHERE visitor_id = $1
           ORDER BY category, created_at DESC`,
        [visitorId]
      );

      const state: Record<string, { granted: boolean; consentVersion: string | null; updatedAt: string }> = {};
      for (const row of r.rows) {
        state[row.category] = {
          granted: row.granted,
          consentVersion: row.consent_version,
          updatedAt: row.created_at,
        };
      }
      res.status(200).json({ ok: true, consent: state });
    } catch (err: any) {
      logger.warn(`[VisitorConsent] fetch failed: ${err?.message || err}`);
      res.status(500).json({ ok: false, error: 'Không thể tải trạng thái đồng ý' });
    }
  });

  // ─── POST /erasure-requests — yêu cầu xoá dữ liệu cá nhân (SLA 72 giờ) ───
  router.post('/erasure-requests', erasureRateLimit, async (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as Record<string, any>;
      const visitorId = s(body.visitorId, 64);
      const email = s(body.email, 200);
      const phone = s(body.phone, 30);
      if (!visitorId && !email && !phone) {
        return res.status(400).json({
          ok: false,
          error: 'Cần cung cấp visitorId, email hoặc số điện thoại để xác định dữ liệu cần xoá',
        });
      }

      const hostBinding: TenantHostBinding | null = (req as any).publicTenant ?? null;

      const r = await pool.query(
        `INSERT INTO data_erasure_requests
           (tenant_id, visitor_id, requested_email, requested_phone, notes, due_at)
         VALUES ($1,$2,$3,$4,$5, NOW() + ($6 || ' hours')::interval)
         RETURNING id, due_at`,
        [
          hostBinding?.tenantId ?? null,
          visitorId,
          email,
          phone,
          s(body.notes, 500),
          ERASURE_SLA_HOURS,
        ]
      );

      res.status(201).json({ ok: true, requestId: r.rows[0].id, dueAt: r.rows[0].due_at });
    } catch (err: any) {
      logger.warn(`[VisitorErasure] insert failed: ${err?.message || err}`);
      res.status(500).json({ ok: false, error: 'Không thể ghi nhận yêu cầu xoá dữ liệu' });
    }
  });

  return router;
}
