/**
 * scraperProjectRoutes.ts
 * Scraper cho 7 dự án BĐS cụ thể:
 *   1. sgsland.vn         — API nội bộ (JSON, không cần proxy)
 *   2. Vinhomes Green Paradise — ScraperAPI + cheerio
 *   3. Vinhomes Central Park  — ScraperAPI + cheerio
 *   4. SwanBay                — ScraperAPI + cheerio
 *   5. SwanPark               — ScraperAPI + cheerio
 *   6. Phú Mỹ Hưng            — ScraperAPI + cheerio
 *   7. Sala (Đại Quang Minh)  — ScraperAPI + cheerio
 */

import { Router, Request, Response } from 'express';
import * as cheerio from 'cheerio';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProjectUnit {
  id:           string;
  project:      string;
  projectId:    string;
  type:         string;
  block:        string;
  floor:        string;
  area:         number;
  price:        number;
  priceDisplay: string;
  pricePerM2:   number;
  status:       'available' | 'sold' | 'reserved' | 'unknown';
  direction:    string;
  url:          string;
  imageUrl:     string | null;
  scrapedAt:    string;
}

export interface ProjectResult {
  projectId:  string;
  project:    string;
  siteUrl:    string;
  ok:         boolean;
  units:      ProjectUnit[];
  total:      number;
  durationMs: number;
  error?:     string;
  warning?:   string;
}

// ── Project catalog ───────────────────────────────────────────────────────────

export const PROJECT_CATALOG = [
  {
    id:      'sgsland',
    name:    'SGSLand.vn',
    siteUrl: 'https://sgsland.vn',
    note:    'Cổng dữ liệu nội bộ — JSON API trực tiếp',
    color:   'indigo',
    logo:    '🏠',
  },
  {
    id:      'vinhomes-green-paradise',
    name:    'Vinhomes Green Paradise',
    siteUrl: 'https://vinhomesgreensparadise.vinhomes.vn',
    note:    'Dự án Vinhomes — scrape qua ScraperAPI',
    color:   'emerald',
    logo:    '🌿',
  },
  {
    id:      'vinhomes-central-park',
    name:    'Vinhomes Central Park',
    siteUrl: 'https://centralpark.vinhomes.vn',
    note:    'Dự án Vinhomes — scrape qua ScraperAPI',
    color:   'blue',
    logo:    '🌳',
  },
  {
    id:      'swanbay',
    name:    'Swan Bay',
    siteUrl: 'https://swanbay.vn',
    note:    'Đảo thiên nga Đồng Nai — scrape qua ScraperAPI',
    color:   'sky',
    logo:    '🦢',
  },
  {
    id:      'swanpark',
    name:    'Swan Park',
    siteUrl: 'https://swanpark.vn',
    note:    'Swan Park Nhơn Trạch — scrape qua ScraperAPI',
    color:   'cyan',
    logo:    '🌊',
  },
  {
    id:      'phu-my-hung',
    name:    'Phú Mỹ Hưng',
    siteUrl: 'https://phumyhung.vn',
    note:    'Khu đô thị Phú Mỹ Hưng Quận 7 — scrape qua ScraperAPI',
    color:   'amber',
    logo:    '🏙️',
  },
  {
    id:      'sala',
    name:    'Sala Đại Quang Minh',
    siteUrl: 'https://daikimgroup.vn/du-an/sala-dai-quang-minh',
    note:    'Sala Thủ Thiêm — scrape qua ScraperAPI',
    color:   'rose',
    logo:    '🏛️',
  },
];

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

function fmtPrice(price: number): string {
  if (!price) return 'Liên hệ';
  if (price >= 1e9) return `${(price / 1e9).toFixed(2)} tỷ`;
  if (price >= 1e6) return `${(price / 1e6).toFixed(0)} triệu`;
  return price.toLocaleString('vi-VN') + ' đ';
}

async function scraperApiFetch(targetUrl: string, render = true) {
  const key = process.env.SCRAPERAPI_KEY;
  if (!key) throw new Error('SCRAPERAPI_KEY chưa được cấu hình');
  const proxyUrl = `http://api.scraperapi.com?api_key=${key}&url=${encodeURIComponent(targetUrl)}&country_code=vn${render ? '&render=true' : ''}`;
  return fetch(proxyUrl, { signal: AbortSignal.timeout(45_000) });
}

// ── 1. SGSLand.vn — own JSON API ──────────────────────────────────────────────

async function scrapeSgsland(): Promise<ProjectResult> {
  const start = Date.now();
  const units: ProjectUnit[] = [];
  const proj  = PROJECT_CATALOG.find(p => p.id === 'sgsland')!;

  try {
    const res  = await fetch('https://sgsland.vn/api/public/listings?page=1&pageSize=100', {
      headers: { 'Accept': 'application/json', 'User-Agent': 'SGSLand-Scraper/1.0' },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as { listings?: any[]; total?: number };
    const raw  = data.listings ?? (Array.isArray(data) ? data : []);

    for (const l of raw) {
      const price = Number(l.price ?? 0);
      const area  = Number(l.area ?? 0);
      units.push({
        id:           `sgsland-${l.id}`,
        project:      proj.name,
        projectId:    proj.id,
        type:         String(l.type ?? l.category ?? 'Bất động sản'),
        block:        String(l.block ?? l.projectCode ?? ''),
        floor:        String(l.floor ?? ''),
        area,
        price,
        priceDisplay: fmtPrice(price),
        pricePerM2:   area > 0 ? Math.round(price / area) : 0,
        status:       l.status === 'AVAILABLE' ? 'available' : l.status === 'SOLD' ? 'sold' : 'unknown',
        direction:    String(l.direction ?? l.attributes?.direction ?? ''),
        url:          `https://sgsland.vn/listing/${l.id}`,
        imageUrl:     Array.isArray(l.images) && l.images[0]
                        ? (l.images[0].startsWith('http') ? l.images[0] : `https://sgsland.vn${l.images[0]}`)
                        : null,
        scrapedAt:    new Date().toISOString(),
      });
    }
    return { projectId: proj.id, project: proj.name, siteUrl: proj.siteUrl, ok: true, units, total: units.length, durationMs: Date.now() - start };
  } catch (err) {
    return { projectId: proj.id, project: proj.name, siteUrl: proj.siteUrl, ok: false, units, total: 0, durationMs: Date.now() - start, error: String(err) };
  }
}

// ── Generic HTML scraper (shared by all CF-protected developer sites) ─────────

interface HtmlScraperConfig {
  projectId:    string;
  urls:         { url: string; type?: string }[];
  selectors: {
    card:       string;
    title?:     string;
    type?:      string;
    price?:     string;
    area?:      string;
    block?:     string;
    floor?:     string;
    status?:    string;
    link?:      string;
    image?:     string;
    direction?: string;
  };
  baseUrl:      string;
}

async function scrapeHtmlProject(cfg: HtmlScraperConfig): Promise<ProjectResult> {
  const start  = Date.now();
  const units: ProjectUnit[] = [];
  const proj   = PROJECT_CATALOG.find(p => p.id === cfg.projectId)!;
  let   ok     = false;

  if (!process.env.SCRAPERAPI_KEY) {
    return {
      projectId: proj.id, project: proj.name, siteUrl: proj.siteUrl,
      ok: false, units, total: 0, durationMs: Date.now() - start,
      error: 'SCRAPERAPI_KEY chưa được cấu hình',
    };
  }

  for (const { url, type: urlType } of cfg.urls) {
    try {
      const res  = await scraperApiFetch(url, true);
      if (!res.ok) continue;
      const html = await res.text();
      if (html.includes('Just a moment') || html.includes('cf_chl_opt')) {
        continue; // CF still blocking
      }
      const $ = cheerio.load(html);
      const cards = $(cfg.selectors.card);

      cards.each((_, el) => {
        const $el = $(el);
        const getText = (sel?: string) => sel ? $el.find(sel).first().text().trim() : '';
        const getAttr = (sel: string, attr: string) => $el.find(sel).first().attr(attr) ?? '';

        const titleText = getText(cfg.selectors.title) || $el.find('h2,h3,h4').first().text().trim();
        if (!titleText) return;

        const priceRaw = getText(cfg.selectors.price);
        const areaRaw  = getText(cfg.selectors.area);
        const blockTxt = getText(cfg.selectors.block);
        const floorTxt = getText(cfg.selectors.floor);
        const dirTxt   = getText(cfg.selectors.direction);
        const statusTxt= getText(cfg.selectors.status).toLowerCase();
        const href     = cfg.selectors.link
          ? (getAttr(cfg.selectors.link, 'href') || $el.find('a').first().attr('href') || url)
          : ($el.find('a').first().attr('href') || url);
        const imgSrc   = cfg.selectors.image
          ? (getAttr(cfg.selectors.image, 'src') || getAttr(cfg.selectors.image, 'data-src'))
          : ($el.find('img').first().attr('src') || $el.find('img').first().attr('data-src') || '');

        const price = parseVnPrice(priceRaw);
        const area  = parseArea(areaRaw);
        const idKey = `${cfg.projectId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

        const status: ProjectUnit['status'] =
          statusTxt.includes('bán') || statusTxt.includes('sold') ? 'sold'
          : statusTxt.includes('giữ') || statusTxt.includes('hold') || statusTxt.includes('reserved') ? 'reserved'
          : 'available';

        units.push({
          id:           idKey,
          project:      proj.name,
          projectId:    proj.id,
          type:         urlType || getText(cfg.selectors.type) || 'Bất động sản',
          block:        blockTxt,
          floor:        floorTxt,
          area,
          price,
          priceDisplay: price > 0 ? fmtPrice(price) : priceRaw || 'Liên hệ',
          pricePerM2:   area > 0 && price > 0 ? Math.round(price / area) : 0,
          status,
          direction:    dirTxt,
          url:          href.startsWith('http') ? href : (href.startsWith('/') ? `${cfg.baseUrl}${href}` : url),
          imageUrl:     imgSrc ? (imgSrc.startsWith('http') ? imgSrc : `${cfg.baseUrl}${imgSrc}`) : null,
          scrapedAt:    new Date().toISOString(),
        });
      });

      if (units.length > 0) ok = true;
      await sleep(1200);
    } catch { continue; }
  }

  const warning = !ok && units.length === 0
    ? 'Không parse được dữ liệu. Trang có thể cần cấu trúc selector khác hoặc đòi hỏi tương tác JS.'
    : undefined;

  return {
    projectId: proj.id, project: proj.name, siteUrl: proj.siteUrl,
    ok: ok || units.length > 0, units, total: units.length,
    durationMs: Date.now() - start,
    ...(warning ? { warning } : {}),
  };
}

// ── 2. Vinhomes Green Paradise ────────────────────────────────────────────────

async function scrapeVinhomesGreenParadise(): Promise<ProjectResult> {
  return scrapeHtmlProject({
    projectId: 'vinhomes-green-paradise',
    baseUrl:   'https://vinhomesgreensparadise.vinhomes.vn',
    urls: [
      { url: 'https://vinhomesgreensparadise.vinhomes.vn/can-ho', type: 'Căn hộ' },
      { url: 'https://vinhomesgreensparadise.vinhomes.vn/nha-pho', type: 'Nhà phố' },
    ],
    selectors: {
      card:      '.product-item, .apartment-item, [class*="product-item"], [class*="apartment"], .item-product',
      title:     '.product-title, .apartment-name, h3, h4, [class*="title"]',
      price:     '.product-price, .price, [class*="price"]',
      area:      '.product-area, .area, [class*="area"], [class*="dien-tich"]',
      block:     '[class*="block"], [class*="toa"]',
      floor:     '[class*="floor"], [class*="tang"]',
      status:    '[class*="status"], [class*="trang-thai"]',
      link:      'a',
      image:     'img',
    },
  });
}

// ── 3. Vinhomes Central Park ──────────────────────────────────────────────────

async function scrapeVinhomesCentralPark(): Promise<ProjectResult> {
  return scrapeHtmlProject({
    projectId: 'vinhomes-central-park',
    baseUrl:   'https://centralpark.vinhomes.vn',
    urls: [
      { url: 'https://centralpark.vinhomes.vn/can-ho-central-park', type: 'Căn hộ' },
      { url: 'https://centralpark.vinhomes.vn/biet-thu-central-park', type: 'Biệt thự' },
    ],
    selectors: {
      card:      '.product-item, .apartment-item, [class*="product-item"], [class*="apartment"]',
      title:     '.product-title, h3, h4, [class*="title"]',
      price:     '.price, [class*="price"]',
      area:      '[class*="area"], [class*="dien-tich"]',
      block:     '[class*="block"], [class*="toa"]',
      floor:     '[class*="floor"], [class*="tang"]',
      status:    '[class*="status"]',
      link:      'a',
      image:     'img',
    },
  });
}

// ── 4. SwanBay ────────────────────────────────────────────────────────────────

async function scrapeSwanBay(): Promise<ProjectResult> {
  return scrapeHtmlProject({
    projectId: 'swanbay',
    baseUrl:   'https://swanbay.vn',
    urls: [
      { url: 'https://swanbay.vn/du-an', type: 'Bất động sản' },
      { url: 'https://swanbay.vn/san-pham', type: 'Bất động sản' },
    ],
    selectors: {
      card:      '.product-item, .project-item, [class*="product-item"], [class*="project-item"], article',
      title:     'h2, h3, .title, [class*="title"]',
      price:     '[class*="price"], .price',
      area:      '[class*="area"], [class*="dien-tich"]',
      block:     '[class*="block"]',
      floor:     '[class*="floor"]',
      status:    '[class*="status"]',
      link:      'a',
      image:     'img',
    },
  });
}

// ── 5. SwanPark ───────────────────────────────────────────────────────────────

async function scrapeSwanPark(): Promise<ProjectResult> {
  return scrapeHtmlProject({
    projectId: 'swanpark',
    baseUrl:   'https://swanpark.vn',
    urls: [
      { url: 'https://swanpark.vn/du-an', type: 'Bất động sản' },
      { url: 'https://swanpark.vn/san-pham', type: 'Bất động sản' },
    ],
    selectors: {
      card:      '.product-item, [class*="product"], article, .item',
      title:     'h2, h3, [class*="title"]',
      price:     '[class*="price"]',
      area:      '[class*="area"]',
      block:     '[class*="block"]',
      floor:     '[class*="floor"]',
      status:    '[class*="status"]',
      link:      'a',
      image:     'img',
    },
  });
}

// ── 6. Phú Mỹ Hưng ───────────────────────────────────────────────────────────

async function scrapePhuMyHung(): Promise<ProjectResult> {
  return scrapeHtmlProject({
    projectId: 'phu-my-hung',
    baseUrl:   'https://phumyhung.vn',
    urls: [
      { url: 'https://phumyhung.vn/bds/can-ho-cho-ban', type: 'Căn hộ' },
      { url: 'https://phumyhung.vn/bds/nha-cho-ban', type: 'Nhà' },
      { url: 'https://phumyhung.vn/bds/dat-cho-ban', type: 'Đất' },
    ],
    selectors: {
      card:      '.property-item, .product-item, [class*="property-item"], article',
      title:     '.property-title, h3, h2, [class*="title"]',
      price:     '.price, [class*="price"]',
      area:      '.area, [class*="area"], [class*="dien-tich"]',
      block:     '[class*="block"], [class*="du-an"]',
      floor:     '[class*="floor"]',
      status:    '[class*="status"]',
      link:      'a',
      image:     'img',
    },
  });
}

// ── 7. Sala Đại Quang Minh ───────────────────────────────────────────────────

async function scrapeSala(): Promise<ProjectResult> {
  return scrapeHtmlProject({
    projectId: 'sala',
    baseUrl:   'https://daikimgroup.vn',
    urls: [
      { url: 'https://daikimgroup.vn/du-an/sala-dai-quang-minh', type: 'Căn hộ / Nhà phố' },
    ],
    selectors: {
      card:      '.product-item, .project-item, [class*="product"], article, .item',
      title:     'h2, h3, [class*="title"], [class*="name"]',
      price:     '[class*="price"]',
      area:      '[class*="area"]',
      block:     '[class*="block"], [class*="toa"]',
      floor:     '[class*="floor"]',
      status:    '[class*="status"]',
      link:      'a',
      image:     'img',
    },
  });
}

// ── Runner map ────────────────────────────────────────────────────────────────

const PROJECT_RUNNERS: Record<string, () => Promise<ProjectResult>> = {
  'sgsland':                  scrapeSgsland,
  'vinhomes-green-paradise':  scrapeVinhomesGreenParadise,
  'vinhomes-central-park':    scrapeVinhomesCentralPark,
  'swanbay':                  scrapeSwanBay,
  'swanpark':                 scrapeSwanPark,
  'phu-my-hung':              scrapePhuMyHung,
  'sala':                     scrapeSala,
};

// ── In-memory cache (60 min TTL) ──────────────────────────────────────────────

let cachedResults: ProjectResult[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60 * 60 * 1000;

function isCacheValid() {
  return !!cachedResults && Date.now() - cacheTimestamp < CACHE_TTL_MS;
}

// ── Route factory ─────────────────────────────────────────────────────────────

export function createScraperProjectRoutes(authenticateToken: any) {
  const router      = Router();
  const ADMIN_ROLES = ['ADMIN', 'TEAM_LEAD'];

  // GET /api/scraper/projects/catalog — list all projects
  router.get('/catalog', authenticateToken, (_req: Request, res: Response) => {
    const hasKey = !!process.env.SCRAPERAPI_KEY;
    res.json({
      projects: PROJECT_CATALOG.map(p => ({
        ...p,
        apiReady: p.id === 'sgsland' ? true : hasKey,
        note:     p.id === 'sgsland'
          ? 'API nội bộ — luôn sẵn sàng'
          : hasKey ? p.note : 'Cần SCRAPERAPI_KEY để scrape',
      })),
      cacheValid:  isCacheValid(),
      cacheAge:    cachedResults ? Math.round((Date.now() - cacheTimestamp) / 1000) : null,
      cacheTtlMin: 60,
    });
  });

  // GET /api/scraper/projects/results — return cached results
  router.get('/results', authenticateToken, (_req: Request, res: Response) => {
    if (!cachedResults) {
      return res.json({ results: [], units: [], totalUnits: 0, scrapedAt: null });
    }
    const allUnits = cachedResults.flatMap(r => r.units);
    res.json({
      results:    cachedResults.map(r => ({
        projectId: r.projectId, project: r.project, siteUrl: r.siteUrl,
        ok: r.ok, count: r.units.length, error: r.error, warning: r.warning, durationMs: r.durationMs,
      })),
      units:      allUnits,
      totalUnits: allUnits.length,
      scrapedAt:  new Date(cacheTimestamp).toISOString(),
      cacheAge:   Math.round((Date.now() - cacheTimestamp) / 1000),
    });
  });

  // POST /api/scraper/projects/run — run project scrapers
  router.post('/run', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!ADMIN_ROLES.includes(user.role)) {
        return res.status(403).json({ error: 'Chỉ Admin/Team Lead mới có thể chạy scraper' });
      }

      const { projects = Object.keys(PROJECT_RUNNERS) } = req.body as { projects?: string[] };
      const validProjects = projects.filter(p => PROJECT_RUNNERS[p]);

      const results = await Promise.allSettled(
        validProjects.map(id => PROJECT_RUNNERS[id]())
      );

      const settled: ProjectResult[] = results.map((r, i) => {
        if (r.status === 'fulfilled') return r.value;
        const proj = PROJECT_CATALOG.find(p => p.id === validProjects[i])!;
        return {
          projectId: proj.id, project: proj.name, siteUrl: proj.siteUrl,
          ok: false, units: [], total: 0, durationMs: 0,
          error: String((r as PromiseRejectedResult).reason),
        };
      });

      cachedResults  = settled;
      cacheTimestamp = Date.now();

      const allUnits = settled.flatMap(r => r.units);
      res.json({
        ok:         true,
        results:    settled.map(r => ({
          projectId: r.projectId, project: r.project, siteUrl: r.siteUrl,
          ok: r.ok, count: r.units.length, error: r.error, warning: r.warning, durationMs: r.durationMs,
        })),
        units:      allUnits,
        totalUnits: allUnits.length,
        scrapedAt:  new Date().toISOString(),
      });
    } catch (err) {
      res.status(500).json({ error: 'Scrape thất bại', detail: String(err) });
    }
  });

  return router;
}
