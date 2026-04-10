import { Router, Request, Response } from 'express';
import * as cheerio from 'cheerio';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ExternalListing {
  id:           string;
  source:       string;
  title:        string;
  type:         string;
  transaction:  string;
  price:        number;
  priceDisplay: string;
  area:         number;
  pricePerM2:   number;
  location:     string;
  province:     string;
  bedrooms:     number | null;
  imageUrl:     string | null;
  url:          string;
  postedAt:     string | null;
  scrapedAt:    string;
}

export interface SourceResult {
  source:     string;
  ok:         boolean;
  listings:   ExternalListing[];
  total:      number;
  durationMs: number;
  error?:     string;
  warning?:   string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const HEADERS_BROWSER = {
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function parseVnPrice(raw: string): number {
  const s = (raw ?? '').toLowerCase().replace(/\s/g, '').replace(/,/g, '.');
  const ty  = s.match(/([\d.]+)tỷ/);
  const tr  = s.match(/([\d.]+)triệu/);
  const ty2 = s.match(/([\d.]+)ty/);
  if (ty)  return Math.round(parseFloat(ty[1]) * 1e9);
  if (ty2) return Math.round(parseFloat(ty2[1]) * 1e9);
  if (tr)  return Math.round(parseFloat(tr[1]) * 1e6);
  return 0;
}

function parseArea(raw: string): number {
  const m = (raw ?? '').replace(/,/g, '.').match(/[\d.]+/);
  return m ? parseFloat(m[0]) : 0;
}

/** Fetch via ScraperAPI proxy (bypasses Cloudflare). render=true uses headless browser. */
async function scraperApiFetch(targetUrl: string, render = false): Promise<Response> {
  const key = process.env.SCRAPERAPI_KEY;
  if (!key) throw new Error('SCRAPERAPI_KEY not configured');
  const proxyUrl = `http://api.scraperapi.com?api_key=${key}&url=${encodeURIComponent(targetUrl)}&country_code=vn${render ? '&render=true' : ''}`;
  return fetch(proxyUrl, { signal: AbortSignal.timeout(30_000) });
}

// ── Chotot Scraper (direct JSON API — no proxy needed) ────────────────────────

async function scrapeChotot(maxPages = 3): Promise<SourceResult> {
  const start = Date.now();
  const listings: ExternalListing[] = [];
  try {
    for (let page = 0; page < maxPages; page++) {
      const offset = page * 20;
      const url = `https://gateway.chotot.com/v1/public/ad-listing?cg=1020&o=${offset}&limit=20&st=s,k&key_param_included=true`;
      const res  = await fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { total?: number; ads?: Record<string, unknown>[] };
      const ads  = data.ads ?? [];
      if (!ads.length) break;

      for (const ad of ads) {
        const price = Number(ad.price ?? 0);
        const area  = parseArea(String(ad.size ?? ad.area ?? ''));
        listings.push({
          id:           `chotot-${ad.list_id ?? ad.ad_id}`,
          source:       'Chợ Tốt',
          title:        String(ad.subject ?? ''),
          type:         String(ad.category_name ?? 'Nhà ở'),
          transaction:  String(ad.type ?? '').toLowerCase() === 'r' ? 'Cho thuê' : 'Bán',
          price,
          priceDisplay: String(ad.price_string ?? ''),
          area,
          pricePerM2:   area > 0 ? Math.round(price / area) : 0,
          location:     [String(ad.street_name ?? ''), String(ad.area_name ?? ''), String(ad.region_name ?? '')].filter(Boolean).join(', '),
          province:     String(ad.region_name ?? ''),
          bedrooms:     ad.rooms ? Number(ad.rooms) : null,
          imageUrl:     String(ad.thumbnail_image ?? ad.image ?? '') || null,
          url:          `https://www.chotot.com/${ad.list_id}.htm`,
          postedAt:     ad.list_time ? new Date(Number(ad.list_time)).toISOString() : null,
          scrapedAt:    new Date().toISOString(),
        });
      }
      if (page < maxPages - 1) await sleep(600);
    }
    return { source: 'chotot', ok: true, listings, total: listings.length, durationMs: Date.now() - start };
  } catch (err) {
    return { source: 'chotot', ok: false, listings, total: 0, durationMs: Date.now() - start, error: String(err) };
  }
}

// ── AlonNhaDat Scraper (direct HTML — no proxy needed) ────────────────────────

const ALONHADAT_URLS = [
  { url: 'https://alonhadat.com.vn/nha-dat/can-ban/nha-dat/tp-ho-chi-minh/1/quan-1.html',          province: 'TP Hồ Chí Minh', district: 'Quận 1' },
  { url: 'https://alonhadat.com.vn/nha-dat/can-ban/nha-dat/tp-ho-chi-minh/3/quan-3.html',          province: 'TP Hồ Chí Minh', district: 'Quận 3' },
  { url: 'https://alonhadat.com.vn/nha-dat/can-ban/nha-dat/tp-ho-chi-minh/7/quan-binh-thanh.html', province: 'TP Hồ Chí Minh', district: 'Bình Thạnh' },
  { url: 'https://alonhadat.com.vn/nha-dat/can-ban/nha-dat/dong-nai/1/thanh-pho-bien-hoa.html',    province: 'Đồng Nai',        district: 'Biên Hòa' },
  { url: 'https://alonhadat.com.vn/nha-dat/can-ban/nha-dat/binh-duong/1/thanh-pho-thu-dau-mot.html', province: 'Bình Dương',    district: 'Thủ Dầu Một' },
];

async function scrapeAlonNhaDat(maxUrls = 3): Promise<SourceResult> {
  const start    = Date.now();
  const listings: ExternalListing[] = [];
  let   okCount  = 0;

  for (const { url, province, district } of ALONHADAT_URLS.slice(0, maxUrls)) {
    try {
      const res  = await fetch(url, { headers: HEADERS_BROWSER });
      if (!res.ok) continue;
      const html = await res.text();
      const $    = cheerio.load(html);

      $('article.property-item').each((_, el) => {
        const $el      = $(el);
        const href     = $el.find('a.link').attr('href') ?? '';
        const title    = $el.find('.property-title').text().trim();
        const date     = $el.find('time.created-date').attr('datetime') ?? null;
        const det      = $el.find('.property-details');
        const priceRaw = det.find('.price strong').text().trim() || $el.find('.price').text().trim();
        const areaRaw  = det.find('.area').text().trim() || det.find('.square').text().trim();
        const imgSrc   = $el.find('.thumbnail img').attr('src') ?? null;
        const bedRaw   = det.find('.bedroom').text().trim();
        const idMatch  = href.match(/(\d{5,})/);
        const extId    = idMatch ? idMatch[1] : `${Date.now()}-${Math.random()}`;

        const price = parseVnPrice(priceRaw);
        const area  = parseArea(areaRaw);

        listings.push({
          id:           `alonhadat-${extId}`,
          source:       'AlonNhaDat',
          title,
          type:         'Nhà ở',
          transaction:  'Bán',
          price,
          priceDisplay: priceRaw,
          area,
          pricePerM2:   area > 0 ? Math.round(price / area) : 0,
          location:     [district, province].join(', '),
          province,
          bedrooms:     bedRaw ? parseInt(bedRaw) || null : null,
          imageUrl:     imgSrc ? (imgSrc.startsWith('http') ? imgSrc : `https://alonhadat.com.vn${imgSrc}`) : null,
          url:          href.startsWith('http') ? href : `https://alonhadat.com.vn${href}`,
          postedAt:     date,
          scrapedAt:    new Date().toISOString(),
        });
      });

      okCount++;
      await sleep(700);
    } catch { /* skip failed url */ }
  }

  return { source: 'alonhadat', ok: okCount > 0, listings, total: listings.length, durationMs: Date.now() - start };
}

// ── BatDongSan Scraper (via ScraperAPI — Cloudflare bypass) ───────────────────

const BDS_PAGES = [
  { url: 'https://batdongsan.com.vn/nha-dat-ban-tp-hcm',   province: 'TP Hồ Chí Minh' },
  { url: 'https://batdongsan.com.vn/nha-dat-ban-ha-noi',   province: 'Hà Nội' },
  { url: 'https://batdongsan.com.vn/nha-dat-ban-da-nang',  province: 'Đà Nẵng' },
];

async function scrapeBatDongSan(maxPages = 2): Promise<SourceResult> {
  const start = Date.now();
  const listings: ExternalListing[] = [];

  if (!process.env.SCRAPERAPI_KEY) {
    return { source: 'batdongsan', ok: false, listings, total: 0, durationMs: Date.now() - start,
      error: 'SCRAPERAPI_KEY chưa được cấu hình', warning: 'Thêm SCRAPERAPI_KEY vào secrets để bật scraper này.' };
  }

  let okCount = 0;
  for (const { url, province } of BDS_PAGES.slice(0, maxPages)) {
    try {
      const res  = await scraperApiFetch(url, true);
      if (!res.ok) { continue; }
      const html = await res.text();
      const $    = cheerio.load(html);

      // BatDongSan listing card selectors (based on their DOM structure)
      const cards = $('[class*="re__card-full"]').length
        ? $('[class*="re__card-full"]')
        : $('[class*="js__card"]');

      cards.each((_, el) => {
        const $el      = $(el);
        const titleEl  = $el.find('[class*="re__card-title"] a, [class*="card-title"] a').first();
        const href     = titleEl.attr('href') ?? $el.find('a').first().attr('href') ?? '';
        const title    = titleEl.text().trim() || $el.find('h3').first().text().trim();
        if (!title) return;

        const priceRaw = $el.find('[class*="re__card-config-price"] [class*="value"], [class*="price"]').first().text().trim();
        const areaRaw  = $el.find('[class*="re__card-config-area"] [class*="value"], [class*="area"]').first().text().trim();
        const locRaw   = $el.find('[class*="re__card-location"]').first().text().trim();
        const imgSrc   = $el.find('img').first().attr('src') ?? $el.find('img').first().attr('data-src') ?? null;
        const idMatch  = href.match(/pr(\d+)/) ?? href.match(/(\d{5,})/);
        const extId    = idMatch ? idMatch[1] : `${Date.now()}-${Math.random()}`;

        const price = parseVnPrice(priceRaw);
        const area  = parseArea(areaRaw);

        listings.push({
          id:           `bds-${extId}`,
          source:       'BatDongSan',
          title,
          type:         'Nhà ở',
          transaction:  'Bán',
          price,
          priceDisplay: priceRaw,
          area,
          pricePerM2:   area > 0 ? Math.round(price / area) : 0,
          location:     locRaw || province,
          province,
          bedrooms:     null,
          imageUrl:     imgSrc ?? null,
          url:          href.startsWith('http') ? href : `https://batdongsan.com.vn${href}`,
          postedAt:     null,
          scrapedAt:    new Date().toISOString(),
        });
      });

      okCount++;
      await sleep(1000);
    } catch (err) {
      continue;
    }
  }

  return {
    source: 'batdongsan', ok: okCount > 0 && listings.length > 0, listings, total: listings.length,
    durationMs: Date.now() - start,
    ...(listings.length === 0 ? { warning: 'Scrape thành công nhưng không parse được listing. Cấu trúc HTML có thể đã thay đổi.' } : {}),
  };
}

// ── Muaban Scraper (via ScraperAPI — Cloudflare bypass) ───────────────────────

const MUABAN_PAGES = [
  { url: 'https://muaban.net/bat-dong-san/nha-o',      province: 'Toàn quốc' },
  { url: 'https://muaban.net/bat-dong-san/can-ho',     province: 'Toàn quốc' },
];

async function scrapeMuaban(maxPages = 2): Promise<SourceResult> {
  const start = Date.now();
  const listings: ExternalListing[] = [];

  if (!process.env.SCRAPERAPI_KEY) {
    return { source: 'muaban', ok: false, listings, total: 0, durationMs: Date.now() - start,
      error: 'SCRAPERAPI_KEY chưa được cấu hình', warning: 'Thêm SCRAPERAPI_KEY vào secrets để bật scraper này.' };
  }

  let okCount = 0;
  for (const { url, province } of MUABAN_PAGES.slice(0, maxPages)) {
    try {
      const res  = await scraperApiFetch(url, true);
      if (!res.ok) continue;
      const html = await res.text();
      const $    = cheerio.load(html);

      // Muaban listing selectors
      const cards = $('[class*="AdItem"], .item--product, [class*="product-item"], article[class*="item"]');

      cards.each((_, el) => {
        const $el      = $(el);
        const titleEl  = $el.find('h2 a, h3 a, [class*="title"] a, [class*="name"] a').first();
        const href     = titleEl.attr('href') ?? $el.find('a').first().attr('href') ?? '';
        const title    = titleEl.text().trim() || $el.find('h2, h3').first().text().trim();
        if (!title) return;

        const priceRaw = $el.find('[class*="price"]').first().text().trim();
        const areaRaw  = $el.find('[class*="area"], [class*="dien-tich"]').first().text().trim();
        const locRaw   = $el.find('[class*="location"], [class*="address"], [class*="dia-diem"]').first().text().trim();
        const imgSrc   = $el.find('img').first().attr('src') ?? $el.find('img').first().attr('data-src') ?? null;
        const idMatch  = href.match(/(\d{5,})/);
        const extId    = idMatch ? idMatch[1] : `${Date.now()}-${Math.random()}`;

        const price = parseVnPrice(priceRaw);
        const area  = parseArea(areaRaw);

        listings.push({
          id:           `muaban-${extId}`,
          source:       'Muaban',
          title,
          type:         'Nhà ở',
          transaction:  'Bán',
          price,
          priceDisplay: priceRaw,
          area,
          pricePerM2:   area > 0 ? Math.round(price / area) : 0,
          location:     locRaw || province,
          province,
          bedrooms:     null,
          imageUrl:     imgSrc ?? null,
          url:          href.startsWith('http') ? href : `https://muaban.net${href}`,
          postedAt:     null,
          scrapedAt:    new Date().toISOString(),
        });
      });

      okCount++;
      await sleep(1000);
    } catch {
      continue;
    }
  }

  return {
    source: 'muaban', ok: okCount > 0 && listings.length > 0, listings, total: listings.length,
    durationMs: Date.now() - start,
    ...(listings.length === 0 ? { warning: 'Scrape thành công nhưng không parse được listing. Cấu trúc HTML có thể đã thay đổi.' } : {}),
  };
}

// ── In-memory cache (30 min TTL) ─────────────────────────────────────────────

let cachedResults: SourceResult[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 30 * 60 * 1000;

function isCacheValid(): boolean {
  return !!cachedResults && Date.now() - cacheTimestamp < CACHE_TTL_MS;
}

// ── Route factory ─────────────────────────────────────────────────────────────

export function createScraperRoutes(authenticateToken: any) {
  const router      = Router();
  const ADMIN_ROLES = ['ADMIN', 'TEAM_LEAD'];
  const hasScraperApiKey = () => !!process.env.SCRAPERAPI_KEY;

  // GET /api/scraper/status
  router.get('/status', authenticateToken, (_req: Request, res: Response) => {
    const apiReady = hasScraperApiKey();
    res.json({
      sources: [
        { id: 'chotot',     name: 'Chợ Tốt',          status: 'active',                note: 'API công khai — hoạt động tốt',                          listings: '10,000+' },
        { id: 'alonhadat',  name: 'AlonNhaDat',        status: 'active',                note: 'HTML scraping — không có Cloudflare',                    listings: '~20/trang' },
        { id: 'batdongsan', name: 'BatDongSan.com.vn', status: apiReady ? 'active' : 'blocked', note: apiReady ? 'ScraperAPI proxy — CF bypass OK' : 'Cần SCRAPERAPI_KEY', listings: apiReady ? '20-40/trang' : '0' },
        { id: 'muaban',     name: 'Muaban.net',         status: apiReady ? 'active' : 'blocked', note: apiReady ? 'ScraperAPI proxy — CF bypass OK' : 'Cần SCRAPERAPI_KEY', listings: apiReady ? '20-40/trang' : '0' },
      ],
      scraperApiConfigured: apiReady,
      cacheValid:           isCacheValid(),
      cacheAge:             cachedResults ? Math.round((Date.now() - cacheTimestamp) / 1000) : null,
      cacheTtlMin:          30,
    });
  });

  // GET /api/scraper/results
  router.get('/results', authenticateToken, (_req: Request, res: Response) => {
    if (!cachedResults) {
      return res.json({ results: [], scrapedAt: null, totalListings: 0 });
    }
    const all = cachedResults.flatMap(r => r.listings);
    res.json({
      results:       cachedResults.map(r => ({ source: r.source, ok: r.ok, count: r.listings.length, error: r.error, warning: r.warning, durationMs: r.durationMs })),
      listings:      all,
      totalListings: all.length,
      scrapedAt:     new Date(cacheTimestamp).toISOString(),
      cacheAge:      Math.round((Date.now() - cacheTimestamp) / 1000),
    });
  });

  // POST /api/scraper/run
  router.post('/run', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!ADMIN_ROLES.includes(user.role)) {
        return res.status(403).json({ error: 'Chỉ Admin/Team Lead mới có thể chạy scraper' });
      }

      const { sources = ['chotot', 'alonhadat'], pages = 3 } = req.body as { sources?: string[]; pages?: number };
      const maxPages = Math.min(Number(pages) || 3, 10);
      const results: SourceResult[] = [];

      if (sources.includes('chotot'))     results.push(await scrapeChotot(maxPages));
      if (sources.includes('alonhadat'))  results.push(await scrapeAlonNhaDat(Math.min(maxPages, 5)));
      if (sources.includes('batdongsan')) results.push(await scrapeBatDongSan(Math.min(maxPages, 3)));
      if (sources.includes('muaban'))     results.push(await scrapeMuaban(Math.min(maxPages, 3)));

      cachedResults  = results;
      cacheTimestamp = Date.now();

      const all = results.flatMap(r => r.listings);
      res.json({
        ok:            true,
        results:       results.map(r => ({ source: r.source, ok: r.ok, count: r.listings.length, error: r.error, warning: r.warning, durationMs: r.durationMs })),
        listings:      all,
        totalListings: all.length,
        scrapedAt:     new Date().toISOString(),
      });
    } catch (err) {
      res.status(500).json({ error: 'Scrape failed', detail: String(err) });
    }
  });

  return router;
}
