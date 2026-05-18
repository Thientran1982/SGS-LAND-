import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';

const SITE_URL = 'https://sgsland.vn';
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.jpg`;

function usePathname(): string {
  const [pathname, setPathname] = useState(() => window.location.pathname);
  useEffect(() => {
    function onPopState() {
      setPathname(window.location.pathname);
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  return pathname;
}

interface SeoHeadProps {
  title: string;
  description: string;
  canonicalPath?: string;
  ogImage?: string;
  ogType?: string;
  ogImageAlt?: string;
  structuredData?: object | object[];
  noindex?: boolean;
}

export function SeoHead({
  title,
  description,
  canonicalPath,
  ogImage = DEFAULT_OG_IMAGE,
  ogType = 'website',
  ogImageAlt,
  structuredData,
  noindex = false,
}: SeoHeadProps) {
  const currentPathname = usePathname();
  const path = canonicalPath ?? currentPathname;
  const canonicalUrl = `${SITE_URL}${path}`;
  const resolvedImageAlt = ogImageAlt ?? title;
  const robotsContent = noindex
    ? 'noindex, follow'
    : 'index, follow, max-image-preview:large, max-snippet:-1';

  // Update the single canonical element that lives in index.html (id="canonical-url").
  // We do NOT put <link rel="canonical"> inside Helmet because Helmet removes the
  // existing element (losing its id) and creates a new one — which causes a duplicate
  // canonical conflict detected by Lighthouse and Google Search Console.
  useEffect(() => {
    const el = document.getElementById('canonical-url') as HTMLLinkElement | null;
    if (el) el.href = canonicalUrl;
  }, [canonicalUrl]);

  // Manage JSON-LD via direct DOM manipulation so it does not duplicate on navigation.
  // Helmet re-renders <script> tags as new nodes on every route change; updating
  // textContent on a stable element avoids that duplication.
  useEffect(() => {
    if (!structuredData) {
      const existing = document.getElementById('json-ld-schema');
      if (existing) existing.remove();
      return;
    }

    if (process.env.NODE_ENV === 'development') {
      if (!Array.isArray(structuredData) && '@context' in (structuredData as Record<string, unknown>)) {
        console.warn(
          '[SeoHead] structuredData already contains an @context key — it is injected automatically. ' +
          'Please remove @context from the object you pass to <SeoHead>.'
        );
      }
    }

    const payload = Array.isArray(structuredData)
      ? { '@context': 'https://schema.org', '@graph': structuredData }
      : { '@context': 'https://schema.org', ...(structuredData as Record<string, unknown>) };

    let script = document.getElementById('json-ld-schema') as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = 'json-ld-schema';
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(payload);
  }, [structuredData]);

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="robots" content={robotsContent} />
      {/* OpenGraph */}
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:secure_url" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={resolvedImageAlt} />
      <meta property="og:site_name" content="SGS LAND" />
      <meta property="og:locale" content="vi_VN" />
      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
      <meta name="twitter:site" content="@SGSLand" />
    </Helmet>
  );
}
