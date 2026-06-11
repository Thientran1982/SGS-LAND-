// @ts-nocheck
// ─── Breadcrumb generator ─────────────────────────────────────────────────────
// Maps URL segments to human-readable Vietnamese labels.

export interface BreadcrumbItem {
  name: string;
  url: string;
}

const SEGMENT_LABELS: Record<string, string> = {
  "news": "Kiến thức & Tin tức",
  "tin-tuc": "Kiến thức & Tin tức",
  "du-an": "Dự án BĐS",
  "tac-gia": "Tác giả",
  "about-us": "Về chúng tôi",
  "marketplace": "Marketplace",
  "ai-valuation": "Định giá AI",
  "contact": "Liên hệ",
  "chinh-sach-bien-tap": "Chính sách biên tập",
  "privacy-policy": "Chính sách bảo mật",
  "terms-of-service": "Điều khoản sử dụng",
  "dau-tu-bat-dong-san": "Đầu tư BĐS",
  "phap-ly-nha-dat": "Pháp lý nhà đất",
  "lai-suat-ngan-hang": "Lãi suất ngân hàng",
  "ky-gui-bat-dong-san": "Ký gửi BĐS",
};

/**
 * Generates breadcrumb items from a URL pathname.
 * Always prepends "Trang chủ" → SITE_URL.
 */
export function generateBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const SITE_URL = "https://sgsland.vn";
  const segments = pathname.split("/").filter(Boolean);

  const crumbs: BreadcrumbItem[] = [{ name: "Trang chủ", url: SITE_URL }];

  let accumulated = "";
  for (const seg of segments) {
    accumulated += `/${seg}`;
    crumbs.push({
      name: SEGMENT_LABELS[seg] ?? seg.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      url: `${SITE_URL}${accumulated}`,
    });
  }

  return crumbs;
}
