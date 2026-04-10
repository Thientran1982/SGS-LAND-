import React from 'react';
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

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />
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

      {/* JSON-LD — client-side layer cho AI crawlers sau navigation */}
      {structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(
            Array.isArray(structuredData)
              ? { '@context': 'https://schema.org', '@graph': structuredData }
              : structuredData
          )}
        </script>
      )}
    </Helmet>
  );
}
