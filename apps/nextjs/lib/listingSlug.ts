/**
 * Human-readable listing slug.
 *
 * Keep the UUID outside this helper: the detail route uses the trailing UUID
 * as the stable identifier, while this part is only for SEO/readability.
 */
export function slugifyListingTitle(title: string | null | undefined): string {
  const normalized = String(title || "bds")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, (char) => (char === "Đ" ? "D" : "d"));

  return normalized
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "") || "bds";
}