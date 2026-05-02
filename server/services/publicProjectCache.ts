/**
 * In-memory cache cho public project microsite payload.
 *
 * - TTL 25s — đáp ứng SLA "branding mới có hiệu lực < 30s" (task #28). Trước
 *   đây để 5 phút khiến CĐT cập nhật logo/màu xong vẫn thấy bản cũ tới 5 phút
 *   sau khi cache hết hạn (ngoài evict thủ công). Vì payload nhẹ và cache hit
 *   rate trong 25s vẫn rất cao, hạ TTL xuống không ảnh hưởng đáng kể tới DB.
 * - Key gồm `${tenantId}|${code}` để tách rõ branding của từng CĐT — không leak
 *   payload tenant này sang tenant khác khi 2 tenant cùng có project trùng code
 *   (ví dụ "MCC"). `tenantId = "*"` là bucket mặc định khi truy cập từ apex
 *   `sgsland.vn` (không có Host binding).
 * - Invalidation thủ công qua `evictPublicProjectCache(code)` (mọi tenant) hoặc
 *   `evictPublicProjectCacheByTenant(tenantId)` (toàn bộ entries của tenant đó —
 *   gọi khi update branding). Cũng được gọi từ projectRoutes / listingRoutes
 *   khi mutate.
 * - Multi-instance: cache là per-process. Yêu cầu invalidation < 30s thoả mãn
 *   bằng TTL ngắn + best-effort evict; multi-instance cần Redis-backed cache.
 */

const TTL_MS = 25 * 1000;
const MAX_ENTRIES = 500;

interface Entry {
  value: any;
  bucket: string;            // bucket key ("*" cho apex, tenantId cho subdomain/custom domain)
  projectTenantId: string;   // tenantId thực tế của project — dùng để evict khi
                             // branding của tenant đó thay đổi, kể cả khi entry
                             // được cache dưới bucket "*" (apex)
  expiresAt: number;
}

const store = new Map<string, Entry>();

function buildKey(tenantId: string | null | undefined, code: string): string {
  const t = (tenantId && String(tenantId).trim()) || '*';
  const c = String(code || '').trim().toUpperCase();
  return `${t}|${c}`;
}

export function getPublicProjectCache(code: string, tenantId?: string | null): any | null {
  const key = buildKey(tenantId, code);
  if (!key.endsWith('|') === false && key === `${tenantId || '*'}|`) return null;
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

/**
 * Cache 1 payload public project.
 * - `bucketTenantId`: Host bucket — `null`/empty = apex (bucket "*"), string = tenant subdomain/custom domain
 * - `projectTenantId`: tenantId thực tế của project, để evict by tenant khi
 *   branding thay đổi (kể cả entries trong bucket "*").
 */
export function setPublicProjectCache(
  code: string,
  value: any,
  bucketTenantId?: string | null,
  projectTenantId?: string | null,
): void {
  const c = String(code || '').trim().toUpperCase();
  if (!c) return;
  const bucket = (bucketTenantId && String(bucketTenantId).trim()) || '*';
  const ptid = (projectTenantId && String(projectTenantId).trim())
    || (bucket !== '*' ? bucket : '');
  const key = `${bucket}|${c}`;
  if (store.has(key)) {
    store.delete(key);
  } else if (store.size >= MAX_ENTRIES) {
    const oldestKey = store.keys().next().value;
    if (oldestKey !== undefined) store.delete(oldestKey);
  }
  store.set(key, { value, bucket, projectTenantId: ptid, expiresAt: Date.now() + TTL_MS });
}

/** Evict mọi entry của 1 project code, ở MỌI tenant bucket. */
export function evictPublicProjectCache(code: string | null | undefined): void {
  const c = String(code || '').trim().toUpperCase();
  if (!c) return;
  const suffix = `|${c}`;
  for (const key of store.keys()) {
    if (key.endsWith(suffix)) store.delete(key);
  }
}

/**
 * Evict mọi entry thuộc 1 tenant — gọi khi update branding/subdomain.
 * Match cả entry cached dưới bucket riêng (subdomain/custom domain) lẫn entry
 * cached dưới bucket "*" (apex `sgsland.vn/p/<code>`) mà project thuộc tenant
 * này — đảm bảo branding mới có hiệu lực < 30s trên mọi đường truy cập.
 */
export function evictPublicProjectCacheByTenant(tenantId: string | null | undefined): void {
  const t = (tenantId && String(tenantId).trim()) || '';
  if (!t) return;
  for (const [key, entry] of store.entries()) {
    if (entry.bucket === t || entry.projectTenantId === t) store.delete(key);
  }
}

export function clearPublicProjectCache(): void {
  store.clear();
}

export function publicProjectCacheStats(): { size: number; keys: string[] } {
  return { size: store.size, keys: Array.from(store.keys()) };
}
