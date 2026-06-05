import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ARTICLES, getArticleBySlug } from "@/data/articles";
import { getAuthorBySlug } from "@/data/authors";
import { getCategoryBySlug, CATEGORIES } from "@/data/categories";
import { getRelatedArticles } from "@/lib/content/related-articles";
import { generateArticleMeta } from "@/lib/seo/article-meta";
import { ArticleHeader } from "@/components/content/ArticleHeader";
import { ArticleFooter } from "@/components/content/ArticleFooter";
import { TrustBadges } from "@/components/content/TrustBadges";
import { ArticleSchema } from "@/components/content/ArticleSchema";
import { SchemaScript } from "@/components/SchemaScript";
import { getBreadcrumbSchema, SITE_URL } from "@/lib/schema";

export async function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const canonicalUrl = `https://sgsland.vn/news/${slug}`;
  const article = getArticleBySlug(slug);
  if (!article) {
    return {
      title: "Bài viết không tìm thấy | SGS LAND",
      alternates: { canonical: canonicalUrl },
    };
  }
  return {
    ...generateArticleMeta(article),
    alternates: { canonical: canonicalUrl },
  };
}

export const revalidate = 3600;

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) notFound();

  const author = getAuthorBySlug(article.author);
  if (!author) notFound();

  const category = getCategoryBySlug(article.category);
  const relatedArticles = getRelatedArticles(ARTICLES, slug, article.category, article.tags);

  const breadcrumb = getBreadcrumbSchema([
    { name: "Trang chủ", url: SITE_URL },
    { name: "Kiến thức & Tin tức", url: `${SITE_URL}/news` },
    ...(category ? [{ name: category.name, url: `${SITE_URL}/news?category=${category.slug}` }] : []),
    { name: article.title, url: `${SITE_URL}/news/${slug}` },
  ]);

  return (
    <>
      {/* Article JSON-LD + Breadcrumb */}
      <ArticleSchema article={article} author={author} />
      <SchemaScript schemas={[breadcrumb]} />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-10">
          {/* Main content */}
          <article itemScope itemType="https://schema.org/Article">
            <ArticleHeader article={article} author={author} category={category} />

            {/* Article body placeholder — in production this renders MDX/rich text */}
            <div
              className="prose prose-lg max-w-none mb-10"
              style={{ color: "var(--text-secondary)" }}
              itemProp="articleBody"
            >
              {/* Direct answer block — GEO: lead with the answer in ≤60 words */}
              <div
                className="p-5 rounded-xl mb-8 text-base leading-relaxed font-medium"
                style={{
                  background: "var(--primary-subtle)",
                  borderLeft: "4px solid var(--primary-600)",
                  color: "var(--text-primary)",
                }}
              >
                {article.excerpt}
              </div>

              {/* Outline / Table of contents */}
              <nav aria-label="Mục lục bài viết" className="mb-8">
                <p className="font-bold text-sm mb-3" style={{ color: "var(--text-primary)" }}>
                  Nội dung bài viết
                </p>
                <ol className="space-y-1.5">
                  {article.outline.map((section, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <span className="font-mono shrink-0 text-xs mt-0.5" style={{ color: "var(--primary-600)" }}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span style={{ color: "var(--text-secondary)" }}>{section}</span>
                    </li>
                  ))}
                </ol>
              </nav>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mt-8">
                {article.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{
                      background: "var(--bg-elevated)",
                      color: "var(--text-secondary)",
                      border: "1px solid var(--border-default)",
                    }}
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>

            <ArticleFooter
              article={article}
              author={author}
              relatedArticles={relatedArticles}
              categories={CATEGORIES}
            />
          </article>

          {/* Sticky sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-6 space-y-6">
              <TrustBadges />

              {/* Inline CTA */}
              <div
                className="p-5 rounded-2xl text-center"
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-default)",
                }}
              >
                <p className="font-bold mb-1 text-sm" style={{ color: "var(--text-primary)" }}>
                  Định giá BĐS miễn phí
                </p>
                <p className="text-xs mb-4" style={{ color: "var(--text-secondary)" }}>
                  Sai số ±5%, kết quả trong 30 giây
                </p>
                <a
                  href="/ai-valuation"
                  className="block w-full text-center py-2.5 rounded-xl font-semibold text-white text-sm transition-opacity hover:opacity-90"
                  style={{ background: "var(--primary-600)" }}
                >
                  Định giá ngay
                </a>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
