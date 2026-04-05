/**
 * MarketDataService — Real-time market price cache for SGS LAND
 *
 * Architecture:
 *  1. In-memory cache (fast lookup) keyed by normalized location string
 *  2. Redis persistence (Upstash) — survives server restarts, TTL 24h
 *  3. Background seed — fetches realtime prices for all 63 Vietnamese provinces
 *     at startup using Gemini + Google Search (non-blocking, rate-limited)
 *  4. Per-request refresh — on cache miss, fetches lightweight market price
 *  5. WebSocket broadcast — emits `market_index_updated` when data refreshes
 *
 * Data sources (via Gemini Google Search grounding):
 *   batdongsan.com.vn, cafeland.vn, cen.vn, onehousing.vn, alonhadat.com,
 *   CBRE/Savills/JLL Vietnam market reports
 */

import { Server as SocketServer } from 'socket.io';
import { logger } from '../middleware/logger';
import { getRegionalBasePrice } from '../valuationEngine';

const CACHE_TTL_MS      = parseInt(process.env.MARKET_CACHE_TTL_HOURS || '6') * 3_600_000;
const SEED_TTL_MS       = 24 * 3_600_000;    // seed data valid for 24h
const REDIS_TTL_SECS    = 86_400;            // 24h Redis key TTL
const MAX_CACHE_ENTRIES = 300;
const SEED_BATCH_SIZE   = 3;                 // parallel searches per batch
const SEED_BATCH_DELAY  = 3_000;            // ms between batches (rate-limit buffer)
const MIN_PRICE_VND     = 5_000_000;        // sanity: 5 triệu/m²
const MAX_PRICE_VND     = 1_000_000_000;    // sanity: 1 tỷ/m²
const REDIS_KEY_PREFIX  = 'sgsland:market:v2:';

// ─────────────────────────────────────────────────────────────────────────────
// Seed locations: one representative address per province/city of Vietnam
// These get seeded with realtime Gemini+Search prices at startup.
// ─────────────────────────────────────────────────────────────────────────────
export const SEED_LOCATIONS: Array<{ location: string; pType?: string }> = [
  // 5 Thành phố trực thuộc Trung ương
  { location: 'Quận Hoàn Kiếm, Hà Nội',              pType: 'townhouse_center' },
  { location: 'Quận 1, TP. Hồ Chí Minh',             pType: 'townhouse_center' },
  { location: 'Quận Hải Châu, Đà Nẵng',              pType: 'townhouse_center' },
  { location: 'Quận Hồng Bàng, Hải Phòng',           pType: 'townhouse_center' },
  { location: 'Quận Ninh Kiều, Cần Thơ',             pType: 'townhouse_center' },

  // Hà Nội — quận trung tâm + ngoại thành lớn
  { location: 'Quận Ba Đình, Hà Nội',                pType: 'townhouse_center' },
  { location: 'Quận Đống Đa, Hà Nội',                pType: 'townhouse_center' },
  { location: 'Quận Cầu Giấy, Hà Nội',               pType: 'townhouse_center' },
  { location: 'Quận Tây Hồ, Hà Nội',                 pType: 'townhouse_center' },
  { location: 'Quận Hà Đông, Hà Nội',                pType: 'townhouse_center' },
  { location: 'Huyện Đông Anh, Hà Nội',              pType: 'townhouse_suburb' },
  { location: 'Quận Long Biên, Hà Nội',              pType: 'townhouse_center' },

  // TP.HCM — quận trung tâm + ngoại thành lớn
  { location: 'Quận 3, TP. Hồ Chí Minh',             pType: 'townhouse_center' },
  { location: 'Quận 7 Phú Mỹ Hưng, TP. Hồ Chí Minh', pType: 'townhouse_center' },
  { location: 'Quận Bình Thạnh, TP. Hồ Chí Minh',   pType: 'townhouse_center' },
  { location: 'Quận Thủ Đức, TP. Hồ Chí Minh',      pType: 'townhouse_center' },
  { location: 'Huyện Bình Chánh, TP. Hồ Chí Minh',  pType: 'townhouse_suburb' },

  // Đà Nẵng — quận
  { location: 'Quận Sơn Trà, Đà Nẵng',               pType: 'townhouse_center' },
  { location: 'Quận Ngũ Hành Sơn, Đà Nẵng',          pType: 'townhouse_center' },
  { location: 'Quận Liên Chiểu, Đà Nẵng',            pType: 'townhouse_center' },

  // Miền Nam — tỉnh vệ tinh HCM
  { location: 'Thành phố Thuận An, Bình Dương',      pType: 'townhouse_center' },
  { location: 'Thành phố Dĩ An, Bình Dương',         pType: 'townhouse_center' },
  { location: 'Thành phố Biên Hòa, Đồng Nai',        pType: 'townhouse_center' },
  { location: 'Huyện Long Thành, Đồng Nai',           pType: 'townhouse_suburb' },
  { location: 'Thành phố Vũng Tàu, Bà Rịa - Vũng Tàu', pType: 'townhouse_center' },
  { location: 'Thành phố Tân An, Long An',            pType: 'townhouse_center' },
  { location: 'Thành phố Tây Ninh, Tây Ninh',        pType: 'townhouse_center' },
  { location: 'Thành phố Đồng Xoài, Bình Phước',     pType: 'townhouse_center' },

  // Đồng bằng sông Cửu Long
  { location: 'Thành phố Mỹ Tho, Tiền Giang',        pType: 'townhouse_center' },
  { location: 'Thành phố Bến Tre, Bến Tre',          pType: 'townhouse_center' },
  { location: 'Thành phố Trà Vinh, Trà Vinh',        pType: 'townhouse_center' },
  { location: 'Thành phố Vĩnh Long, Vĩnh Long',      pType: 'townhouse_center' },
  { location: 'Thành phố Cao Lãnh, Đồng Tháp',       pType: 'townhouse_center' },
  { location: 'Thành phố Long Xuyên, An Giang',       pType: 'townhouse_center' },
  { location: 'Thành phố Châu Đốc, An Giang',         pType: 'townhouse_center' },
  { location: 'Thành phố Phú Quốc, Kiên Giang',      pType: 'townhouse_center' },
  { location: 'Thành phố Rạch Giá, Kiên Giang',      pType: 'townhouse_center' },
  { location: 'Thành phố Vị Thanh, Hậu Giang',       pType: 'townhouse_center' },
  { location: 'Thành phố Sóc Trăng, Sóc Trăng',      pType: 'townhouse_center' },
  { location: 'Thành phố Bạc Liêu, Bạc Liêu',        pType: 'townhouse_center' },
  { location: 'Thành phố Cà Mau, Cà Mau',             pType: 'townhouse_center' },

  // Miền Trung
  { location: 'Thành phố Huế, Thừa Thiên Huế',       pType: 'townhouse_center' },
  { location: 'Thành phố Hội An, Quảng Nam',          pType: 'townhouse_center' },
  { location: 'Thành phố Tam Kỳ, Quảng Nam',          pType: 'townhouse_center' },
  { location: 'Thành phố Quảng Ngãi, Quảng Ngãi',    pType: 'townhouse_center' },
  { location: 'Thành phố Quy Nhơn, Bình Định',        pType: 'townhouse_center' },
  { location: 'Thành phố Tuy Hòa, Phú Yên',          pType: 'townhouse_center' },
  { location: 'Thành phố Nha Trang, Khánh Hòa',       pType: 'townhouse_center' },
  { location: 'Thành phố Cam Ranh, Khánh Hòa',       pType: 'townhouse_center' },
  { location: 'Thành phố Phan Rang, Ninh Thuận',      pType: 'townhouse_center' },
  { location: 'Thành phố Phan Thiết, Bình Thuận',     pType: 'townhouse_center' },
  { location: 'Mũi Né, Phan Thiết, Bình Thuận',       pType: 'townhouse_center' },
  { location: 'Thành phố Đồng Hới, Quảng Bình',       pType: 'townhouse_center' },
  { location: 'Thành phố Đông Hà, Quảng Trị',         pType: 'townhouse_center' },
  { location: 'Thành phố Thanh Hóa, Thanh Hóa',       pType: 'townhouse_center' },
  { location: 'Thị xã Sầm Sơn, Thanh Hóa',            pType: 'townhouse_center' },
  { location: 'Thành phố Vinh, Nghệ An',               pType: 'townhouse_center' },
  { location: 'Thành phố Hà Tĩnh, Hà Tĩnh',           pType: 'townhouse_center' },

  // Quảng Ninh
  { location: 'Thành phố Hạ Long, Quảng Ninh',        pType: 'townhouse_center' },
  { location: 'Thành phố Móng Cái, Quảng Ninh',       pType: 'townhouse_center' },

  // Các tỉnh phía Bắc (vệ tinh Hà Nội)
  { location: 'Thành phố Bắc Ninh, Bắc Ninh',         pType: 'townhouse_center' },
  { location: 'Thành phố Bắc Giang, Bắc Giang',       pType: 'townhouse_center' },
  { location: 'Thành phố Vĩnh Yên, Vĩnh Phúc',        pType: 'townhouse_center' },
  { location: 'Thành phố Hải Dương, Hải Dương',        pType: 'townhouse_center' },
  { location: 'Thành phố Hưng Yên, Hưng Yên',         pType: 'townhouse_center' },
  { location: 'Thành phố Thái Bình, Thái Bình',        pType: 'townhouse_center' },
  { location: 'Thành phố Phủ Lý, Hà Nam',             pType: 'townhouse_center' },
  { location: 'Thành phố Nam Định, Nam Định',          pType: 'townhouse_center' },
  { location: 'Thành phố Ninh Bình, Ninh Bình',        pType: 'townhouse_center' },

  // Trung du & Miền núi phía Bắc
  { location: 'Thành phố Thái Nguyên, Thái Nguyên',   pType: 'townhouse_center' },
  { location: 'Thành phố Việt Trì, Phú Thọ',          pType: 'townhouse_center' },
  { location: 'Thành phố Yên Bái, Yên Bái',           pType: 'townhouse_center' },
  { location: 'Thành phố Lào Cai, Lào Cai',           pType: 'townhouse_center' },
  { location: 'Thị xã Sa Pa, Lào Cai',                pType: 'townhouse_center' },
  { location: 'Thành phố Tuyên Quang, Tuyên Quang',   pType: 'townhouse_center' },
  { location: 'Thành phố Hòa Bình, Hòa Bình',         pType: 'townhouse_center' },
  { location: 'Thành phố Lạng Sơn, Lạng Sơn',         pType: 'townhouse_center' },
  { location: 'Thành phố Cao Bằng, Cao Bằng',         pType: 'townhouse_center' },
  { location: 'Thành phố Sơn La, Sơn La',             pType: 'townhouse_center' },
  { location: 'Thành phố Điện Biên Phủ, Điện Biên',   pType: 'townhouse_center' },
  { location: 'Thành phố Hà Giang, Hà Giang',         pType: 'townhouse_center' },

  // Tây Nguyên
  { location: 'Thành phố Đà Lạt, Lâm Đồng',          pType: 'townhouse_center' },
  { location: 'Thành phố Bảo Lộc, Lâm Đồng',         pType: 'townhouse_center' },
  { location: 'Thành phố Buôn Ma Thuột, Đắk Lắk',    pType: 'townhouse_center' },
  { location: 'Thành phố Pleiku, Gia Lai',             pType: 'townhouse_center' },
  { location: 'Thành phố Kon Tum, Kon Tum',           pType: 'townhouse_center' },
  { location: 'Thành phố Gia Nghĩa, Đắk Nông',        pType: 'townhouse_center' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export interface MarketDataEntry {
  location: string;
  normalizedKey: string;
  pricePerM2: number;
  confidence: number;
  marketTrend: string;
  monthlyRentEstimate?: number;
  source: 'AI' | 'REGIONAL_TABLE' | 'BLENDED' | 'SEED';
  fetchedAt: string;
  expiresAt: string;
  region?: string;
  sampleNotes?: string;
  priceMin?: number;
  priceMax?: number;
  sourceCount?: number;
  dataRecency?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function normalizeLocation(location: string): string {
  return location
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

async function getRedisClient(): Promise<any | null> {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const { Redis } = await import('@upstash/redis');
    return new Redis({ url, token });
  } catch {
    return null;
  }
}

async function getAiClient() {
  const { GoogleGenAI } = await import('@google/genai');
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  return new GoogleGenAI({ apiKey: apiKey! });
}

// ─────────────────────────────────────────────────────────────────────────────
// Lightweight market price fetcher (2-step: search → extract)
// Much lighter than full AVM pipeline — used for seeding and cache-miss fills
// ─────────────────────────────────────────────────────────────────────────────
async function fetchLightMarketPrice(
  location: string,
  pType: string = 'townhouse_center',
): Promise<{ priceMedian: number; priceMin: number; priceMax: number; trend: string; confidence: number; rentMedian: number; sourceCount: number; dataRecency: string }> {
  const { Type } = await import('@google/genai');
  const year  = new Date().getFullYear();
  const month = new Date().toLocaleString('vi-VN', { month: 'long', timeZone: 'Asia/Ho_Chi_Minh' });

  const pTypeLabels: Record<string, string> = {
    apartment_center:  'Căn hộ chung cư',
    apartment_suburb:  'Căn hộ chung cư ngoại thành',
    townhouse_center:  'Nhà phố / đất thổ cư',
    townhouse_suburb:  'Nhà phố / đất thổ cư ngoại thành',
    villa:             'Biệt thự',
    shophouse:         'Shophouse / Nhà phố thương mại',
    land_urban:        'Đất thổ cư nội đô (đất nền)',
    land_suburban:     'Đất thổ cư ngoại thành (đất nền)',
    penthouse:         'Penthouse / Căn hộ đỉnh tháp',
    office:            'Văn phòng / Mặt bằng thương mại',
    warehouse:         'Nhà xưởng / Kho bãi công nghiệp',
    land_agricultural: 'Đất nông nghiệp / Đất vườn',
    land_industrial:   'Đất khu công nghiệp (KCN)',
    project:           'Căn hộ dự án / Off-plan',
  };
  const pLabel = pTypeLabels[pType] || 'Nhà phố / đất thổ cư';

  const ai = await getAiClient();

  // Step 1 — Google Search grounding: get raw market text
  const searchResp = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Tra cứu giá BĐS tại ${location}, Việt Nam — ${month} ${year}

Cần: Giá GIAO DỊCH THỰC TẾ 1m² (${pLabel}, Sổ Hồng/Sổ Đỏ, lộ giới 4m, 60-100m²)
Nguồn: batdongsan.com.vn, cafeland.vn, cen.vn, onehousing.vn, alonhadat.com, CBRE/Savills Vietnam ${year}
1. Khoảng giá giao dịch thực tế (thấp nhất – trung bình – cao nhất) /m²
2. Giá thuê trung bình/tháng cho 60m² tại khu vực
3. Xu hướng tăng/giảm % so với năm ngoái
4. Số nguồn tìm thấy dữ liệu
ƯU TIÊN: giá giao dịch > giá rao bán > ước tính khu vực`,
    config: {
      systemInstruction: 'Bạn là chuyên gia định giá BĐS Việt Nam. Tìm giá thị trường thực tế từ các nguồn uy tín.',
      tools: [{ googleSearch: {} }],
    },
  });
  const marketText = searchResp.text || '';

  // Step 2 — Structured extraction
  const extractSchema = {
    type: Type.OBJECT as any,
    properties: {
      priceMin:     { type: Type.NUMBER as any, description: 'Giá thấp nhất tìm thấy (VNĐ/m²)' },
      priceMedian:  { type: Type.NUMBER as any, description: 'Giá trung bình/trung vị (VNĐ/m²) — chính' },
      priceMax:     { type: Type.NUMBER as any, description: 'Giá cao nhất tìm thấy (VNĐ/m²)' },
      rentMedian:   { type: Type.NUMBER as any, description: 'Giá thuê trung bình tháng (triệu VNĐ) cho 60m²' },
      trend:        { type: Type.STRING as any, description: 'Xu hướng giá, ví dụ: Tăng 8%/năm, Ổn định' },
      confidence:   { type: Type.NUMBER as any, description: 'Độ tin cậy 0-100. 90+ nếu có giao dịch thực tế từ nguồn uy tín.' },
      sourceCount:  { type: Type.NUMBER as any, description: 'Số nguồn độc lập tìm thấy (1-10)' },
      dataRecency:  { type: Type.STRING as any, enum: ['current_year', 'last_year', 'older'], description: 'Độ mới dữ liệu' },
    },
    required: ['priceMin', 'priceMedian', 'priceMax', 'rentMedian', 'trend', 'confidence', 'sourceCount', 'dataRecency'],
  };

  const extractResp = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Khu vực: "${location}" | Loại: ${pLabel}\n\nDỮ LIỆU THỊ TRƯỜNG:\n${marketText}\n\nTRÍCH XUẤT: priceMin, priceMedian, priceMax (VNĐ/m²), rentMedian (triệu/tháng cho 60m²), trend, confidence, sourceCount, dataRecency.`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: extractSchema as any,
      systemInstruction: 'Trích xuất số liệu chính xác. Trả JSON theo schema. Đơn vị giá: VNĐ/m² (150000000 = 150 triệu/m²).',
    },
  });

  const d = JSON.parse(extractResp.text || '{}');
  return {
    priceMedian:  d.priceMedian  || 0,
    priceMin:     d.priceMin     || d.priceMedian || 0,
    priceMax:     d.priceMax     || d.priceMedian || 0,
    trend:        d.trend        || 'Đang cập nhật',
    confidence:   Math.min(100, Math.max(0, d.confidence || 75)),
    rentMedian:   d.rentMedian   || 0,
    sourceCount:  d.sourceCount  || 1,
    dataRecency:  d.dataRecency  || 'current_year',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MarketDataService class
// ─────────────────────────────────────────────────────────────────────────────
class MarketDataService {
  private static instance: MarketDataService;
  private cache = new Map<string, MarketDataEntry>();
  private io: SocketServer | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private isRefreshing = false;
  private isSeedRunning = false;
  private redisClient: any | null = null;

  private constructor() {}

  static getInstance(): MarketDataService {
    if (!MarketDataService.instance) {
      MarketDataService.instance = new MarketDataService();
    }
    return MarketDataService.instance;
  }

  /** Start background refresh loop and seed all provinces */
  async start(io: SocketServer): Promise<void> {
    this.io = io;

    // Connect Redis
    this.redisClient = await getRedisClient();
    if (this.redisClient) {
      logger.info('[MarketData] Redis connected — loading cached market prices...');
      await this.loadFromRedis();
    } else {
      logger.warn('[MarketData] Redis unavailable — using in-memory cache only');
    }

    // Periodic stale-entry refresh
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    this.refreshTimer = setInterval(() => this.refreshStaleEntries(), CACHE_TTL_MS);

    logger.info(`[MarketData] Service started — cache TTL: ${CACHE_TTL_MS / 3_600_000}h, seed locations: ${SEED_LOCATIONS.length}`);

    // Seed in background after 10s delay (let server fully start first)
    setTimeout(() => this.seedAllProvinces(), 10_000);
  }

  stop(): void {
    if (this.refreshTimer) { clearInterval(this.refreshTimer); this.refreshTimer = null; }
    logger.info('[MarketData] Service stopped');
  }

  /**
   * Get market data for a location.
   *
   * When `propertyType` is supplied and is NOT a townhouse variant, the cache
   * uses a type-specific key (`normalizedLocation:propertyType`) so that
   * apartment / villa / warehouse prices are fetched with the correct AI type
   * and stored separately from the townhouse reference baseline. The returned
   * price is already type-accurate and should NOT have a type multiplier applied
   * in the calling code.
   *
   * For townhouse_center / townhouse_suburb (the reference baseline) the
   * original key format is used so the background seed entries are still hit.
   */
  async getMarketData(location: string, propertyType?: string): Promise<MarketDataEntry> {
    const baseKey = normalizeLocation(location);
    const isTownhouseRef = !propertyType
      || propertyType === 'townhouse_center'
      || propertyType === 'townhouse_suburb';
    const key = isTownhouseRef ? baseKey : `${baseKey}:${propertyType}`;
    const cached = this.cache.get(key);
    if (cached && new Date(cached.expiresAt) > new Date()) {
      logger.debug(`[MarketData] Cache HIT for "${key}"`);
      return cached;
    }
    return this.fetchAndCache(location, key, isTownhouseRef ? 'townhouse_center' : propertyType!);
  }

  /** Force refresh a location (bypasses TTL) */
  async forceRefresh(location: string): Promise<MarketDataEntry> {
    const key = normalizeLocation(location);
    return this.fetchAndCache(location, key, 'townhouse_center');
  }

  /** Get all currently cached entries (for admin/monitoring) */
  getCacheSnapshot(): MarketDataEntry[] {
    return Array.from(this.cache.values())
      .sort((a, b) => new Date(b.fetchedAt).getTime() - new Date(a.fetchedAt).getTime());
  }

  get cacheSize(): number { return this.cache.size; }

  // ── Seed all provinces ────────────────────────────────────────────────────
  /** Run background seed for all Vietnamese provinces — skips already-cached entries */
  async seedAllProvinces(): Promise<void> {
    if (this.isSeedRunning) return;
    this.isSeedRunning = true;
    logger.info(`[MarketData] Starting background seed for ${SEED_LOCATIONS.length} locations...`);

    const missing = SEED_LOCATIONS.filter(({ location }) => {
      const key = normalizeLocation(location);
      const cached = this.cache.get(key);
      return !cached || new Date(cached.expiresAt) <= new Date();
    });

    if (missing.length === 0) {
      logger.info('[MarketData] All seed locations already cached — skip');
      this.isSeedRunning = false;
      return;
    }

    logger.info(`[MarketData] Seeding ${missing.length} missing locations in batches of ${SEED_BATCH_SIZE}...`);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < missing.length; i += SEED_BATCH_SIZE) {
      const batch = missing.slice(i, i + SEED_BATCH_SIZE);

      await Promise.allSettled(
        batch.map(async ({ location, pType }) => {
          try {
            await this.fetchSeedEntry(location, pType || 'townhouse_center');
            successCount++;
          } catch (err: any) {
            failCount++;
            logger.error(`[MarketData] Seed failed "${location}": ${err.message}`);
          }
        })
      );

      // Rate-limit: wait between batches
      if (i + SEED_BATCH_SIZE < missing.length) {
        await new Promise(r => setTimeout(r, SEED_BATCH_DELAY));
      }
    }

    this.isSeedRunning = false;
    logger.info(`[MarketData] Seed complete — ${successCount} success, ${failCount} failed. Cache size: ${this.cache.size}`);
  }

  // ── Private methods ───────────────────────────────────────────────────────

  /** Load all valid entries from Redis into in-memory cache */
  private async loadFromRedis(): Promise<void> {
    if (!this.redisClient) return;
    try {
      const keys: string[] = await this.redisClient.keys(`${REDIS_KEY_PREFIX}*`);
      if (!keys || keys.length === 0) {
        logger.info('[MarketData] Redis cache empty — will seed on startup');
        return;
      }

      let loaded = 0;
      for (const key of keys) {
        try {
          const raw = await this.redisClient.get(key);
          if (!raw) continue;
          const entry: MarketDataEntry = typeof raw === 'string' ? JSON.parse(raw) : raw;
          if (new Date(entry.expiresAt) > new Date()) {
            const normKey = key.replace(REDIS_KEY_PREFIX, '');
            this.cache.set(normKey, entry);
            loaded++;
          }
        } catch { /* skip corrupt entries */ }
      }
      logger.info(`[MarketData] Loaded ${loaded}/${keys.length} valid entries from Redis`);
    } catch (err: any) {
      logger.error('[MarketData] Failed to load from Redis:', err.message);
    }
  }

  /** Persist a cache entry to Redis */
  private async saveToRedis(key: string, entry: MarketDataEntry): Promise<void> {
    if (!this.redisClient) return;
    try {
      await this.redisClient.set(
        `${REDIS_KEY_PREFIX}${key}`,
        JSON.stringify(entry),
        { ex: REDIS_TTL_SECS }
      );
    } catch (err: any) {
      logger.warn(`[MarketData] Redis save failed for "${key}": ${err.message}`);
    }
  }

  /**
   * Fetch + cache using the full AVM pipeline (per-request, high precision).
   *
   * `fetchPropertyType` controls what the AI is asked to price:
   *  - 'townhouse_center' (default) → reference baseline price for the area
   *  - any other type → type-specific price stored under key `location:type`
   */
  private async fetchAndCache(location: string, key: string, fetchPropertyType: string = 'townhouse_center'): Promise<MarketDataEntry> {
    let entry: MarketDataEntry;

    try {
      const { aiService } = await import('../ai');
      const result = await aiService.getRealtimeValuation(
        location, 70, 4, 'PINK_BOOK', fetchPropertyType as any
      );
      const now = new Date();
      entry = {
        location,
        normalizedKey: key,
        pricePerM2:     result.basePrice,
        confidence:     result.confidence,
        marketTrend:    result.marketTrend,
        monthlyRentEstimate: result.incomeApproach?.monthlyRent,
        source:         'AI',
        fetchedAt:      now.toISOString(),
        expiresAt:      new Date(now.getTime() + CACHE_TTL_MS).toISOString(),
      };
    } catch {
      entry = this.buildRegionalEntry(location, key);
    }

    return this.storeEntry(key, entry);
  }

  /** Fetch lightweight seed entry (2-step search+extract, no full AVM) */
  private async fetchSeedEntry(location: string, pType: string): Promise<MarketDataEntry> {
    const key = normalizeLocation(location);
    const regional = getRegionalBasePrice(location, pType);

    try {
      const data = await fetchLightMarketPrice(location, pType);

      // Sanity check against regional baseline
      const regionRef = regional.price;
      const priceLow  = regionRef * 0.30;
      const priceHigh = regionRef * 4.0;
      let price = data.priceMedian;
      let source: MarketDataEntry['source'] = 'SEED';

      if (price < MIN_PRICE_VND || price < priceLow || price > priceHigh) {
        // AI price implausible — blend with regional
        price = price > 0 ? Math.round(regionRef * 0.55 + price * 0.45) : regionRef;
        source = 'BLENDED';
      }

      const now = new Date();
      const entry: MarketDataEntry = {
        location,
        normalizedKey: key,
        pricePerM2:     price,
        priceMin:       data.priceMin  || price,
        priceMax:       data.priceMax  || price,
        confidence:     data.confidence,
        marketTrend:    data.trend,
        monthlyRentEstimate: data.rentMedian || undefined,
        source,
        fetchedAt:  now.toISOString(),
        expiresAt:  new Date(now.getTime() + SEED_TTL_MS).toISOString(),
        region:     regional.region,
        sourceCount: data.sourceCount,
        dataRecency: data.dataRecency,
        sampleNotes: `Seed: ${data.sourceCount} nguồn, ${data.dataRecency}`,
      };

      return this.storeEntry(key, entry);
    } catch (err: any) {
      logger.warn(`[MarketData] Seed AI failed "${location}" — using regional table: ${err.message}`);
      return this.storeEntry(key, this.buildRegionalEntry(location, key));
    }
  }

  private buildRegionalEntry(location: string, key: string): MarketDataEntry {
    const regional = getRegionalBasePrice(location);
    const now = new Date();
    return {
      location,
      normalizedKey: key,
      pricePerM2:   regional.price,
      confidence:   regional.confidence,
      marketTrend:  'Bảng khu vực — cập nhật định kỳ',
      source:       'REGIONAL_TABLE',
      fetchedAt:    now.toISOString(),
      expiresAt:    new Date(now.getTime() + 2 * 3_600_000).toISOString(),
      region:       regional.region,
    };
  }

  private async storeEntry(key: string, entry: MarketDataEntry): Promise<MarketDataEntry> {
    // Sanity bounds
    if (entry.pricePerM2 < MIN_PRICE_VND || entry.pricePerM2 > MAX_PRICE_VND) {
      logger.warn(`[MarketData] Price out of range for "${entry.location}" (${entry.pricePerM2}) — falling back`);
      entry = this.buildRegionalEntry(entry.location, key);
    }

    // LRU eviction
    if (this.cache.size >= MAX_CACHE_ENTRIES) {
      const oldest = Array.from(this.cache.entries())
        .sort(([, a], [, b]) => new Date(a.fetchedAt).getTime() - new Date(b.fetchedAt).getTime())[0];
      if (oldest) this.cache.delete(oldest[0]);
    }

    this.cache.set(key, entry);
    await this.saveToRedis(key, entry);

    logger.info(
      `[MarketData] Stored "${entry.location}" → ${(entry.pricePerM2 / 1_000_000).toFixed(0)} tr/m² `
      + `(conf: ${entry.confidence}%, src: ${entry.source})`
    );

    this.broadcastUpdate(entry);
    return entry;
  }

  private broadcastUpdate(entry: MarketDataEntry): void {
    if (!this.io) return;
    this.io.emit('market_index_updated', {
      location:    entry.location,
      pricePerM2:  entry.pricePerM2,
      priceMin:    entry.priceMin,
      priceMax:    entry.priceMax,
      confidence:  entry.confidence,
      marketTrend: entry.marketTrend,
      source:      entry.source,
      updatedAt:   entry.fetchedAt,
    });
  }

  private async refreshStaleEntries(): Promise<void> {
    if (this.isRefreshing) return;
    this.isRefreshing = true;

    const stale = Array.from(this.cache.values())
      .filter(e => new Date(e.expiresAt) <= new Date());

    logger.info(`[MarketData] Background refresh: ${stale.length} stale entries`);

    for (const entry of stale) {
      try {
        await this.fetchAndCache(entry.location, entry.normalizedKey);
        await new Promise(r => setTimeout(r, 2_000));
      } catch (err: any) {
        logger.error(`[MarketData] Refresh failed for "${entry.location}": ${err.message}`);
      }
    }

    this.isRefreshing = false;
    logger.info('[MarketData] Background refresh complete');
  }
}

export const marketDataService = MarketDataService.getInstance();
