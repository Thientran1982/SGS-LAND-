/**
 * In-memory LRU cache cho public listing DETAIL (`/api/public/listings/:slugId`).
 *
 * - Tách namespace với publicListingsCache (feed) để evict mutate-time
 *   theo từng `listing_id` mà không xoá toàn bộ feed.
 * - TTL 5 phút, max 1000 entries (detail nhiều entry hơn feed vì 1 entry/listing).
 * - Map giữ insertion-order; HIT move-to-end; OVERFLOW evict head.
 *
 * Mọi mutate listing (create/update/status/delete/bulk) gọi
 * `evictPublicListingDetailCache(id)` từ listingRoutes.ts.
 */
import { sharedCacheDeleteByPattern, sharedCacheDeleteByPrefix, sharedCacheGet, sharedCacheKey, sharedCacheSet } from './sharedCache';
interface Entry { value: unknown; expiresAt: number; }
const TTL_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 1000;
const store = new Map<string, Entry>();
export async function getPublicListingDetailCache(key: string, tenantId: string): Promise<unknown | null> {
  const sharedKey = sharedCacheKey({ tenantId, namespace: 'public-listing-detail', listingId: key.replace(/^pld:/, ''), version: 2 });
  const shared = await sharedCacheGet(sharedKey);
  if (shared !== null) return shared;
  const e = store.get(key);
  if (!e) return null;
  if (e.expiresAt < Date.now()) { store.delete(key); return null; }
  // LRU touch: re-insert moves to map tail
  store.delete(key);
  store.set(key, e);
  return e.value;
}
export async function setPublicListingDetailCache(key: string, value: unknown, tenantId: string): Promise<void> {
  if (store.has(key)) store.delete(key);
  store.set(key, { value, expiresAt: Date.now() + TTL_MS });
  while (store.size > MAX_ENTRIES) {
    const firstKey = store.keys().next().value;
    if (firstKey === undefined) break;
    store.delete(firstKey);
  }
  await sharedCacheSet(
    sharedCacheKey({ tenantId, namespace: 'public-listing-detail', listingId: key.replace(/^pld:/, ''), version: 2 }),
    value,
    TTL_MS,
  );
}
/**
 * Xoá tất cả entries của 1 listing id (key prefix `pld:<id>`).
 * Gọi sau mọi mutate (create/update/status/delete) để buyer thấy data mới
 * trong < 30s mà không phải đợi TTL 5 phút.
 */
export async function evictPublicListingDetailCache(id: string | null | undefined, tenantId?: string): Promise<void> {
  if (!id) return;
  const prefix = `pld:${id}`;
  for (const key of Array.from(store.keys())) {
    if (key === prefix || key.startsWith(prefix + '|')) store.delete(key);
  }
  if (tenantId) await sharedCacheDeleteByPrefix(`${tenantId}:public-listing-detail:${id}`);
  else await sharedCacheDeleteByPattern(`*:public-listing-detail*${id}*`);
}
export function publicListingDetailCacheStats(): { size: number } {
  return { size: store.size };
}