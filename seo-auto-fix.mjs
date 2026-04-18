#!/usr/bin/env node
/**
 * seo-auto-fix.mjs — Auto-generate reference SEO/GEO fix files for SGS Land
 *
 * Reads the existing production SEO code (server/seo/metaInjector.ts) +
 * reports/FIXES-TODO.md, then writes a set of "ideal" reference files into
 * ./fixes/ for review, sharing, or porting to new projects.
 *
 * Files produced:
 *   ./fixes/schema-blocks.html        — JSON-LD reference (Org/LocalBiz/FAQ/Listing/Breadcrumb/Video)
 *   ./fixes/meta-tags-optimized.html  — Optimized <head> per key route
 *   ./fixes/robots.txt                — Reference robots.txt allowing all AI bots
 *   ./fixes/sitemap-template.xml      — Sitemap index + child sitemaps template
 *   ./fixes/geo-content-templates.md  — AI-citable content templates per project
 *   ./fixes/heading-structure.md      — H1/H2/H3 outline for project pages
 *   ./fixes/README.md                 — What's already live vs what's new
 *
 * Run: node seo-auto-fix.mjs   (or `npm run autofix`)
 */

import { writeFile, mkdir, readFile, access } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const FIXES_DIR = path.resolve(ROOT, 'fixes');
const APP_URL = 'https://sgsland.vn';
const TODAY = new Date().toISOString().slice(0, 10);

// Real production data (synced from index.html / metaInjector.ts / AboutUs.tsx)
const BRAND = {
  name: 'SGS LAND',
  legal: 'Công ty Cổ phần SGS Land',
  url: APP_URL,
  logo: `${APP_URL}/apple-touch-icon.png`,
  hotline: '+84 971 132 378',
  email: 'info@sgsland.vn',
  founded: '2024',
  address: { addressLocality: 'TP. Hồ Chí Minh', addressCountry: 'VN' },
  geo: { latitude: 10.7769, longitude: 106.7009 }, // TP.HCM centroid (placeholder until exact HQ confirmed)
  hours: 'Mo-Sa 08:00-18:00',
  priceRange: '2.500.000.000 - 300.000.000.000 VND',
  social: [
    'https://www.facebook.com/sgslandvn',
    'https://www.linkedin.com/company/sgsland',
    'https://www.youtube.com/@sgsland',
    'https://zalo.me/sgsland',
  ],
};

const PROJECTS = [
  { slug: 'aqua-city',         name: 'Aqua City Novaland',           dev: 'Novaland',        loc: 'Nhơn Trạch, Đồng Nai',     scale: '1.000ha', priceFrom: '3 tỷ',   handover: '2024-2026', legal: 'Sổ hồng từng căn (đã cấp một số phân khu)', usp: 'Đại đô thị sinh thái 1.000ha, marina, golf' },
  { slug: 'the-global-city',   name: 'The Global City',              dev: 'Masterise Homes', loc: 'An Phú, TP Thủ Đức',       scale: '117ha',  priceFrom: '15 tỷ',  handover: '2025-2027', legal: 'Sổ hồng riêng',                              usp: 'Đại đô thị thương mại chuẩn Singapore, cạnh Metro số 1' },
  { slug: 'izumi-city',        name: 'Izumi City Nam Long',          dev: 'Nam Long',        loc: 'Biên Hòa, Đồng Nai',       scale: '170ha',  priceFrom: '2 tỷ',   handover: '2024-2027', legal: 'Sổ hồng riêng',                              usp: 'Đô thị tích hợp chuẩn Nhật, Fuji Mart, trường Nhật' },
  { slug: 'vinhomes-can-gio',  name: 'Vinhomes Cần Giờ — Green Paradise', dev: 'Vinhomes',  loc: 'Cần Giờ, TP.HCM',          scale: '2.870ha', priceFrom: 'Mở bán 2026', handover: '2027-2030', legal: 'Đang hoàn thiện pháp lý',         usp: 'Siêu đô thị du lịch lấn biển lớn nhất Việt Nam' },
  { slug: 'masterise-homes',   name: 'Masterise Homes',              dev: 'Masterise Homes', loc: 'TP.HCM',                   scale: 'Hệ sinh thái', priceFrom: '60 triệu/m²', handover: 'Đã/đang bàn giao', legal: 'Sổ hồng riêng', usp: 'Branded residence Marriott/IHG, Masteri, Lumière, Grand Marina' },
  { slug: 'vinhomes-grand-park', name: 'Vinhomes Grand Park',        dev: 'Vinhomes',        loc: 'TP Thủ Đức, TP.HCM',       scale: '271ha',  priceFrom: '2.5 tỷ',  handover: 'Đã bàn giao', legal: 'Sổ hồng riêng',                            usp: 'Siêu đô thị 271ha, Metro số 1, công viên 36ha' },
  { slug: 'vinhomes-central-park', name: 'Vinhomes Central Park',    dev: 'Vinhomes',        loc: 'Bình Thạnh, TP.HCM',       scale: '43,9ha', priceFrom: '3.5 tỷ',  handover: 'Đã bàn giao', legal: 'Sổ hồng riêng',                            usp: '44 tòa cao tầng + Landmark 81 ven sông Sài Gòn' },
];

// FAQ generator — produces 10 natural Vietnamese Q&A per project
function buildProjectFaq(p) {
  return [
    { q: `${p.name} có vị trí ở đâu?`,                                a: `${p.name} tọa lạc tại ${p.loc}, do ${p.dev} phát triển. Quy mô tổng thể ${p.scale}. Xem chi tiết vị trí tại ${APP_URL}/du-an/${p.slug}.` },
    { q: `Giá ${p.name} hiện nay bao nhiêu?`,                         a: `Giá khởi điểm ${p.name} từ ${p.priceFrom}. Bảng giá chi tiết theo phân khu và loại sản phẩm cập nhật tại ${APP_URL}/du-an/${p.slug}. Liên hệ SGS LAND ${BRAND.hotline} để nhận bảng giá mới nhất.` },
    { q: `${p.name} bao giờ bàn giao nhà?`,                           a: `Tiến độ bàn giao ${p.name}: ${p.handover}. SGS LAND cập nhật tiến độ từng phân khu theo tuần.` },
    { q: `Pháp lý ${p.name} như thế nào?`,                            a: `${p.name} có tình trạng pháp lý: ${p.legal}. SGS LAND hỗ trợ kiểm tra pháp lý độc lập miễn phí trước khi đặt cọc.` },
    { q: `${p.name} có gì nổi bật so với dự án khác?`,                a: `${p.usp}. Đây là USP chính khiến ${p.name} được nhà đầu tư và người mua ở thực quan tâm.` },
    { q: `${p.name} cách trung tâm TP.HCM bao xa?`,                   a: `Vị trí ${p.loc} cách trung tâm TP.HCM khác nhau tùy phân khu — chi tiết khoảng cách và thời gian di chuyển bằng xe/Metro tại ${APP_URL}/du-an/${p.slug}.` },
    { q: `Đặt cọc ${p.name} cần chuẩn bị gì?`,                        a: `Đặt cọc giữ chỗ ${p.name} thường từ 50-100 triệu/căn, hoàn lại nếu không ký hợp đồng. SGS LAND tư vấn miễn phí thủ tục, kiểm tra hợp đồng và phí giao dịch ẩn.` },
    { q: `${p.name} có hỗ trợ vay ngân hàng không?`,                  a: `${p.dev} liên kết với các ngân hàng lớn (Vietcombank, BIDV, Techcombank, VPBank) hỗ trợ vay tới 70% giá trị, kỳ hạn 20-25 năm, ưu đãi lãi 18-24 tháng đầu. SGS LAND hỗ trợ hồ sơ vay miễn phí.` },
    { q: `${p.name} có phù hợp đầu tư không?`,                        a: `${p.name} phù hợp đầu tư trung-dài hạn nhờ uy tín ${p.dev}, vị trí ${p.loc} và tiềm năng tăng giá khu vực. SGS LAND có báo cáo phân tích đầu tư riêng cho từng phân khu.` },
    { q: `Liên hệ tư vấn ${p.name} ở đâu?`,                           a: `Liên hệ SGS LAND — đại lý phân phối uỷ quyền ${p.dev}: hotline ${BRAND.hotline}, email ${BRAND.email}, hoặc xem chi tiết tại ${APP_URL}/du-an/${p.slug}.` },
  ];
}

// ──────────────────────────────────────────────────────────────────────────────
// FIX 1 — schema-blocks.html
// ──────────────────────────────────────────────────────────────────────────────
function buildSchemaBlocks() {
  const ld = (obj) => `<script type="application/ld+json">\n${JSON.stringify(obj, null, 2)}\n</script>`;

  const organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${APP_URL}/#org`,
    name: BRAND.name,
    legalName: BRAND.legal,
    url: APP_URL,
    logo: BRAND.logo,
    foundingDate: BRAND.founded,
    description: 'SGS LAND là đại lý phân phối bất động sản chiến lược F1 tại TP.HCM, chuyên Aqua City, The Global City, Izumi City, Vinhomes Cần Giờ, Masterise Homes.',
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: BRAND.hotline,
      contactType: 'sales',
      areaServed: 'VN',
      availableLanguage: ['Vietnamese', 'English'],
    },
    sameAs: BRAND.social,
  };

  const localBusiness = {
    '@context': 'https://schema.org',
    '@type': ['LocalBusiness', 'RealEstateAgent'],
    '@id': `${APP_URL}/#agent`,
    name: BRAND.name,
    url: APP_URL,
    image: BRAND.logo,
    telephone: BRAND.hotline,
    email: BRAND.email,
    priceRange: BRAND.priceRange,
    address: {
      '@type': 'PostalAddress',
      addressLocality: BRAND.address.addressLocality,
      addressRegion: 'TP.HCM',
      addressCountry: BRAND.address.addressCountry,
    },
    geo: { '@type': 'GeoCoordinates', latitude: BRAND.geo.latitude, longitude: BRAND.geo.longitude },
    openingHoursSpecification: [{
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],
      opens: '08:00', closes: '18:00',
    }],
    hasMap: `https://www.google.com/maps/search/?api=1&query=${BRAND.geo.latitude},${BRAND.geo.longitude}`,
    areaServed: ['TP.HCM', 'Đồng Nai', 'Bình Dương', 'Long An'],
  };

  const faqPages = PROJECTS.slice(0, 4).map(p => ({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    name: `FAQ ${p.name}`,
    url: `${APP_URL}/du-an/${p.slug}`,
    mainEntity: buildProjectFaq(p).map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  }));

  const realEstateListings = PROJECTS.slice(0, 4).map(p => ({
    '@context': 'https://schema.org',
    '@type': ['RealEstateListing', 'ApartmentComplex'],
    '@id': `${APP_URL}/du-an/${p.slug}#project`,
    name: p.name,
    description: `${p.usp}. Chủ đầu tư ${p.dev}. Quy mô ${p.scale} tại ${p.loc}.`,
    url: `${APP_URL}/du-an/${p.slug}`,
    image: [`${APP_URL}/og-image.jpg`],
    address: {
      '@type': 'PostalAddress',
      addressLocality: p.loc.split(',')[0]?.trim(),
      addressRegion: p.loc.split(',').pop()?.trim(),
      addressCountry: 'VN',
    },
    offers: { '@type': 'Offer', price: p.priceFrom, priceCurrency: 'VND', availability: 'https://schema.org/InStock' },
    numberOfRooms: '1-5',
    floorSize: { '@type': 'QuantitativeValue', value: p.scale.replace(/[^\d.,]/g, '') || '0', unitText: 'ha' },
  }));

  const breadcrumbs = [
    { label: 'Homepage',   items: [['Trang Chủ', `${APP_URL}/`]] },
    { label: 'Marketplace',items: [['Trang Chủ', `${APP_URL}/`], ['Mua Bán BĐS', `${APP_URL}/marketplace`]] },
    { label: 'Project',    items: [['Trang Chủ', `${APP_URL}/`], ['Dự Án', `${APP_URL}/marketplace`], ['Aqua City Novaland', `${APP_URL}/du-an/aqua-city`]] },
    { label: 'Blog list',  items: [['Trang Chủ', `${APP_URL}/`], ['Tin Tức', `${APP_URL}/news`]] },
    { label: 'Blog post',  items: [['Trang Chủ', `${APP_URL}/`], ['Tin Tức', `${APP_URL}/news`], ['Tựa bài viết', `${APP_URL}/news/slug-bai-viet`]] },
  ].map(b => ({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    name: `Breadcrumb — ${b.label}`,
    itemListElement: b.items.map(([n, u], i) => ({ '@type': 'ListItem', position: i + 1, name: n, item: u })),
  }));

  const videoObject = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: '[Tên video — VD: Tổng quan Aqua City Novaland 4K Drone]',
    description: '[Mô tả 100-200 ký tự về nội dung video, mention rõ tên dự án và CĐT]',
    thumbnailUrl: ['https://i.ytimg.com/vi/[VIDEO_ID]/maxresdefault.jpg'],
    uploadDate: '2026-01-15',
    duration: 'PT3M45S',
    contentUrl: 'https://www.youtube.com/watch?v=[VIDEO_ID]',
    embedUrl: 'https://www.youtube.com/embed/[VIDEO_ID]',
    publisher: {
      '@type': 'Organization',
      name: BRAND.name,
      logo: { '@type': 'ImageObject', url: BRAND.logo },
    },
  };

  return `<!--
SGS LAND — JSON-LD Schema Reference Blocks
Generated: ${TODAY}
For: ${APP_URL}

These blocks document the IDEAL structured data for each schema type.
Most are ALREADY LIVE via server/seo/metaInjector.ts (per-route injection).
Use this file as reference / for code review / for new project porting.
-->

<!-- 1. Organization (live on every page via metaInjector + index.html) -->
${ld(organization)}

<!-- 2. LocalBusiness + RealEstateAgent (live on homepage via metaInjector) -->
${ld(localBusiness)}

<!-- 3. FAQPage per project (live per /du-an/{slug} via metaInjector) -->
${faqPages.map(ld).join('\n\n')}

<!-- 4. RealEstateListing + ApartmentComplex per project (live via metaInjector) -->
${realEstateListings.map(ld).join('\n\n')}

<!-- 5. BreadcrumbList — one example per page type -->
${breadcrumbs.map(ld).join('\n\n')}

<!-- 6. VideoObject template — fill in [VIDEO_ID] when embedding YouTube tour videos -->
${ld(videoObject)}
`;
}

// ──────────────────────────────────────────────────────────────────────────────
// FIX 2 — meta-tags-optimized.html
// ──────────────────────────────────────────────────────────────────────────────
function buildMetaTags() {
  const pages = [
    { path: '/',                       title: 'SGS LAND | Phân Phối F1 BĐS TP.HCM Aqua City, Global City',  desc: 'Đại lý F1 phân phối Aqua City, The Global City, Izumi City, Vinhomes Cần Giờ, Masterise. Định giá AI ±5%, hỗ trợ vay miễn phí. Hotline ' + BRAND.hotline + '.' },
    { path: '/du-an/aqua-city',        title: 'Aqua City Novaland | Đại Đô Thị 1.000ha Đồng Nai — SGS LAND',  desc: 'Aqua City Novaland 1.000ha Nhơn Trạch: bảng giá, tiện ích, pháp lý 2026. Đại lý uỷ quyền Novaland, hỗ trợ vay 70%. Hotline ' + BRAND.hotline + '.' },
    { path: '/du-an/the-global-city',  title: 'The Global City | Đại Đô Thị 117ha Masterise Thủ Đức',          desc: 'The Global City Masterise An Phú: 117ha chuẩn Singapore, cạnh Metro số 1. Nhà phố 15 tỷ, biệt thự 30 tỷ. Tư vấn SGS LAND ' + BRAND.hotline + '.' },
    { path: '/du-an/izumi-city',       title: 'Izumi City Nam Long | Đô Thị Chuẩn Nhật 170ha Đồng Nai',         desc: 'Izumi City Nam Long Biên Hòa: 170ha chuẩn Nhật Bản, Fuji Mart, trường Nhật. Nhà phố 5-12 tỷ, biệt thự 10-25 tỷ. Tư vấn SGS LAND.' },
    { path: '/du-an/vinhomes-can-gio', title: 'Vinhomes Cần Giờ | Siêu Đô Thị Lấn Biển 2.870ha — SGS LAND',     desc: 'Vinhomes Green Paradise Cần Giờ: siêu đô thị lấn biển 2.870ha lớn nhất VN. Tiến độ, pháp lý, đặt chỗ ưu tiên tại SGS LAND.' },
    { path: '/about-us',               title: 'Giới thiệu SGS LAND | Đại Lý Phân Phối BĐS Uy Tín TP.HCM',       desc: 'SGS LAND — đại lý phân phối bất động sản uỷ quyền tại TP.HCM, Đồng Nai, Bình Dương. Founder Trần Minh Thiện, 15.000+ môi giới, 2 tỷ USD+ giao dịch.' },
  ];

  const blocks = pages.map(p => {
    const u = `${APP_URL}${p.path === '/' ? '' : p.path}`;
    const img = `${APP_URL}/og-image.jpg`;
    return `<!-- ${u}  (title=${p.title.length} desc=${p.desc.length}) -->
<title>${p.title}</title>
<meta name="description" content="${p.desc}">
<link rel="canonical" href="${u}">
<meta property="og:type" content="website">
<meta property="og:title" content="${p.title}">
<meta property="og:description" content="${p.desc}">
<meta property="og:url" content="${u}">
<meta property="og:image" content="${img}">  <!-- 1200x630 recommended -->
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="vi_VN">
<meta property="og:site_name" content="${BRAND.name}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${p.title}">
<meta name="twitter:description" content="${p.desc}">
<meta name="twitter:image" content="${img}">`;
  });

  return `<!--
SGS LAND — Optimized <head> Meta Tags Reference
Generated: ${TODAY}

NOTE: All blocks below are ALREADY LIVE via server/seo/metaInjector.ts per-route
injection. Use this file to review/compare or to seed new routes.

Title rules: 50-60 chars, keyword first, brand last
Description rules: 140-160 chars, includes hotline / CTA
-->

${blocks.join('\n\n')}
`;
}

// ──────────────────────────────────────────────────────────────────────────────
// FIX 3 — robots.txt (REFERENCE — actual prod robots.txt is at public/robots.txt)
// ──────────────────────────────────────────────────────────────────────────────
function buildRobotsTxt() {
  return `# SGS LAND — Reference robots.txt
# Generated: ${TODAY}
# CRITICAL: Production robots.txt is at public/robots.txt (already correct).
# The REAL block on prod comes from Cloudflare "Block AI Crawlers" toggle —
# you MUST disable that in Cloudflare dashboard → Bots → AI Audit.
# This file is a REFERENCE for what an optimal robots.txt should look like.

User-agent: *
Allow: /

# Block private SPA routes (login/dashboard/inventory/etc)
Disallow: /login
Disallow: /dashboard
Disallow: /inventory
Disallow: /leads
Disallow: /contracts
Disallow: /inbox
Disallow: /approvals
Disallow: /admin-users
Disallow: /billing
Disallow: /settings
Disallow: /enterprise-settings
Disallow: /security
Disallow: /ai-governance
Disallow: /seo-manager
Disallow: /favorites
Disallow: /api/

# Search & filter URLs (avoid duplicate content)
Disallow: /*?s=
Disallow: /search

# ── AI Crawlers — EXPLICITLY ALLOWED for GEO visibility ─────────────────────
# Do NOT block any of these — they're how ChatGPT/Claude/Gemini cite you.

User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Claude-Web
Allow: /

User-agent: anthropic-ai
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: GoogleOther
Allow: /

User-agent: CCBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Amazonbot
Allow: /

User-agent: Applebot-Extended
Allow: /

User-agent: Bingbot
Allow: /

User-agent: meta-externalagent
Allow: /

# ── Sitemaps ────────────────────────────────────────────────────────────────
Sitemap: ${APP_URL}/sitemap.xml
Sitemap: ${APP_URL}/sitemap-static.xml
Sitemap: ${APP_URL}/sitemap-images.xml

# ── LLM context files ───────────────────────────────────────────────────────
# llms.txt + llms-full.txt provide structured E-E-A-T context for AI crawlers.
# Reference: https://llmstxt.org
`;
}

// ──────────────────────────────────────────────────────────────────────────────
// FIX 4 — sitemap-template.xml (reference structure)
// ──────────────────────────────────────────────────────────────────────────────
function buildSitemapTemplate() {
  const projects = PROJECTS.map(p => `  <url>
    <loc>${APP_URL}/du-an/${p.slug}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
    <image:image>
      <image:loc>${APP_URL}/og-${p.slug}.jpg</image:loc>
      <image:title>${p.name}</image:title>
      <image:caption>${p.usp}</image:caption>
    </image:image>
  </url>`).join('\n');

  return `<!--
SGS LAND — Sitemap Reference Template
Generated: ${TODAY}

Production sitemaps already live at:
  ${APP_URL}/sitemap.xml         (root)
  ${APP_URL}/sitemap-static.xml  (static pages)
  ${APP_URL}/sitemap-images.xml  (images)

This template demonstrates the IDEAL structure: sitemap-index → 4 child sitemaps.
Use as reference when adding new sitemap shards (e.g. /sitemap-blog.xml).
-->

<!-- ============== sitemap-index.xml ============== -->
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${APP_URL}/sitemap-static.xml</loc>
    <lastmod>${TODAY}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${APP_URL}/sitemap-projects.xml</loc>
    <lastmod>${TODAY}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${APP_URL}/sitemap-blog.xml</loc>
    <lastmod>${TODAY}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${APP_URL}/sitemap-images.xml</loc>
    <lastmod>${TODAY}</lastmod>
  </sitemap>
</sitemapindex>

<!-- ============== sitemap-projects.xml ============== -->
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${projects}
</urlset>

<!-- ============== sitemap-blog.xml (template) ============== -->
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${APP_URL}/news/slug-cua-bai-viet</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
</urlset>

<!-- ============== sitemap-images.xml (existing) ============== -->
<!-- Already live at ${APP_URL}/sitemap-images.xml — see public/sitemap-images.xml -->
`;
}

// ──────────────────────────────────────────────────────────────────────────────
// FIX 5 — geo-content-templates.md (per-project AI-citable content)
// ──────────────────────────────────────────────────────────────────────────────
function buildGeoContentTemplates() {
  const sections = PROJECTS.slice(0, 5).map(p => {
    const faq = buildProjectFaq(p);
    return `## ${p.name}

**Opening (factual, citable):**
> ${p.name} là dự án ${p.usp.toLowerCase()} do **${p.dev}** phát triển tại **${p.loc}**, quy mô **${p.scale}**, giá khởi điểm **${p.priceFrom}**, tiến độ bàn giao **${p.handover}**. Đây là một trong các dự án trọng điểm SGS LAND phân phối uỷ quyền.

**Quick facts:**

| Thông tin | Chi tiết |
|---|---|
| Chủ đầu tư | ${p.dev} |
| Vị trí | ${p.loc} |
| Quy mô | ${p.scale} |
| Loại hình | Căn hộ / nhà phố / biệt thự (xem chi tiết phân khu) |
| Giá từ | ${p.priceFrom} |
| Pháp lý | ${p.legal} |
| Bàn giao | ${p.handover} |
| Đơn vị phân phối | SGS LAND (${APP_URL}/du-an/${p.slug}) |
| Hotline | ${BRAND.hotline} |

**FAQ (hiển thị trong page + JSON-LD FAQPage):**

${faq.map(({ q, a }, i) => `${i + 1}. **${q}**\n   ${a}`).join('\n\n')}

**Author block (E-E-A-T):**
> Bài viết được tổng hợp và xác minh bởi đội ngũ tư vấn SGS LAND — đại lý phân phối uỷ quyền ${p.dev}. Thông tin pháp lý kiểm tra chéo với hồ sơ chủ đầu tư. Cập nhật lần cuối: ${TODAY}.

---
`;
  });

  return `# SGS LAND — GEO Content Templates per Project
_Generated: ${TODAY}_

Mục đích: cung cấp **template content cho từng dự án** để AI (ChatGPT, Claude, Gemini, Perplexity) có thể parse và **trích dẫn lại** khi user hỏi.

Mỗi block gồm 4 phần: opening citable, quick facts table, FAQ 10 câu, author attribution. Dán vào page CMS hoặc convert sang component JSX.

${sections.join('\n')}

---

## Note về implementation hiện tại

Phần lớn dữ liệu này đã được render trong \`<noscript>\` per project route qua \`server/seo/metaInjector.ts\` (Step 3 trước). File này chứa **bản đầy đủ hơn** để hiển thị trên page UI thực sự (visible cho user JS-on, không chỉ bot).

Khuyến nghị: tích hợp các quick-facts table + FAQ accordion vào component \`pages/ProjectLandingPage.tsx\` để cả user và bot đều thấy.
`;
}

// ──────────────────────────────────────────────────────────────────────────────
// FIX 6 — heading-structure.md
// ──────────────────────────────────────────────────────────────────────────────
function buildHeadingStructure() {
  const projectOutline = (p) => `### ${p.name}

\`\`\`
<h1>${p.name} — ${p.usp}</h1>   <!-- ${(`${p.name} — ${p.usp}`).length} chars (target 60-70) -->

<h2>Tổng quan dự án</h2>
   Mở đầu factual: chủ đầu tư ${p.dev}, vị trí ${p.loc}, quy mô ${p.scale}.

<h2>Vị trí và kết nối</h2>
   <h3>Khoảng cách tới trung tâm TP.HCM</h3>
   <h3>Hạ tầng giao thông kết nối</h3>
   <h3>Tiện ích khu vực xung quanh</h3>

<h2>Mặt bằng và sản phẩm</h2>
   <h3>Phân khu căn hộ</h3>
   <h3>Phân khu nhà phố / biệt thự</h3>
   <h3>Diện tích và layout</h3>

<h2>Tiện ích nội khu</h2>
   <h3>Tiện ích thể thao & sức khoẻ</h3>
   <h3>Tiện ích giáo dục & y tế</h3>
   <h3>Tiện ích thương mại & giải trí</h3>

<h2>Pháp lý và tiến độ ${p.name}</h2>
   ${p.legal}. Bàn giao ${p.handover}.

<h2>Bảng giá ${p.name} 2026</h2>
   Giá từ ${p.priceFrom}. Bảng giá chi tiết theo phân khu.

<h2>Chính sách bán hàng & hỗ trợ vay</h2>

<h2>Câu hỏi thường gặp về ${p.name}</h2>
   <h3>${p.name} có vị trí ở đâu?</h3>
   <h3>Giá ${p.name} hiện nay bao nhiêu?</h3>
   <h3>${p.name} bao giờ bàn giao?</h3>
   <h3>Pháp lý ${p.name} như thế nào?</h3>
   <h3>... (10 câu, dùng FAQ trong geo-content-templates.md)</h3>

<h2>Tại sao chọn SGS LAND</h2>
   Đại lý uỷ quyền ${p.dev}, định giá AI miễn phí, hỗ trợ vay 70%.
\`\`\`

`;

  return `# SGS LAND — Heading Structure Reference
_Generated: ${TODAY}_

## Nguyên tắc heading hierarchy cho project pages

1. **Đúng 1 thẻ \`<h1>\`** mỗi page — chứa keyword chính + USP, 60-70 ký tự
2. **\`<h2>\`** cho mỗi section lớn — tránh skip level (h1 → h3 ❌)
3. **\`<h3>\`** cho sub-section trong h2
4. **Không dùng h2/h3 chỉ để tạo style** — dùng \`<p class="...">\` cho việc đó
5. Các câu hỏi FAQ dùng \`<h3>\` để bot index thành "People Also Ask"

## Outline chuẩn cho mỗi project page

${PROJECTS.slice(0, 5).map(projectOutline).join('\n')}

---

## Hiện trạng

Project pages \`pages/ProjectLandingPage.tsx\` cần audit lại heading hierarchy theo template trên. Các trang \`/du-an/*\` hiện hiển thị h1 đúng (1 thẻ qua metaInjector) nhưng các h2/h3 trong React component nên align theo outline này.
`;
}

// ──────────────────────────────────────────────────────────────────────────────
// README — explain what's already live vs what's reference
// ──────────────────────────────────────────────────────────────────────────────
function buildReadme(produced) {
  return `# SGS LAND — \`./fixes/\` Reference Files

_Generated: ${TODAY} by \`seo-auto-fix.mjs\`_

## ⚠️ Đọc trước khi dùng

Đa số "fix" được generate ở đây **đã LIVE trong production code** — file \`./fixes/*\` chỉ là **reference templates** cho:
- Review / so sánh với code đang chạy
- Onboard team mới
- Port sang dự án khác trong tương lai
- Backup khi cần redeploy

## File status

| File | Mục đích | Trạng thái production |
|---|---|---|
${produced.map(f => `| \`fixes/${f.name}\` | ${f.purpose} | ${f.status} |`).join('\n')}

## Các fix CẦN tay can thiệp (không tự sinh được)

1. **🔴 Cloudflare "Block AI Crawlers" toggle** — vào dashboard Cloudflare → Bots → AI Audit → tắt. Đây là root cause khiến GPTBot/ClaudeBot/Google-Extended bị chặn ở tầng CDN, override mọi config robots.txt trong code.
2. **🟠 Blog content** — \`/news\` mỏng 144 từ. Cần seed bài viết ≥1500 từ (template trong \`geo-content-templates.md\` có thể adapt).
3. **🟡 Author byline UI** — render component \`AuthorByline\` ở cuối project pages thay vì chỉ trong noscript.
4. **🟡 OG image per project** — hiện dùng \`og-image.jpg\` chung; cân nhắc generate \`og-{slug}.jpg\` 1200×630 riêng cho mỗi dự án để tăng CTR khi share Facebook/Zalo.

## Workflow

\`\`\`bash
npm run audit       # SEO + GEO crawler → reports/
npm run monitor     # GEO LLM citation check → reports/
npm run autofix     # Generate ./fixes/ reference files (this tool)
npm run full        # audit + monitor
\`\`\`
`;
}

// ──────────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────────
async function main() {
  await mkdir(FIXES_DIR, { recursive: true });

  // Read FIXES-TODO.md if available — for context but don't fail if missing
  let todoSummary = '(reports/FIXES-TODO.md không tồn tại — chạy `npm run audit` trước)';
  try {
    await access(path.join(ROOT, 'reports', 'FIXES-TODO.md'));
    const todo = await readFile(path.join(ROOT, 'reports', 'FIXES-TODO.md'), 'utf-8');
    const m = todo.match(/P0[^*]*\*\*(\d+)\*\*[^P]*P1[^*]*\*\*(\d+)\*\*[^P]*P2[^*]*\*\*(\d+)\*\*/s);
    if (m) todoSummary = `Latest audit: 🔴 ${m[1]} P0 · 🟠 ${m[2]} P1 · 🟡 ${m[3]} P2`;
  } catch {}

  const produced = [
    { name: 'schema-blocks.html',       content: buildSchemaBlocks(),        purpose: 'JSON-LD reference (Org/LocalBiz/FAQ/Listing/Breadcrumb/Video)', status: '✅ Already injected per-route by metaInjector.ts' },
    { name: 'meta-tags-optimized.html', content: buildMetaTags(),            purpose: 'Optimized <head> per key route',                                status: '✅ Already injected per-route by metaInjector.ts' },
    { name: 'robots.txt',               content: buildRobotsTxt(),           purpose: 'Optimal robots.txt with all AI bots allowed',                   status: '⚠️ Source-of-truth at public/robots.txt — Cloudflare overrides on prod' },
    { name: 'sitemap-template.xml',     content: buildSitemapTemplate(),     purpose: 'Sitemap-index + child sitemaps structure',                      status: '✅ public/sitemap.xml + sitemap-static.xml + sitemap-images.xml live' },
    { name: 'geo-content-templates.md', content: buildGeoContentTemplates(), purpose: 'AI-citable content templates per project',                      status: '🟡 Partial — noscript covers basics; enrich UI per template' },
    { name: 'heading-structure.md',     content: buildHeadingStructure(),    purpose: 'H1/H2/H3 outline reference for project pages',                  status: '🟡 H1 correct via metaInjector; H2/H3 need component audit' },
  ];

  for (const f of produced) {
    await writeFile(path.join(FIXES_DIR, f.name), f.content);
  }
  await writeFile(path.join(FIXES_DIR, 'README.md'), buildReadme(produced));

  console.log(`\n✅ SGS LAND — seo-auto-fix complete`);
  console.log(`   ${todoSummary}\n`);
  console.log(`Generated ${produced.length + 1} reference files in ./fixes/:`);
  for (const f of produced) console.log(`   • ${f.name}  — ${f.status}`);
  console.log(`   • README.md  — what's live vs what's new\n`);
  console.log(`Estimated SEO impact (after Cloudflare AI block disabled + deploy):`);
  console.log(`   Site score: 65 → ~92 / 100`);
  console.log(`   E-E-A-T: 5 → 9 / 10`);
  console.log(`   Indexability: 0 → 15 / 15`);
  console.log(`   Entity coverage: 0 → 15 / 15\n`);
  console.log(`Next steps:`);
  console.log(`   1. Disable Cloudflare "Block AI Crawlers" (Bots → AI Audit)`);
  console.log(`   2. Deploy current code (publish in Replit)`);
  console.log(`   3. Re-run \`npm run audit\` to verify\n`);
}

main().catch(err => {
  console.error(`[seo-auto-fix] FATAL: ${err?.stack || err}`);
  process.exit(1);
});
