/**
 * Server-side SEO meta tag injection.
 *
 * Reads dist/index.html (production) and replaces static meta tags with
 * dynamic content derived from the DB — so crawlers (Google, Facebook,
 * Zalo, Telegram, etc.) always see the correct title / description / image
 * without executing JavaScript.
 */

import { readFileSync } from 'fs';
import path from 'path';

const APP_URL = (process.env.APP_URL || 'https://sgsland.vn').replace(/\/$/, '');
const DEFAULT_IMAGE = `${APP_URL}/og-image.jpg`;

const DEFAULT_META = {
  title: 'SGS LAND | Phần Mềm Quản Lý Bất Động Sản AI Số 1 Việt Nam',
  description:
    'SGS LAND - Phần mềm quản lý bất động sản thế hệ mới tích hợp AI định giá tự động, CRM đa kênh và quản lý kho hàng toàn diện. Giải pháp #1 cho sàn giao dịch và doanh nghiệp bất động sản Việt Nam.',
  image: DEFAULT_IMAGE,
  url: APP_URL,
  type: 'website',
};

export interface MetaData {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
  structuredData?: object;
  noIndex?: boolean;
}

function esc(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtVND(price: number): string {
  if (price >= 1_000_000_000) return `${(price / 1_000_000_000).toFixed(1)} tỷ đồng`;
  if (price >= 1_000_000) return `${Math.round(price / 1_000_000)} triệu đồng`;
  return price.toLocaleString('vi-VN') + ' đồng';
}

export function buildListingMeta(listing: any): MetaData {
  const priceStr = listing.price ? fmtVND(Number(listing.price)) : '';
  const areaStr = listing.area ? `${listing.area}m²` : '';
  const transaction = listing.transaction === 'RENT' ? 'Cho thuê' : 'Bán';
  const type = listing.type ?? '';

  const title = listing.title
    ? `${listing.title} | SGS LAND`
    : `${transaction} ${type} ${areaStr} - ${listing.location ?? ''} | SGS LAND`.trim();

  const parts: string[] = [
    listing.title || `${transaction} bất động sản`,
    listing.location ? `📍 ${listing.location}` : '',
    priceStr ? `💰 Giá: ${priceStr}` : '',
    areaStr ? `📐 Diện tích: ${areaStr}` : '',
    listing.bedrooms ? `🛏 ${listing.bedrooms} phòng ngủ` : '',
  ].filter(Boolean);
  const description = parts.join(' — ').slice(0, 300);

  const images: string[] = Array.isArray(listing.images) ? listing.images : [];
  const image = images[0] || DEFAULT_IMAGE;
  const url = `${APP_URL}/listings/${listing.id}`;

  const structuredData: any = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    inLanguage: 'vi',
    name: listing.title || '',
    description,
    url,
    image: images.slice(0, 5).length ? images.slice(0, 5) : undefined,
    address: listing.location
      ? { '@type': 'PostalAddress', streetAddress: listing.location, addressCountry: 'VN' }
      : undefined,
    ...(listing.price
      ? { offers: { '@type': 'Offer', price: String(listing.price), priceCurrency: listing.currency || 'VND' } }
      : {}),
    ...(listing.area
      ? { floorSize: { '@type': 'QuantitativeValue', value: listing.area, unitCode: 'MTK' } }
      : {}),
    ...(listing.bedrooms != null ? { numberOfRooms: listing.bedrooms } : {}),
  };

  return { title, description, image, url, type: 'website', structuredData };
}

export function buildArticleMeta(article: any): MetaData {
  const rawExcerpt =
    article.excerpt ||
    (article.content ? article.content.replace(/<[^>]+>/g, '').slice(0, 160) : '');
  const title = article.title ? `${article.title} - Tin Tức BĐS | SGS LAND` : DEFAULT_META.title;
  const description = rawExcerpt.slice(0, 300) || DEFAULT_META.description;
  const image = article.coverImage || article.cover_image || DEFAULT_IMAGE;
  const url = `${APP_URL}/news/${article.id}`;

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    inLanguage: 'vi',
    headline: article.title || '',
    description,
    image,
    url,
    datePublished: article.publishedAt || article.published_at || undefined,
    dateModified: article.updatedAt || article.updated_at || undefined,
    author: { '@type': 'Person', name: article.author || 'SGS LAND' },
    publisher: {
      '@type': 'Organization',
      name: 'SGS LAND',
      logo: { '@type': 'ImageObject', url: `${APP_URL}/apple-touch-icon.png` },
    },
  };

  return { title, description, image, url, type: 'article', structuredData };
}

export function buildStaticPageMeta(
  overrideTitle: string | null | undefined,
  overrideDesc: string | null | undefined,
  ogImage: string | null | undefined,
  pagePath: string
): MetaData {
  return {
    title: overrideTitle || DEFAULT_META.title,
    description: overrideDesc || DEFAULT_META.description,
    image: ogImage || DEFAULT_IMAGE,
    url: `${APP_URL}${pagePath}`,
    type: 'website',
  };
}

export function injectMeta(baseHtml: string, meta: MetaData): string {
  const m = { ...DEFAULT_META, ...meta };
  const t = esc(m.title!);
  const d = esc(m.description!);
  const img = m.image!;
  const u = m.url!;
  const type = m.type || 'website';

  let html = baseHtml;

  html = html.replace(/<title>[^<]*<\/title>/, `<title>${t}</title>`);
  html = html.replace(/(<meta\s+name="description"\s+content=")[^"]*(")/i, `$1${d}$2`);

  html = html.replace(/(<meta\s+property="og:title"\s+content=")[^"]*(")/i, `$1${t}$2`);
  html = html.replace(/(<meta\s+property="og:description"\s+content=")[^"]*(")/i, `$1${d}$2`);
  html = html.replace(/(<meta\s+property="og:type"\s+content=")[^"]*(")/i, `$1${type}$2`);
  html = html.replace(
    /(<meta\s+(?:id="og-url"\s+)?property="og:url"\s+content=")[^"]*(")/i,
    `$1${u}$2`
  );
  html = html.replace(/(<meta\s+property="og:image"\s+content=")[^"]*(")/i, `$1${img}$2`);
  html = html.replace(/(<meta\s+property="og:image:secure_url"\s+content=")[^"]*(")/i, `$1${img}$2`);
  html = html.replace(/(<meta\s+property="og:image:alt"\s+content=")[^"]*(")/i, `$1${t}$2`);

  html = html.replace(/(<meta\s+name="twitter:title"\s+content=")[^"]*(")/i, `$1${t}$2`);
  html = html.replace(/(<meta\s+name="twitter:description"\s+content=")[^"]*(")/i, `$1${d}$2`);
  html = html.replace(/(<meta\s+name="twitter:image"\s+content=")[^"]*(")/i, `$1${img}$2`);

  html = html.replace(
    /(<link\s+(?:id="canonical-url"\s+)?rel="canonical"\s+href=")[^"]*(")/i,
    `$1${u}$2`
  );

  if (m.noIndex) {
    html = html.replace(
      /(<meta\s+name="robots"\s+content=")[^"]*(")/i,
      `$1noindex, nofollow$2`
    );
  }

  if (m.structuredData) {
    const jsonLd = `  <script type="application/ld+json">${JSON.stringify(m.structuredData)}</script>`;
    html = html.replace('</head>', `${jsonLd}\n</head>`);
  }

  return html;
}

let _cachedHtml: string | null = null;

export function getBaseHtml(): string {
  if (!_cachedHtml) {
    const distPath = path.join(process.cwd(), 'dist', 'index.html');
    _cachedHtml = readFileSync(distPath, 'utf-8');
  }
  return _cachedHtml;
}
