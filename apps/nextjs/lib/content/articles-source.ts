/**
 * SINGLE SOURCE OF TRUTH for editorial content = the Postgres `articles` table,
 * served by Express at /api/public/articles.
 *
 * The old hand-written array in data/articles.ts has been migrated into the DB
 * (scripts/seed-static-articles.ts) and is now only kept for its TypeScript
 * types. Nothing in the app reads it at runtime any more.
 */
import { cache } from "react";
import type { Article, Source, ArticleSEO } from "@/data/articles";
import { AUTHORS } from "@/data/authors";

const BASE_URL =
  typeof window === "undefined"
    ? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"
    : "";

/** Remove Vietnamese diacritics so DB labels can be matched reliably. */
function deaccent(input: string): string {
  return (input || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[d]/gi, (m) => (m === m.toLowerCase() ? "d" : "D"))
    .toLowerCase()
    .trim();
}

function slugify(input: string): string {
  return deaccent(input)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** DB categories are free text; map them onto the 5 canonical site categories. */
const CATEGORY_MAP: Record<string, string> = {
  "thi truong": "phan-tich-thi-truong",
  "xu huong": "phan-tich-thi-truong",
  "khu vuc": "phan-tich-thi-truong",
  "quy hoach": "phan-tich-thi-truong",
  "chinh sach": "phan-tich-thi-truong",
  "bao cao": "phan-tich-thi-truong",
  "phap ly": "huong-dan-phap-ly",
  "phap luat": "huong-dan-phap-ly",
  "dau tu": "kien-thuc-dau-tu",
  "kien thuc": "kien-thuc-dau-tu",
  "dich vu": "kien-thuc-dau-tu",
  "dinh gia ai": "kien-thuc-dau-tu",
  "so sanh du an": "kien-thuc-dau-tu",
  "phan khuc cao cap": "kien-thuc-dau-tu",
  "du an": "du-an-noi-bat",
  "tai chinh": "tai-chinh-vay-mua-nha",
  "vay mua nha": "tai-chinh-vay-mua-nha",
};

const VALID_CATEGORIES = [
  "phan-tich-thi-truong",
  "huong-dan-phap-ly",
  "kien-thuc-dau-tu",
  "du-an-noi-bat",
  "tai-chinh-vay-mua-nha",
];

export function normalizeCategory(raw: string | null | undefined): string {
  const value = (raw || "").trim();
  if (VALID_CATEGORIES.includes(value)) return value;
  const key = deaccent(value);
  if (CATEGORY_MAP[key]) return CATEGORY_MAP[key];
  const asSlug = slugify(value);
  if (VALID_CATEGORIES.includes(asSlug)) return asSlug;
  return "phan-tich-thi-truong";
}

/** "Tran Minh Thien - Founder SGS LAND" -> author slug when we know that person. */
function resolveAuthor(raw: string | null | undefined, metaSlug?: string) {
  const label = (raw || "").trim();
  if (metaSlug && AUTHORS.some((a) => a.slug === metaSlug)) {
    return { slug: metaSlug, name: label || AUTHORS.find((a) => a.slug === metaSlug)!.name };
  }
  const namePart = label.split(/\s+[-\u2013\u2014]\s+/)[0] || label;
  const candidate = slugify(namePart);
  if (AUTHORS.some((a) => a.slug === candidate)) return { slug: candidate, name: namePart };
  return { slug: "ban-bien-tap", name: label || "Ban Bi\u00ean T\u1eadp SGS LAND" };
}

/** Used when a DB row has no cover image, so <Image> never gets an empty src. */
const FALLBACK_COVER = "/images/projects/the-global-city.jpg";

function stripHtml(html: string): string {
  return (html || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/** Map one DB row (already normalised by the API) onto the site Article shape. */
export function mapDbArticle(row: any): Article {
  const meta = (row && typeof row.metadata === "object" && row.metadata) || {};
  const body: string = row.content || "";
  const plain = stripHtml(body);
  const wordCount: number =
    typeof meta.wordCount === "number" && meta.wordCount > 0
      ? meta.wordCount
      : plain
        ? plain.split(" ").filter(Boolean).length
        : 0;
  const readTime: number =
    typeof meta.readTime === "number" && meta.readTime > 0
      ? meta.readTime
      : Math.max(1, Math.round(wordCount / 200));
  const author = resolveAuthor(row.author, meta.authorSlug);
  const title: string = row.title || "";
  const excerpt: string = row.excerpt || plain.slice(0, 180);
  const publishedAt: string = row.publishedAt || row.createdAt || new Date().toISOString();
  // metadata.seo comes from the CMS as { title, description, focusKeyword, schemaType }
  // or from the legacy seed as a full ArticleSEO - merge both onto safe defaults.
  const rawSeo: any = meta.seo && typeof meta.seo === "object" ? meta.seo : {};
  const seo: ArticleSEO = {
    metaTitle: rawSeo.metaTitle || rawSeo.title || title,
    metaDescription: rawSeo.metaDescription || rawSeo.description || excerpt,
    focusKeyword: rawSeo.focusKeyword || "",
    secondaryKeywords: Array.isArray(rawSeo.secondaryKeywords) ? rawSeo.secondaryKeywords : [],
  };

  return {
    id: String(row.id || row.slug || ""),
    slug: row.slug || "",
    title,
    excerpt,
    category: normalizeCategory(row.category),
    author: author.slug,
    authorName: author.name,
    publishedAt,
    updatedAt: row.updatedAt || meta.updatedAt || publishedAt,
    readTime,
    wordCount,
    tags: toArray<string>(row.tags),
    coverImage: row.coverImage || row.image || FALLBACK_COVER,
    featured: row.featured === true,
    outline: toArray<string>(meta.outline),
    body,
    sources: toArray<Source>(meta.sources),
    relatedSlugs: toArray<string>(meta.relatedSlugs),
    seo,
    isLegal: meta.isLegal === true,
  };
}

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** All published articles, newest first. Deduplicated per request. */
export const getAllArticles = cache(async (): Promise<Article[]> => {
  const json = await fetchJson<{ data?: any[] }>("/api/public/articles?page=1&pageSize=200");
  const rows = Array.isArray(json?.data) ? json!.data! : [];
  return rows.map(mapDbArticle).filter((a) => a.slug);
});

export const getArticleBySlug = cache(async (slug: string): Promise<Article | undefined> => {
  if (!slug) return undefined;
  const row = await fetchJson<any>(`/api/public/articles/${encodeURIComponent(slug)}`);
  if (row && row.slug) return mapDbArticle(row);
  const all = await getAllArticles();
  return all.find((a) => a.slug === slug);
});

export async function getFeaturedArticles(limit = 2): Promise<Article[]> {
  const all = await getAllArticles();
  const featured = all.filter((a) => a.featured);
  return (featured.length ? featured : all).slice(0, limit);
}

export async function getArticlesByCategory(categorySlug: string): Promise<Article[]> {
  const all = await getAllArticles();
  return all.filter((a) => a.category === categorySlug);
}

export async function getArticlesByAuthor(authorSlug: string): Promise<Article[]> {
  const all = await getAllArticles();
  return all.filter((a) => a.author === authorSlug);
}
