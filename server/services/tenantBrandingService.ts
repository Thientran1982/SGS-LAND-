/**
 * Tenant branding & host-binding service.
 *
 * - Resolves tenant from incoming Host header (subdomain `<slug>.sgsland.vn`
 *   hoặc custom domain đã verify).
 * - Cache in-memory 60s để middleware không hit DB mọi request.
 * - Validate slug strict + chặn reserved words.
 * - Generate TXT token cho custom domain verification, verify qua DNS.
 *
 * Lookup luôn dùng `withRlsBypass` vì middleware chạy trước auth — chưa có
 * tenant context. Trả về null nếu không khớp (= dùng host tenant mặc định,
 * không branding).
 */

import { withRlsBypass } from '../db';
import { logger } from '../middleware/logger';
import { promises as dns } from 'node:dns';
import crypto from 'node:crypto';
import { DEFAULT_TENANT_ID } from '../constants';
import { notificationRepository } from '../repositories/notificationRepository';
import { emailService } from './emailService';

/**
 * Số lần verify thất bại liên tiếp trước khi huỷ trạng thái verified và gửi
 * cảnh báo. Cron chạy 5 phút/lần → 3 lần ≈ 15 phút mới alert, đủ tránh false
 * positive khi DNS provider có hiccup ngắn hạn nhưng vẫn phát hiện sớm khi CĐT
 * thật sự xoá bản ghi TXT.
 */
export const CUSTOM_DOMAIN_FAILURE_THRESHOLD = 3;

// Domain gốc cho subdomain wildcard. Có thể override qua env nếu deploy domain
// khác (vd staging dùng `<slug>.staging.sgsland.vn`).
export const APEX_DOMAIN = (process.env.WHITELABEL_APEX_DOMAIN || 'sgsland.vn').toLowerCase();

/**
 * Tính địa chỉ email gửi đi cho 1 tenant theo white-label rule:
 * - Custom domain đã verify TXT ownership + nằm trong allowlist Brevo
 *   (env BREVO_VERIFIED_SENDER_DOMAINS, comma-separated) → `noreply@<customDomain>`
 * - Subdomain riêng + apex nằm trong allowlist                      → `noreply@<slug>.<apex>`
 * - Không có gì hợp lệ                                               → BREVO_FROM_EMAIL fallback
 *
 * Vì sao cần allowlist: TXT verify chỉ chứng minh CĐT sở hữu domain — KHÔNG
 * chứng minh SPF/DKIM đã cấu hình cho Brevo. Nếu set sender chưa được Brevo
 * authenticate, request gửi mail sẽ bị Brevo reject (HTTP 400) → mất
 * notification lead. Allowlist do ops cập nhật khi đã onboard CĐT trên Brevo.
 * Apex `sgsland.vn` luôn được coi là verified (default trong allowlist).
 */
function getVerifiedSenderDomains(): Set<string> {
  const raw = process.env.BREVO_VERIFIED_SENDER_DOMAINS || '';
  const set = new Set(
    raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
  );
  set.add(APEX_DOMAIN); // apex luôn verified mặc định
  return set;
}

export function resolveTenantSenderEmail(binding: TenantHostBinding | null): string {
  const fallback = process.env.BREVO_FROM_EMAIL || `no-reply@${APEX_DOMAIN}`;
  if (!binding) return fallback;
  const verified = getVerifiedSenderDomains();
  if (binding.customDomain && binding.customDomainVerifiedAt) {
    const dom = binding.customDomain.toLowerCase();
    if (verified.has(dom)) return `noreply@${dom}`;
    // Đã verify ownership nhưng chưa được ops onboard SPF/DKIM ở Brevo →
    // fallback để không mất email; from-name vẫn là tenant (caller xử lý).
  }
  if (binding.subdomainSlug && verified.has(APEX_DOMAIN)) {
    return `noreply@${binding.subdomainSlug.toLowerCase()}.${APEX_DOMAIN}`;
  }
  return fallback;
}

// Reserved subdomains — không được phép đăng ký (tránh conflict hệ thống).
const RESERVED_SLUGS = new Set([
  'api', 'app', 'www', 'admin', 'mail', 'smtp', 'imap', 'pop', 'pop3',
  'ftp', 'sftp', 'ns', 'ns1', 'ns2', 'mx', 'webmail', 'cdn', 'static',
  'assets', 'media', 'img', 'images', 'video', 'docs', 'help', 'support',
  'status', 'health', 'metrics', 'monitoring', 'grafana', 'prometheus',
  'dev', 'staging', 'test', 'qa', 'sandbox', 'demo', 'beta', 'alpha',
  'auth', 'login', 'logout', 'sso', 'oauth', 'oidc',
  'p', 'public', 'private', 'internal', 'partner', 'partners',
  'crm', 'erp', 'sales', 'lead', 'leads', 'contract', 'contracts',
  'sgsland', 'sgs',
]);

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/;
// RFC 1123 hostname (loose) — không cho phép protocol/path/port.
const HOSTNAME_RE = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export interface TenantBranding {
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string | null;
  displayName: string | null;
  hotline: string | null;
  hotlineDisplay: string | null;
  zalo: string | null;
  messenger: string | null;
  ga4Id: string | null;
  fbPixelId: string | null;
  gtmId: string | null;
}

export interface TenantHostBinding {
  tenantId: string;
  name: string;
  subdomainSlug: string | null;
  customDomain: string | null;
  customDomainVerifiedAt: string | null;
  branding: TenantBranding;
}

export const EMPTY_BRANDING: TenantBranding = {
  logoUrl: null,
  faviconUrl: null,
  primaryColor: null,
  displayName: null,
  hotline: null,
  hotlineDisplay: null,
  zalo: null,
  messenger: null,
  ga4Id: null,
  fbPixelId: null,
  gtmId: null,
};

const GA4_ID_RE = /^G-[A-Z0-9]{4,12}$/i;
const FB_PIXEL_RE = /^\d{6,20}$/;
const GTM_ID_RE = /^GTM-[A-Z0-9]{4,12}$/i;

// ── Slug validation ──────────────────────────────────────────────────────────

export function normalizeSlug(raw: string): string {
  return String(raw || '').trim().toLowerCase();
}

export function validateSlug(raw: string): { ok: true; slug: string } | { ok: false; error: string } {
  const slug = normalizeSlug(raw);
  if (!slug) return { ok: false, error: 'Slug không được để trống.' };
  if (!SLUG_RE.test(slug)) {
    return {
      ok: false,
      error: 'Slug chỉ chấp nhận chữ thường, số và dấu gạch ngang (3–32 ký tự, không bắt đầu/kết thúc bằng dấu gạch).',
    };
  }
  if (RESERVED_SLUGS.has(slug)) {
    return { ok: false, error: `Slug "${slug}" đã được hệ thống giữ chỗ — vui lòng chọn tên khác.` };
  }
  return { ok: true, slug };
}

export function normalizeHostname(raw: string): string {
  return String(raw || '').trim().toLowerCase().replace(/\.$/, '');
}

export function validateHostname(raw: string): { ok: true; hostname: string } | { ok: false; error: string } {
  const hostname = normalizeHostname(raw);
  if (!hostname) return { ok: false, error: 'Tên miền không được để trống.' };
  if (!HOSTNAME_RE.test(hostname)) {
    return { ok: false, error: 'Tên miền không hợp lệ. Ví dụ hợp lệ: brand.example.com' };
  }
  // Không cho phép custom domain trỏ về apex sgsland.vn (sẽ conflict)
  if (hostname === APEX_DOMAIN || hostname.endsWith('.' + APEX_DOMAIN)) {
    return { ok: false, error: `Custom domain không thể nằm trong "${APEX_DOMAIN}". Dùng tab Subdomain để cấu hình.` };
  }
  return { ok: true, hostname };
}

// ── Branding payload normalisation ───────────────────────────────────────────

const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function clean(s: unknown, max = 200): string | null {
  if (s == null) return null;
  const v = String(s).trim();
  if (!v) return null;
  return v.length > max ? v.slice(0, max) : v;
}

export function normalizeBrandingInput(input: any): TenantBranding {
  const b = (input && typeof input === 'object') ? input : {};
  const primaryColor = clean(b.primaryColor, 16);
  const ga4 = clean(b.ga4Id, 32);
  const pixel = clean(b.fbPixelId, 32);
  const gtm = clean(b.gtmId, 32);
  return {
    logoUrl: clean(b.logoUrl, 500),
    faviconUrl: clean(b.faviconUrl, 500),
    primaryColor: primaryColor && HEX_COLOR_RE.test(primaryColor) ? primaryColor : null,
    displayName: clean(b.displayName, 120),
    hotline: clean(b.hotline, 20),
    hotlineDisplay: clean(b.hotlineDisplay, 30),
    zalo: clean(b.zalo, 200),
    messenger: clean(b.messenger, 200),
    ga4Id: ga4 && GA4_ID_RE.test(ga4) ? ga4.toUpperCase() : null,
    fbPixelId: pixel && FB_PIXEL_RE.test(pixel) ? pixel : null,
    gtmId: gtm && GTM_ID_RE.test(gtm) ? gtm.toUpperCase() : null,
  };
}

export function brandingFromConfig(config: any): TenantBranding {
  const b = (config && typeof config === 'object' && config.branding && typeof config.branding === 'object')
    ? config.branding
    : {};
  return normalizeBrandingInput(b);
}

// ── Host header → tenant resolution ──────────────────────────────────────────

interface CachedBinding {
  binding: TenantHostBinding | null;
  expiresAt: number;
}

const HOST_CACHE_TTL_MS = 60 * 1000; // 1 phút — cân bằng giữa latency & invalidation
// Bounded LRU-ish: Host header là attacker-controlled, một bot có thể spam vô số
// host khác nhau → cache phải có giới hạn để tránh memory DoS. Map giữ insertion
// order, evict entry cũ nhất khi đầy.
const HOST_CACHE_MAX_ENTRIES = 1000;
const hostCache = new Map<string, CachedBinding>();

function setHostCacheEntry(host: string, entry: CachedBinding): void {
  if (hostCache.has(host)) {
    hostCache.delete(host);
  } else if (hostCache.size >= HOST_CACHE_MAX_ENTRIES) {
    const oldestKey = hostCache.keys().next().value;
    if (oldestKey !== undefined) hostCache.delete(oldestKey);
  }
  hostCache.set(host, entry);
}

export function evictHostCache(host?: string | null): void {
  if (host) hostCache.delete(host.toLowerCase());
  else hostCache.clear();
}

/** Đẩy hết cache binding của 1 tenant — gọi khi update branding/slug. */
export function evictHostCacheByTenant(tenantId: string): void {
  for (const [k, v] of hostCache.entries()) {
    if (v.binding?.tenantId === tenantId) hostCache.delete(k);
  }
}

interface TenantRow {
  id: string;
  name: string;
  subdomain_slug: string | null;
  custom_domain: string | null;
  custom_domain_verified_at: string | null;
  config: any;
}

function rowToBinding(row: TenantRow): TenantHostBinding {
  return {
    tenantId: row.id,
    name: row.name,
    subdomainSlug: row.subdomain_slug,
    customDomain: row.custom_domain,
    customDomainVerifiedAt: row.custom_domain_verified_at,
    branding: brandingFromConfig(row.config),
  };
}

/** Strip port + lowercase. Trả null nếu host rỗng / loopback. */
function cleanHost(host: string | undefined | null): string | null {
  if (!host) return null;
  const h = String(host).trim().toLowerCase().split(':')[0];
  if (!h || h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h === '::1') return null;
  return h;
}

/**
 * Resolve tenant từ Host header.
 * - Nếu host = APEX_DOMAIN (vd `sgsland.vn`) → trả null (= host tenant mặc định, không branding).
 * - Nếu `<slug>.APEX_DOMAIN` → tra `subdomain_slug = <slug>`.
 * - Nếu host khác → tra `custom_domain` AND `custom_domain_verified_at IS NOT NULL`.
 * Cross-tenant lookup, RLS bypass.
 */
export async function resolveTenantByHost(rawHost: string | undefined | null): Promise<TenantHostBinding | null> {
  const host = cleanHost(rawHost);
  if (!host) return null;
  if (host === APEX_DOMAIN || host === 'www.' + APEX_DOMAIN) return null;

  // Cache hit
  const now = Date.now();
  const cached = hostCache.get(host);
  if (cached && cached.expiresAt > now) return cached.binding;

  let binding: TenantHostBinding | null = null;
  try {
    if (host.endsWith('.' + APEX_DOMAIN)) {
      const slug = host.slice(0, -('.' + APEX_DOMAIN).length);
      // Sub-subdomain (vd a.b.sgsland.vn) — không support, treat as null
      if (!slug || slug.includes('.')) {
        binding = null;
      } else {
        const v = validateSlug(slug);
        if (v.ok) {
          binding = await withRlsBypass(async (client) => {
            const r = await client.query<TenantRow>(
              `SELECT id, name, subdomain_slug, custom_domain, custom_domain_verified_at, config
                 FROM tenants
                 WHERE LOWER(subdomain_slug) = $1
                 LIMIT 1`,
              [v.slug]
            );
            return r.rows[0] ? rowToBinding(r.rows[0]) : null;
          });
        }
      }
    } else {
      // Custom domain: PHẢI đã verify
      binding = await withRlsBypass(async (client) => {
        const r = await client.query<TenantRow>(
          `SELECT id, name, subdomain_slug, custom_domain, custom_domain_verified_at, config
             FROM tenants
             WHERE LOWER(custom_domain) = $1
               AND custom_domain_verified_at IS NOT NULL
             LIMIT 1`,
          [host]
        );
        return r.rows[0] ? rowToBinding(r.rows[0]) : null;
      });
    }
  } catch (err: any) {
    logger.warn(`[TenantBranding] resolveTenantByHost(${host}) failed: ${err?.message || err}`);
    binding = null;
  }

  setHostCacheEntry(host, { binding, expiresAt: now + HOST_CACHE_TTL_MS });
  return binding;
}

/** Lấy binding theo tenantId — dùng cho microsite khi Host = apex (apply branding theo project's tenant). */
export async function getTenantBinding(tenantId: string): Promise<TenantHostBinding | null> {
  if (!tenantId) return null;
  return withRlsBypass(async (client) => {
    const r = await client.query<TenantRow>(
      `SELECT id, name, subdomain_slug, custom_domain, custom_domain_verified_at, config
         FROM tenants
         WHERE id = $1
         LIMIT 1`,
      [tenantId]
    );
    return r.rows[0] ? rowToBinding(r.rows[0]) : null;
  });
}

// ── Custom domain TXT verify ─────────────────────────────────────────────────

export function generateTxtToken(): string {
  // 24 hex chars (~96 bits) — đủ random, dễ copy-paste
  return 'sgsland-verify=' + crypto.randomBytes(12).toString('hex');
}

/** Resolve TXT records của hostname. Trả mảng rỗng nếu lỗi (= chưa verify). */
export async function resolveTxtRecords(hostname: string): Promise<string[]> {
  try {
    const records = await dns.resolveTxt(hostname);
    // Mỗi record là string[] — concat thành 1 chuỗi (DNS hay split 255 chars)
    return records.map(parts => parts.join(''));
  } catch (err: any) {
    // ENODATA / ENOTFOUND = chưa cấu hình TXT — không log noisy
    if (err?.code !== 'ENODATA' && err?.code !== 'ENOTFOUND') {
      logger.warn(`[TenantBranding] DNS TXT lookup failed for ${hostname}: ${err?.message || err}`);
    }
    return [];
  }
}

/** Check 1 hostname có chứa TXT token kỳ vọng. Lookup tại `_sgsland.<host>` để không xung đột. */
export async function verifyCustomDomainTxt(hostname: string, expectedToken: string): Promise<boolean> {
  if (!hostname || !expectedToken) return false;
  const verifyHost = `_sgsland.${hostname}`;
  const records = await resolveTxtRecords(verifyHost);
  return records.some(r => r.trim() === expectedToken.trim());
}

// ── Cron: verify (& re-verify) custom domains every 5 minutes ────────────────
//
// 2 trường hợp xử lý chung 1 vòng:
//   • Pending (chưa verified): TXT khớp → set verified_at = NOW(); reset
//     failure_count. TXT chưa có → tăng failure_count nhưng KHÔNG alert
//     (CĐT vẫn đang setup, chưa từng vận hành).
//   • Verified: TXT khớp → reset failure_count. TXT mất → tăng failure_count.
//     Khi vượt CUSTOM_DOMAIN_FAILURE_THRESHOLD lần liên tiếp → huỷ verified
//     (custom_domain_verified_at = NULL, unverified_at = NOW()) và gửi
//     notification + email cho tất cả ADMIN/SUPER_ADMIN ACTIVE của tenant.
//
// Lý do không huỷ verified ngay từ lần fail đầu: DNS resolver có thể flap, cache
// upstream hết hạn không đồng bộ, v.v. Đợi 3 tick (~15 phút) loại false positive.

let cronTimer: NodeJS.Timeout | null = null;

interface CustomDomainCronRow {
  id: string;
  name: string;
  custom_domain: string;
  custom_domain_txt_token: string;
  custom_domain_verified_at: string | null;
  custom_domain_failure_count: number;
}

export async function tickCustomDomainVerify(): Promise<void> {
  let rows: CustomDomainCronRow[] = [];
  try {
    rows = await withRlsBypass(async (client) => {
      const r = await client.query<CustomDomainCronRow>(
        `SELECT id, name, custom_domain, custom_domain_txt_token,
                custom_domain_verified_at, custom_domain_failure_count
           FROM tenants
           WHERE custom_domain IS NOT NULL
             AND custom_domain_txt_token IS NOT NULL
           LIMIT 200`
      );
      return r.rows;
    });
  } catch (err: any) {
    logger.warn(`[TenantBranding] cron list failed: ${err?.message || err}`);
    return;
  }
  if (rows.length === 0) return;

  for (const row of rows) {
    try {
      const ok = await verifyCustomDomainTxt(row.custom_domain, row.custom_domain_txt_token);
      const wasVerified = row.custom_domain_verified_at !== null;
      const prevFailures = row.custom_domain_failure_count || 0;

      if (ok) {
        // Trường hợp pending → verify lần đầu
        if (!wasVerified) {
          await withRlsBypass(async (client) => {
            await client.query(
              `UPDATE tenants
                  SET custom_domain_verified_at = NOW(),
                      custom_domain_failure_count = 0,
                      custom_domain_last_check_at = NOW(),
                      custom_domain_unverified_at = NULL
                  WHERE id = $1`,
              [row.id]
            );
          });
          evictHostCacheByTenant(row.id);
          logger.info(`[TenantBranding] Custom domain verified: ${row.custom_domain} (tenant ${row.id})`);
        } else {
          // Đã verify rồi → reset failure_count nếu trước đó đang có lỗi
          if (prevFailures !== 0) {
            await withRlsBypass(async (client) => {
              await client.query(
                `UPDATE tenants
                    SET custom_domain_failure_count = 0,
                        custom_domain_last_check_at = NOW(),
                        custom_domain_unverified_at = NULL
                    WHERE id = $1`,
                [row.id]
              );
            });
            logger.info(`[TenantBranding] Custom domain re-check OK after ${prevFailures} failures: ${row.custom_domain}`);
          } else {
            await withRlsBypass(async (client) => {
              await client.query(
                `UPDATE tenants SET custom_domain_last_check_at = NOW() WHERE id = $1`,
                [row.id]
              );
            });
          }
        }
        continue;
      }

      // ── TXT KHÔNG khớp ────────────────────────────────────────────────
      const newFailures = prevFailures + 1;
      const shouldUnverify = wasVerified && newFailures >= CUSTOM_DOMAIN_FAILURE_THRESHOLD;

      if (shouldUnverify) {
        await withRlsBypass(async (client) => {
          await client.query(
            `UPDATE tenants
                SET custom_domain_verified_at = NULL,
                    custom_domain_unverified_at = NOW(),
                    custom_domain_failure_count = $2,
                    custom_domain_last_check_at = NOW()
                WHERE id = $1`,
            [row.id, newFailures]
          );
        });
        evictHostCacheByTenant(row.id);
        logger.warn(`[TenantBranding] Custom domain LOST verification after ${newFailures} failed checks: ${row.custom_domain} (tenant ${row.id})`);
        // Fire-and-forget: notification/email không được chặn cron tick
        notifyTenantAdminsCustomDomainLost(row.id, row.name, row.custom_domain).catch((e) => {
          logger.warn(`[TenantBranding] notify admins failed for tenant ${row.id}: ${e?.message || e}`);
        });
      } else {
        await withRlsBypass(async (client) => {
          await client.query(
            `UPDATE tenants
                SET custom_domain_failure_count = $2,
                    custom_domain_last_check_at = NOW()
                WHERE id = $1`,
            [row.id, newFailures]
          );
        });
        if (wasVerified) {
          logger.info(`[TenantBranding] Custom domain check failed (${newFailures}/${CUSTOM_DOMAIN_FAILURE_THRESHOLD}): ${row.custom_domain}`);
        }
      }
    } catch (err: any) {
      logger.warn(`[TenantBranding] verify ${row.custom_domain} failed: ${err?.message || err}`);
    }
  }
}

/**
 * Reset failure tracking cho 1 tenant — gọi khi admin verify thủ công thành
 * công, hoặc khi gỡ/đổi custom domain.
 */
export async function resetCustomDomainHealth(tenantId: string): Promise<void> {
  await withRlsBypass(async (client) => {
    await client.query(
      `UPDATE tenants
          SET custom_domain_failure_count = 0,
              custom_domain_unverified_at = NULL,
              custom_domain_last_check_at = NOW()
          WHERE id = $1`,
      [tenantId]
    );
  });
}

/**
 * Gửi notification + email cho tất cả ADMIN/SUPER_ADMIN ACTIVE của tenant khi
 * custom domain mất xác thực. Dedupe email theo (tenant + domain) trong 24h để
 * tránh spam khi DNS down kéo dài.
 */
async function notifyTenantAdminsCustomDomainLost(
  tenantId: string,
  tenantName: string,
  hostname: string,
): Promise<void> {
  const admins = await withRlsBypass(async (client) => {
    const r = await client.query<{ id: string; email: string; name: string }>(
      `SELECT id, email, name
         FROM users
         WHERE tenant_id = $1
           AND role IN ('ADMIN', 'SUPER_ADMIN')
           AND status = 'ACTIVE'
         LIMIT 20`,
      [tenantId]
    );
    return r.rows;
  });
  if (admins.length === 0) {
    logger.warn(`[TenantBranding] No active admins to notify for tenant ${tenantId} (domain ${hostname})`);
    return;
  }

  const title = `Tên miền ${hostname} cần xác thực lại`;
  const body =
    `Hệ thống không tìm thấy bản ghi TXT _sgsland.${hostname} sau ${CUSTOM_DOMAIN_FAILURE_THRESHOLD} lần kiểm tra liên tiếp. ` +
    `Mini-site qua tên miền này đã tạm dừng cho đến khi bạn khôi phục bản ghi TXT trong trang quản lý DNS.`;

  for (const admin of admins) {
    try {
      await notificationRepository.create({
        tenantId,
        userId: admin.id,
        type: 'CUSTOM_DOMAIN_UNVERIFIED',
        title,
        body,
        metadata: { hostname, tenantName },
      });
    } catch (e: any) {
      logger.warn(`[TenantBranding] create notification failed for user ${admin.id}: ${e?.message || e}`);
    }

    try {
      const html = `
        <p>Xin chào <strong>${escapeHtmlSafe(admin.name || admin.email)}</strong>,</p>
        <p>Hệ thống SGS Land vừa kiểm tra định kỳ tên miền riêng của workspace
           <strong>${escapeHtmlSafe(tenantName)}</strong> và phát hiện bản ghi xác thực không còn tồn tại:</p>
        <ul>
          <li>Tên miền: <strong>${escapeHtmlSafe(hostname)}</strong></li>
          <li>Bản ghi cần kiểm tra: <code>TXT _sgsland.${escapeHtmlSafe(hostname)}</code></li>
          <li>Số lần fail liên tiếp: ${CUSTOM_DOMAIN_FAILURE_THRESHOLD}</li>
        </ul>
        <p>Mini-site qua tên miền này đã tạm dừng để bảo vệ bạn khỏi rủi ro mất quyền sở hữu tên miền.
           Vui lòng vào trang quản lý DNS, khôi phục bản ghi TXT theo hướng dẫn trong mục
           <em>Cài đặt → Thương hiệu → Tên miền riêng</em>, sau đó nhấn "Kiểm tra TXT ngay".</p>
        <p>Nếu bạn chủ động đổi DNS provider hoặc gỡ tên miền, có thể bỏ qua email này.</p>
        <p>— SGS Land</p>
      `;
      await emailService.sendEmail(tenantId, {
        to: admin.email,
        subject: `[SGS Land] Tên miền ${hostname} cần xác thực lại`,
        html,
        text:
          `Hệ thống phát hiện tên miền ${hostname} của workspace ${tenantName} không còn bản ghi TXT xác thực ` +
          `(_sgsland.${hostname}) sau ${CUSTOM_DOMAIN_FAILURE_THRESHOLD} lần kiểm tra. Vui lòng khôi phục bản ghi và verify lại.`,
        template: 'custom_domain_unverified',
        // Dedupe theo domain trong 24h: nếu DNS down kéo dài, không spam admin
        // mỗi 5 phút.
        dedupeKey: `custom_domain_unverified:${hostname}:${admin.email}`,
        dedupeWindowMinutes: 24 * 60,
        skipQuota: true,
      });
    } catch (e: any) {
      logger.warn(`[TenantBranding] send email failed for ${admin.email}: ${e?.message || e}`);
    }
  }
}

function escapeHtmlSafe(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// In-flight guard: nếu 1 tick chạy lâu hơn interval (DNS chậm + nhiều domain),
// setInterval sẽ chồng tick mới lên trên → progress `failure_count` sai và admin
// có thể nhận in-app notification trùng. Guard này đảm bảo tại 1 thời điểm chỉ
// có 1 tick chạy trong process. Multi-instance: best-effort — production thực sự
// cần advisory lock (pg_advisory_lock) hoặc Redis lock; hiện tại app chạy single
// instance nên process-local guard là đủ.
let cronInFlight = false;

async function runCronTickGuarded(label: string): Promise<void> {
  if (cronInFlight) {
    logger.warn(`[TenantBranding] cron ${label} skipped — previous tick still in flight`);
    return;
  }
  cronInFlight = true;
  try {
    await tickCustomDomainVerify();
  } catch (err: any) {
    logger.warn(`[TenantBranding] cron ${label} failed: ${err?.message || err}`);
  } finally {
    cronInFlight = false;
  }
}

export function startCustomDomainVerifyCron(opts?: { intervalMs?: number }): void {
  if (cronTimer) return;
  const intervalMs = opts?.intervalMs ?? 5 * 60 * 1000;
  cronTimer = setInterval(() => {
    void runCronTickGuarded('tick');
  }, intervalMs);
  // unref để cron không chặn process exit
  if (typeof (cronTimer as any).unref === 'function') (cronTimer as any).unref();
  // Chạy ngay 1 lần sau 30s startup
  setTimeout(() => {
    void runCronTickGuarded('initial');
  }, 30_000).unref?.();
}

export function stopCustomDomainVerifyCron(): void {
  if (cronTimer) {
    clearInterval(cronTimer);
    cronTimer = null;
  }
}

export function getApexDomain(): string {
  return APEX_DOMAIN;
}

export function isHostTenant(tenantId: string): boolean {
  return tenantId === DEFAULT_TENANT_ID;
}
