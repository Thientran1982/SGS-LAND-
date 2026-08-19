/**
 * In-memory LRU cache for public listings endpoints (`/api/public/listings`,
 * `/api/public/listings/locations`).
 *
 * - TTL 5 phút — listing feed thay đổi chậm hơn microsite branding (25s) nên
 *   có thể cache lâu hơn. Mọi mutate trên listings (create/update/delete) gọi
 *   `evictPublicListingsCache()` để xoá toàn bộ entries — đảm bảo SLA "list
 *   public hiển thị listing mới trong vòng vài giây sau khi tạo".
 * - Key được build từ filter params + page/cursor + tenantId. Mọi tham số nằm
 *   ngoài key sẽ KHÔNG ảnh hưởng tới hit/miss — caller phải đảm bảo build key
 *   chính xác.
 * - LRU bằng `Map` insertion order: khi đầy, xoá entry cũ nhất; khi hit, xoá
 *   rồi set lại để move cuối order.
 */
import { sharedCacheDeleteByPattern, sharedCacheDeleteByPrefix, sharedCacheGet, sharedCacheKey, sharedCacheSet } from './sharedCache';
const TTL_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 500;
interface Entry {
  value: any;
  expiresAt: number;
}
const store = new Map<string, Entry>();
export async function getPublicListingsCache(key: string, tenantId: string): Promise<any | null> {
  const sharedKey = sharedCacheKey({ tenantId, namespace: 'public-listings', version: 2, dimensions: { query: key } });
  const shared = await sharedCacheGet<any>(sharedKey);
  if (shared !== null) return shared;
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    store.delete(key);
    return null;
  }
  // Move to end (LRU recency)
  store.delete(key);
  store.set(key, entry);
  return entry.value;
}
export async function setPublicListingsCache(key: string, value: any, tenantId: string): Promise<void> {
  if (!key) return;
  if (store.has(key)) {
    store.delete(key);
  } else if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  store.set(key, { value, expiresAt: Date.now() + TTL_MS });
  await sharedCacheSet(
    sharedCacheKey({ tenantId, namespace: 'public-listings', version: 2, dimensions: { query: key } }),
    value,
    TTL_MS,
  );
}
/** Evict ALL entries — gọi từ mọi mutation hook trong listingRoutes. */
export async function evictPublicListingsCache(tenantId?: string): Promise<void> {
  store.clear();
  if (tenantId) await sharedCacheDeleteByPrefix(`${tenantId}:public-listings`);
  else await sharedCacheDeleteByPattern('*:public-listings*');
}
export function publicListingsCacheStats(): { size: number } {
  return { size: store.size };
}