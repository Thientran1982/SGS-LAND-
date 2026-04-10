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
import { pool, withTenantContext } from '../db';

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
    logo:    'SGS',
  },
  {
    id:      'vinhomes-green-paradise',
    name:    'Vinhomes Green Paradise',
    siteUrl: 'https://vinhomesgreensparadise.vinhomes.vn',
    note:    'Dự án Vinhomes tại Bắc Hà Nội',
    color:   'emerald',
    logo:    'VGP',
  },
  {
    id:      'vinhomes-central-park',
    name:    'Vinhomes Central Park',
    siteUrl: 'https://centralpark.vinhomes.vn',
    note:    'Dự án Vinhomes tại Bình Thạnh, TP.HCM',
    color:   'blue',
    logo:    'VCP',
  },
  {
    id:      'swanbay',
    name:    'Swan Bay',
    siteUrl: 'https://swanbay.vn',
    note:    'Đảo thiên nga Đồng Nai — scrape qua ScraperAPI',
    color:   'sky',
    logo:    'SWB',
  },
  {
    id:      'swanpark',
    name:    'Swan Park',
    siteUrl: 'https://swanpark.vn',
    note:    'Swan Park Nhơn Trạch — scrape qua ScraperAPI',
    color:   'cyan',
    logo:    'SWP',
  },
  {
    id:      'phu-my-hung',
    name:    'Phú Mỹ Hưng',
    siteUrl: 'https://phumyhung.vn',
    note:    'Khu đô thị Phú Mỹ Hưng Quận 7',
    color:   'amber',
    logo:    'PMH',
  },
  {
    id:      'sala',
    name:    'Sala Đại Quang Minh',
    siteUrl: 'https://daikimgroup.vn/du-an/sala-dai-quang-minh',
    note:    'Sala Thủ Thiêm, Quận 2',
    color:   'rose',
    logo:    'SAL',
  },
  // ── 10 dự án bổ sung ──────────────────────────────────────────────────────
  {
    id:      'aqua-city',
    name:    'Aqua City',
    siteUrl: 'https://aquacity.com.vn',
    note:    'Novaland — Đồng Nai',
    color:   'teal',
    logo:    'AQC',
  },
  {
    id:      'izumi',
    name:    'Izumi City',
    siteUrl: 'https://izumicity.com.vn',
    note:    'Nam Long — Bình Dương / Long An',
    color:   'violet',
    logo:    'IZM',
  },
  {
    id:      'global-city',
    name:    'Global City',
    siteUrl: 'https://globalcity.vn',
    note:    'Masterise Homes — Quận 2, TP.HCM',
    color:   'blue',
    logo:    'GLC',
  },
  {
    id:      'masterise',
    name:    'Masterise Homes',
    siteUrl: 'https://masterisehomes.com',
    note:    'Masterise Homes — nhiều dự án TP.HCM',
    color:   'slate',
    logo:    'MAS',
  },
  {
    id:      'gamuda-land',
    name:    'Gamuda Land',
    siteUrl: 'https://gamudacity.com.vn',
    note:    'Gamuda City — Hoàng Mai, Hà Nội & TP.HCM',
    color:   'green',
    logo:    'GAM',
  },
  {
    id:      'sun-land',
    name:    'Sun Land',
    siteUrl: 'https://sungroup.com.vn/bat-dong-san-nha-o',
    note:    'Sun Group — khu dân cư toàn quốc',
    color:   'orange',
    logo:    'SUN',
  },
  {
    id:      'van-phuc-city',
    name:    'Vạn Phúc City',
    siteUrl: 'https://vanphuccity.com.vn',
    note:    'Vạn Phúc City — Thủ Đức, TP.HCM',
    color:   'purple',
    logo:    'VPC',
  },
  {
    id:      'son-kim-land',
    name:    'Sơn Kim Land',
    siteUrl: 'https://sonkimland.com.vn',
    note:    'Sơn Kim Land — TP.HCM & Đà Nẵng',
    color:   'pink',
    logo:    'SKL',
  },
  {
    id:      'bim-land',
    name:    'BIM Land',
    siteUrl: 'https://bimland.com.vn',
    note:    'BIM Land — Hà Nội, Quảng Ninh, Phú Quốc',
    color:   'lime',
    logo:    'BIM',
  },
  {
    id:      'vinacapital',
    name:    'VinaCapital',
    siteUrl: 'https://vinacapital.com/vi/real-estate',
    note:    'VinaCapital RE — resort & đô thị cao cấp',
    color:   'yellow',
    logo:    'VNC',
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

// ── Scraper functions for 10 new projects (generic HTML) ─────────────────────

const GENERIC_SELECTORS = {
  card:   '.product-item, [class*="product-item"], .project-item, article, .item',
  title:  'h2, h3, h4, [class*="title"], [class*="name"]',
  price:  '[class*="price"]',
  area:   '[class*="area"], [class*="dien-tich"]',
  block:  '[class*="block"], [class*="toa"]',
  floor:  '[class*="floor"], [class*="tang"]',
  status: '[class*="status"], [class*="trang-thai"]',
  link:   'a',
  image:  'img',
};

function makeGenericScraper(id: string, urls: { url: string; type?: string }[]) {
  const proj = PROJECT_CATALOG.find(p => p.id === id)!;
  return () => scrapeHtmlProject({
    projectId: id, baseUrl: new URL(proj.siteUrl).origin, urls,
    selectors: GENERIC_SELECTORS,
  });
}

const EXTRA_RUNNERS: Record<string, () => Promise<ProjectResult>> = {
  'aqua-city':   makeGenericScraper('aqua-city', [
    { url: 'https://aquacity.com.vn/du-an', type: 'Bất động sản' },
    { url: 'https://aquacity.com.vn/san-pham', type: 'Bất động sản' },
  ]),
  'izumi':       makeGenericScraper('izumi', [
    { url: 'https://izumicity.com.vn/du-an', type: 'Bất động sản' },
    { url: 'https://izumicity.com.vn/san-pham', type: 'Căn hộ' },
  ]),
  'global-city': makeGenericScraper('global-city', [
    { url: 'https://globalcity.vn/du-an', type: 'Bất động sản' },
    { url: 'https://globalcity.vn/can-ho', type: 'Căn hộ' },
  ]),
  'masterise':   makeGenericScraper('masterise', [
    { url: 'https://masterisehomes.com/du-an', type: 'Bất động sản' },
    { url: 'https://masterisehomes.com/can-ho', type: 'Căn hộ' },
  ]),
  'gamuda-land': makeGenericScraper('gamuda-land', [
    { url: 'https://gamudacity.com.vn/can-ho', type: 'Căn hộ' },
    { url: 'https://gamudacity.com.vn/biet-thu', type: 'Biệt thự' },
  ]),
  'sun-land':    makeGenericScraper('sun-land', [
    { url: 'https://sungroup.com.vn/bat-dong-san-nha-o', type: 'Bất động sản' },
  ]),
  'van-phuc-city': makeGenericScraper('van-phuc-city', [
    { url: 'https://vanphuccity.com.vn/du-an', type: 'Bất động sản' },
    { url: 'https://vanphuccity.com.vn/can-ho', type: 'Căn hộ' },
  ]),
  'son-kim-land': makeGenericScraper('son-kim-land', [
    { url: 'https://sonkimland.com.vn/du-an', type: 'Bất động sản' },
    { url: 'https://sonkimland.com.vn/san-pham', type: 'Bất động sản' },
  ]),
  'bim-land':    makeGenericScraper('bim-land', [
    { url: 'https://bimland.com.vn/du-an', type: 'Bất động sản' },
    { url: 'https://bimland.com.vn/san-pham', type: 'Bất động sản' },
  ]),
  'vinacapital': makeGenericScraper('vinacapital', [
    { url: 'https://vinacapital.com/vi/real-estate', type: 'Bất động sản' },
  ]),
};

const PROJECT_RUNNERS: Record<string, () => Promise<ProjectResult>> = {
  'sgsland':                  scrapeSgsland,
  'vinhomes-green-paradise':  scrapeVinhomesGreenParadise,
  'vinhomes-central-park':    scrapeVinhomesCentralPark,
  'swanbay':                  scrapeSwanBay,
  'swanpark':                 scrapeSwanPark,
  'phu-my-hung':              scrapePhuMyHung,
  'sala':                     scrapeSala,
  ...EXTRA_RUNNERS,
};

// ── Lead types ────────────────────────────────────────────────────────────────

export interface ProjectLead {
  id:          string;
  projectId:   string;
  project:     string;
  name:        string;
  phone:       string;
  email:       string;
  source:      string;   // 'sgsland_db' | 'batdongsan' | 'muaban' | 'website'
  sourceUrl:   string;
  listing:     string;   // listing title if from classifieds
  price:       string;
  interest:    'seller' | 'buyer' | 'renter' | 'investor' | 'unknown';
  notes:       string;
  scrapedAt:   string;
  importedAt:  string | null;
}

export interface LeadScrapeResult {
  projectId:  string;
  project:    string;
  ok:         boolean;
  leads:      ProjectLead[];
  total:      number;
  durationMs: number;
  error?:     string;
}

// ── Phone + email extractors ──────────────────────────────────────────────────

const VN_PHONE_RE  = /(?:(?:\+84|84|0)(?:3[2-9]|5[6-9]|7[06-9]|8[0-9]|9[0-9])\d{7})/g;
const EMAIL_RE     = /[\w.+%-]{2,}@[\w-]+\.[a-z]{2,}/gi;
const FAKE_PHONES  = new Set(['0000000000', '1234567890', '0123456789']);

function normalizePhone(raw: string): string {
  const s = raw.replace(/\D/g, '');
  if (s.startsWith('84') && s.length === 11) return '0' + s.slice(2);
  return s.startsWith('0') ? s : '0' + s;
}

function extractPhones(text: string): string[] {
  const seen = new Set<string>();
  return (text.match(VN_PHONE_RE) ?? [])
    .map(m => normalizePhone(m))
    .filter(p => {
      if (p.length !== 10 || FAKE_PHONES.has(p) || seen.has(p)) return false;
      seen.add(p); return true;
    });
}

function extractEmails(text: string): string[] {
  const seen = new Set<string>();
  const BAD  = ['example.com', 'domain.com', 'email.com', 'test.com', 'sentry.io'];
  return (text.match(EMAIL_RE) ?? [])
    .map(m => m.toLowerCase())
    .filter(e => {
      if (seen.has(e) || BAD.some(b => e.endsWith(b))) return false;
      seen.add(e); return true;
    });
}

// ── Project search keyword map ────────────────────────────────────────────────

const PROJECT_KEYWORDS: Record<string, string[]> = {
  'sgsland':                 ['sgsland', 'SGS Land'],
  'vinhomes-green-paradise': ['Vinhomes Green Paradise', 'Green Paradise Vinhomes'],
  'vinhomes-central-park':   ['Vinhomes Central Park', 'Central Park Vinhomes'],
  'swanbay':                 ['Swan Bay', 'SwanBay', 'Đảo thiên nga'],
  'swanpark':                ['Swan Park', 'SwanPark', 'Nhơn Trạch'],
  'phu-my-hung':             ['Phú Mỹ Hưng', 'Phu My Hung', 'PMH'],
  'sala':                    ['Sala Đại Quang Minh', 'Sala DQM', 'Sala Thủ Thiêm'],
  'aqua-city':               ['Aqua City', 'Aqua City Novaland', 'Đồng Nai Novaland'],
  'izumi':                   ['Izumi City', 'Nam Long Izumi', 'Izumi Nam Long'],
  'global-city':             ['Global City', 'Global City Masterise', 'Masterise Quận 2'],
  'masterise':               ['Masterise Homes', 'Masterise', 'Masteri'],
  'gamuda-land':             ['Gamuda Land', 'Gamuda City', 'Gamuda Hoàng Mai'],
  'sun-land':                ['Sun Land', 'Sun Group bất động sản', 'Sun Property'],
  'van-phuc-city':           ['Vạn Phúc City', 'Van Phuc City', 'Khu đô thị Vạn Phúc'],
  'son-kim-land':            ['Sơn Kim Land', 'Son Kim Land', 'The Standard SKL'],
  'bim-land':                ['BIM Land', 'BIM Group', 'BIM Property'],
  'vinacapital':             ['VinaCapital', 'Vina Capital', 'VinaCapital Real Estate'],
};

// ── Lead scraper: sgsland.vn internal DB ─────────────────────────────────────

async function scrapeSgslandLeads(): Promise<LeadScrapeResult> {
  const start  = Date.now();
  const leads: ProjectLead[] = [];
  const proj   = PROJECT_CATALOG.find(p => p.id === 'sgsland')!;

  try {
    const DEFAULT_TENANT = '00000000-0000-0000-0000-000000000001';
    const { rows } = await pool.query(
      `SELECT id, name, COALESCE(phone,'') AS phone, COALESCE(email,'') AS email,
              COALESCE(source,'DIRECT') AS source, COALESCE(stage,'NEW') AS stage,
              COALESCE(notes,'') AS notes, created_at
         FROM leads
        WHERE tenant_id = $1
          AND phone IS NOT NULL AND phone <> ''
        ORDER BY created_at DESC
        LIMIT 200`,
      [DEFAULT_TENANT]
    );

    for (const r of rows) {
      leads.push({
        id:         `sgsland-db-${r.id}`,
        projectId:  proj.id,
        project:    proj.name,
        name:       r.name ?? '',
        phone:      r.phone,
        email:      r.email,
        source:     'sgsland_db',
        sourceUrl:  'https://sgsland.vn',
        listing:    '',
        price:      '',
        interest:   'unknown',
        notes:      r.notes ?? '',
        scrapedAt:  new Date().toISOString(),
        importedAt: null,
      });
    }
    return { projectId: proj.id, project: proj.name, ok: true, leads, total: leads.length, durationMs: Date.now() - start };
  } catch (err) {
    return { projectId: proj.id, project: proj.name, ok: false, leads, total: 0, durationMs: Date.now() - start, error: String(err) };
  }
}

// ── Shared lead builder ───────────────────────────────────────────────────────

interface LeadCandidate {
  name:     string;
  phone:    string;
  email:    string;
  source:   string;
  url:      string;
  title:    string;
  price:    string;
  interest: ProjectLead['interest'];
  notes:    string;
}

function buildLead(projectId: string, proj: typeof PROJECT_CATALOG[0], c: LeadCandidate, suffix: string): ProjectLead {
  return {
    id:         `${projectId}-${c.source}-${suffix}`,
    projectId:  proj.id,
    project:    proj.name,
    name:       c.name || 'Không rõ',
    phone:      c.phone,
    email:      c.email,
    source:     c.source,
    sourceUrl:  c.url,
    listing:    c.title,
    price:      c.price,
    interest:   c.interest,
    notes:      c.notes,
    scrapedAt:  new Date().toISOString(),
    importedAt: null,
  };
}

// ── Generic page scraper — returns cards with contact data ────────────────────

interface SrcDef {
  label:    string;
  url:      string;
  interest: ProjectLead['interest'];
  card:     string;
  title:    string;
  price:    string;
  name:     string;
  link:     string;
}

async function scrapeOneSrc(
  src: SrcDef,
  proj: typeof PROJECT_CATALOG[0],
  seenPhone: Set<string>,
  seenEmail: Set<string>,
): Promise<ProjectLead[]> {
  const out: ProjectLead[] = [];
  try {
    const res  = await scraperApiFetch(src.url, true);
    if (!res.ok) return out;
    const html = await res.text();
    if (html.includes('Just a moment') || html.includes('cf_chl_opt') || html.length < 1000) return out;

    const $ = cheerio.load(html);

    // ── Structured card extraction ─────────────────────────────────────────
    $(src.card).slice(0, 40).each((_, el) => {
      const $el = $(el);
      const elHtml  = $el.html() ?? '';
      const elText  = $el.text();
      const titleTx = $el.find(src.title).first().text().trim() || $el.find('h2,h3,h4').first().text().trim();
      if (!titleTx) return;

      const priceTx = $el.find(src.price).first().text().trim();
      const nameTx  = $el.find(src.name).first().text().trim().slice(0, 80);
      const href    = $el.find(src.link).first().attr('href') ?? $el.find('a').first().attr('href') ?? '';
      const fullUrl = href.startsWith('http') ? href
        : href.startsWith('/') ? `https://${new URL(src.url).host}${href}`
        : src.url;

      // Phone: data attributes first, then text
      const dataPhone = $el.find('[data-phone]').attr('data-phone')
                     ?? $el.find('[data-contact-phone]').attr('data-contact-phone')
                     ?? $el.find('[data-original-phone]').attr('data-original-phone')
                     ?? $el.find('[data-sdt]').attr('data-sdt')
                     ?? '';

      const phones = dataPhone
        ? [normalizePhone(dataPhone)].filter(p => p.length === 10)
        : extractPhones(elHtml + ' ' + elText);

      const emails = extractEmails(elHtml + ' ' + elText);

      for (const phone of phones.slice(0, 2)) {
        if (seenPhone.has(phone)) continue;
        seenPhone.add(phone);
        const email = emails.find(e => !seenEmail.has(e)) ?? '';
        if (email) seenEmail.add(email);
        out.push(buildLead(proj.id, proj, {
          name:     nameTx,
          phone,
          email,
          source:   src.label,
          url:      fullUrl,
          title:    titleTx,
          price:    priceTx,
          interest: src.interest,
          notes:    `[${src.label.toUpperCase()}] ${titleTx}${priceTx ? ' · ' + priceTx : ''}`,
        }, phone));
      }

      // Contacts with email but no phone
      for (const email of emails.slice(0, 2)) {
        if (seenEmail.has(email)) continue;
        seenEmail.add(email);
        out.push(buildLead(proj.id, proj, {
          name: nameTx, phone: '', email,
          source: src.label, url: fullUrl, title: titleTx,
          price: priceTx, interest: src.interest,
          notes: `[${src.label.toUpperCase()}] Email: ${email} — ${titleTx}`,
        }, email.replace(/[@.]/g, '_')));
      }
    });

    // ── Fallback: raw regex over full page ─────────────────────────────────
    if (out.length < 3) {
      for (const phone of extractPhones(html).slice(0, 15)) {
        if (seenPhone.has(phone)) continue;
        seenPhone.add(phone);
        out.push(buildLead(proj.id, proj, {
          name: '', phone, email: '', source: src.label,
          url: src.url, title: '', price: '',
          interest: src.interest,
          notes: `SĐT trích xuất từ ${src.label}`,
        }, `raw-${phone}`));
      }
      for (const email of extractEmails(html).slice(0, 10)) {
        if (seenEmail.has(email)) continue;
        seenEmail.add(email);
        out.push(buildLead(proj.id, proj, {
          name: '', phone: '', email, source: src.label,
          url: src.url, title: '', price: '',
          interest: src.interest,
          notes: `Email trích xuất từ ${src.label}`,
        }, `raw-${email.replace(/[@.]/g, '_')}`));
      }
    }
  } catch { /* skip source on error */ }
  return out;
}

// ── Lead scraper: 8 classifieds + portal sources ──────────────────────────────

async function scrapeClassifiedLeads(projectId: string): Promise<LeadScrapeResult> {
  const start = Date.now();
  const proj  = PROJECT_CATALOG.find(p => p.id === projectId);
  if (!proj) return { projectId, project: projectId, ok: false, leads: [], total: 0, durationMs: 0, error: 'Project not found' };

  if (!process.env.SCRAPERAPI_KEY) {
    return { projectId: proj.id, project: proj.name, ok: false, leads: [], total: 0, durationMs: Date.now() - start, error: 'SCRAPERAPI_KEY chưa được cấu hình' };
  }

  const keywords  = PROJECT_KEYWORDS[projectId] ?? [proj.name];
  const kw        = encodeURIComponent(keywords[0]);
  const kwShort   = encodeURIComponent((keywords[1] ?? keywords[0]).split(' ').slice(0, 3).join(' '));

  const SOURCES: SrcDef[] = [
    // ── BatDongSan — bán ────────────────────────────────────────────────────
    {
      label: 'batdongsan', interest: 'seller',
      url:   `https://batdongsan.com.vn/ban-can-ho-chung-cu?keyword=${kw}`,
      card:  '.re__card-full, [data-product-id]',
      title: '.re__card-info-title, h3',
      price: '.re__card-config-price',
      name:  '.re__card-info-agent-name, [class*="agent-name"]',
      link:  'a.re__card-info-title',
    },
    // ── BatDongSan — cần mua / thuê ─────────────────────────────────────────
    {
      label: 'batdongsan', interest: 'buyer',
      url:   `https://batdongsan.com.vn/can-mua-thue?keyword=${kw}`,
      card:  '.re__card-full, [data-product-id]',
      title: '.re__card-info-title, h3',
      price: '.re__card-config-price',
      name:  '.re__card-info-agent-name',
      link:  'a.re__card-info-title',
    },
    // ── Muaban.net ───────────────────────────────────────────────────────────
    {
      label: 'muaban', interest: 'seller',
      url:   `https://muaban.net/bat-dong-san?q=${kw}`,
      card:  '.listing-item, [class*="item-listing"], article.item',
      title: 'h2,h3,[class*="title"]',
      price: '[class*="price"]',
      name:  '[class*="seller"],[class*="contact"],[class*="user"]',
      link:  'a',
    },
    // ── Homedy.com — bán ─────────────────────────────────────────────────────
    {
      label: 'homedy', interest: 'seller',
      url:   `https://homedy.com/ban-can-ho-chung-cu?keyword=${kw}`,
      card:  '.product-item, [class*="product-item"], .item-product',
      title: '.product-title, h3,[class*="title"]',
      price: '.product-price,[class*="price"]',
      name:  '[class*="agent"],[class*="contact"],[class*="user"]',
      link:  'a.product-title, a',
    },
    // ── Homedy.com — hỏi đáp / quan tâm dự án ────────────────────────────────
    {
      label: 'homedy_forum', interest: 'buyer',
      url:   `https://homedy.com/hoi-dap?keyword=${kw}`,
      card:  '.question-item, [class*="question"], .forum-item, article',
      title: 'h2,h3,[class*="title"],[class*="question"]',
      price: '[class*="price"]',
      name:  '[class*="author"],[class*="user"],[class*="name"]',
      link:  'a',
    },
    // ── Alonhadat.com.vn ─────────────────────────────────────────────────────
    {
      label: 'alonhadat', interest: 'seller',
      url:   `https://alonhadat.com.vn/tim-kiem.html?text=${kwShort}&chuyen=1`,
      card:  '.content-item, .property-item, [class*="content-item"]',
      title: '.ct-title, h3, [class*="title"]',
      price: '.ct-price, [class*="price"]',
      name:  '.ct-name, [class*="contact"],[class*="agent"]',
      link:  'a.ct-title, a',
    },
    // ── Mogi.vn ──────────────────────────────────────────────────────────────
    {
      label: 'mogi', interest: 'seller',
      url:   `https://mogi.vn/mua-ban/tim-kiem?q=${kw}`,
      card:  '.prop-item, .prop-list-item, [class*="prop-item"]',
      title: '.prop-name, h3,[class*="title"]',
      price: '.prop-price, [class*="price"]',
      name:  '.prop-contact, [class*="contact"],[class*="agent"]',
      link:  'a.prop-name, a',
    },
    // ── NhaTot.com ───────────────────────────────────────────────────────────
    {
      label: 'nhatot', interest: 'seller',
      url:   `https://www.nhatot.com/mua-ban-bat-dong-san?q=${kw}`,
      card:  '[class*="ad-listing"],[class*="AdItem"],[class*="aditem"],article',
      title: '[class*="subject"],[class*="title"],h2,h3',
      price: '[class*="price"]',
      name:  '[class*="account"],[class*="author"],[class*="seller"]',
      link:  'a',
    },
    // ── Cafeland.vn ──────────────────────────────────────────────────────────
    {
      label: 'cafeland', interest: 'investor',
      url:   `https://cafeland.vn/tim-kiem/?s=${kw}`,
      card:  '.item-news, article, [class*="item-news"]',
      title: 'h2,h3,[class*="title"]',
      price: '[class*="price"]',
      name:  '[class*="author"],[class*="contact"]',
      link:  'a',
    },
  ];

  const seenPhone = new Set<string>();
  const seenEmail = new Set<string>();
  const allLeads:  ProjectLead[] = [];

  // Run all sources in parallel (max 4 concurrent to avoid rate limiting)
  const BATCH = 4;
  for (let i = 0; i < SOURCES.length; i += BATCH) {
    const batch  = SOURCES.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map(src => scrapeOneSrc(src, proj, seenPhone, seenEmail))
    );
    for (const r of results) {
      if (r.status === 'fulfilled') allLeads.push(...r.value);
    }
    if (i + BATCH < SOURCES.length) await sleep(1000);
  }

  return {
    projectId: proj.id, project: proj.name,
    ok: allLeads.length > 0, leads: allLeads,
    total: allLeads.length, durationMs: Date.now() - start,
  };
}

// ── Lead scraper: project website agents/contacts ─────────────────────────────

async function scrapeProjectWebsiteLeads(projectId: string): Promise<LeadScrapeResult> {
  const start = Date.now();
  const proj  = PROJECT_CATALOG.find(p => p.id === projectId);
  if (!proj || projectId === 'sgsland') {
    return { projectId: projectId || '', project: proj?.name ?? '', ok: false, leads: [], total: 0, durationMs: 0 };
  }

  if (!process.env.SCRAPERAPI_KEY) {
    return { projectId: proj.id, project: proj.name, ok: false, leads: [], total: 0, durationMs: Date.now() - start, error: 'SCRAPERAPI_KEY chưa được cấu hình' };
  }

  const CONTACT_PATHS: Record<string, string[]> = {
    'vinhomes-green-paradise': [
      'https://vinhomesgreensparadise.vinhomes.vn/lien-he',
      'https://vinhomesgreensparadise.vinhomes.vn/dai-ly',
      'https://vinhomesgreensparadise.vinhomes.vn/tu-van',
    ],
    'vinhomes-central-park': [
      'https://centralpark.vinhomes.vn/lien-he',
      'https://centralpark.vinhomes.vn/dai-ly',
    ],
    'swanbay': [
      'https://swanbay.vn/lien-he',
      'https://swanbay.vn/tu-van',
      'https://swanbay.vn/dai-ly',
    ],
    'swanpark': [
      'https://swanpark.vn/lien-he',
      'https://swanpark.vn/tu-van',
    ],
    'phu-my-hung': [
      'https://phumyhung.vn/lien-he',
      'https://phumyhung.vn/mua-ban/tim-dai-ly',
    ],
    'sala': [
      'https://daikimgroup.vn/lien-he',
      'https://daikimgroup.vn/du-an/sala-dai-quang-minh',
    ],
    'aqua-city': [
      'https://aquacity.com.vn/lien-he',
      'https://aquacity.com.vn/dai-ly',
    ],
    'izumi': [
      'https://izumicity.com.vn/lien-he',
      'https://izumicity.com.vn/dai-ly-phan-phoi',
    ],
    'global-city': [
      'https://globalcity.vn/lien-he',
      'https://globalcity.vn/dai-ly',
    ],
    'masterise': [
      'https://masterisehomes.com/lien-he',
      'https://masterisehomes.com/dai-ly',
    ],
    'gamuda-land': [
      'https://gamudacity.com.vn/lien-he',
      'https://gamudacity.com.vn/dai-ly',
    ],
    'sun-land': [
      'https://sungroup.com.vn/lien-he',
    ],
    'van-phuc-city': [
      'https://vanphuccity.com.vn/lien-he',
      'https://vanphuccity.com.vn/dai-ly',
    ],
    'son-kim-land': [
      'https://sonkimland.com.vn/lien-he',
      'https://sonkimland.com.vn/dai-ly',
    ],
    'bim-land': [
      'https://bimland.com.vn/lien-he',
      'https://bimland.com.vn/dai-ly',
    ],
    'vinacapital': [
      'https://vinacapital.com/vi/lien-he',
      'https://vinacapital.com/vi/real-estate',
    ],
  };

  const urls      = CONTACT_PATHS[projectId] ?? [];
  const leads:    ProjectLead[] = [];
  const seenPhone = new Set<string>();
  const seenEmail = new Set<string>();

  for (const url of urls) {
    try {
      const res  = await scraperApiFetch(url, true);
      if (!res.ok) continue;
      const html = await res.text();
      if (html.includes('Just a moment') || html.length < 500) continue;

      const $     = cheerio.load(html);
      const text  = $.text();

      // Agent/contact cards on project site
      const agentSel = '.agent-item, .broker-item, [class*="agent"], [class*="broker"], [class*="tu-van"], [class*="nhan-vien"], [class*="expert"]';
      $(agentSel).slice(0, 20).each((_, el) => {
        const $el     = $(el);
        const elHtml  = $el.html() ?? '';
        const nameTx  = $el.find('[class*="name"],h3,h4').first().text().trim().slice(0, 80);
        const phones  = extractPhones(elHtml);
        const emails  = extractEmails(elHtml);
        const href    = $el.find('a').first().attr('href') ?? '';
        const fullUrl = href.startsWith('http') ? href : url;

        for (const phone of phones.slice(0, 1)) {
          if (seenPhone.has(phone)) continue;
          seenPhone.add(phone);
          leads.push(buildLead(proj.id, proj, {
            name: nameTx, phone,
            email: emails[0] ?? '',
            source: 'website', url: fullUrl,
            title: `Đại lý / Tư vấn viên tại ${proj.name}`,
            price: '', interest: 'seller',
            notes: `[WEBSITE] Tư vấn viên dự án — ${proj.name} · ${url}`,
          }, phone));
        }
        for (const email of emails.slice(0, 1)) {
          if (seenEmail.has(email)) continue;
          seenEmail.add(email);
          leads.push(buildLead(proj.id, proj, {
            name: nameTx, phone: '', email,
            source: 'website', url: fullUrl,
            title: `Liên hệ tại ${proj.name}`,
            price: '', interest: 'seller',
            notes: `[WEBSITE] Email liên hệ — ${proj.name}`,
          }, email.replace(/[@.]/g, '_')));
        }
      });

      // Fallback: raw extraction from entire contact page
      for (const phone of extractPhones(text + html).slice(0, 10)) {
        if (seenPhone.has(phone)) continue;
        seenPhone.add(phone);
        leads.push(buildLead(proj.id, proj, {
          name: '', phone, email: '', source: 'website', url,
          title: `Liên hệ chính thức — ${proj.name}`,
          price: '', interest: 'seller',
          notes: `[WEBSITE] SĐT trích từ trang chính thức ${proj.name}`,
        }, `site-${phone}`));
      }
      for (const email of extractEmails(text + html).slice(0, 5)) {
        if (seenEmail.has(email)) continue;
        seenEmail.add(email);
        leads.push(buildLead(proj.id, proj, {
          name: '', phone: '', email, source: 'website', url,
          title: `Email liên hệ — ${proj.name}`,
          price: '', interest: 'unknown',
          notes: `[WEBSITE] Email trích từ trang chính thức ${proj.name}`,
        }, `site-${email.replace(/[@.]/g, '_')}`));
      }

      await sleep(1200);
    } catch { continue; }
  }

  return {
    projectId: proj.id, project: proj.name,
    ok: leads.length > 0, leads, total: leads.length,
    durationMs: Date.now() - start,
  };
}

// ── Combined lead scraper for external projects ───────────────────────────────

async function scrapeAllLeadsForProject(projectId: string): Promise<LeadScrapeResult> {
  const [classified, website] = await Promise.allSettled([
    scrapeClassifiedLeads(projectId),
    scrapeProjectWebsiteLeads(projectId),
  ]);

  const r1 = classified.status === 'fulfilled' ? classified.value : null;
  const r2 = website.status    === 'fulfilled' ? website.value    : null;

  const proj = PROJECT_CATALOG.find(p => p.id === projectId)!;
  const allLeads = [...(r1?.leads ?? []), ...(r2?.leads ?? [])];

  return {
    projectId, project: proj?.name ?? projectId,
    ok: allLeads.length > 0,
    leads: allLeads,
    total: allLeads.length,
    durationMs: (r1?.durationMs ?? 0) + (r2?.durationMs ?? 0),
    error: (!r1?.ok && !r2?.ok) ? (r1?.error ?? r2?.error) : undefined,
  };
}

// ── Lead runner map ───────────────────────────────────────────────────────────

const LEAD_RUNNERS: Record<string, () => Promise<LeadScrapeResult>> = {
  'sgsland':                  scrapeSgslandLeads,
  'vinhomes-green-paradise':  () => scrapeAllLeadsForProject('vinhomes-green-paradise'),
  'vinhomes-central-park':    () => scrapeAllLeadsForProject('vinhomes-central-park'),
  'swanbay':                  () => scrapeAllLeadsForProject('swanbay'),
  'swanpark':                 () => scrapeAllLeadsForProject('swanpark'),
  'phu-my-hung':              () => scrapeAllLeadsForProject('phu-my-hung'),
  'sala':                     () => scrapeAllLeadsForProject('sala'),
  'aqua-city':                () => scrapeAllLeadsForProject('aqua-city'),
  'izumi':                    () => scrapeAllLeadsForProject('izumi'),
  'global-city':              () => scrapeAllLeadsForProject('global-city'),
  'masterise':                () => scrapeAllLeadsForProject('masterise'),
  'gamuda-land':              () => scrapeAllLeadsForProject('gamuda-land'),
  'sun-land':                 () => scrapeAllLeadsForProject('sun-land'),
  'van-phuc-city':            () => scrapeAllLeadsForProject('van-phuc-city'),
  'son-kim-land':             () => scrapeAllLeadsForProject('son-kim-land'),
  'bim-land':                 () => scrapeAllLeadsForProject('bim-land'),
  'vinacapital':              () => scrapeAllLeadsForProject('vinacapital'),
};

// ── Lead cache (45 min TTL) ───────────────────────────────────────────────────

let cachedLeads: LeadScrapeResult[] | null  = null;
let leadCacheTs = 0;
const LEAD_CACHE_TTL_MS = 45 * 60 * 1000;

function isLeadCacheValid() {
  return !!cachedLeads && Date.now() - leadCacheTs < LEAD_CACHE_TTL_MS;
}

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

  // GET /api/scraper/projects/leads/results — cached leads
  router.get('/leads/results', authenticateToken, (_req: Request, res: Response) => {
    if (!cachedLeads) {
      return res.json({ results: [], leads: [], totalLeads: 0, scrapedAt: null });
    }
    const allLeads = cachedLeads.flatMap(r => r.leads);
    res.json({
      results:    cachedLeads.map(r => ({
        projectId: r.projectId, project: r.project,
        ok: r.ok, count: r.leads.length, error: r.error, durationMs: r.durationMs,
      })),
      leads:      allLeads,
      totalLeads: allLeads.length,
      scrapedAt:  new Date(leadCacheTs).toISOString(),
      cacheAge:   Math.round((Date.now() - leadCacheTs) / 1000),
    });
  });

  // POST /api/scraper/projects/leads/run — scrape leads
  router.post('/leads/run', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!['ADMIN', 'TEAM_LEAD'].includes(user.role)) {
        return res.status(403).json({ error: 'Chỉ Admin/Team Lead mới có thể chạy scraper' });
      }

      const { projects = Object.keys(LEAD_RUNNERS) } = req.body as { projects?: string[] };
      const validProjects = projects.filter(p => LEAD_RUNNERS[p]);

      const settled = await Promise.allSettled(validProjects.map(id => LEAD_RUNNERS[id]()));
      const results: LeadScrapeResult[] = settled.map((r, i) => {
        if (r.status === 'fulfilled') return r.value;
        const proj = PROJECT_CATALOG.find(p => p.id === validProjects[i])!;
        return { projectId: proj.id, project: proj.name, ok: false, leads: [], total: 0, durationMs: 0, error: String((r as PromiseRejectedResult).reason) };
      });

      cachedLeads  = results;
      leadCacheTs  = Date.now();

      const allLeads = results.flatMap(r => r.leads);
      res.json({
        ok: true,
        results: results.map(r => ({ projectId: r.projectId, project: r.project, ok: r.ok, count: r.leads.length, error: r.error, durationMs: r.durationMs })),
        leads: allLeads,
        totalLeads: allLeads.length,
        scrapedAt: new Date().toISOString(),
      });
    } catch (err) {
      res.status(500).json({ error: 'Lead scrape thất bại', detail: String(err) });
    }
  });

  // POST /api/scraper/projects/leads/import — import one lead into CRM
  router.post('/leads/import', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!['ADMIN', 'TEAM_LEAD', 'SALES'].includes(user.role)) {
        return res.status(403).json({ error: 'Không có quyền import lead' });
      }

      const { name, phone, email, source, notes, projectId, project, sourceUrl, listing, interest } =
        req.body as Partial<ProjectLead>;

      if (!phone) return res.status(400).json({ error: 'Thiếu số điện thoại' });

      const DEFAULT_TENANT = '00000000-0000-0000-0000-000000000001';
      const tenantId       = user.tenantId ?? DEFAULT_TENANT;

      // Dedup check
      const { rows: dup } = await pool.query(
        `SELECT id FROM leads WHERE tenant_id = $1 AND phone = $2 LIMIT 1`,
        [tenantId, phone]
      );
      if (dup.length) {
        return res.status(409).json({ error: 'SĐT đã tồn tại trong CRM', leadId: dup[0].id });
      }

      const notesText = [
        notes,
        listing  ? `Tin đăng: ${listing}` : '',
        sourceUrl? `Nguồn: ${sourceUrl}`  : '',
        project  ? `Dự án: ${project}`    : '',
        interest ? `Phân loại: ${interest === 'seller' ? 'Người bán' : interest === 'buyer' ? 'Người mua' : 'Chưa xác định'}` : '',
      ].filter(Boolean).join('\n').trim();

      const insertSrc = source === 'sgsland_db' ? 'DIRECT'
        : source === 'batdongsan' ? 'WEBSITE'
        : source === 'muaban' ? 'WEBSITE'
        : 'WEBSITE';

      const { rows } = await withTenantContext(tenantId, async (client) =>
        client.query(
          `INSERT INTO leads (tenant_id, name, phone, email, source, stage, notes, attributes)
           VALUES (current_setting('app.current_tenant_id', true)::uuid, $1, $2, $3, $4, 'NEW', $5, $6)
           RETURNING *`,
          [
            name || 'Không rõ',
            phone,
            email || null,
            insertSrc,
            notesText || null,
            JSON.stringify({ projectId, projectName: project, interest, scrapedFrom: sourceUrl }),
          ]
        )
      );

      res.status(201).json({ ok: true, lead: rows[0] });
    } catch (err) {
      res.status(500).json({ error: 'Import thất bại', detail: String(err) });
    }
  });

  // POST /api/scraper/projects/leads/import-bulk — import multiple leads
  router.post('/leads/import-bulk', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!['ADMIN', 'TEAM_LEAD'].includes(user.role)) {
        return res.status(403).json({ error: 'Chỉ Admin/Team Lead mới có thể import hàng loạt' });
      }

      const { leads = [] } = req.body as { leads: Partial<ProjectLead>[] };
      const DEFAULT_TENANT = '00000000-0000-0000-0000-000000000001';
      const tenantId       = user.tenantId ?? DEFAULT_TENANT;

      let imported = 0;
      let skipped  = 0;
      const errors: string[] = [];

      for (const lead of leads.slice(0, 50)) {
        if (!lead.phone) { skipped++; continue; }
        try {
          const { rows: dup } = await pool.query(
            `SELECT id FROM leads WHERE tenant_id = $1 AND phone = $2 LIMIT 1`,
            [tenantId, lead.phone]
          );
          if (dup.length) { skipped++; continue; }

          const notesText = [
            lead.notes,
            lead.listing   ? `Tin đăng: ${lead.listing}`   : '',
            lead.sourceUrl ? `Nguồn: ${lead.sourceUrl}`    : '',
            lead.project   ? `Dự án: ${lead.project}`      : '',
          ].filter(Boolean).join('\n').trim();

          await withTenantContext(tenantId, (client) =>
            client.query(
              `INSERT INTO leads (tenant_id, name, phone, email, source, stage, notes, attributes)
               VALUES (current_setting('app.current_tenant_id', true)::uuid, $1, $2, $3, $4, 'NEW', $5, $6)`,
              [
                lead.name || 'Không rõ', lead.phone, lead.email || null,
                lead.source === 'sgsland_db' ? 'DIRECT' : 'WEBSITE',
                notesText || null,
                JSON.stringify({ projectId: lead.projectId, projectName: lead.project, interest: lead.interest }),
              ]
            )
          );
          imported++;
        } catch (e) { errors.push(String(e)); }
      }

      res.json({ ok: true, imported, skipped, errors: errors.slice(0, 5) });
    } catch (err) {
      res.status(500).json({ error: 'Bulk import thất bại', detail: String(err) });
    }
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
