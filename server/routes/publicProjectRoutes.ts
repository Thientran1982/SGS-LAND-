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
import { emailBase } from '../services/emailService';
import { recordEmailSend } from '../services/emailMetricsService';
import {
  getPublicProjectCache,
  setPublicProjectCache,
  evictPublicProjectCache,
} from '../services/publicProjectCache';
import { rateLimit } from '../middleware/rateLimiter';
import {
  brandingFromConfig,
  getTenantBinding,
  resolveTenantSenderEmail,
  type TenantBranding,
  type TenantHostBinding,
} from '../services/tenantBrandingService';

// Base URL for converting relative image paths to absolute — required by React Native Image component
const APP_BASE_URL = (process.env.APP_URL || 'https://sgsland.vn').replace(/\/+$/, '');

function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${APP_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

// Fallback platform-wide contact (chỉ dùng khi tenant chưa cấu hình public_brand)
const FALLBACK_HOTLINE         = '0379281445';
const FALLBACK_HOTLINE_DISPLAY = '0379 281 445';
const FALLBACK_ZALO_URL        = 'https://zalo.me/0379281445';
const INTERNAL_INBOX = process.env.LANDING_LEAD_INBOX || 'info@sgsland.vn';

// Cloudflare Turnstile — chỉ enforce khi env `TURNSTILE_SECRET_KEY` được cấu hình
// (theo task spec: "verify reCAPTCHA hoặc Cloudflare Turnstile (token sẵn nếu có)").
const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY || '';
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

async function verifyTurnstileToken(token: string, ip: string | undefined): Promise<boolean> {
  if (!TURNSTILE_SECRET) return true; // soft mode — chưa bật captcha
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret: TURNSTILE_SECRET, response: token });
    if (ip) body.append('remoteip', ip);
    const r = await fetch(TURNSTILE_VERIFY_URL, { method: 'POST', body });
    if (!r.ok) return false;
    const j: any = await r.json();
    return !!j?.success;
  } catch (err: any) {
    logger.warn(`[PublicProject] Turnstile verify error: ${err?.message || err}`);
    return false; // fail closed khi đã bật captcha
  }
}

interface TenantContact {
  brandName: string;
  hotline: string;
  hotlineDisplay: string;
  zalo: string;
}

/**
 * Build tenantContact từ tenants.name + enterprise_config['public_brand']
 * { hotline, hotlineDisplay, zalo, brandName? }. Fallback platform-wide chỉ
 * khi tenant chưa cấu hình.
 */
async function loadTenantContact(tenantId: string, defaultBrand: string): Promise<TenantContact> {
  try {
    const r = await pool.query(
      `SELECT t.name AS tenant_name, t.config AS tenant_config, ec.config_value AS brand
         FROM tenants t
         LEFT JOIN enterprise_config ec
           ON ec.tenant_id = t.id AND ec.config_key = 'public_brand'
         WHERE t.id = $1
         LIMIT 1`,
      [tenantId]
    );
    const row = r.rows[0] || {};
    // Ưu tiên branding của task #28 (tenants.config.branding); fallback enterprise_config.public_brand
    const wlBranding = brandingFromConfig(row.tenant_config);
    const brand = (row.brand && typeof row.brand === 'object') ? row.brand : {};
    const hotlineRaw = String(wlBranding.hotline || brand.hotline || '').trim();
    const hotline = hotlineRaw.replace(/\D/g, '') || FALLBACK_HOTLINE;
    const hotlineDisplay = String(wlBranding.hotlineDisplay || brand.hotlineDisplay || '').trim() ||
      (hotlineRaw ? hotlineRaw : FALLBACK_HOTLINE_DISPLAY);
    const zaloRaw = String(wlBranding.zalo || brand.zalo || '').trim();
    const zalo = zaloRaw
      ? (zaloRaw.startsWith('http') ? zaloRaw : `https://zalo.me/${zaloRaw.replace(/\D/g, '')}`)
      : (hotlineRaw ? `https://zalo.me/${hotline}` : FALLBACK_ZALO_URL);
    const brandName = String(
      wlBranding.displayName || brand.brandName || row.tenant_name || defaultBrand || 'SGS Land'
    ).trim();
    return { brandName, hotline, hotlineDisplay, zalo };
  } catch (err: any) {
    logger.warn(`[PublicProject] loadTenantContact failed: ${err?.message || err}`);
    return {
      brandName: defaultBrand || 'SGS Land',
      hotline: FALLBACK_HOTLINE,
      hotlineDisplay: FALLBACK_HOTLINE_DISPLAY,
      zalo: FALLBACK_ZALO_URL,
    };
  }
}

interface PublicBrandingPayload {
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string | null;
  displayName: string | null;
  messenger: string | null;
  ga4Id: string | null;
  fbPixelId: string | null;
  gtmId: string | null;
}

function pickPublicBranding(branding: TenantBranding): PublicBrandingPayload {
  return {
    logoUrl: branding.logoUrl,
    faviconUrl: branding.faviconUrl,
    primaryColor: branding.primaryColor,
    displayName: branding.displayName,
    messenger: branding.messenger,
    ga4Id: branding.ga4Id,
    fbPixelId: branding.fbPixelId,
    gtmId: branding.gtmId,
  };
}

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
    coverImage: resolveImageUrl(meta.coverImage || meta.cover_image),
    metadata: {
      // Chỉ trả về các metadata an toàn — KHÔNG trả drive_url (tài liệu nội bộ)
      coverImage: resolveImageUrl(meta.coverImage || meta.cover_image),
      gallery: Array.isArray(meta.gallery) ? meta.gallery.slice(0, 30) : [],
      amenities: Array.isArray(meta.amenities) ? meta.amenities : [],
      highlights: Array.isArray(meta.highlights) ? meta.highlights : [],
      developer: meta.developer || null,
      website: meta.website || null,
    },
  };
}

/**
 * Tra cứu project theo code. Khi `hostTenantId` được truyền (Host trỏ về
 * subdomain/custom domain của 1 CĐT) → scope query theo tenant đó để xử lý
 * đúng case 2 tenant trùng project code (vd "MCC"). Khi gọi từ apex
 * `sgsland.vn` (hostTenantId = null) → cross-tenant lookup như cũ và trả về
 * row đầu tiên public.
 *
 * Luôn `withRlsBypass` vì microsite là public, không có session để xác định
 * tenant trong RLS context.
 */
async function findPublicProjectByCode(
  code: string,
  hostTenantId?: string | null,
): Promise<{ project: any; tenantId: string } | null> {
  return withRlsBypass(async (client) => {
    if (hostTenantId) {
      const r = await client.query(
        `SELECT *
           FROM projects
           WHERE UPPER(code) = $1
             AND tenant_id = $2
             AND metadata->>'public_microsite' = 'true'
           LIMIT 1`,
        [code, hostTenantId]
      );
      if (!r.rows[0]) return null;
      return { project: r.rows[0], tenantId: r.rows[0].tenant_id };
    }
    const result = await client.query(
      `SELECT *
         FROM projects
         WHERE UPPER(code) = $1
           AND metadata->>'public_microsite' = 'true'
         ORDER BY created_at ASC NULLS LAST
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
           AND UPPER(project_code) = $2
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
    const result = await withRlsBypass((client) => client.query(
      `SELECT id FROM leads
         WHERE tenant_id = $1
           AND phone = $2
           AND UPPER(metadata->>'project_code') = $3
           AND created_at > NOW() - INTERVAL '24 hours'
         LIMIT 1`,
      [tenantId, phone, code]
    ));
    return result.rows.length > 0;
  } catch {
    return false;
  }
}

export function createPublicProjectRoutes(): Router {
  const router = Router();

  // GET /api/public/projects/featured — Sprint 7 (#57). Trả về danh sách rút
  // gọn các project được flag `metadata.public_microsite=true` để render
  // carousel "Dự án nổi bật" trên Discover của mobile app. Chúng ta tái sử
  // dụng cờ public_microsite (đã có sẵn cho web mini-site) thay vì bịa ra
  // một cờ `is_featured` riêng — cùng một tập project được CĐT chủ động bật
  // công khai. Endpoint nằm TRƯỚC `/:code` để Express không bắt nhầm
  // "featured" thành mã dự án.
  router.get('/featured', async (req: Request, res: Response) => {
    try {
      const limitRaw = typeof req.query.limit === 'string' && req.query.limit.trim()
        ? Number(req.query.limit)
        : NaN;
      const limit = Number.isInteger(limitRaw)
        ? Math.max(1, Math.min(20, limitRaw))
        : 8;
      // Featured selection rule:
      //  1) Curated set: any project with `metadata.is_featured='true'` —
      //     this is the explicit "is_featured" flag from the product spec
      //     and is what the upcoming admin UI (#61) will set.
      //  2) Fallback set: when no project has been curated yet, fall back
      //     to `metadata.public_microsite='true'` so the carousel never
      //     ships empty before ops has a chance to flip the flag.
      // Both branches share the same `featured_rank` ordering so the
      // semantic is "rank ASC, then most recent first".
      const rows = await withRlsBypass(async (client) => {
        const curated = await client.query(
          `SELECT id, name, code, description, location, status,
                  total_units, metadata, tenant_id
             FROM projects
            WHERE metadata->>'is_featured' = 'true'
              AND COALESCE(metadata->>'public_microsite', 'true') <> 'false'
            ORDER BY
              COALESCE((metadata->>'featured_rank')::int, 999),
              created_at DESC NULLS LAST
            LIMIT $1`,
          [limit],
        );
        if (curated.rows.length > 0) return curated.rows;
        const fallback = await client.query(
          `SELECT id, name, code, description, location, status,
                  total_units, metadata, tenant_id
             FROM projects
            WHERE metadata->>'public_microsite' = 'true'
            ORDER BY
              COALESCE((metadata->>'featured_rank')::int, 999),
              created_at DESC NULLS LAST
            LIMIT $1`,
          [limit],
        );
        return fallback.rows;
      });
      const projects = rows.map((row) => {
        const meta = (row.metadata && typeof row.metadata === 'object') ? row.metadata : {};
        return {
          id: row.id,
          name: row.name,
          code: row.code,
          location: row.location,
          status: row.status,
          totalUnits: row.total_units ?? null,
          coverImage: resolveImageUrl(meta.coverImage || meta.cover_image),
          description: row.description,
          developer: meta.developer || null,
        };
      });
      res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
      res.json({ ok: true, projects });
    } catch (err: any) {
      logger.error(`[PublicProject] GET /featured failed: ${err?.message || err}`);
      res.status(500).json({ ok: false, error: 'Lỗi máy chủ. Vui lòng thử lại.' });
    }
  });

  // GET /api/public/project-feed — GEO machine-readable entity catalog (JSON-LD).
  // Designed for LLM crawlers (GPTBot, ClaudeBot, PerplexityBot) that want a
  // structured entity feed of all public projects without paginating the full
  // /projects endpoint. Returns a JSON-LD @graph array of ApartmentComplex /
  // Residence entities. Cached 1 hour; no auth required.
  router.get('/project-feed', async (_req: Request, res: Response) => {
    try {
      const rows = await withRlsBypass(async (client) => {
        const result = await client.query<{
          id: string;
          name: string;
          code: string;
          description: string | null;
          location: string | null;
          status: string | null;
          total_units: number | null;
          metadata: Record<string, unknown>;
        }>(
          `SELECT id, name, code, description, location, status, total_units, metadata
             FROM projects
            WHERE metadata->>'public_microsite' = 'true'
            ORDER BY
              COALESCE((metadata->>'featured_rank')::int, 999),
              created_at DESC NULLS LAST
            LIMIT 50`,
        );
        return result.rows;
      });

      const baseUrl = 'https://sgsland.vn';
      const graph = rows.map((p) => {
        const meta = p.metadata || {};
        return {
          '@type': (meta.schema_type as string) || 'Residence',
          '@id': `${baseUrl}/du-an/${p.code.toLowerCase()}`,
          name: p.name,
          description: p.description || undefined,
          url: `${baseUrl}/du-an/${p.code.toLowerCase()}`,
          address: p.location
            ? { '@type': 'PostalAddress', addressLocality: p.location, addressCountry: 'VN' }
            : undefined,
          developer: meta.developer
            ? { '@type': 'Organization', name: meta.developer as string }
            : undefined,
          numberOfUnits: p.total_units || undefined,
          priceRange: (meta.price_range as string) || undefined,
          keywords: (meta.seo_keywords as string) || undefined,
          status: p.status || undefined,
        };
      });

      res.setHeader('Content-Type', 'application/ld+json; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.json({
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'SGS LAND — Danh mục dự án BĐS phân phối chính thức',
        description:
          'Machine-readable entity catalog of real estate projects distributed by SGS LAND in Vietnam. Updated hourly.',
        url: `${baseUrl}/api/public/project-feed`,
        publisher: {
          '@type': 'Organization',
          '@id': `${baseUrl}/#org`,
          name: 'SGS LAND',
          url: baseUrl,
        },
        numberOfItems: graph.length,
        itemListElement: graph.map((item, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          item,
        })),
        sameAs: `${baseUrl}/data/project-feed.json`,
        dateModified: new Date().toISOString().slice(0, 10),
      });
    } catch (err: any) {
      logger.error(`[PublicProject] GET /project-feed failed: ${err?.message || err}`);
      res.status(500).json({ ok: false, error: 'Lỗi máy chủ. Vui lòng thử lại.' });
    }

  // GET /api/geo-entity-feed — Full GEO entity feed: Organization + 13 Projects + Services + Datasets
  // Returns complete Schema.org JSON-LD knowledge graph for AI crawlers, LLM engines, and search bots
  // Mirrors /data/project-feed.json but served via API with proper content-type and CORS headers
  router.get('/geo-entity-feed', async (_req: Request, res: Response) => {
    try {
      const baseUrl = process.env.APP_URL || 'https://sgsland.vn';
      const now = new Date().toISOString().slice(0, 10);

      const entityFeed = {
        '@context': 'https://schema.org',
        '@type': 'Dataset',
        '@id': `${baseUrl}/data/project-feed.json`,
        'name': 'SGS LAND GEO Entity Feed — Knowledge Graph API',
        'description': 'Machine-readable entity feed for AI search engines and LLM crawlers. Contains Organization, 13 ApartmentComplex projects, Service entities, and Dataset references.',
        'version': '2.0.0',
        'dateModified': now,
        'creator': { '@id': `${baseUrl}/#organization` },
        'license': 'https://creativecommons.org/licenses/by/4.0/',
        'distribution': [
          { '@type': 'DataDownload', 'encodingFormat': 'application/json', 'contentUrl': `${baseUrl}/data/project-feed.json` },
          { '@type': 'DataDownload', 'encodingFormat': 'application/json', 'contentUrl': `${baseUrl}/api/geo-entity-feed` }
        ],
        '@graph': [
          {
            '@type': 'Organization',
            '@id': `${baseUrl}/#organization`,
            'name': 'SGS LAND',
            'url': baseUrl,
            'logo': `${baseUrl}/logo.svg`,
            'email': 'info@sgsland.vn',
            'telephone': '+84-379-281-445',
            'foundingDate': '2019',
            'knowsAbout': ['Bất động sản TP.HCM', 'Định giá AI', 'CRM BĐS', 'PropTech Việt Nam'],
            'sameAs': ['https://www.facebook.com/sgslandvn', 'https://www.linkedin.com/company/sgsland', 'https://g.page/sgsland'],
            'makesOffer': [
              { '@type': 'Offer', 'name': 'Định giá AI miễn phí', 'url': `${baseUrl}/ai-valuation`, 'price': '0', 'priceCurrency': 'VND' },
              { '@type': 'Offer', 'name': 'CRM Bất Động Sản', 'url': `${baseUrl}/crm-platform` },
              { '@type': 'Offer', 'name': 'Ký gửi BĐS', 'url': `${baseUrl}/ky-gui-bat-dong-san` }
            ]
          },
          {
            '@type': 'Service',
            '@id': `${baseUrl}/ai-valuation#service`,
            'name': 'Định Giá AI Bất Động Sản',
            'url': `${baseUrl}/ai-valuation`,
            'provider': { '@id': `${baseUrl}/#organization` },
            'description': 'Công cụ định giá BĐS miễn phí bằng AI, MAPE ±4.8%, kết quả trong 30 giây',
            'serviceType': 'Định giá bất động sản'
          },
          {
            '@type': 'ItemList',
            '@id': `${baseUrl}/data/project-feed.json#list`,
            'name': 'Danh sách 13 dự án bất động sản SGS LAND',
            'numberOfItems': 13,
            'itemListElement': [
              { '@type': 'ListItem', 'position': 1, 'item': { '@type': 'ApartmentComplex', '@id': `${baseUrl}/du-an/aqua-city#project`, 'name': 'Aqua City Novaland', 'url': `${baseUrl}/du-an/aqua-city`, 'geo': { '@type': 'GeoCoordinates', 'latitude': 10.9218, 'longitude': 106.8962 } } },
              { '@type': 'ListItem', 'position': 2, 'item': { '@type': 'ApartmentComplex', '@id': `${baseUrl}/du-an/vinhomes-grand-park#project`, 'name': 'Vinhomes Grand Park', 'url': `${baseUrl}/du-an/vinhomes-grand-park`, 'geo': { '@type': 'GeoCoordinates', 'latitude': 10.8354, 'longitude': 106.8298 } } },
              { '@type': 'ListItem', 'position': 3, 'item': { '@type': 'ApartmentComplex', '@id': `${baseUrl}/du-an/vinhomes-central-park#project`, 'name': 'Vinhomes Central Park', 'url': `${baseUrl}/du-an/vinhomes-central-park`, 'geo': { '@type': 'GeoCoordinates', 'latitude': 10.7956, 'longitude': 106.7220 } } },
              { '@type': 'ListItem', 'position': 4, 'item': { '@type': 'ApartmentComplex', '@id': `${baseUrl}/du-an/the-global-city#project`, 'name': 'The Global City', 'url': `${baseUrl}/du-an/the-global-city`, 'geo': { '@type': 'GeoCoordinates', 'latitude': 10.8007, 'longitude': 106.7564 } } },
              { '@type': 'ListItem', 'position': 5, 'item': { '@type': 'ApartmentComplex', '@id': `${baseUrl}/du-an/izumi-city#project`, 'name': 'Izumi City Nam Long', 'url': `${baseUrl}/du-an/izumi-city`, 'geo': { '@type': 'GeoCoordinates', 'latitude': 10.8560, 'longitude': 106.9612 } } },
              { '@type': 'ListItem', 'position': 6, 'item': { '@type': 'ApartmentComplex', '@id': `${baseUrl}/du-an/vinhomes-can-gio#project`, 'name': 'Vinhomes Cần Giờ', 'url': `${baseUrl}/du-an/vinhomes-can-gio`, 'geo': { '@type': 'GeoCoordinates', 'latitude': 10.4114, 'longitude': 106.8730 } } },
              { '@type': 'ListItem', 'position': 7, 'item': { '@type': 'ApartmentComplex', '@id': `${baseUrl}/du-an/van-phuc-city#project`, 'name': 'Van Phuc City', 'url': `${baseUrl}/du-an/van-phuc-city`, 'geo': { '@type': 'GeoCoordinates', 'latitude': 10.8897, 'longitude': 106.7198 } } },
              { '@type': 'ListItem', 'position': 8, 'item': { '@type': 'ApartmentComplex', '@id': `${baseUrl}/du-an/sala#project`, 'name': 'Sala Đại Quang Minh', 'url': `${baseUrl}/du-an/sala`, 'geo': { '@type': 'GeoCoordinates', 'latitude': 10.7877, 'longitude': 106.7315 } } },
              { '@type': 'ListItem', 'position': 9, 'item': { '@type': 'ApartmentComplex', '@id': `${baseUrl}/du-an/thu-thiem#project`, 'name': 'Khu Đô Thị Thủ Thiêm', 'url': `${baseUrl}/du-an/thu-thiem`, 'geo': { '@type': 'GeoCoordinates', 'latitude': 10.7880, 'longitude': 106.7320 } } },
              { '@type': 'ListItem', 'position': 10, 'item': { '@type': 'ApartmentComplex', '@id': `${baseUrl}/du-an/son-kim-land#project`, 'name': 'Son Kim Land', 'url': `${baseUrl}/du-an/son-kim-land`, 'geo': { '@type': 'GeoCoordinates', 'latitude': 10.7318, 'longitude': 106.7201 } } },
              { '@type': 'ListItem', 'position': 11, 'item': { '@type': 'ApartmentComplex', '@id': `${baseUrl}/du-an/masterise-homes#project`, 'name': 'Masterise Homes', 'url': `${baseUrl}/du-an/masterise-homes`, 'geo': { '@type': 'GeoCoordinates', 'latitude': 10.8003, 'longitude': 106.7562 } } },
              { '@type': 'ListItem', 'position': 12, 'item': { '@type': 'ApartmentComplex', '@id': `${baseUrl}/du-an/manhattan#project`, 'name': 'The Manhattan', 'url': `${baseUrl}/du-an/manhattan`, 'geo': { '@type': 'GeoCoordinates', 'latitude': 10.8360, 'longitude': 106.8305 } } },
              { '@type': 'ListItem', 'position': 13, 'item': { '@type': 'ApartmentComplex', '@id': `${baseUrl}/du-an/nha-pho-trung-tam#project`, 'name': 'Nhà Phố Trung Tâm TP.HCM', 'url': `${baseUrl}/du-an/nha-pho-trung-tam`, 'geo': { '@type': 'GeoCoordinates', 'latitude': 10.7769, 'longitude': 106.7009 } } }
            ]
          },
          {
            '@type': 'Dataset',
            '@id': `${baseUrl}/data/area-price-index.json`,
            'name': 'Chỉ số giá BĐS theo khu vực Đông Nam Bộ',
            'url': `${baseUrl}/data/area-price-index.json`,
            'creator': { '@id': `${baseUrl}/#organization` }
          },
          {
            '@type': 'Dataset',
            '@id': `${baseUrl}/data/knowledge-graph.json`,
            'name': 'SGS LAND Knowledge Graph v2.1',
            'url': `${baseUrl}/data/knowledge-graph.json`,
            'creator': { '@id': `${baseUrl}/#organization` }
          },
          {
            '@type': 'TechArticle',
            '@id': `${baseUrl}/data/valuation-methodology.json`,
            'name': 'Phương Pháp Định Giá AI SGS LAND — AVM v2.1',
            'url': `${baseUrl}/data/valuation-methodology.json`,
            'author': { '@id': `${baseUrl}/#organization` }
          }
        ]
      };

      res.setHeader('Content-Type', 'application/ld+json; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('X-Robots-Tag', 'noindex');
      res.json(entityFeed);
    } catch (err: any) {
      logger.error(`[GeoEntityFeed] GET /geo-entity-feed failed: ${err?.message || err}`);
      res.status(500).json({ ok: false, error: 'Lỗi máy chủ. Vui lòng thử lại.' });
    }
  });

  });

  // GET /api/public/projects/:code — full payload (cached 5 phút, scoped theo Host tenant)
  router.get('/:code', async (req: Request, res: Response) => {
    const code = String(req.params.code || '').trim().toUpperCase();
    if (!code || !/^[A-Z0-9][A-Z0-9_-]{0,63}$/.test(code)) {
      return res.status(400).json({ ok: false, error: 'Mã dự án không hợp lệ' });
    }

    // Host binding được resolve trong middleware Host (server.ts) trước route mount.
    const hostBinding: TenantHostBinding | null = (req as any).publicTenant ?? null;
    const cacheBucket = hostBinding?.tenantId || '*';

    try {
      const cached = await getPublicProjectCache(code, cacheBucket);
      if (cached) {
        res.setHeader('X-Public-Project-Cache', 'HIT');
        res.setHeader('Cache-Control', 'public, max-age=25, stale-while-revalidate=30');
        return res.json(cached);
      }

      // Khi truy cập qua subdomain/custom-domain của 1 tenant, scope lookup
      // theo tenant đó ngay từ DB query — tránh leak project chéo CĐT và xử lý
      // đúng case 2 tenant trùng project code.
      const found = await findPublicProjectByCode(code, hostBinding?.tenantId ?? null);
      if (!found) {
        // Không leak việc project có tồn tại nhưng chưa bật mini-site
        return res.status(404).json({ ok: false, error: 'Dự án chưa công khai hoặc không tồn tại' });
      }

      const listingsRaw = await findPublicListingsByProject(found.tenantId, code);
      const listings = listingsRaw.map(pickPublicListing);
      const project = pickPublicProject(found.project);
      const tenantContact = await loadTenantContact(found.tenantId, project.metadata.developer || project.name);

      // Branding: ưu tiên hostBinding (subdomain/custom domain) — luôn cùng tenant
      // nhờ check trên; nếu vào từ apex thì lấy theo project's tenant.
      let brandingSource: TenantHostBinding | null = hostBinding;
      if (!brandingSource) {
        brandingSource = await getTenantBinding(found.tenantId);
      }
      const branding = brandingSource ? pickPublicBranding(brandingSource.branding) : pickPublicBranding({
        logoUrl: null, faviconUrl: null, primaryColor: null,
        displayName: null, hotline: null, hotlineDisplay: null, zalo: null, messenger: null,
        ga4Id: null, fbPixelId: null, gtmId: null,
      });

      const payload = {
        ok: true,
        project,
        listings,
        listingCount: listings.length,
        tenantContact,
        branding,
        captcha: TURNSTILE_SECRET
          ? { provider: 'turnstile', siteKey: process.env.TURNSTILE_SITE_KEY || '' }
          : null,
        cachedAt: new Date().toISOString(),
      };

      await setPublicProjectCache(code, payload, cacheBucket, found.tenantId);
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
      // Consent is explicit opt-in. Missing or malformed checkbox values are
      // intentionally treated as opt-out, never as consent.
      const marketingEmailConsent = body.marketingEmailConsent === true;

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

      // Captcha verification (chỉ enforce khi env TURNSTILE_SECRET_KEY được set)
      if (TURNSTILE_SECRET) {
        const captchaToken = String(body.captchaToken || body['cf-turnstile-response'] || '').trim();
        const captchaOk = await verifyTurnstileToken(captchaToken, req.ip);
        if (!captchaOk) {
          return res.status(400).json({
            ok: false,
            error: 'Vui lòng xác nhận bạn không phải robot rồi gửi lại.',
          });
        }
      }

      // Cross-tenant guard: tương tự GET — Host của tenant A KHÔNG được phép
      // submit lead vào project thuộc tenant B (IDOR write protection).
      const hostBindingForLead: TenantHostBinding | null = (req as any).publicTenant ?? null;

      // Resolve project (must be public) → lấy tenantId để lưu lead đúng tenant.
      // Scope theo Host tenant nếu có để chọn đúng project khi 2 tenant trùng code.
      const found = await findPublicProjectByCode(code, hostBindingForLead?.tenantId ?? null);
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

      // Marketing attribution payload (first-click — gửi từ FE attribution lib).
      const attribution = (body.attribution && typeof body.attribution === 'object') ? body.attribution : {};
      const attrUtm = (attribution.utm && typeof attribution.utm === 'object') ? attribution.utm : {};
      const utm_source   = String(attrUtm.source   ?? attrUtm.utm_source   ?? body.utm_source   ?? '').trim().slice(0, 100) || null;
      const utm_medium   = String(attrUtm.medium   ?? attrUtm.utm_medium   ?? body.utm_medium   ?? '').trim().slice(0, 100) || null;
      const utm_campaign = String(attrUtm.campaign ?? attrUtm.utm_campaign ?? body.utm_campaign ?? '').trim().slice(0, 200) || null;
      const utm_term     = String(attrUtm.term     ?? attrUtm.utm_term     ?? body.utm_term     ?? '').trim().slice(0, 200) || null;
      const utm_content  = String(attrUtm.content  ?? attrUtm.utm_content  ?? body.utm_content  ?? '').trim().slice(0, 200) || null;
      const landing_page   = String(attribution.landingPage   ?? body.landingPage   ?? body.pageUrl  ?? '').slice(0, 500) || null;
      const first_referrer = String(attribution.firstReferrer ?? body.firstReferrer ?? body.referrer ?? '').slice(0, 500) || null;
      const gclid     = String(attribution.gclid  ?? body.gclid  ?? '').trim().slice(0, 200) || null;
      const fbclid    = String(attribution.fbclid ?? body.fbclid ?? '').trim().slice(0, 200) || null;
      const visitorIdRaw = String(attribution.visitorId ?? body.visitorId ?? '').trim().slice(0, 64);
      const visitor_id = /^[a-zA-Z0-9_-]{8,64}$/.test(visitorIdRaw) ? visitorIdRaw : null;

      const tags = ['microsite', `code:${code}`];
      if (utm_source) tags.push(`src:${utm_source}`);
      if (utm_campaign) tags.push(`camp:${utm_campaign.slice(0, 40)}`);

      const metadata = {
        project_code: code,
        project_name: found.project.name,
        source_type: 'microsite',
        page_url: String(body.pageUrl || '').slice(0, 500),
        referrer: String(body.referrer || '').slice(0, 500),
        ip: req.ip || null,
        user_agent: String(req.headers['user-agent'] || '').slice(0, 300),
        // Backward-compat: vẫn lưu UTM trong metadata cho code cũ
        utm_source, utm_medium, utm_campaign, utm_term, utm_content,
        gclid, fbclid, landing_page, first_referrer, visitor_id,
      };
      const notes = [
        interest ? `Quan tâm: ${interest}` : '',
        note,
      ].filter(Boolean).join('\n\n') || null;

      let leadId: string | null = null;
      try {
        const result = await withRlsBypass((client) => client.query(
          `INSERT INTO leads
             (tenant_id, name, phone, email, source, stage, notes, tags, metadata,
              utm_source, utm_medium, utm_campaign, utm_term, utm_content,
              landing_page, first_referrer, gclid, fbclid, visitor_id,
              marketing_email_consent, marketing_email_consent_at, marketing_email_consent_source)
             VALUES ($1, $2, $3, $4, $5, 'NEW', $6, $7::jsonb, $8::jsonb,
                     $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
                     $19, CASE WHEN $19 THEN NOW() ELSE NULL END, CASE WHEN $19 THEN $20 ELSE NULL END)
             RETURNING id`,
          [
            found.tenantId,
            name,
            phone,
            email || null,
            'microsite',
            notes,
            JSON.stringify(tags),
            JSON.stringify(metadata),
            utm_source, utm_medium, utm_campaign, utm_term, utm_content,
            landing_page, first_referrer, gclid, fbclid, visitor_id,
            marketingEmailConsent,
            `public_microsite:${code}`,
          ]
        ));
        leadId = result.rows[0]?.id ?? null;
      } catch (dbErr: any) {
        logger.error(`[PublicProject] Lead insert failed: ${dbErr?.message || dbErr}`);
      }

      // Notify hotline inbox (best-effort, không block phản hồi cho user).
      // From-name được override bằng tên CĐT (white-label task #28).
      const tenantBindingForEmail = await getTenantBinding(found.tenantId).catch(() => null);
      const fromName = tenantBindingForEmail?.branding.displayName || tenantBindingForEmail?.name || 'SGS Land';
      // White-label sender: ưu tiên custom domain đã verify → subdomain → fallback
      const fromEmail = resolveTenantSenderEmail(tenantBindingForEmail);
      try {
        const subject = `[Mini-site] ${found.project.name} — ${name} (${phone})`;
        const htmlBody = `
          <div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto;padding:24px;background:#f8fafc;border-radius:12px;">
            <h2 style="margin:0 0 16px;color:#1e293b;">Lead mới từ Mini-site dự án</h2>
            <table style="width:100%;border-collapse:collapse;font-size:14px;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:8px;">
              <tr><td style="padding:6px 0;color:#64748b;">Dự án</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(found.project.name)} (${escapeHtml(code)})</td></tr>
              <tr><td style="padding:6px 0;color:#64748b;">Họ tên</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(name)}</td></tr>
              <tr><td style="padding:6px 0;color:#64748b;">Điện thoại</td><td style="padding:6px 0;"><a href="tel:${escapeHtml(phone)}">${escapeHtml(phone)}</a></td></tr>
              ${email ? `<tr><td style="padding:6px 0;color:#64748b;">Email</td><td style="padding:6px 0;"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>` : ''}
              ${interest ? `<tr><td style="padding:6px 0;color:#64748b;">Quan tâm</td><td style="padding:6px 0;">${escapeHtml(interest)}</td></tr>` : ''}
              ${note ? `<tr><td style="padding:6px 0;color:#64748b;vertical-align:top;">Ghi chú</td><td style="padding:6px 0;white-space:pre-wrap;">${escapeHtml(note)}</td></tr>` : ''}
            </table>
            <p style="margin-top:16px;color:#94a3b8;font-size:12px;">Nguồn: ${escapeHtml(metadata.page_url || `/p/${code}`)}</p>
          </div>`;
        // brevoSendEmail tự catch lỗi và trả { success:false, error } — không throw.
        const sendResult = await brevoSendEmail({
          to: [{ email: INTERNAL_INBOX, name: `${fromName} Hotline` }],
          from: { email: fromEmail, name: fromName },
          subject,
          html: emailBase(htmlBody, 'Thông báo nội bộ từ form dự án SGS LAND.'),
          text: `Lead mới: ${name} / ${phone}${email ? ' / ' + email : ''} — ${found.project.name} (${code})`,
          replyTo: email ? { email, name } : undefined,
          tags: ['microsite-lead', `code-${code.toLowerCase()}`],
        });
        if (!sendResult.success) {
          logger.warn(`[PublicProject] Brevo send failed: ${sendResult.error}`);
        }
        recordEmailSend({
          tenantId: found.tenantId,
          kind: 'LEAD_NOTIFY',
          success: sendResult.success,
          reason: sendResult.success ? null : sendResult.error || 'unknown',
          messageId: sendResult.messageId ?? null,
        }).catch(() => {});
      } catch (emailErr: any) {
        logger.warn(`[PublicProject] Notification email skipped: ${emailErr?.message || emailErr}`);
        recordEmailSend({
          tenantId: found.tenantId,
          kind: 'LEAD_NOTIFY',
          success: false,
          reason: `threw:${emailErr?.message || emailErr}`,
        }).catch(() => {});
      }

      // Hotline trong response — đọc từ tenant để khách thấy đúng số tenant chủ
      const contact = await loadTenantContact(found.tenantId, found.project.name);

      // Auto-reply cho khách (best-effort, không block) — chỉ gửi khi khách điền email hợp lệ.
      // Dùng white-label sender (from-name = displayName CĐT, from-email = sender đã verify).
      if (email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        try {
          const replySubject = `Đã nhận yêu cầu tư vấn dự án ${found.project.name}`;
          const replyHtml = `
            <div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto;padding:24px;background:#f8fafc;border-radius:12px;color:#1e293b;">
              <h2 style="margin:0 0 12px;">Cảm ơn ${escapeHtml(name)}!</h2>
              <p style="margin:0 0 12px;font-size:14px;line-height:1.55;">
                ${escapeHtml(fromName)} đã nhận thông tin của bạn về dự án <strong>${escapeHtml(found.project.name)}</strong>
                (mã <span style="font-family:monospace">${escapeHtml(code)}</span>).
                Chuyên viên sẽ liên hệ trong vòng 30 phút (giờ hành chính) để gửi bảng giá, chính sách bán hàng và tư vấn chi tiết.
              </p>
              <table style="width:100%;border-collapse:collapse;font-size:14px;margin:12px 0;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;">
                <tr><td style="padding:6px 0;color:#64748b;">Hotline</td><td style="padding:6px 0;font-weight:600;"><a href="tel:${escapeHtml(contact.hotline)}" style="color:#1e293b;text-decoration:none;">${escapeHtml(contact.hotlineDisplay)}</a></td></tr>
                <tr><td style="padding:6px 0;color:#64748b;">Zalo</td><td style="padding:6px 0;"><a href="${escapeHtml(contact.zalo)}" style="color:#1e293b;">${escapeHtml(contact.hotlineDisplay)}</a></td></tr>
                ${interest ? `<tr><td style="padding:6px 0;color:#64748b;">Quan tâm</td><td style="padding:6px 0;">${escapeHtml(interest)}</td></tr>` : ''}
              </table>
              <p style="margin:12px 0 0;color:#94a3b8;font-size:12px;">
                Email tự động — vui lòng không trả lời. Nếu cần hỗ trợ gấp, gọi hotline hoặc nhắn Zalo phía trên.
              </p>
              <p style="margin:8px 0 0;color:#94a3b8;font-size:12px;">
                Thông tin được lưu trữ và xử lý theo Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân.
              </p>
            </div>`;
          const replyText =
            `Cảm ơn ${name}! ${fromName} đã nhận yêu cầu tư vấn dự án ${found.project.name} (${code}). ` +
            `Chuyên viên sẽ liên hệ trong vòng 30 phút. Hotline: ${contact.hotlineDisplay}.`;
          const replyResult = await brevoSendEmail({
            to: [{ email, name }],
            from: { email: fromEmail, name: fromName },
            subject: replySubject,
            html: emailBase(replyHtml, 'Email này được gửi tự động sau khi bạn đăng ký tư vấn.'),
            text: replyText,
            tags: ['microsite-lead-autoreply', `code-${code.toLowerCase()}`],
          });
          if (!replyResult.success) {
            logger.warn(`[PublicProject] Brevo auto-reply failed: ${replyResult.error}`);
          }
          recordEmailSend({
            tenantId: found.tenantId,
            kind: 'LEAD_AUTOREPLY',
            success: replyResult.success,
            reason: replyResult.success ? null : replyResult.error || 'unknown',
            messageId: replyResult.messageId ?? null,
          }).catch(() => {});
        } catch (replyErr: any) {
          logger.warn(`[PublicProject] Auto-reply email skipped: ${replyErr?.message || replyErr}`);
          recordEmailSend({
            tenantId: found.tenantId,
            kind: 'LEAD_AUTOREPLY',
            success: false,
            reason: `threw:${replyErr?.message || replyErr}`,
          }).catch(() => {});
        }
      }

      logger.info(`[PublicProject] Lead captured: ${name}/${phone} → ${found.project.name} (${code})${email ? ' [auto-reply queued]' : ''}`);

      return res.json({
        ok: true,
        leadId,
        message: `Cảm ơn ${name}! Chuyên viên sẽ liên hệ trong vòng 30 phút. Hotline: ${contact.hotlineDisplay}.`,
      });
    } catch (err: any) {
      logger.error(`[PublicProject] POST /${code}/leads failed: ${err?.message || err}`);
      res.status(500).json({ ok: false, error: 'Có lỗi xảy ra. Vui lòng thử lại sau ít phút.' });
    }
  });

  return router;
}

// Re-export cache helper để các route khác (projectRoutes / listingRoutes)
// có thể invalidate khi mutate.
export { evictPublicProjectCache };
