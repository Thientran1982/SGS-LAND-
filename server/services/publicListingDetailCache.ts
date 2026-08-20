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
import { sharedCacheDeleteByPattern, sharedCacheDeleteByPrefix, sharedCacheKey, sharedCacheRead, sharedCacheSet } from './sharedCache';
interface Entry { value: unknown; expiresAt: number; }
const TTL_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 1000;
const store = new Map<string, Entry>();
function cacheKey(key: string, tenantId: string): string {
  return sharedCacheKey({ tenantId, namespace: 'public-listing-detail', listingId: key.replace(/^pld:/, ''), version: 2 });
}
export async function getPublicListingDetailCache(key: string, tenantId: string): Promise<unknown | null> {
  const keyForTenant = cacheKey(key, tenantId);
  const shared = await sharedCacheRead(keyForTenant);
  if (shared.value !== null) return shared.value;
  if (shared.source === 'miss') return null;
  const e = store.get(keyForTenant);
  if (!e) return null;
  if (e.expiresAt < Date.now()) { store.delete(keyForTenant); return null; }
  // LRU touch: re-insert moves to map tail
  store.delete(keyForTenant);
  store.set(keyForTenant, e);
  return e.value;
}
export async function setPublicListingDetailCache(key: string, value: unknown, tenantId: string): Promise<void> {
  const keyForTenant = cacheKey(key, tenantId);
  if (store.has(keyForTenant)) store.delete(keyForTenant);
  store.set(keyForTenant, { value, expiresAt: Date.now() + TTL_MS });
  while (store.size > MAX_ENTRIES) {
    const firstKey = store.keys().next().value;
    if (firstKey === undefined) break;
    store.delete(firstKey);
  }
  await sharedCacheSet(keyForTenant, value, TTL_MS);
}
/**
 * Xoá tất cả entries của 1 listing id (key prefix `pld:<id>`).
 * Gọi sau mọi mutate (create/update/status/delete) để buyer thấy data mới
 * trong < 30s mà không phải đợi TTL 5 phút.
 */
export async function evictPublicListingDetailCache(id: string | null | undefined, tenantId?: string): Promise<void> {
  if (!id) return;
  const cleanId = String(id).trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '_');
  for (const key of Array.from(store.keys())) {
    if (key.includes(`:public-listing-detail:${cleanId}`)) store.delete(key);
  }
  if (tenantId) await sharedCacheDeleteByPrefix(`${tenantId}:public-listing-detail:${id}`);
  else await sharedCacheDeleteByPattern(`*:public-listing-detail*${id}*`);
}
export function publicListingDetailCacheStats(): { size: number } {
  return { size: store.size };
}