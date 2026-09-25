/**
 * Display title for a listing (UX audit U7).
 *
 * Listing titles are often SEO-stuffed ("... | Xây Dựng 152,85m² | Giá Chỉ 8.499 Tỷ ...").
 * Price and area already have their own UI, so headings, cards and <title>
 * show a short, readable name. The full title stays in the data.
 */
export function displayListingTitle(raw: unknown, max = 90): string {
  let t = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (!t) return t;
  const pipe = t.indexOf(" | ");
  if (pipe > 15) t = t.slice(0, pipe).trim();
  // Trailing price phrases: "– Giá Chỉ 8.499 Tỷ (...)", ", giá 3,2 tỷ"
  t = t.replace(/\s*[-–—|,]?\s*gi[aá]\s+(ch[iỉ]\s+)?(t[uừ]\s+)?[\d.,]+\s*(t[ỷy]|tri[ệe]u)(\s*\([^)]*\))?/i, "").replace(/\s*,\s*,/g, ",").replace(/^[\s,–—-]+|[\s,–—-]+$/g, "").trim();
  if (!t) t = String(raw ?? "").trim();
  if (t.length > max) {
    const dash = t.search(/\s[–—-]\s/);
    if (dash > 15) t = t.slice(0, dash).trim();
  }
  if (t.length > max) t = t.slice(0, max - 1).replace(/\s+\S*$/, "") + "…";
  return t;
}
