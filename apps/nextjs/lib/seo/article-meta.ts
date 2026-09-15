// @ts-nocheck
import type { Metadata } from "next";
import type { Article } from "@/data/articles";

const SITE_URL = "https://sgsland.vn";

/** Generates a Next.js Metadata object from an Article for use in generateMetadata(). */
export function generateArticleMeta(article: Article): Metadata {
  const canonicalUrl = `${SITE_URL}/tin-tuc/${article.slug}`;
  const description =
    article.seo?.metaDescription?.trim() ||
    article.excerpt?.trim() ||
    article.title?.trim() ||
    "Thông tin và kiến thức bất động sản từ SGS LAND.";
  const ogImage = article.coverImage.startsWith("http")
    ? article.coverImage
    : `${SITE_URL}${article.coverImage}`;

  return {
    title: `${article.seo.metaTitle} | SGS Land`,
    description,
    keywords: [article.seo.focusKeyword, ...article.seo.secondaryKeywords],
    alternates: { canonical: canonicalUrl },
    authors: [{ name: article.authorName ?? article.author, url: `${SITE_URL}/tac-gia/${article.author}` }],
    openGraph: {
      type: "article",
      url: canonicalUrl,
      title: article.seo.metaTitle,
      description,
      siteName: "SGS LAND",
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      authors: [`${SITE_URL}/tac-gia/${article.author}`],
      images: [{ url: ogImage, width: 1200, height: 630, alt: article.title }],
      locale: "vi_VN",
    },
    twitter: {
      card: "summary_large_image",
      title: article.seo.metaTitle,
      description,
      images: { url: ogImage, alt: article.title },
    },
  };
}
