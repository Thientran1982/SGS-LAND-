/**
 * MarketDataService — Real-time market price cache for SGS LAND
 *
 * Architecture:
 *  1. In-memory cache keyed by normalized location string
 *  2. TTL: 6 hours (configurable via MARKET_CACHE_TTL_HOURS env var)
 *  3. Background refresh: every 6 hours, re-fetches stale entries via AI
 *  4. WebSocket broadcast: emits `market_index_updated` when data refreshes
 *  5. Multi-source confidence scoring
 *
 * Usage:
 *   const svc = MarketDataService.getInstance();
 *   await svc.start(io);                         // start background refresh
 *   const data = await svc.getMarketData(address); // get or fetch
 *   svc.stop();                                   // graceful shutdown
 */

import { Server as SocketServer } from 'socket.io';
import { logger } from '../middleware/logger';
import { getRegionalBasePrice } from '../valuationEngine';

const CACHE_TTL_MS = parseInt(process.env.MARKET_CACHE_TTL_HOURS || '6') * 3_600_000;
const REFRESH_INTERVAL_MS = CACHE_TTL_MS;           // refresh every TTL period
const MAX_CACHE_ENTRIES = 200;                        // LRU-style eviction threshold
const MIN_PRICE_VND = 5_000_000;                     // sanity: 5 triệu/m²
const MAX_PRICE_VND = 1_000_000_000;                 // sanity: 1 tỷ/m²

export interface MarketDataEntry {
  location: string;
  normalizedKey: string;
  pricePerM2: number;       // VNĐ/m² for standard reference property
  confidence: number;       // 0-100
  marketTrend: string;
  monthlyRentEstimate?: number;  // triệu VNĐ/tháng for 60m² reference
  source: 'AI' | 'REGIONAL_TABLE' | 'BLENDED';
  fetchedAt: string;        // ISO timestamp
  expiresAt: string;        // ISO timestamp
  region?: string;          // resolved region name
  sampleNotes?: string;     // AI's source notes
}

// Normalise location string to a cache key
function normalizeLocation(location: string): string {
  return location
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // strip diacritics
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

// Check if AI SDK is available
async function isAIAvailable(): Promise<boolean> {
  try {
    const { aiService } = await import('../ai');
    return !!aiService;
  } catch {
    return false;
  }
}

class MarketDataService {
  private static instance: MarketDataService;
  private cache = new Map<string, MarketDataEntry>();
  private io: SocketServer | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private isRefreshing = false;

  private constructor() {}

  static getInstance(): MarketDataService {
    if (!MarketDataService.instance) {
      MarketDataService.instance = new MarketDataService();
    }
    return MarketDataService.instance;
  }

  /** Start background refresh loop (call once after server starts) */
  start(io: SocketServer): void {
    this.io = io;
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    this.refreshTimer = setInterval(() => this.refreshStaleEntries(), REFRESH_INTERVAL_MS);
    logger.info(`[MarketData] Service started — cache TTL: ${CACHE_TTL_MS / 3_600_000}h, refresh: every ${REFRESH_INTERVAL_MS / 3_600_000}h`);
  }

  stop(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    logger.info('[MarketData] Service stopped');
  }

  /** Get market data for a location. Hits cache first, fetches if stale/missing */
  async getMarketData(location: string): Promise<MarketDataEntry> {
    const key = normalizeLocation(location);
    const cached = this.cache.get(key);

    if (cached && new Date(cached.expiresAt) > new Date()) {
      logger.debug(`[MarketData] Cache HIT for "${key}" (expires ${cached.expiresAt})`);
      return cached;
    }

    return this.fetchAndCache(location, key);
  }

  /** Force refresh a location (bypasses TTL) */
  async forceRefresh(location: string): Promise<MarketDataEntry> {
    const key = normalizeLocation(location);
    return this.fetchAndCache(location, key);
  }

  /** Get all currently cached entries (for admin/monitoring) */
  getCacheSnapshot(): MarketDataEntry[] {
    return Array.from(this.cache.values());
  }

  /** Number of entries currently in cache */
  get cacheSize(): number {
    return this.cache.size;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private methods
  // ──────────────────────────────────────────────────────────────────────────

  private async fetchAndCache(location: string, key: string): Promise<MarketDataEntry> {
    const aiAvailable = await isAIAvailable();

    let entry: MarketDataEntry;

    if (aiAvailable) {
      entry = await this.fetchFromAI(location, key);
    } else {
      entry = this.fetchFromRegionalTable(location, key);
    }

    // Validate price sanity
    if (entry.pricePerM2 < MIN_PRICE_VND || entry.pricePerM2 > MAX_PRICE_VND) {
      logger.warn(`[MarketData] Price out of range for "${location}": ${entry.pricePerM2} — falling back to regional table`);
      entry = this.fetchFromRegionalTable(location, key);
    }

    // LRU eviction: remove oldest entry if cache is full
    if (this.cache.size >= MAX_CACHE_ENTRIES) {
      const oldest = Array.from(this.cache.entries())
        .sort(([, a], [, b]) => new Date(a.fetchedAt).getTime() - new Date(b.fetchedAt).getTime())[0];
      if (oldest) this.cache.delete(oldest[0]);
    }

    this.cache.set(key, entry);
    logger.info(`[MarketData] Cached "${location}" → ${(entry.pricePerM2 / 1_000_000).toFixed(0)} tr/m² (confidence: ${entry.confidence}%, source: ${entry.source})`);

    // Broadcast to WebSocket clients
    this.broadcastUpdate(entry);

    return entry;
  }

  private async fetchFromAI(location: string, key: string): Promise<MarketDataEntry> {
    try {
      const { aiService } = await import('../ai');

      // Use a minimal valuation call just to get market base price
      const result = await aiService.getRealtimeValuation(
        location, 70, 4, 'PINK_BOOK', 'townhouse_center'
      );

      const now = new Date();
      const expiresAt = new Date(now.getTime() + CACHE_TTL_MS);

      return {
        location,
        normalizedKey: key,
        pricePerM2: result.basePrice,
        confidence: result.confidence,
        marketTrend: result.marketTrend,
        monthlyRentEstimate: result.incomeApproach?.monthlyRent,
        source: 'AI',
        fetchedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      };
    } catch (err: any) {
      logger.error(`[MarketData] AI fetch failed for "${location}":`, err.message);
      return this.fetchFromRegionalTable(location, key);
    }
  }

  private fetchFromRegionalTable(location: string, key: string): MarketDataEntry {
    const regional = getRegionalBasePrice(location);
    const now = new Date();
    // Regional table data has shorter TTL (2h) since it's less precise
    const expiresAt = new Date(now.getTime() + Math.min(CACHE_TTL_MS, 2 * 3_600_000));

    return {
      location,
      normalizedKey: key,
      pricePerM2: regional.price,
      confidence: regional.confidence,
      marketTrend: 'Dữ liệu bảng khu vực — cập nhật thủ công',
      source: 'REGIONAL_TABLE',
      fetchedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      region: regional.region,
    };
  }

  private broadcastUpdate(entry: MarketDataEntry): void {
    if (!this.io) return;
    this.io.emit('market_index_updated', {
      location: entry.location,
      pricePerM2: entry.pricePerM2,
      confidence: entry.confidence,
      marketTrend: entry.marketTrend,
      source: entry.source,
      updatedAt: entry.fetchedAt,
    });
    logger.debug(`[MarketData] Broadcasted market_index_updated for "${entry.location}"`);
  }

  /** Refresh all stale entries in background (runs on timer) */
  private async refreshStaleEntries(): Promise<void> {
    if (this.isRefreshing) return;
    this.isRefreshing = true;

    const staleEntries = Array.from(this.cache.values())
      .filter(e => new Date(e.expiresAt) <= new Date());

    if (staleEntries.length === 0) {
      this.isRefreshing = false;
      return;
    }

    logger.info(`[MarketData] Background refresh: ${staleEntries.length} stale entries`);

    for (const entry of staleEntries) {
      try {
        await this.fetchAndCache(entry.location, entry.normalizedKey);
        // Small delay between AI calls to avoid rate limiting
        await new Promise(r => setTimeout(r, 1500));
      } catch (err: any) {
        logger.error(`[MarketData] Refresh failed for "${entry.location}":`, err.message);
      }
    }

    this.isRefreshing = false;
    logger.info(`[MarketData] Background refresh complete`);
  }
}

export const marketDataService = MarketDataService.getInstance();
