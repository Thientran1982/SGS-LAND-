#!/usr/bin/env node
/**
 * seo-geo-audit.mjs — SGS Land full SEO + GEO audit tool
 *
 * Crawls https://sgsland.vn (max 50 pages) and produces:
 *   - reports/sgsland-audit-<ts>.json   (raw)
 *   - reports/sgsland-audit-<ts>.md     (human-readable)
 *   - reports/FIXES-TODO.md             (prioritized P0/P1/P2 fix list)
 *
 * Lighthouse Core Web Vitals are optional — if `lighthouse` + `chrome-launcher`
 * are installed they run automatically; otherwise the section is gracefully
 * skipped with an INFO note.
 *
 * Run: node seo-geo-audit.mjs   (or `npm run audit`)
 */

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import * as cheerio from 'cheerio';

// ──────────────────────────────────────────────────────────────────────────────
// Config
// ──────────────────────────────────────────────────────────────────────────────
const TARGET_HOST = 'sgsland.vn';
const BASE_URL = 'https://sgsland.vn';
const REPORTS_DIR = path.resolve('./reports');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const MAX_PAGES = 50;
const REQUEST_DELAY_MS = 500;
const REQUEST_TIMEOUT_MS = 20000;
const USER_AGENT = 'SGSLandAuditBot/1.0 (SEO Audit; contact@sgsland.vn)';

const TARGET_URLS = [
  `${BASE_URL}/`,
  `${BASE_URL}/du-an/aqua-city`,
  `${BASE_URL}/du-an/the-global-city`,
  `${BASE_URL}/du-an/izumi-city`,
  `${BASE_URL}/du-an/vinhomes-can-gio`,
  `${BASE_URL}/du-an/masterise-homes`,
  `${BASE_URL}/about-us`,
  `${BASE_URL}/news`,
];
const SPECIAL_URLS = [
  `${BASE_URL}/sitemap.xml`,
  `${BASE_URL}/robots.txt`,
  `${BASE_URL}/llms.txt`,
  `${BASE_URL}/llms-full.txt`,
];

const TARGET_KEYWORDS = [
  'aqua city', 'global city', 'izumi', 'vinhomes can gio',
  'masterise', 'bat dong san', 'sgs land', 'sgsland',
];

const ENTITIES = [
  'Novaland', 'Masterise', 'Vinhomes', 'Vingroup', 'Aqua City',
  'Global City', 'Izumi', 'Khu Đông', 'TP.HCM', 'SGS Land',
];

const SKIP_PATH_RX = /\/(wp-admin|cart|checkout)|\.(pdf|jpg|jpeg|png|gif|webp|svg|css|js|ico|xml|woff2?|ttf)(\?|$)/i;
const PRIVATE_PREFIXES = [
  '/login', '/dashboard', '/inventory', '/leads', '/contracts',
  '/inbox', '/approvals', '/projects', '/admin-users', '/billing',
  '/profile', '/settings', '/enterprise-settings', '/security',
  '/ai-governance', '/seo-manager', '/data-platform', '/marketplace-apps',
  '/routing-rules', '/sequences', '/knowledge', '/scoring-rules',
  '/system', '/favorites', '/p/', '/api/',
];

// ──────────────────────────────────────────────────────────────────────────────
// Tiny ANSI color helper (avoids extra dep)
// ──────────────────────────────────────────────────────────────────────────────
const c = {
  red:    s => `\x1b[31m${s}\x1b[0m`,
  green:  s => `\x1b[32m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  orange: s => `\x1b[38;5;208m${s}\x1b[0m`,
  cyan:   s => `\x1b[36m${s}\x1b[0m`,
  bold:   s => `\x1b[1m${s}\x1b[0m`,
  dim:    s => `\x1b[2m${s}\x1b[0m`,
};

// ──────────────────────────────────────────────────────────────────────────────
// HTTP
// ──────────────────────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchUrl(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  const start = Date.now();
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'user-agent': USER_AGENT, 'accept-language': 'vi,en;q=0.8' },
    });
    const ttfb = Date.now() - start;
    const ct = res.headers.get('content-type') || '';
    const cl = parseInt(res.headers.get('content-length') || '0', 10);
    let body = '';
    if (ct.includes('html') || ct.includes('xml') || ct.includes('text') || ct.includes('json')) {
      body = await res.text();
    }
    return { url, status: res.status, ttfb, contentType: ct, contentLength: cl || body.length, finalUrl: res.url, body };
  } catch (err) {
    return { url, status: 0, ttfb: Date.now() - start, error: String(err?.message || err) };
  } finally {
    clearTimeout(t);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Per-page checks (returns { issues: [{level, code, message}], facts: {...} })
// ──────────────────────────────────────────────────────────────────────────────
function levelToBucket(level) {
  return { CRITICAL: '🔴', WARN: '🟠', INFO: '🟡', PASS: '🟢' }[level];
}

function analyzeHtml(pageRes) {
  const issues = [];
  const facts = {};
  const html = pageRes.body || '';
  // scriptingEnabled:false → cheerio parses <noscript> content as DOM (bot's view)
  const $ = cheerio.load(html || '<html></html>', { scriptingEnabled: false });

  // HTTP / TTFB
  if (pageRes.status >= 500) issues.push({ level: 'CRITICAL', code: 'http_5xx', message: `HTTP ${pageRes.status}` });
  else if (pageRes.status === 404) issues.push({ level: 'CRITICAL', code: 'http_404', message: 'Page not found (404)' });
  else if (pageRes.status >= 300 && pageRes.status < 400) issues.push({ level: 'INFO', code: 'http_3xx', message: `Redirect ${pageRes.status} → ${pageRes.finalUrl}` });
  if (pageRes.ttfb > 600) issues.push({ level: 'WARN', code: 'slow_ttfb', message: `TTFB ${pageRes.ttfb}ms (>600ms)` });
  facts.ttfb = pageRes.ttfb;
  facts.status = pageRes.status;

  if (!html) return { issues, facts };

  // Title
  const title = $('title').first().text().trim();
  facts.title = title;
  facts.titleLength = title.length;
  if (!title) issues.push({ level: 'CRITICAL', code: 'no_title', message: 'Missing <title>' });
  else if (title.length < 30) issues.push({ level: 'WARN', code: 'title_short', message: `Title quá ngắn (${title.length} ký tự, nên 50-60)` });
  else if (title.length > 70) issues.push({ level: 'WARN', code: 'title_long', message: `Title quá dài (${title.length} ký tự, nên 50-60)` });

  // Meta description
  const desc = ($('meta[name="description"]').attr('content') || '').trim();
  facts.metaDescription = desc;
  facts.metaDescriptionLength = desc.length;
  if (!desc) issues.push({ level: 'CRITICAL', code: 'no_meta_desc', message: 'Thiếu meta description' });
  else if (desc.length < 100) issues.push({ level: 'WARN', code: 'desc_short', message: `Meta description ngắn (${desc.length} ký tự, nên 140-160)` });
  else if (desc.length > 200) issues.push({ level: 'WARN', code: 'desc_long', message: `Meta description quá dài (${desc.length} ký tự, nên 140-160)` });

  // H1
  const h1s = $('h1').map((_, el) => $(el).text().trim()).get().filter(Boolean);
  facts.h1Count = h1s.length;
  facts.h1 = h1s;
  if (h1s.length === 0) issues.push({ level: 'CRITICAL', code: 'no_h1', message: 'Thiếu thẻ <h1>' });
  else if (h1s.length > 1) issues.push({ level: 'WARN', code: 'multiple_h1', message: `Có ${h1s.length} thẻ <h1> (nên chỉ 1)` });

  // Heading hierarchy (skip if h2 appears before h1, or h3 before h2)
  const headings = $('h1,h2,h3,h4,h5,h6').map((_, el) => Number(el.name[1])).get();
  let lastLevel = 0;
  let hierarchyOk = true;
  for (const lv of headings) {
    if (lv > lastLevel + 1 && lastLevel !== 0) { hierarchyOk = false; break; }
    lastLevel = lv;
  }
  facts.headingHierarchyOk = hierarchyOk;
  if (!hierarchyOk) issues.push({ level: 'INFO', code: 'heading_skip', message: 'Heading hierarchy có skip (h2 → h4)' });

  // Canonical
  const canonical = $('link[rel="canonical"]').attr('href') || '';
  facts.canonical = canonical;
  if (!canonical) issues.push({ level: 'WARN', code: 'no_canonical', message: 'Thiếu canonical tag' });

  // robots meta
  const robotsMeta = $('meta[name="robots"]').attr('content') || '';
  facts.robotsMeta = robotsMeta;
  if (/noindex/i.test(robotsMeta)) issues.push({ level: 'CRITICAL', code: 'noindex', message: '⚠️ Meta robots = noindex — page bị loại khỏi index' });

  // Open Graph
  const og = {
    title: $('meta[property="og:title"]').attr('content'),
    description: $('meta[property="og:description"]').attr('content'),
    image: $('meta[property="og:image"]').attr('content'),
    type: $('meta[property="og:type"]').attr('content'),
  };
  facts.openGraph = og;
  if (!og.title || !og.description || !og.image) {
    issues.push({ level: 'WARN', code: 'og_incomplete', message: `OG tags thiếu: ${[!og.title&&'title',!og.description&&'description',!og.image&&'image'].filter(Boolean).join(', ')}` });
  }

  // Twitter card
  const tw = $('meta[name="twitter:card"]').attr('content');
  facts.twitterCard = tw;
  if (!tw) issues.push({ level: 'INFO', code: 'no_twitter_card', message: 'Thiếu Twitter Card meta' });

  // hreflang
  const hreflangs = $('link[rel="alternate"][hreflang]').map((_, el) => $(el).attr('hreflang')).get();
  facts.hreflangs = hreflangs;
  if (hreflangs.length === 0) issues.push({ level: 'INFO', code: 'no_hreflang', message: 'Không có hreflang (vi/en) — bỏ qua nếu chỉ phục vụ thị trường VN' });

  // Images
  const imgs = $('img');
  let missingAlt = 0;
  imgs.each((_, el) => { if (!($(el).attr('alt') || '').trim()) missingAlt++; });
  facts.imageCount = imgs.length;
  facts.imagesMissingAlt = missingAlt;
  if (missingAlt > 0) issues.push({ level: 'WARN', code: 'img_no_alt', message: `${missingAlt}/${imgs.length} ảnh thiếu thuộc tính alt` });

  // Internal links collect (returned via facts)
  const links = new Set();
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    try {
      const u = new URL(href, pageRes.finalUrl || pageRes.url);
      if (u.hostname.endsWith(TARGET_HOST)) links.add(u.origin + u.pathname);
    } catch {}
  });
  facts.internalLinks = [...links];

  // External authority links
  const externalAuthority = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (/\.(gov\.vn|edu\.vn|cafef\.vn|vnexpress\.net|vneconomy\.vn|cafeland\.com\.vn|thanhnien\.vn|tuoitre\.vn|baochinhphu\.vn)/i.test(href)) {
      externalAuthority.push(href);
    }
  });
  facts.externalAuthorityLinks = [...new Set(externalAuthority)];
  if (externalAuthority.length === 0) issues.push({ level: 'INFO', code: 'no_authority_outlinks', message: 'Không có outbound link tới site authoritative (.gov.vn, báo lớn) — giảm trust signal' });

  // Social profile links
  const social = {
    facebook: $('a[href*="facebook.com"]').length > 0,
    youtube:  $('a[href*="youtube.com"]').length > 0,
    linkedin: $('a[href*="linkedin.com"]').length > 0,
    tiktok:   $('a[href*="tiktok.com"]').length > 0,
    twitter:  ($('a[href*="twitter.com"]').length + $('a[href*="x.com"]').length) > 0,
  };
  facts.socialLinks = social;

  // JSON-LD
  const jsonLdBlocks = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try { jsonLdBlocks.push(JSON.parse($(el).contents().text())); } catch {}
  });
  const types = new Set();
  const collectTypes = o => {
    if (!o) return;
    if (Array.isArray(o)) return o.forEach(collectTypes);
    if (typeof o === 'object') {
      if (o['@type']) (Array.isArray(o['@type']) ? o['@type'] : [o['@type']]).forEach(t => types.add(t));
      Object.values(o).forEach(collectTypes);
    }
  };
  jsonLdBlocks.forEach(collectTypes);
  facts.schemaTypes = [...types];
  facts.jsonLdBlockCount = jsonLdBlocks.length;

  // Schema requirements per @type
  const schemaIssues = validateSchemas(jsonLdBlocks);
  for (const si of schemaIssues) issues.push(si);

  // Body text + word count
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  const words = bodyText.split(' ').filter(Boolean);
  facts.wordCount = words.length;
  const isProjectPage = /\/du-an\//.test(pageRes.url);
  const isBlogPage = /\/news|\/blog/.test(pageRes.url);
  if (isProjectPage && words.length < 300) issues.push({ level: 'WARN', code: 'thin_content_project', message: `Trang dự án mỏng: ${words.length} từ (nên >=300)` });
  if (isBlogPage && words.length > 0 && words.length < 1500) issues.push({ level: 'WARN', code: 'thin_content_blog', message: `Trang blog mỏng: ${words.length} từ (nên >=1500)` });
  if (words.length === 0) issues.push({ level: 'CRITICAL', code: 'no_body_text', message: 'Body không có text — SPA chưa SSR? Bot không chạy JS sẽ thấy trang trống.' });

  // Keyword density
  const lower = bodyText.toLowerCase();
  const keywordHits = {};
  for (const kw of TARGET_KEYWORDS) {
    const re = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    keywordHits[kw] = (lower.match(re) || []).length;
  }
  facts.keywordHits = keywordHits;

  // Entity mentions
  const entityHits = {};
  for (const e of ENTITIES) {
    const re = new RegExp(e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    entityHits[e] = (bodyText.match(re) || []).length;
  }
  facts.entityHits = entityHits;

  // GEO readiness
  facts.hasAuthorByline   = /\b(by|tác giả|author|biên tập)\b/i.test(bodyText) || $('[rel="author"]').length > 0;
  facts.hasPublicationDate = $('meta[property="article:published_time"]').length > 0
                          || /<time\s/i.test(html)
                          || /(cập nhật|đăng lúc|published|ngày \d{1,2}\/\d{1,2}\/\d{2,4})/i.test(bodyText);
  facts.hasFactualData    = /(\d+\s*(tỷ|triệu|tỉ|m²|m2|ha|căn|phòng|tầng|km|năm \d{4}|năm 20\d{2}))/i.test(bodyText)
                          || /bàn giao\s+(năm|q[1-4])/i.test(bodyText);
  facts.hasFaq            = $('details').length > 0
                          || /faq|câu hỏi thường gặp|hỏi đáp|q&a/i.test(bodyText)
                          || facts.schemaTypes.includes('FAQPage');
  facts.hasVideoEmbed     = $('iframe[src*="youtube.com"], iframe[src*="vimeo.com"]').length > 0;

  if (!facts.hasAuthorByline)    issues.push({ level: 'INFO', code: 'no_author', message: 'Không có author byline — giảm E-E-A-T' });
  if (!facts.hasPublicationDate) issues.push({ level: 'INFO', code: 'no_pub_date', message: 'Không có publication / last-modified date hiển thị' });
  if (!facts.hasFactualData)     issues.push({ level: 'WARN', code: 'no_factual_data', message: 'Trang thiếu số liệu cụ thể (giá, m², ha, căn, năm bàn giao) — AI khó cite' });
  if (!facts.hasFaq && (isProjectPage || pageRes.url === `${BASE_URL}/`)) {
    issues.push({ level: 'WARN', code: 'no_faq', message: 'Không có FAQ section — mất cơ hội xuất hiện trong People-Also-Ask & AI Overviews' });
  }

  // Mobile / a11y
  const viewport = $('meta[name="viewport"]').attr('content');
  facts.viewport = viewport;
  if (!viewport) issues.push({ level: 'CRITICAL', code: 'no_viewport', message: 'Thiếu viewport meta — fail mobile-friendly' });
  facts.htmlLang = $('html').attr('lang') || '';
  if (!facts.htmlLang) issues.push({ level: 'WARN', code: 'no_html_lang', message: 'Thiếu thuộc tính lang trên <html>' });

  // Bing
  facts.hasBingVerification = $('meta[name="msvalidate.01"]').length > 0;

  // LocalBusiness w/ geo
  const hasLocalBiz = facts.schemaTypes.some(t => /LocalBusiness|RealEstateAgent/i.test(t));
  if (!hasLocalBiz && pageRes.url === `${BASE_URL}/`) {
    issues.push({ level: 'WARN', code: 'no_local_biz_schema', message: 'Homepage thiếu LocalBusiness/RealEstateAgent schema' });
  }
  facts.hasLocalBusinessSchema = hasLocalBiz;

  return { issues, facts };
}

function validateSchemas(blocks) {
  const issues = [];
  const flat = [];
  const flatten = (o) => {
    if (!o) return;
    if (Array.isArray(o)) return o.forEach(flatten);
    if (typeof o === 'object') {
      if (o['@type']) flat.push(o);
      Object.values(o).forEach(v => { if (typeof v === 'object') flatten(v); });
    }
  };
  blocks.forEach(flatten);

  const requirements = {
    Organization:      ['name', 'url', 'logo', ['contactPoint', 'sameAs']],
    LocalBusiness:     ['name', 'address', 'telephone'],
    RealEstateAgent:   ['name', 'address', 'telephone', 'areaServed'],
    RealEstateListing: ['name', 'description', 'url', 'image', 'offers'],
    FAQPage:           ['mainEntity'],
    BreadcrumbList:    ['itemListElement'],
    Review:            ['author', 'reviewRating', 'reviewBody'],
    Article:           ['headline', 'datePublished', 'author'],
  };

  for (const obj of flat) {
    const t = Array.isArray(obj['@type']) ? obj['@type'][0] : obj['@type'];
    const req = requirements[t];
    if (!req) continue;
    for (const field of req) {
      if (Array.isArray(field)) {
        if (!field.some(f => obj[f])) {
          issues.push({ level: 'WARN', code: `schema_missing_${t}_${field.join('|')}`, message: `Schema ${t} thiếu một trong: ${field.join(' / ')}` });
        }
      } else if (!obj[field]) {
        issues.push({ level: 'WARN', code: `schema_missing_${t}_${field}`, message: `Schema ${t} thiếu trường: ${field}` });
      }
    }
  }
  return issues;
}

// ──────────────────────────────────────────────────────────────────────────────
// Robots.txt + sitemap
// ──────────────────────────────────────────────────────────────────────────────
function analyzeRobots(robotsRes) {
  const issues = [];
  const facts = {};
  if (!robotsRes || robotsRes.status !== 200) {
    issues.push({ level: 'CRITICAL', code: 'no_robots', message: 'robots.txt không tồn tại / không truy cập được' });
    return { issues, facts };
  }
  const txt = robotsRes.body;
  facts.bytes = txt.length;
  facts.hasSitemapDeclaration = /sitemap\s*:/i.test(txt);
  if (!facts.hasSitemapDeclaration) issues.push({ level: 'WARN', code: 'robots_no_sitemap', message: 'robots.txt không khai báo Sitemap:' });

  // Detect global Disallow / for AI bots
  const aiBots = ['gptbot', 'claudebot', 'google-extended', 'ccbot', 'oai-searchbot', 'chatgpt-user', 'perplexitybot', 'amazonbot', 'applebot-extended', 'bytespider'];
  const blockedAi = [];
  for (const bot of aiBots) {
    const rx = new RegExp(`user-agent:\\s*${bot}\\s*\\n([\\s\\S]*?)(?=user-agent:|$)`, 'i');
    const m = txt.match(rx);
    if (m && /disallow:\s*\//i.test(m[1])) blockedAi.push(bot);
  }
  facts.blockedAiBots = blockedAi;
  if (blockedAi.length > 0) {
    issues.push({ level: 'CRITICAL', code: 'ai_bots_blocked', message: `AI bots bị chặn trong robots.txt: ${blockedAi.join(', ')} — kiểm tra cài đặt Cloudflare AI Audit / Block AI Crawlers` });
  }

  // Googlebot block?
  const gbotRx = /user-agent:\s*googlebot\s*\n([\s\S]*?)(?=user-agent:|$)/i;
  const gm = txt.match(gbotRx);
  if (gm && /disallow:\s*\/\s*$/im.test(gm[1])) {
    issues.push({ level: 'CRITICAL', code: 'googlebot_blocked', message: 'Googlebot bị chặn toàn bộ — site sẽ rớt khỏi Google!' });
  }
  return { issues, facts };
}

function parseSitemap(xml) {
  const urls = [];
  const rx = /<loc>([^<]+)<\/loc>/gi;
  let m;
  while ((m = rx.exec(xml)) !== null) urls.push(m[1].trim());
  return urls;
}

// ──────────────────────────────────────────────────────────────────────────────
// Optional Lighthouse
// ──────────────────────────────────────────────────────────────────────────────
async function tryLighthouse(urls) {
  let lighthouse, chromeLauncher;
  try {
    lighthouse = (await import('lighthouse')).default;
    chromeLauncher = await import('chrome-launcher');
  } catch {
    return { skipped: 'lighthouse / chrome-launcher chưa cài (npm install lighthouse chrome-launcher để chạy CWV)' };
  }
  const results = [];
  let chrome;
  try {
    chrome = await chromeLauncher.launch({ chromeFlags: ['--headless=new', '--no-sandbox'] });
    for (const url of urls.slice(0, 4)) {
      try {
        const lhResult = await lighthouse(url, {
          port: chrome.port, output: 'json', logLevel: 'error',
          onlyCategories: ['performance', 'seo', 'accessibility'],
        });
        const lhr = lhResult.lhr;
        results.push({
          url,
          performance:   Math.round((lhr.categories.performance?.score || 0) * 100),
          seo:           Math.round((lhr.categories.seo?.score || 0) * 100),
          accessibility: Math.round((lhr.categories.accessibility?.score || 0) * 100),
          lcp:           lhr.audits['largest-contentful-paint']?.numericValue,
          cls:           lhr.audits['cumulative-layout-shift']?.numericValue,
          fcp:           lhr.audits['first-contentful-paint']?.numericValue,
          ttfb:          lhr.audits['server-response-time']?.numericValue,
        });
      } catch (err) {
        results.push({ url, error: String(err?.message || err) });
      }
    }
  } finally {
    if (chrome) await chrome.kill();
  }
  return { results };
}

// ──────────────────────────────────────────────────────────────────────────────
// Crawler
// ──────────────────────────────────────────────────────────────────────────────
function shouldVisit(url, visited) {
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith(TARGET_HOST)) return false;
    if (SKIP_PATH_RX.test(u.pathname)) return false;
    if (PRIVATE_PREFIXES.some(p => u.pathname.startsWith(p))) return false;
    const key = u.origin + u.pathname;
    if (visited.has(key)) return false;
    return true;
  } catch { return false; }
}

async function crawl(seedUrls, max) {
  const queue = [...seedUrls];
  const visited = new Set();
  const pages = [];
  while (queue.length && pages.length < max) {
    const url = queue.shift();
    const key = url.split('#')[0].split('?')[0];
    if (visited.has(key)) continue;
    visited.add(key);
    process.stdout.write(c.dim(`  [${pages.length + 1}/${max}] ${url}\n`));
    const res = await fetchUrl(url);
    pages.push(res);
    if (res.body && /text\/html/i.test(res.contentType || '')) {
      const $ = cheerio.load(res.body);
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        if (!href) return;
        try {
          const u = new URL(href, res.finalUrl || url);
          const k = u.origin + u.pathname;
          if (shouldVisit(k, visited) && !queue.includes(k)) queue.push(k);
        } catch {}
      });
    }
    await sleep(REQUEST_DELAY_MS);
  }
  return pages;
}

// ──────────────────────────────────────────────────────────────────────────────
// Per-page scoring
// ──────────────────────────────────────────────────────────────────────────────
function scorePage(analysis) {
  // Technical SEO 30
  const f = analysis.facts;
  let tech = 30;
  for (const i of analysis.issues) {
    if (['no_title','no_h1','no_viewport','noindex','http_404','http_5xx'].includes(i.code)) tech -= 8;
    else if (['no_meta_desc','no_canonical','multiple_h1'].includes(i.code)) tech -= 4;
    else if (['title_short','title_long','desc_short','desc_long','no_html_lang'].includes(i.code)) tech -= 2;
  }
  tech = Math.max(0, tech);

  // Content quality 25
  let content = 25;
  if (f.wordCount === 0) content = 0;
  else if (f.wordCount < 300) content -= 12;
  else if (f.wordCount < 800) content -= 6;
  if (f.imagesMissingAlt && f.imageCount) content -= Math.min(6, Math.round(6 * f.imagesMissingAlt / f.imageCount));
  content = Math.max(0, content);

  // Structured data 20
  const schemaTypesNeeded = ['Organization', 'WebSite', 'BreadcrumbList', 'FAQPage', 'LocalBusiness', 'RealEstateAgent'];
  const present = (f.schemaTypes || []).filter(t => schemaTypesNeeded.includes(t)).length;
  let schema = Math.min(20, present * 4);

  // GEO readiness 15
  let geo = 0;
  if (f.hasAuthorByline) geo += 2;
  if (f.hasPublicationDate) geo += 2;
  if (f.hasFactualData) geo += 4;
  if (f.hasFaq) geo += 4;
  const entityCount = Object.values(f.entityHits || {}).filter(n => n > 0).length;
  geo += Math.min(3, Math.round(entityCount / 3));
  geo = Math.min(15, geo);

  // Performance 10 (TTFB-only proxy without Lighthouse)
  let perf = 10;
  if (f.ttfb > 1500) perf -= 6;
  else if (f.ttfb > 600) perf -= 3;
  perf = Math.max(0, perf);

  return { total: tech + content + schema + geo + perf, breakdown: { tech, content, schema, geo, perf } };
}

function scoreLabel(n) {
  if (n >= 90) return c.green(`EXCELLENT (${n}/100)`);
  if (n >= 70) return c.yellow(`GOOD (${n}/100)`);
  if (n >= 50) return c.orange(`NEEDS WORK (${n}/100)`);
  return c.red(`CRITICAL (${n}/100)`);
}

// ──────────────────────────────────────────────────────────────────────────────
// Reports
// ──────────────────────────────────────────────────────────────────────────────
function buildMarkdown({ pages, robots, sitemapInfo, lighthouseInfo, perPage, overall, topIssues }) {
  const lines = [];
  lines.push(`# SEO + GEO Audit — SGS Land`);
  lines.push('');
  lines.push(`**Thời điểm:** ${new Date().toISOString()}`);
  lines.push(`**Domain:** ${BASE_URL}`);
  lines.push(`**Pages crawled:** ${pages.length}`);
  lines.push('');
  lines.push(`## Executive Summary`);
  lines.push(`- **Overall site score:** ${overall.avg}/100 — ${overall.label}`);
  lines.push(`- **Best page:** ${overall.best.url} (${overall.best.score}/100)`);
  lines.push(`- **Worst page:** ${overall.worst.url} (${overall.worst.score}/100)`);
  lines.push(`- **Tổng số issue:** 🔴 ${overall.counts.CRITICAL} CRITICAL · 🟠 ${overall.counts.WARN} WARN · 🟡 ${overall.counts.INFO} INFO`);
  lines.push('');
  lines.push(`### Top 5 vấn đề ưu tiên`);
  for (const t of topIssues.slice(0, 5)) {
    lines.push(`- ${levelToBucket(t.level)} **${t.message}** — ảnh hưởng ${t.affected} trang`);
  }
  lines.push('');

  lines.push(`## robots.txt`);
  for (const i of robots.issues) lines.push(`- ${levelToBucket(i.level)} ${i.message}`);
  lines.push(`- Sitemap declaration: ${robots.facts.hasSitemapDeclaration ? '✅' : '❌'}`);
  if (robots.facts.blockedAiBots?.length) lines.push(`- AI bots bị chặn: **${robots.facts.blockedAiBots.join(', ')}**`);
  lines.push('');

  lines.push(`## Sitemap`);
  if (sitemapInfo.error) lines.push(`- ❌ ${sitemapInfo.error}`);
  else {
    lines.push(`- URLs trong sitemap: **${sitemapInfo.urlCount}**`);
    if (sitemapInfo.sample.length) {
      lines.push(`- Mẫu:`);
      for (const u of sitemapInfo.sample.slice(0, 10)) lines.push(`  - ${u}`);
    }
  }
  lines.push('');

  lines.push(`## Core Web Vitals (Lighthouse)`);
  if (lighthouseInfo.skipped) lines.push(`- 🟡 ${lighthouseInfo.skipped}`);
  else {
    lines.push('| URL | Perf | SEO | A11y | LCP (ms) | CLS | TTFB (ms) |');
    lines.push('|---|---:|---:|---:|---:|---:|---:|');
    for (const r of lighthouseInfo.results || []) {
      if (r.error) lines.push(`| ${r.url} | ❌ ${r.error} | | | | | |`);
      else lines.push(`| ${r.url} | ${r.performance} | ${r.seo} | ${r.accessibility} | ${Math.round(r.lcp || 0)} | ${(r.cls || 0).toFixed(3)} | ${Math.round(r.ttfb || 0)} |`);
    }
  }
  lines.push('');

  lines.push(`## Per-page report (${perPage.length} pages)`);
  for (const p of perPage) {
    lines.push(`### ${p.url}  —  ${p.score.total}/100`);
    lines.push(`- Tech: ${p.score.breakdown.tech}/30 · Content: ${p.score.breakdown.content}/25 · Schema: ${p.score.breakdown.schema}/20 · GEO: ${p.score.breakdown.geo}/15 · Perf: ${p.score.breakdown.perf}/10`);
    lines.push(`- Title (${p.facts.titleLength || 0} ký tự): ${p.facts.title || '(thiếu)'}`);
    lines.push(`- Meta desc (${p.facts.metaDescriptionLength || 0} ký tự): ${(p.facts.metaDescription || '(thiếu)').slice(0, 120)}`);
    lines.push(`- H1 (${p.facts.h1Count || 0}): ${(p.facts.h1 || []).slice(0, 1).join(' | ') || '(thiếu)'}`);
    lines.push(`- Word count: ${p.facts.wordCount} · Images: ${p.facts.imageCount} (missing alt: ${p.facts.imagesMissingAlt})`);
    lines.push(`- Schema types: ${(p.facts.schemaTypes || []).join(', ') || '(none)'}`);
    lines.push(`- GEO: byline ${p.facts.hasAuthorByline?'✅':'❌'} · pubDate ${p.facts.hasPublicationDate?'✅':'❌'} · factualData ${p.facts.hasFactualData?'✅':'❌'} · FAQ ${p.facts.hasFaq?'✅':'❌'} · video ${p.facts.hasVideoEmbed?'✅':'❌'}`);
    lines.push(`- Entity mentions: ${Object.entries(p.facts.entityHits || {}).filter(([,n])=>n>0).map(([k,n])=>`${k}(${n})`).join(', ') || '(none)'}`);
    if (p.issues.length) {
      lines.push(`- Issues:`);
      for (const i of p.issues) lines.push(`  - ${levelToBucket(i.level)} ${i.message}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function buildFixesTodo(perPage, robots, sitemapInfo) {
  const fixes = [];
  // Aggregate by issue code → unique fix entry
  const byCode = new Map();
  for (const p of perPage) {
    for (const i of p.issues) {
      if (!byCode.has(i.code)) byCode.set(i.code, { code: i.code, level: i.level, message: i.message, urls: [] });
      byCode.get(i.code).urls.push(p.url);
    }
  }
  for (const i of robots.issues)  byCode.set(`robots:${i.code}`, { code: i.code, level: i.level, message: `(robots.txt) ${i.message}`, urls: [`${BASE_URL}/robots.txt`] });
  if (sitemapInfo.error)          byCode.set('sitemap:missing', { code: 'sitemap_missing', level: 'CRITICAL', message: sitemapInfo.error, urls: [`${BASE_URL}/sitemap.xml`] });

  const PRIORITY = { CRITICAL: 'P0', WARN: 'P1', INFO: 'P2' };
  const FIX_HINTS = {
    ai_bots_blocked:        'Vào Cloudflare → Bots → AI Audit → tắt "Block AI Crawlers" và "Manage robots.txt". Sau ~5 phút verify lại bằng `curl https://sgsland.vn/robots.txt`.',
    googlebot_blocked:      'Sửa public/robots.txt — đảm bảo `User-agent: Googlebot\\nAllow: /` và không có `Disallow: /` chung.',
    no_robots:              'Tạo public/robots.txt với block User-agent: * Allow: / + Sitemap: https://sgsland.vn/sitemap.xml.',
    robots_no_sitemap:      'Thêm dòng `Sitemap: https://sgsland.vn/sitemap.xml` vào cuối robots.txt.',
    noindex:                'Xoá `<meta name="robots" content="noindex">` khỏi page hoặc đảm bảo route không trả header X-Robots-Tag: noindex.',
    no_title:               'Thêm `<title>` mô tả nội dung trang, 50-60 ký tự, có chứa keyword chính.',
    title_short:            'Mở rộng title 50-60 ký tự — gồm brand + keyword chính + benefit.',
    title_long:             'Rút gọn title về 50-60 ký tự — Google sẽ truncate phần thừa.',
    no_meta_desc:           'Thêm `<meta name="description" content="...">` 140-160 ký tự, có CTA và keyword.',
    desc_short:             'Mở rộng meta description lên 140-160 ký tự với 1-2 keyword + USP.',
    desc_long:              'Rút meta description xuống 140-160 ký tự.',
    no_h1:                  'Thêm đúng 1 thẻ `<h1>` chứa keyword chính của trang.',
    multiple_h1:            'Giảm còn 1 thẻ `<h1>` mỗi trang (chuyển các H1 phụ thành H2).',
    no_canonical:           'Thêm `<link rel="canonical" href="https://sgsland.vn/...">` self-referencing.',
    og_incomplete:          'Bổ sung `<meta property="og:title">`, `og:description`, `og:image` (tối thiểu 1200×630).',
    no_twitter_card:        'Thêm `<meta name="twitter:card" content="summary_large_image">`.',
    no_hreflang:            'Nếu phục vụ EN, thêm `<link rel="alternate" hreflang="vi" href="...">` và `hreflang="en"`.',
    img_no_alt:             'Cung cấp thuộc tính alt mô tả cho mọi `<img>` (đặc biệt project hero, sơ đồ).',
    no_viewport:            'Thêm `<meta name="viewport" content="width=device-width, initial-scale=1">`.',
    no_html_lang:           'Đặt `<html lang="vi">` (hoặc lang phù hợp).',
    thin_content_project:   'Mở rộng nội dung trang dự án ≥300 từ: thông tin pháp lý, bảng giá, tiện ích, mặt bằng, FAQ.',
    thin_content_blog:      'Bài blog cần ≥1500 từ: cover topic đầy đủ, có dữ liệu/case study, có FAQ cuối bài.',
    no_body_text:           'SPA chưa SSR — bot không chạy JS thấy trang trống. Bổ sung nội dung text trong `<noscript>` hoặc cân nhắc SSR/prerender các route public.',
    no_factual_data:        'Bổ sung số liệu cụ thể (giá từ ... tỷ, diện tích ... m²/ha, số căn, năm bàn giao) — AI cần dữ liệu để cite.',
    no_faq:                 'Thêm FAQ section 5-10 câu hỏi thực tế khách hàng, kèm JSON-LD FAQPage.',
    no_author:              'Thêm author byline cuối bài: tên + chức danh + ảnh + link LinkedIn.',
    no_pub_date:            'Hiển thị ngày đăng + ngày cập nhật (`<time datetime="2026-01-15">`).',
    no_local_biz_schema:    'Thêm JSON-LD `RealEstateAgent` hoặc `LocalBusiness` ở homepage với address, geo, telephone, openingHours.',
    no_authority_outlinks:  'Thêm 1-2 outbound link tới site authority (.gov.vn, baochinhphu.vn, cafef.vn) trong các bài về quy định/pháp lý.',
    slow_ttfb:              'TTFB > 600ms. Bật cache CDN (Cloudflare Cache Everything cho static), pre-warm SSR cho route public, kiểm tra DB query chậm.',
    http_5xx:               'Server lỗi 5xx — kiểm tra log production ngay, có thể do Neon connection pool / Redis / dependency.',
    http_404:               'URL trả 404 — kiểm tra route, redirect 301 sang URL mới nếu đã đổi.',
  };

  for (const f of byCode.values()) {
    fixes.push({
      priority: PRIORITY[f.level] || 'P2',
      level: f.level,
      issue: f.message,
      affected: f.urls.length,
      sampleUrls: f.urls.slice(0, 3),
      fix: FIX_HINTS[f.code] || 'Xem chi tiết per-page; rà soát theo guidance trong báo cáo MD.',
      impact: f.level === 'CRITICAL' ? 'High' : f.level === 'WARN' ? 'Medium' : 'Low',
    });
  }

  fixes.sort((a, b) => {
    const pa = { P0: 0, P1: 1, P2: 2 }[a.priority];
    const pb = { P0: 0, P1: 1, P2: 2 }[b.priority];
    if (pa !== pb) return pa - pb;
    return b.affected - a.affected;
  });

  const lines = [];
  lines.push(`# FIXES TODO — SGS Land SEO + GEO Audit`);
  lines.push(`_Generated: ${new Date().toISOString()}_`);
  lines.push('');
  lines.push(`## Quick stats`);
  const counts = { P0: 0, P1: 0, P2: 0 };
  for (const f of fixes) counts[f.priority]++;
  lines.push(`- 🔴 P0 (fix ngay): **${counts.P0}**`);
  lines.push(`- 🟠 P1 (fix trong 2 tuần): **${counts.P1}**`);
  lines.push(`- 🟡 P2 (cải thiện): **${counts.P2}**`);
  lines.push('');
  for (const f of fixes) {
    lines.push(`## [${f.priority}] ${f.issue}`);
    lines.push(`- **Impact:** ${f.impact}`);
    lines.push(`- **Affected:** ${f.affected} trang/asset`);
    lines.push(`- **Sample URLs:**`);
    for (const u of f.sampleUrls) lines.push(`  - ${u}`);
    lines.push(`- **Fix:** ${f.fix}`);
    lines.push('');
  }
  return lines.join('\n');
}

// ──────────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────────
async function main() {
  await mkdir(REPORTS_DIR, { recursive: true });
  console.log(c.bold(c.cyan(`\n🔎 SGS Land SEO + GEO Audit — ${TIMESTAMP}`)));
  console.log(c.dim(`Target: ${BASE_URL}\n`));

  // Special files first
  console.log(c.bold('📄 robots.txt + sitemap + llms.txt'));
  const [robotsRes, sitemapRes, llmsRes, llmsFullRes] = await Promise.all(SPECIAL_URLS.map(fetchUrl));
  const robots = analyzeRobots(robotsRes);
  console.log(`  robots.txt: ${robotsRes.status === 200 ? c.green('✓') : c.red('✗')}  ` +
              `sitemap.xml: ${sitemapRes.status === 200 ? c.green('✓') : c.red('✗')}  ` +
              `llms.txt: ${llmsRes.status === 200 ? c.green('✓') : c.red('✗')}  ` +
              `llms-full.txt: ${llmsFullRes.status === 200 ? c.green('✓') : c.red('✗')}`);
  for (const i of robots.issues) console.log(`  ${levelToBucket(i.level)} ${i.message}`);

  let sitemapInfo;
  if (sitemapRes.status === 200) {
    const urls = parseSitemap(sitemapRes.body);
    sitemapInfo = { urlCount: urls.length, sample: urls.slice(0, 50) };
    // Add discovered sitemap URLs to crawl queue (limited)
    for (const u of urls.slice(0, 25)) if (!TARGET_URLS.includes(u)) TARGET_URLS.push(u);
  } else {
    sitemapInfo = { error: `Sitemap không truy cập được (HTTP ${sitemapRes.status})` };
  }
  console.log('');

  // Crawl
  console.log(c.bold(`🕷️  Crawling (max ${MAX_PAGES} pages, delay ${REQUEST_DELAY_MS}ms)`));
  const pages = await crawl(TARGET_URLS, MAX_PAGES);
  console.log(c.dim(`Crawled ${pages.length} pages.\n`));

  // Per-page analysis
  console.log(c.bold(`🧪 Analyzing pages…`));
  const perPage = [];
  const counts = { CRITICAL: 0, WARN: 0, INFO: 0 };
  for (const pageRes of pages) {
    if (!/text\/html/i.test(pageRes.contentType || '')) continue;
    const a = analyzeHtml(pageRes);
    const score = scorePage(a);
    perPage.push({ url: pageRes.url, status: pageRes.status, ttfb: pageRes.ttfb, ...a, score });
    for (const i of a.issues) counts[i.level] = (counts[i.level] || 0) + 1;
    const lvlBadge = score.total >= 70 ? c.green('●') : score.total >= 50 ? c.orange('●') : c.red('●');
    console.log(`  ${lvlBadge} ${score.total}/100  ${pageRes.url}`);
  }

  // Lighthouse (optional)
  console.log('');
  console.log(c.bold(`⚡ Core Web Vitals (Lighthouse)`));
  const lighthouseInfo = await tryLighthouse(TARGET_URLS.slice(0, 4));
  if (lighthouseInfo.skipped) console.log(`  🟡 ${lighthouseInfo.skipped}`);
  else for (const r of lighthouseInfo.results || []) {
    if (r.error) console.log(`  ❌ ${r.url}: ${r.error}`);
    else console.log(`  ${r.url}  perf=${r.performance} seo=${r.seo} a11y=${r.accessibility} LCP=${Math.round(r.lcp)}ms TTFB=${Math.round(r.ttfb)}ms`);
  }

  // Top issues aggregated
  const issueAgg = new Map();
  for (const p of perPage) for (const i of p.issues) {
    const k = i.code;
    if (!issueAgg.has(k)) issueAgg.set(k, { code: k, level: i.level, message: i.message, affected: 0 });
    issueAgg.get(k).affected++;
  }
  const topIssues = [...issueAgg.values()]
    .sort((a, b) => {
      const lvl = { CRITICAL: 0, WARN: 1, INFO: 2 };
      if (lvl[a.level] !== lvl[b.level]) return lvl[a.level] - lvl[b.level];
      return b.affected - a.affected;
    });

  // Overall
  const scoresArr = perPage.map(p => p.score.total);
  const avg = scoresArr.length ? Math.round(scoresArr.reduce((a, b) => a + b, 0) / scoresArr.length) : 0;
  const sorted = [...perPage].sort((a, b) => b.score.total - a.score.total);
  const overall = {
    avg,
    label: avg >= 90 ? 'EXCELLENT' : avg >= 70 ? 'GOOD' : avg >= 50 ? 'NEEDS WORK' : 'CRITICAL',
    counts,
    best:  sorted[0]              ? { url: sorted[0].url,              score: sorted[0].score.total }              : { url: '-', score: 0 },
    worst: sorted[sorted.length-1]? { url: sorted[sorted.length-1].url, score: sorted[sorted.length-1].score.total } : { url: '-', score: 0 },
  };

  // Reports
  const md = buildMarkdown({ pages, robots, sitemapInfo, lighthouseInfo, perPage, overall, topIssues });
  const todo = buildFixesTodo(perPage, robots, sitemapInfo);
  const raw = {
    timestamp: new Date().toISOString(),
    target: BASE_URL,
    overall,
    robots,
    sitemap: sitemapInfo,
    lighthouse: lighthouseInfo,
    perPage,
    topIssues,
    pagesCrawled: pages.map(p => ({ url: p.url, status: p.status, ttfb: p.ttfb, contentType: p.contentType })),
  };
  const jsonFile = path.join(REPORTS_DIR, `sgsland-audit-${TIMESTAMP}.json`);
  const mdFile   = path.join(REPORTS_DIR, `sgsland-audit-${TIMESTAMP}.md`);
  const todoFile = path.join(REPORTS_DIR, `FIXES-TODO.md`);
  await writeFile(jsonFile, JSON.stringify(raw, null, 2));
  await writeFile(mdFile, md);
  await writeFile(todoFile, todo);

  console.log('');
  console.log(c.bold(`📊 Site score: ${scoreLabel(avg)}`));
  console.log(`   🔴 ${counts.CRITICAL} CRITICAL · 🟠 ${counts.WARN} WARN · 🟡 ${counts.INFO} INFO`);
  console.log('');
  console.log(`📝 ${mdFile}`);
  console.log(`📦 ${jsonFile}`);
  console.log(`🛠  ${todoFile}`);
  console.log('');
}

main().catch(err => {
  console.error(c.red(`[seo-geo-audit] FATAL: ${err?.stack || err}`));
  process.exit(1);
});
