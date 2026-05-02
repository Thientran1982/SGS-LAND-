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

// Domain gốc cho subdomain wildcard. Có thể override qua env nếu deploy domain
// khác (vd staging dùng `<slug>.staging.sgsland.vn`).
export const APEX_DOMAIN = (process.env.WHITELABEL_APEX_DOMAIN || 'sgsland.vn').toLowerCase();

/**
 * Tính địa chỉ email gửi đi cho 1 tenant theo white-label rule:
 * - Custom domain đã verify  → `noreply@<customDomain>`
 * - Subdomain riêng           → `noreply@<slug>.<apex>`
 * - Không có gì hợp lệ        → BREVO_FROM_EMAIL (mặc định `no-reply@sgsland.vn`)
 *
 * Lưu ý vận hành: để Brevo deliverability tốt khi dùng custom domain, CĐT
 * cần thêm SPF/DKIM cho Brevo trên DNS của họ. Trường hợp DNS chưa cấu hình
 * Brevo có thể vẫn nhận nhưng spam folder — đây là trách nhiệm của CĐT, không
 * phải lỗi hệ thống.
 */
export function resolveTenantSenderEmail(binding: TenantHostBinding | null): string {
  const fallback = process.env.BREVO_FROM_EMAIL || 'no-reply@sgsland.vn';
  if (!binding) return fallback;
  if (binding.customDomain && binding.customDomainVerifiedAt) {
    return `noreply@${binding.customDomain.toLowerCase()}`;
  }
  if (binding.subdomainSlug) {
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
};

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
  return {
    logoUrl: clean(b.logoUrl, 500),
    faviconUrl: clean(b.faviconUrl, 500),
    primaryColor: primaryColor && HEX_COLOR_RE.test(primaryColor) ? primaryColor : null,
    displayName: clean(b.displayName, 120),
    hotline: clean(b.hotline, 20),
    hotlineDisplay: clean(b.hotlineDisplay, 30),
    zalo: clean(b.zalo, 200),
    messenger: clean(b.messenger, 200),
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

// ── Cron: verify pending custom domains every 5 minutes ──────────────────────

let cronTimer: NodeJS.Timeout | null = null;

export function startCustomDomainVerifyCron(opts?: { intervalMs?: number }): void {
  if (cronTimer) return;
  const intervalMs = opts?.intervalMs ?? 5 * 60 * 1000;
  const tick = async () => {
    try {
      const rows = await withRlsBypass(async (client) => {
        const r = await client.query<{ id: string; custom_domain: string; custom_domain_txt_token: string }>(
          `SELECT id, custom_domain, custom_domain_txt_token
             FROM tenants
             WHERE custom_domain IS NOT NULL
               AND custom_domain_txt_token IS NOT NULL
               AND custom_domain_verified_at IS NULL
             LIMIT 100`
        );
        return r.rows;
      });
      if (rows.length === 0) return;
      for (const row of rows) {
        try {
          const ok = await verifyCustomDomainTxt(row.custom_domain, row.custom_domain_txt_token);
          if (!ok) continue;
          await withRlsBypass(async (client) => {
            await client.query(
              `UPDATE tenants
                  SET custom_domain_verified_at = NOW()
                  WHERE id = $1
                    AND custom_domain_verified_at IS NULL`,
              [row.id]
            );
          });
          evictHostCacheByTenant(row.id);
          logger.info(`[TenantBranding] Custom domain verified: ${row.custom_domain} (tenant ${row.id})`);
        } catch (err: any) {
          logger.warn(`[TenantBranding] verify ${row.custom_domain} failed: ${err?.message || err}`);
        }
      }
    } catch (err: any) {
      logger.warn(`[TenantBranding] cron tick failed: ${err?.message || err}`);
    }
  };
  cronTimer = setInterval(tick, intervalMs);
  // unref để cron không chặn process exit
  if (typeof (cronTimer as any).unref === 'function') (cronTimer as any).unref();
  // Chạy ngay 1 lần sau 30s startup
  setTimeout(tick, 30_000).unref?.();
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
