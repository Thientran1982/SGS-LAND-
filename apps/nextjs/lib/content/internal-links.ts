// @ts-nocheck
// ─── Internal link map ────────────────────────────────────────────────────────
// GEO: Internal links provide entity clarity — AI engines match named entities
// to canonical URLs, strengthening topical authority signals.

export const KEYWORD_LINKS: Record<string, string> = {
  // Legal
  "Luật Đất Đai 2024": "/news/huong-dan-kiem-tra-phap-ly-truoc-khi-mua-nha-dat-2024",
  "Luật Kinh Doanh BĐS 2023": "/news/luat-kinh-doanh-bat-dong-san-2023-nhung-diem-moi",
  "sổ hồng": "/news/so-do-la-gi-cac-loai-so-do-sgsland",
  "sổ đỏ": "/news/so-do-la-gi-cac-loai-so-do-sgsland",
  "sổ trắng": "/news/so-do-la-gi-cac-loai-so-do-sgsland",
  "quy hoạch": "/news/huong-dan-kiem-tra-phap-ly-truoc-khi-mua-nha-dat-2024",
  // Projects
  "Aqua City": "/du-an/aqua-city",
  "Aqua City Novaland": "/du-an/aqua-city",
  "The Global City": "/du-an/the-global-city",
  "Izumi City": "/du-an/izumi-city",
  "Vinhomes Grand Park": "/du-an/vinhomes-grand-park",
  "Vinhomes Cần Giờ": "/du-an/vinhomes-can-gio",
  "Masterise Homes": "/du-an/masterise-homes",
  // Products
  "định giá AI": "/ai-valuation",
  "định giá BĐS": "/ai-valuation",
  "AVM": "/ai-valuation",
  "Automated Valuation Model": "/ai-valuation",
  // Finance
  "lãi suất vay mua nhà": "/news/cach-vay-mua-nha-lai-suat-thap-2024",
  "vay mua nhà": "/news/cach-vay-mua-nha-lai-suat-thap-2024",
  "lãi suất ngân hàng": "/lai-suat-ngan-hang",
  // Content
  "thị trường BĐS TP.HCM": "/news/thi-truong-bat-dong-san-dong-nam-bo-2025-2026",
  "đầu tư BĐS": "/news/dau-tu-bat-dong-san-cho-nguoi-moi-bat-dau",
  "cho thuê căn hộ": "/news/dong-tien-cho-thue-can-ho-tphcm-2025",
  "marketplace": "/marketplace",
  "ký gửi BĐS": "/ky-gui-bat-dong-san",
};

const TAG_RE = /<a[\s\S]*?<\/a>/gi;

/**
 * Auto-links the FIRST occurrence of each keyword in `content`,
 * skipping keywords that already appear inside an anchor tag.
 */
export function autoLink(content: string): string {
  // Extract all existing anchor positions to avoid double-linking.
  const anchors: [number, number][] = [];
  let m: RegExpExecArray | null;
  const tagReCopy = new RegExp(TAG_RE.source, "gi");
  while ((m = tagReCopy.exec(content)) !== null) {
    anchors.push([m.index, m.index + m[0].length]);
  }

  function isInsideAnchor(start: number): boolean {
    return anchors.some(([s, e]) => start >= s && start < e);
  }

  let result = content;
  let offset = 0; // track character drift as we inject links

  // Sort keywords by length descending — match longer phrases first.
  const entries = Object.entries(KEYWORD_LINKS).sort(([a], [b]) => b.length - a.length);

  for (const [keyword, url] of entries) {
    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?<![">])${escapedKeyword}(?![^<]*>)`, "g");

    re.lastIndex = 0;
    const matchInOriginal = re.exec(content);
    if (!matchInOriginal) continue;

    const origStart = matchInOriginal.index;
    if (isInsideAnchor(origStart)) continue;

    const adjustedIndex = origStart + offset;
    const link = `<a href="${url}" class="text-indigo-600 hover:underline">${keyword}</a>`;
    result =
      result.slice(0, adjustedIndex) +
      link +
      result.slice(adjustedIndex + keyword.length);
    offset += link.length - keyword.length;
  }

  return result;
}
