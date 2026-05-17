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
interface Entry { value: unknown; expiresAt: number; }
const TTL_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 1000;
const store = new Map<string, Entry>();
export function getPublicListingDetailCache(key: string): unknown | null {
  const e = store.get(key);
  if (!e) return null;
  if (e.expiresAt < Date.now()) { store.delete(key); return null; }
  // LRU touch: re-insert moves to map tail
  store.delete(key);
  store.set(key, e);
  return e.value;
}
export function setPublicListingDetailCache(key: string, value: unknown): void {
  if (store.has(key)) store.delete(key);
  store.set(key, { value, expiresAt: Date.now() + TTL_MS });
  while (store.size > MAX_ENTRIES) {
    const firstKey = store.keys().next().value;
    if (firstKey === undefined) break;
    store.delete(firstKey);
  }
}
/**
 * Xoá tất cả entries của 1 listing id (key prefix `pld:<id>`).
 * Gọi sau mọi mutate (create/update/status/delete) để buyer thấy data mới
 * trong < 30s mà không phải đợi TTL 5 phút.
 */
export function evictPublicListingDetailCache(id: string | null | undefined): void {
  if (!id) return;
  const prefix = `pld:${id}`;
  for (const key of Array.from(store.keys())) {
    if (key === prefix || key.startsWith(prefix + '|')) store.delete(key);
  }
}
export function publicListingDetailCacheStats(): { size: number } {
  return { size: store.size };
}