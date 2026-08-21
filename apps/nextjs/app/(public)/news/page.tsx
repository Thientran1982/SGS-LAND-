// @ts-nocheck
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { Calendar, Clock, ArrowRight } from "lucide-react";
import type { Article } from "@/data/articles";
import { getAllArticles } from "@/lib/content/articles-source";
import { AUTHORS } from "@/data/authors";
import { CATEGORIES } from "@/data/categories";
import { CategoryFilter } from "@/components/content/CategoryFilter";
import { AuthorCard } from "@/components/content/AuthorCard";
import { NewsAdminBar } from "@/components/content/NewsAdminBar";
import { SchemaScript } from "@/components/SchemaScript";
import { getBreadcrumbSchema, SITE_URL } from "@/lib/schema";
import { getLang } from "@/lib/lang";
export async function generateMetadata(): Promise<Metadata> {
  const en = (await getLang()) === "en";
  const url = `${SITE_URL}${en ? "/en" : ""}/news`;
  const title = en ? "Real Estate Knowledge & News | SGS LAND Experts" : "Kiến Thức & Tin Tức BĐS | Chuyên gia SGS LAND";
  const description = en
    ? "In-depth real estate market analysis, legal guidance and investment knowledge from SGS LAND experts."
    : "Phân tích thị trường BĐS chuyên sâu, hướng dẫn pháp lý và kiến thức đầu tư từ chuyên gia SGS LAND.";
  return {
    title,
    description,
    alternates: { canonical: url, languages: { "vi-VN": `${SITE_URL}/news`, "en-US": `${SITE_URL}/en/news`, "x-default": `${SITE_URL}/news` } },
    openGraph: {
      type: "article",
      url,
      siteName: "SGS LAND",
      locale: en ? "en_US" : "vi_VN",
      title,
      description,
      images: [{ url: "https://sgsland.vn/og-image.jpg", width: 1200, height: 630 }],
      publishedTime: "2024-03-01T00:00:00.000Z",
      modifiedTime: new Date().toISOString(),
    },
  };
}
export const dynamic = "force-dynamic";
function formatDate(iso: string, lang: "vi" | "en") {
  return new Date(iso).toLocaleDateString(lang === "en" ? "en-US" : "vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function ArticleCard({ article, prefix = "", lang = "vi" }: { article: Article; prefix?: string; lang?: "vi" | "en" }) {
  const cat = CATEGORIES.find((c) => c.slug === article.category);
  const author = AUTHORS.find((a) => a.slug === article.author);
  const catColor = cat?.color ?? "var(--primary-600)";
  return (
    <article
      className="group flex flex-col rounded-2xl overflow-hidden transition-transform hover:scale-[1.01]"
      style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}
      itemScope      itemType="https://schema.org/Article"
    >
      <Link href={`${prefix}/news/${article.slug}`} className="block aspect-[16/9] relative overflow-hidden shrink-0" tabIndex={-1} aria-hidden>
        <Image
          src={article.coverImage}
          alt={article.title}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-500"
          sizes="(max-width: 768px) 100vw, 50vw"
        />
      </Link>
      <div className="flex flex-col flex-1 p-5">
        <div className="flex items-center gap-2 mb-3">
          {cat && (
            <span
              className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
              style={{ background: `${catColor}18`, color: catColor }}
            >
              {cat.name}
            </span>
          )}
          <span className="flex items-center gap-1 text-xs" style={{ color: "var(--text-tertiary)" }}>
            <Calendar className="w-3 h-3" aria-hidden />
            <time dateTime={article.publishedAt} itemProp="datePublished">{formatDate(article.publishedAt, lang)}</time>
          </span>
          <span className="flex items-center gap-1 text-xs" style={{ color: "var(--text-tertiary)" }}>
            <Clock className="w-3 h-3" aria-hidden />
            {article.readTime} {lang === "en" ? "min read" : "phút"}
          </span>
        </div>
        <h2
          className="font-bold text-base leading-snug mb-2 group-hover:text-sgs-primary transition-colors line-clamp-2 flex-1"
          style={{ color: "var(--text-primary)" }}
          itemProp="headline"
        >
          <Link href={`${prefix}/news/${article.slug}`}>{article.title}</Link>
        </h2>
        <p className="text-sm leading-relaxed mb-4 line-clamp-2" style={{ color: "var(--text-secondary)" }} itemProp="description">
          {article.excerpt}
        </p>
        <div className="flex items-center justify-between mt-auto">
          {author && (
            <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-tertiary)" }}>
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                style={{ background: "var(--primary-600)" }}>
                {author.name.charAt(0)}
              </span>
              <span itemProp="author" itemScope itemType="https://schema.org/Person">
                <span itemProp="name">{author.name}</span>
              </span>
            </div>
          )}
          <Link href={`${prefix}/news/${article.slug}`} className="flex items-center gap-1 text-xs font-semibold"
            style={{ color: "var(--primary-600)" }}>
            {lang === "en" ? "Read more" : "Đọc tiếp"} <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </article>
  );
}
function FeaturedArticle({ article, prefix = "", lang = "vi" }: { article: Article; prefix?: string; lang?: "vi" | "en" }) {
  const cat = CATEGORIES.find((c) => c.slug === article.category);
  const author = AUTHORS.find((a) => a.slug === article.author);
  const catColor = cat?.color ?? "var(--primary-600)";
  return (
    <article
      className="group grid grid-cols-1 md:grid-cols-2 gap-0 rounded-2xl overflow-hidden mb-10"
      style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}
    >
      <Link href={`${prefix}/news/${article.slug}`} className="block aspect-video md:aspect-auto relative overflow-hidden" aria-hidden tabIndex={-1}>
        <Image
          src={article.coverImage}
          alt={article.title}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-500"
          sizes="(max-width: 768px) 100vw, 50vw"
          priority
        />
        <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-bold text-white"
          style={{ background: "var(--primary-600)" }}>
          {lang === "en" ? "Featured" : "Nổi bật"}
        </span>
      </Link>
      <div className="flex flex-col justify-center p-5 sm:p-7">
        {cat && (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold mb-3 inline-block w-fit"
            style={{ background: `${catColor}18`, color: catColor }}>
            {cat.name}
          </span>
        )}
        <h2 className="text-xl sm:text-2xl font-extrabold leading-tight mb-3 group-hover:text-sgs-primary transition-colors"
          style={{ color: "var(--text-primary)" }}>
          <Link href={`${prefix}/news/${article.slug}`}>{article.title}</Link>
        </h2>
        <p className="text-sm leading-relaxed mb-5 line-clamp-3" style={{ color: "var(--text-secondary)" }}>
          {article.excerpt}
        </p>
        <div className="flex items-center gap-4 text-xs" style={{ color: "var(--text-tertiary)" }}>
          {author && <span>{author.name}</span>}
           <span>{formatDate(article.publishedAt, lang)}</span>
           <span>{article.readTime} {lang === "en" ? "min read" : "phút đọc"}</span>
        </div>
      </div>
    </article>
  );
}
export default async function NewsPage() {
  const lang = await getLang();
  const en = lang === "en";
  const prefix = lang === "en" ? "/en" : "";
  // Single source of truth: the Postgres `articles` table (via /api/public/articles)
  const all = await getAllArticles();
  const featured = all.filter((a) => a.featured).slice(0, 1);
  const rest = all.filter((a) => a.slug !== featured[0]?.slug);
  const breadcrumb = getBreadcrumbSchema([
    { name: "Trang chủ", url: SITE_URL },
    { name: "Kiến thức & Tin tức", url: `${SITE_URL}/news` },
  ]);
  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${SITE_URL}/news#collection`,
    name: "Kiến thức & Tin tức BĐS — SGS LAND",
    url: `${SITE_URL}/news`,
    inLanguage: "vi",
    publisher: { "@id": `${SITE_URL}/#organization` },
    mainEntity: {
      "@type": "ItemList",
      itemListElement: all.map((a, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${SITE_URL}/news/${a.slug}`,
        name: a.title,
      })),
    },
  };
  return (
    <>
      <SchemaScript schemas={[breadcrumb, collectionSchema]} />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12 sm:py-12">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-4xl font-extrabold mb-2" style={{ color: "var(--text-primary)" }}>
            {en ? "Real Estate Knowledge & News" : "Kiến thức & Tin tức BĐS"}
          </h1>
          <p style={{ color: "var(--text-secondary)" }}>
            {en ? "In-depth analysis, legal guidance and investment knowledge from SGS LAND experts" : "Phân tích chuyên sâu, hướng dẫn pháp lý và kiến thức đầu tư từ chuyên gia SGS LAND"}
          </p>
        </div>
        {/* Editor toolbar - only visible to signed-in staff */}
        <NewsAdminBar />
        {/* Category filter (client component) */}
        <Suspense>
          <CategoryFilter categories={CATEGORIES} lang={lang} className="mb-8" />
        </Suspense>
        {/* Featured article */}
        {featured[0] && <FeaturedArticle article={featured[0]} prefix={prefix} lang={lang} />}
        {/* Main grid + sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Articles grid */}
          <div className="lg:col-span-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {rest.map((article) => (
                <ArticleCard key={article.slug} article={article} prefix={prefix} lang={lang} />
              ))}
            </div>
          </div>
          {/* Sidebar: Expert authors */}
          <aside className="space-y-4">
            <p className="font-bold text-base mb-2" style={{ color: "var(--text-primary)" }}>
              {en ? "Expert authors" : "Tác giả chuyên gia"}
            </p>
            {AUTHORS.map((author) => (
              <AuthorCard key={author.slug} author={author} variant="full" />
            ))}
          </aside>
        </div>
      </div>
    </>
  );
}