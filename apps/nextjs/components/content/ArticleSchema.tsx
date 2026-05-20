import type { Article } from "@/data/articles";
import type { Author } from "@/data/authors";

const SITE_URL = "https://sgsland.vn";

interface ArticleSchemaProps {
  article: Article;
  author: Author;
}

/**
 * Injects Article JSON-LD structured data for GEO + E-E-A-T.
 *
 * GEO impact:
 * - Article schema with author Person data (+32% citation probability)
 * - Citation array (sources) as schema.org citation (+30.3%)
 * - dateModified freshness signal for Perplexity real-time crawling
 * - reviewedBy field for legal articles (Google YMYL trust signal)
 */
export function ArticleSchema({ article, author }: ArticleSchemaProps) {
  const canonicalUrl = `${SITE_URL}/news/${article.slug}`;

  const authorSchema = {
    "@type": "Person",
    name: author.name,
    url: `${SITE_URL}/tac-gia/${author.slug}`,
    jobTitle: author.title,
    sameAs: author.sameAs,
    worksFor: {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "SGS LAND",
    },
  };

  const citations = article.sources.map((src) => ({
    "@type": "CreativeWork",
    name: src.name,
    url: src.url,
    datePublished: String(src.publishedYear),
  }));

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${canonicalUrl}#article`,
    headline: article.title,
    description: article.excerpt,
    url: canonicalUrl,
    image: {
      "@type": "ImageObject",
      url: article.coverImage.startsWith("http")
        ? article.coverImage
        : `${SITE_URL}${article.coverImage}`,
      width: 1200,
      height: 630,
    },
    author: authorSchema,
    publisher: {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "SGS LAND",
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/icon-512.png`,
        width: 512,
        height: 512,
      },
    },
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    wordCount: article.wordCount,
    inLanguage: "vi-VN",
    about: { "@type": "Thing", name: "Bất động sản Việt Nam" },
    keywords: article.tags.join(", "),
    citation: citations,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": canonicalUrl,
    },
  };

  // Add reviewedBy for legal articles (YMYL trust signal)
  if (article.isLegal) {
    schema.reviewedBy = {
      "@type": "Person",
      name: "Nguyễn Văn Pháp",
      jobTitle: "Chuyên gia Pháp lý BĐS",
      url: `${SITE_URL}/tac-gia/chuyen-gia-phap-ly`,
    };
    schema.legislationIdentifier = "Luật Đất Đai 2024 (Luật số 31/2024/QH15)";
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema, null, 2) }}
    />
  );
}
