// @ts-nocheck
import type { Metadata } from "next";
import type { Article } from "@/data/articles";

const SITE_URL = "https://sgsland.vn";

/** Generates a Next.js Metadata object from an Article for use in generateMetadata(). */
export function generateArticleMeta(article: Article): Metadata {
  const canonicalUrl = `${SITE_URL}/news/${article.slug}`;
  const ogImage = article.coverImage.startsWith("http")
    ? article.coverImage
    : `${SITE_URL}${article.coverImage}`;

  return {
    title: `${article.seo.metaTitle} | SGS Land`,
    description: article.seo.metaDescription,
    keywords: [article.seo.focusKeyword, ...article.seo.secondaryKeywords],
    alternates: { canonical: canonicalUrl },
    authors: [{ name: article.authorName ?? article.author, url: `${SITE_URL}/tac-gia/${article.author}` }],
    openGraph: {
      type: "article",
      url: canonicalUrl,
      title: article.seo.metaTitle,
      description: article.seo.metaDescription,
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
      description: article.seo.metaDescription,
      images: { url: ogImage, alt: article.title },
    },
  };
}
