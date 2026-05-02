/**
 * Image URL helpers — chèn `?w=N` (chiều rộng đích pixel) cho những ảnh được
 * serve qua route `/uploads/<tenantId>/<filename>`. Server (uploadRoutes) sẽ
 * dùng sharp để resize on-demand và cache `public, max-age=31536000, immutable`.
 *
 * Kết quả: thumbnail 48px chỉ tải ~5–15 KB thay vì 200–600 KB ảnh gốc 1920px,
 * giúp danh sách inventory / mini-site gallery mượt hẳn ngay từ lần load đầu.
 *
 * Quy tắc:
 * - Chỉ thêm `?w=` cho URL nội bộ (`/uploads/`); URL ngoài (Supabase, CDN bên
 *   thứ 3, data:) trả về nguyên trạng để tránh phá cache key của hệ khác.
 * - Bỏ qua nếu URL đã có sẵn query (vd `?w=` đã set hoặc signed URL).
 * - Làm tròn lên bội số 64 để tăng tỉ lệ trùng cache giữa các kích thước
 *   gần nhau (50px → 64, 80px → 128, 200px → 256, …).
 */

const STEP = 64;
const MAX_W = 2400;

export function optimizedImageUrl(url: string | null | undefined, targetWidth: number): string {
  if (!url) return '';
  if (typeof url !== 'string') return String(url);
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  // Chỉ áp dụng cho route /uploads/ nội bộ (relative hoặc absolute cùng origin).
  // Nếu URL chứa `://` mà không phải cùng origin → external, giữ nguyên.
  const isInternalUploads =
    url.startsWith('/uploads/') ||
    (typeof window !== 'undefined' && url.startsWith(window.location.origin + '/uploads/'));
  if (!isInternalUploads) return url;
  if (url.includes('?')) return url; // đã có query — không đụng
  const w = Math.min(MAX_W, Math.max(STEP, Math.ceil(targetWidth / STEP) * STEP));
  return `${url}?w=${w}`;
}
