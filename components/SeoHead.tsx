import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';

const SITE_URL = 'https://sgsland.vn';
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.jpg`;

interface SeoHeadProps {
  title: string;
  description: string;
  canonicalPath?: string;
  ogImage?: string;
  structuredData?: object | object[];
  noindex?: boolean;
}

export function SeoHead({
  title,
  description,
  canonicalPath,
  ogImage = DEFAULT_OG_IMAGE,
  structuredData,
  noindex = false,
}: SeoHeadProps) {
  const path = canonicalPath ?? window.location.pathname.split('?')[0];
  const canonicalUrl = `${SITE_URL}${path}`;

  const robotsContent = noindex
    ? 'noindex, nofollow'
    : 'index, follow, max-image-preview:large, max-snippet:-1';

  // Update the single canonical element that lives in index.html (id="canonical-url").
  // We do NOT put <link rel="canonical"> inside Helmet because Helmet removes the
  // existing element (losing its id) and creates a new one — which causes a duplicate
  // canonical conflict detected by Lighthouse and Google Search Console.
  useEffect(() => {
    const el = document.getElementById('canonical-url') as HTMLLinkElement | null;
    if (el) el.href = canonicalUrl;
  }, [canonicalUrl]);

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="robots" content={robotsContent} />

      {/* OpenGraph */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:secure_url" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={title} />
      <meta property="og:site_name" content="SGS LAND" />
      <meta property="og:locale" content="vi_VN" />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
      <meta name="twitter:site" content="@SGSLand" />

      {/* JSON-LD — client-side layer cho AI crawlers sau navigation.
          Luôn auto-inject @context (https://schema.org) để callers không cần lặp lại. */}
      {structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(
            Array.isArray(structuredData)
              ? { '@context': 'https://schema.org', '@graph': structuredData }
              : { '@context': 'https://schema.org', ...(structuredData as Record<string, unknown>) }
          )}
        </script>
      )}
    </Helmet>
  );
}
