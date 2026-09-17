/**
 * Keep page metadata inside the practical search/snippet ranges without
 * cutting through a word or allowing CMS copy to produce duplicate noise.
 */
function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeMetaTitle(value: string, fallback = "SGS LAND"): string {
  const title = clean(value);
  if (title.length <= 60) return title;
  const shortened = title.slice(0, 57).replace(/\s+\S*$/, "").trim();
  return `${shortened}…`;
}

export function normalizeMetaDescription(
  value: string,
  suffix = " Cập nhật từ chuyên gia SGS LAND.",
): string {
  const description = clean(value);
  if (description.length >= 140 && description.length <= 160) return description;
  if (description.length > 160) {
    return `${description.slice(0, 157).replace(/\s+\S*$/, "").trim()}…`;
  }

  const enriched = clean(`${description}${suffix}`);
  if (enriched.length <= 160) return enriched;
  return `${enriched.slice(0, 157).replace(/\s+\S*$/, "").trim()}…`;
}