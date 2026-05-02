/**
 * In-memory cache cho public project microsite payload.
 *
 * - TTL 5 phút (đáp ứng yêu cầu spec: server-side cache 5min).
 * - Invalidation thủ công qua `evictPublicProjectCache(code)` được gọi từ
 *   projectRoutes (PUT /api/projects/:id) và listingRoutes (POST/PUT/PATCH/
 *   DELETE) khi listing thuộc project_code đó thay đổi.
 * - Multi-instance: cache là per-process. Với TTL 5 phút và invalidation
 *   best-effort, độ trễ tối đa giữa các instance là 5 phút — chấp nhận được
 *   cho microsite tĩnh. Khi cần đồng bộ tuyệt đối (vd. > 5 instance), nâng
 *   cấp lên Upstash Redis với key `sgsland:public:project:<code>`.
 */

const TTL_MS = 5 * 60 * 1000; // 5 phút
// Hard cap chống memory blowup khi crawler đập trăm ngàn project codes (kể cả
// 404 không cache, nhưng entries hợp lệ vẫn có thể lớn nếu tenant có nhiều dự
// án công khai). FIFO evict — đơn giản, đủ tốt cho microsite tĩnh.
const MAX_ENTRIES = 500;

interface Entry {
  value: any;
  expiresAt: number;
}

const store = new Map<string, Entry>();

function normalizeKey(code: string): string {
  return String(code || '').trim().toUpperCase();
}

export function getPublicProjectCache(code: string): any | null {
  const key = normalizeKey(code);
  if (!key) return null;
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

export function setPublicProjectCache(code: string, value: any): void {
  const key = normalizeKey(code);
  if (!key) return;
  // FIFO eviction khi vượt MAX_ENTRIES — Map giữ insertion order, oldest first.
  // Refresh thì delete trước rồi set để đẩy key xuống cuối (LRU-ish).
  if (store.has(key)) {
    store.delete(key);
  } else if (store.size >= MAX_ENTRIES) {
    const oldestKey = store.keys().next().value;
    if (oldestKey !== undefined) store.delete(oldestKey);
  }
  store.set(key, { value, expiresAt: Date.now() + TTL_MS });
}

export function evictPublicProjectCache(code: string | null | undefined): void {
  const key = normalizeKey(code || '');
  if (!key) return;
  store.delete(key);
}

export function clearPublicProjectCache(): void {
  store.clear();
}

/** Test/diagnostics helper. */
export function publicProjectCacheStats(): { size: number; keys: string[] } {
  return { size: store.size, keys: Array.from(store.keys()) };
}
