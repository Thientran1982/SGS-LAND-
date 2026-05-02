/**
 * Public mini-site endpoints for individual projects.
 *
 *   GET  /api/public/projects/:code        → whitelisted project + listings + tenant contact
 *   POST /api/public/projects/:code/leads  → public lead capture (rate-limited, dedup 24h)
 *
 * Hardening:
 * - No authenticated middleware on this router (whitelisted public endpoint).
 * - Project must have `metadata.public_microsite === true`, else 404 (kể cả khi
 *   project tồn tại nhưng admin chưa bật mini-site).
 * - Listing fields are explicitly whitelisted — owner/commission/audit fields
 *   never leak ra client công khai.
 * - Listing status filter: chỉ trả về AVAILABLE / BOOKING / OPENING. Các trạng
 *   thái HOLD / SOLD / RENTED / INACTIVE bị ẩn để khách không thấy giá đã chốt
 *   hoặc sản phẩm tạm khoá.
 * - Server-side cache 5 phút (publicProjectCache) — invalidate khi project
 *   hoặc listing thuộc project đó được mutate.
 * - Lead form rate-limited 5 req/h per IP; dedup theo phone+code 24h để chặn
 *   submit lặp.
 */

import { Router, Request, Response } from 'express';
import { pool, withRlsBypass } from '../db';
import { logger } from '../middleware/logger';
import { brevoSendEmail } from '../services/brevoService';
import {
  getPublicProjectCache,
  setPublicProjectCache,
  evictPublicProjectCache,
} from '../services/publicProjectCache';
import { rateLimit } from '../middleware/rateLimiter';

const HOTLINE = '0971132378';
const HOTLINE_DISPLAY = '0971 132 378';
const ZALO_URL = 'https://zalo.me/0971132378';
const INTERNAL_INBOX = process.env.LANDING_LEAD_INBOX || 'info@sgsland.vn';

// Listing statuses cho phép hiển thị công khai (không lộ HOLD/SOLD/INACTIVE)
const PUBLIC_LISTING_STATUSES = new Set(['AVAILABLE', 'BOOKING', 'OPENING']);

// Whitelist trường listing — KHÔNG bao gồm ownerName/Phone/commission/audit
const PUBLIC_LISTING_FIELDS = [
  'id',
  'code',
  'title',
  'type',
  'transaction',
  'status',
  'price',
  'currency',
  'area',
  'builtArea',
  'bedrooms',
  'bathrooms',
  'location',
  'images',
  'attributes',
] as const;

// Attribute keys an toàn để công khai (loại bỏ nội bộ như note, commission_note,…)
const PUBLIC_ATTRIBUTE_KEYS = new Set([
  'tower',
  'block',
  'floor',
  'orientation',
  'view',
  'unitNumber',
  'unit_number',
  'unitType',
  'unit_type',
  'legalStatus',
  'legal_status',
  'furniture',
  'handover',
  'handover_status',
  'description',
  'amenities',
  'project_amenities',
  'highlights',
]);

// Rate limit dành riêng cho microsite lead form: 5 req / giờ / IP
const publicMicrositeLeadRateLimit = rateLimit({
  name: 'public_microsite_lead',
  windowMs: 60 * 60 * 1000,
  maxRequests: 5,
  keyFn: (req) => `pml:${req.ip || 'anonymous'}`,
  message:
    'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau ít nhất 1 giờ hoặc gọi hotline.',
});

function isValidVNPhone(p: string): boolean {
  return /^(0|\+84)\d{9,10}$/.test(p.replace(/\s+/g, ''));
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function pickPublicAttributes(attrs: any): Record<string, any> {
  if (!attrs || typeof attrs !== 'object') return {};
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(attrs)) {
    if (PUBLIC_ATTRIBUTE_KEYS.has(k) && v !== null && v !== undefined && v !== '') {
      out[k] = v;
    }
  }
  return out;
}

function pickPublicListing(row: any) {
  const out: Record<string, any> = {};
  for (const f of PUBLIC_LISTING_FIELDS) {
    if (f === 'attributes') {
      out.attributes = pickPublicAttributes(row.attributes);
    } else if (f === 'images') {
      out.images = Array.isArray(row.images) ? row.images.slice(0, 10) : [];
    } else {
      out[f] = row[f] ?? null;
    }
  }
  return out;
}

function pickPublicProject(row: any) {
  const meta = (row.metadata && typeof row.metadata === 'object') ? row.metadata : {};
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description,
    location: row.location,
    status: row.status,
    totalUnits: row.total_units ?? row.totalUnits ?? null,
    openDate: row.open_date ?? row.openDate ?? null,
    handoverDate: row.handover_date ?? row.handoverDate ?? null,
    coverImage: meta.coverImage || meta.cover_image || null,
    metadata: {
      // Chỉ trả về các metadata an toàn — KHÔNG trả drive_url (tài liệu nội bộ)
      coverImage: meta.coverImage || meta.cover_image || null,
      gallery: Array.isArray(meta.gallery) ? meta.gallery.slice(0, 30) : [],
      amenities: Array.isArray(meta.amenities) ? meta.amenities : [],
      highlights: Array.isArray(meta.highlights) ? meta.highlights : [],
      developer: meta.developer || null,
      website: meta.website || null,
    },
  };
}

/**
 * Tra cứu project theo code, cross-tenant (vì microsite là public, không có
 * session để xác định tenant). withRlsBypass + ràng buộc bằng `code` + flag
 * `metadata.public_microsite=true`.
 */
async function findPublicProjectByCode(code: string): Promise<{ project: any; tenantId: string } | null> {
  return withRlsBypass(async (client) => {
    const result = await client.query(
      `SELECT *
         FROM projects
         WHERE code = $1
           AND metadata->>'public_microsite' = 'true'
         LIMIT 1`,
      [code]
    );
    if (!result.rows[0]) return null;
    return { project: result.rows[0], tenantId: result.rows[0].tenant_id };
  });
}

async function findPublicListingsByProject(tenantId: string, code: string): Promise<any[]> {
  return withRlsBypass(async (client) => {
    const result = await client.query(
      `SELECT id, code, title, type, transaction, status, price, currency,
              area, built_area AS "builtArea", bedrooms, bathrooms, location,
              images, attributes
         FROM listings
         WHERE tenant_id = $1
           AND project_code = $2
           AND status = ANY($3::text[])
         ORDER BY
           CASE status
             WHEN 'OPENING'   THEN 0
             WHEN 'BOOKING'   THEN 1
             WHEN 'AVAILABLE' THEN 2
             ELSE 99
           END,
           price NULLS LAST,
           code
         LIMIT 200`,
      [tenantId, code, Array.from(PUBLIC_LISTING_STATUSES)]
    );
    return result.rows;
  });
}

async function checkDuplicateLead(tenantId: string, phone: string, code: string): Promise<boolean> {
  try {
    const result = await pool.query(
      `SELECT id FROM leads
         WHERE tenant_id = $1
           AND phone = $2
           AND metadata->>'project_code' = $3
           AND created_at > NOW() - INTERVAL '24 hours'
         LIMIT 1`,
      [tenantId, phone, code]
    );
    return result.rows.length > 0;
  } catch {
    return false;
  }
}

export function createPublicProjectRoutes(): Router {
  const router = Router();

  // GET /api/public/projects/:code — full payload (cached 5 phút)
  router.get('/:code', async (req: Request, res: Response) => {
    const code = String(req.params.code || '').trim().toUpperCase();
    if (!code || !/^[A-Z0-9][A-Z0-9_-]{0,63}$/.test(code)) {
      return res.status(400).json({ ok: false, error: 'Mã dự án không hợp lệ' });
    }

    try {
      const cached = getPublicProjectCache(code);
      if (cached) {
        res.setHeader('X-Public-Project-Cache', 'HIT');
        res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
        return res.json(cached);
      }

      const found = await findPublicProjectByCode(code);
      if (!found) {
        // Không leak việc project có tồn tại nhưng chưa bật mini-site
        return res.status(404).json({ ok: false, error: 'Dự án chưa công khai hoặc không tồn tại' });
      }

      const listingsRaw = await findPublicListingsByProject(found.tenantId, code);
      const listings = listingsRaw.map(pickPublicListing);
      const project = pickPublicProject(found.project);

      const payload = {
        ok: true,
        project,
        listings,
        listingCount: listings.length,
        tenantContact: {
          hotline: HOTLINE,
          hotlineDisplay: HOTLINE_DISPLAY,
          zalo: ZALO_URL,
        },
        cachedAt: new Date().toISOString(),
      };

      setPublicProjectCache(code, payload);
      res.setHeader('X-Public-Project-Cache', 'MISS');
      res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
      res.json(payload);
    } catch (err: any) {
      logger.error(`[PublicProject] GET /${code} failed: ${err?.message || err}`);
      res.status(500).json({ ok: false, error: 'Lỗi máy chủ. Vui lòng thử lại.' });
    }
  });

  // POST /api/public/projects/:code/leads — public lead capture
  router.post('/:code/leads', publicMicrositeLeadRateLimit, async (req: Request, res: Response) => {
    const code = String(req.params.code || '').trim().toUpperCase();
    if (!code || !/^[A-Z0-9][A-Z0-9_-]{0,63}$/.test(code)) {
      return res.status(400).json({ ok: false, error: 'Mã dự án không hợp lệ' });
    }

    try {
      const body = (req.body || {}) as Record<string, any>;
      const name = String(body.name || '').trim().slice(0, 120);
      const phoneRaw = String(body.phone || '').trim();
      const phone = phoneRaw.replace(/\s+/g, '');
      const email = String(body.email || '').trim().slice(0, 200);
      const note = String(body.note || '').trim().slice(0, 1000);
      const interest = String(body.interest || '').trim().slice(0, 200);

      if (!name || !phone) {
        return res.status(400).json({
          ok: false,
          error: 'Vui lòng nhập đầy đủ Họ tên và Số điện thoại.',
        });
      }
      if (!isValidVNPhone(phone)) {
        return res.status(400).json({
          ok: false,
          error: 'Số điện thoại không hợp lệ. Vui lòng nhập số Việt Nam (10-11 chữ số).',
        });
      }

      // Resolve project (must be public) → lấy tenantId để lưu lead đúng tenant
      const found = await findPublicProjectByCode(code);
      if (!found) {
        return res.status(404).json({ ok: false, error: 'Dự án chưa công khai hoặc không tồn tại' });
      }

      // Dedup 24h theo phone + code
      const dup = await checkDuplicateLead(found.tenantId, phone, code);
      if (dup) {
        return res.json({
          ok: true,
          deduped: true,
          message:
            'Yêu cầu của bạn đã được ghi nhận trước đó. Chuyên viên sẽ liên hệ trong thời gian sớm nhất.',
        });
      }

      const tags = ['microsite', `code:${code}`];
      const metadata = {
        project_code: code,
        project_name: found.project.name,
        source_type: 'microsite',
        page_url: String(body.pageUrl || '').slice(0, 500),
        referrer: String(body.referrer || '').slice(0, 500),
        ip: req.ip || null,
        user_agent: String(req.headers['user-agent'] || '').slice(0, 300),
      };
      const notes = [
        interest ? `Quan tâm: ${interest}` : '',
        note,
      ].filter(Boolean).join('\n\n') || null;

      let leadId: string | null = null;
      try {
        const result = await pool.query(
          `INSERT INTO leads (tenant_id, name, phone, email, source, stage, notes, tags, metadata)
             VALUES ($1, $2, $3, $4, $5, 'NEW', $6, $7::jsonb, $8::jsonb)
             RETURNING id`,
          [
            found.tenantId,
            name,
            phone,
            email || null,
            `microsite-${code}`,
            notes,
            JSON.stringify(tags),
            JSON.stringify(metadata),
          ]
        );
        leadId = result.rows[0]?.id ?? null;
      } catch (dbErr: any) {
        logger.error(`[PublicProject] Lead insert failed: ${dbErr?.message || dbErr}`);
      }

      // Notify hotline inbox (best-effort, không block phản hồi cho user)
      try {
        const subject = `[Mini-site] ${found.project.name} — ${name} (${phone})`;
        const htmlBody = `
          <div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto;padding:24px;background:#f8fafc;border-radius:12px;">
            <h2 style="margin:0 0 16px;color:#1e293b;">Lead mới từ Mini-site dự án</h2>
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <tr><td style="padding:6px 0;color:#64748b;">Dự án</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(found.project.name)} (${escapeHtml(code)})</td></tr>
              <tr><td style="padding:6px 0;color:#64748b;">Họ tên</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(name)}</td></tr>
              <tr><td style="padding:6px 0;color:#64748b;">Điện thoại</td><td style="padding:6px 0;"><a href="tel:${escapeHtml(phone)}">${escapeHtml(phone)}</a></td></tr>
              ${email ? `<tr><td style="padding:6px 0;color:#64748b;">Email</td><td style="padding:6px 0;"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>` : ''}
              ${interest ? `<tr><td style="padding:6px 0;color:#64748b;">Quan tâm</td><td style="padding:6px 0;">${escapeHtml(interest)}</td></tr>` : ''}
              ${note ? `<tr><td style="padding:6px 0;color:#64748b;vertical-align:top;">Ghi chú</td><td style="padding:6px 0;white-space:pre-wrap;">${escapeHtml(note)}</td></tr>` : ''}
            </table>
            <p style="margin-top:16px;color:#94a3b8;font-size:12px;">Nguồn: ${escapeHtml(metadata.page_url || `/p/${code}`)}</p>
          </div>`;
        await brevoSendEmail({
          to: [{ email: INTERNAL_INBOX, name: 'SGS Land Hotline' }],
          subject,
          html: htmlBody,
          text: `Lead mới: ${name} / ${phone}${email ? ' / ' + email : ''} — ${found.project.name} (${code})`,
          replyTo: email ? { email, name } : undefined,
          tags: ['microsite-lead', `code-${code.toLowerCase()}`],
        }).catch((e) => logger.warn(`[PublicProject] Brevo send failed: ${e?.message}`));
      } catch (emailErr: any) {
        logger.warn(`[PublicProject] Notification email skipped: ${emailErr?.message || emailErr}`);
      }

      logger.info(`[PublicProject] Lead captured: ${name}/${phone} → ${found.project.name} (${code})`);

      return res.json({
        ok: true,
        leadId,
        message: `Cảm ơn ${name}! Chuyên viên sẽ liên hệ trong vòng 30 phút. Hotline: ${HOTLINE_DISPLAY}.`,
      });
    } catch (err: any) {
      logger.error(`[PublicProject] POST /${code}/leads failed: ${err?.message || err}`);
      res.status(500).json({ ok: false, error: 'Có lỗi xảy ra. Vui lòng gọi hotline 0971 132 378.' });
    }
  });

  return router;
}

// Re-export cache helper để các route khác (projectRoutes / listingRoutes)
// có thể invalidate khi mutate.
export { evictPublicProjectCache };
