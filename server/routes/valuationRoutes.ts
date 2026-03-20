/**
 * Advanced Valuation Routes
 *
 * POST /api/valuation/advanced   — Full multi-source, 7-coefficient valuation
 * GET  /api/valuation/market-index — Cached market price by location
 * POST /api/valuation/market-index/refresh — Force refresh market data
 * GET  /api/valuation/comparables  — Internal comparable listings
 * GET  /api/valuation/cache-status  — Admin: view all cached entries
 */

import { Router, Request, Response } from 'express';
import { applyAVM, computeBlendedBasePrice, getRegionalBasePrice, estimateFallbackRent } from '../valuationEngine';
import type { LegalStatus, PropertyType } from '../valuationEngine';
import { marketDataService } from '../services/marketDataService';
import { listingRepository } from '../repositories/listingRepository';
import { logger } from '../middleware/logger';

export function createValuationRoutes(authenticateToken: any, aiRateLimit: any): Router {
  const router = Router();

  // ──────────────────────────────────────────────────────────────────────────
  // POST /api/valuation/advanced
  // Full advanced valuation: market cache + internal comps + 7 coefficients
  // ──────────────────────────────────────────────────────────────────────────
  router.post('/advanced', authenticateToken, aiRateLimit, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const {
        address,
        area,
        roadWidth,
        legal,
        propertyType,
        // Optional advanced inputs
        floorLevel,
        direction,
        frontageWidth,
        furnishing,
        // Override flags
        skipCache = false,
        skipInternalComps = false,
      } = req.body;

      if (!address || !area || !roadWidth || !legal) {
        return res.status(400).json({
          error: 'Missing required fields: address, area, roadWidth, legal'
        });
      }

      const areaNum = Number(area);
      const roadWidthNum = Number(roadWidth);
      if (isNaN(areaNum) || areaNum <= 0) return res.status(400).json({ error: 'area must be a positive number' });
      if (isNaN(roadWidthNum) || roadWidthNum <= 0) return res.status(400).json({ error: 'roadWidth must be a positive number' });

      const legalValue = (legal as string).toUpperCase() as LegalStatus;
      if (!['PINK_BOOK', 'CONTRACT', 'WAITING'].includes(legalValue)) {
        return res.status(400).json({ error: 'legal must be PINK_BOOK, CONTRACT, or WAITING' });
      }

      // ── Step 1: Get market base price (AI via cache) ──────────────────────
      let marketBasePrice: number;
      let aiConfidence: number;
      let marketTrend: string;
      let monthlyRent: number | undefined;
      let resolvedPropertyType: PropertyType;
      let marketDataSource: string;

      const cacheEntry = skipCache ? null : await marketDataService.getMarketData(address);

      if (cacheEntry) {
        marketBasePrice = cacheEntry.pricePerM2;
        aiConfidence = cacheEntry.confidence;
        marketTrend = cacheEntry.marketTrend;
        monthlyRent = cacheEntry.monthlyRentEstimate;
        marketDataSource = cacheEntry.source;
        resolvedPropertyType = (propertyType || 'townhouse_center') as PropertyType;
      } else {
        // Fallback to full AI call
        try {
          const { aiService } = await import('../ai');
          const aiResult = await aiService.getRealtimeValuation(
            address, areaNum, roadWidthNum, legal, propertyType
          );
          marketBasePrice = aiResult.basePrice;
          aiConfidence = aiResult.confidence;
          marketTrend = aiResult.marketTrend;
          monthlyRent = aiResult.incomeApproach?.monthlyRent;
          resolvedPropertyType = (propertyType || 'townhouse_center') as PropertyType;
          marketDataSource = 'AI_LIVE';
        } catch {
          const regional = getRegionalBasePrice(address);
          marketBasePrice = regional.price;
          aiConfidence = regional.confidence;
          marketTrend = `Ước tính khu vực ${regional.region}`;
          resolvedPropertyType = (propertyType || 'townhouse_center') as PropertyType;
          marketDataSource = 'REGIONAL_TABLE';
        }
      }

      // ── Step 2: Get internal comparable listings ──────────────────────────
      let internalCompsMedian: number | undefined;
      let internalCompsCount = 0;
      let comparables: any[] = [];

      if (!skipInternalComps) {
        try {
          const comps = await listingRepository.findComparables(user.tenantId, {
            location: address,
            area: areaNum,
            propertyType: resolvedPropertyType,
            maxSamples: 15,
          });

          if (comps.count >= 2) {
            internalCompsMedian = comps.medianPricePerM2;
            internalCompsCount = comps.count;
            comparables = comps.samples;
            logger.info(`[Valuation] Internal comps: ${comps.count} listings, median=${(comps.medianPricePerM2 / 1_000_000).toFixed(0)} tr/m²`);
          }
        } catch (compsErr: any) {
          logger.warn('[Valuation] Could not fetch internal comps:', compsErr.message);
        }
      }

      // ── Step 3: Apply AVM with all 7 coefficients + multi-source blend ────
      if (!monthlyRent) {
        monthlyRent = estimateFallbackRent(marketBasePrice * areaNum, resolvedPropertyType, areaNum);
      }

      const avmResult = applyAVM({
        marketBasePrice,
        area: areaNum,
        roadWidth: roadWidthNum,
        legal: legalValue,
        confidence: aiConfidence,
        marketTrend,
        propertyType: resolvedPropertyType,
        monthlyRent,
        // Optional enhanced inputs
        floorLevel: floorLevel !== undefined ? Number(floorLevel) : undefined,
        direction: direction || undefined,
        frontageWidth: frontageWidth !== undefined ? Number(frontageWidth) : undefined,
        furnishing: furnishing || undefined,
        // Multi-source blending
        internalCompsMedian,
        internalCompsCount,
        cachedMarketPrice: cacheEntry ? cacheEntry.pricePerM2 : undefined,
        cachedConfidence: cacheEntry ? cacheEntry.confidence : undefined,
      });

      // ── Response ──────────────────────────────────────────────────────────
      res.json({
        // Core valuation result
        basePrice: avmResult.marketBasePrice,
        pricePerM2: avmResult.pricePerM2,
        totalPrice: avmResult.totalPrice,
        compsPrice: avmResult.compsPrice,
        rangeMin: avmResult.rangeMin,
        rangeMax: avmResult.rangeMax,
        confidence: avmResult.confidence,
        marketTrend: avmResult.marketTrend,
        factors: avmResult.factors,
        coefficients: avmResult.coefficients,
        formula: avmResult.formula,
        incomeApproach: avmResult.incomeApproach,
        reconciliation: avmResult.reconciliation,
        // Enhanced metadata
        sources: {
          ...avmResult.sources,
          marketDataSource,
          cacheAge: cacheEntry ? Math.round((Date.now() - new Date(cacheEntry.fetchedAt).getTime()) / 60000) + 'm' : null,
          cacheExpiresAt: cacheEntry?.expiresAt,
        },
        comparables: {
          count: internalCompsCount,
          samples: comparables.slice(0, 5),
          medianPricePerM2: internalCompsMedian || null,
        },
        // Human-readable summary
        summary: {
          estimatedPrice: `${(avmResult.totalPrice / 1_000_000_000).toFixed(2)} tỷ VNĐ`,
          priceRange: `${(avmResult.rangeMin / 1_000_000_000).toFixed(2)} – ${(avmResult.rangeMax / 1_000_000_000).toFixed(2)} tỷ`,
          pricePerM2: `${(avmResult.pricePerM2 / 1_000_000).toFixed(0)} triệu/m²`,
          confidenceLabel: avmResult.confidence >= 85 ? 'Rất cao' : avmResult.confidence >= 70 ? 'Cao' : avmResult.confidence >= 55 ? 'Trung bình' : 'Thấp',
          activeCoefficients: Object.keys(avmResult.coefficients).length,
        },
      });
    } catch (error: any) {
      logger.error('[Valuation] Advanced valuation error:', error);
      res.status(500).json({ error: 'Advanced valuation failed', detail: error.message });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GET /api/valuation/market-index?location=<address>
  // Returns cached market data for a location
  // ──────────────────────────────────────────────────────────────────────────
  router.get('/market-index', authenticateToken, async (req: Request, res: Response) => {
    const location = req.query.location as string | undefined;
    if (!location) return res.status(400).json({ error: 'location query parameter is required' });

    try {
      const data = await marketDataService.getMarketData(location);
      res.json({
        location: data.location,
        pricePerM2: data.pricePerM2,
        pricePerM2Display: `${(data.pricePerM2 / 1_000_000).toFixed(0)} triệu/m²`,
        confidence: data.confidence,
        marketTrend: data.marketTrend,
        monthlyRentEstimate: data.monthlyRentEstimate,
        source: data.source,
        fetchedAt: data.fetchedAt,
        expiresAt: data.expiresAt,
        region: data.region,
        isFresh: new Date(data.expiresAt) > new Date(),
      });
    } catch (err: any) {
      logger.error('[Valuation] Market index error:', err);
      res.status(500).json({ error: 'Failed to get market data' });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // POST /api/valuation/market-index/refresh
  // Force refresh market data for a location (admin only)
  // ──────────────────────────────────────────────────────────────────────────
  router.post('/market-index/refresh', authenticateToken, aiRateLimit, async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (user.role !== 'ADMIN' && user.role !== 'TEAM_LEAD') {
      return res.status(403).json({ error: 'Only admins can force refresh market data' });
    }

    const { location } = req.body;
    if (!location) return res.status(400).json({ error: 'location is required' });

    try {
      const data = await marketDataService.forceRefresh(location);
      res.json({
        message: 'Market data refreshed',
        location: data.location,
        pricePerM2: data.pricePerM2,
        confidence: data.confidence,
        marketTrend: data.marketTrend,
        source: data.source,
        fetchedAt: data.fetchedAt,
        expiresAt: data.expiresAt,
      });
    } catch (err: any) {
      logger.error('[Valuation] Market index refresh error:', err);
      res.status(500).json({ error: 'Failed to refresh market data' });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GET /api/valuation/comparables?location=...&area=...&type=...
  // Returns comparable listings from internal DB
  // ──────────────────────────────────────────────────────────────────────────
  router.get('/comparables', authenticateToken, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const location = req.query.location as string | undefined;
    const area = parseFloat(req.query.area as string);
    const propertyType = req.query.type as string | undefined;

    if (!location || !area || isNaN(area)) {
      return res.status(400).json({ error: 'location and area are required' });
    }

    try {
      const comps = await listingRepository.findComparables(user.tenantId, {
        location,
        area,
        propertyType,
        maxSamples: 20,
      });

      res.json({
        ...comps,
        medianPriceDisplay: comps.medianPricePerM2 > 0
          ? `${(comps.medianPricePerM2 / 1_000_000).toFixed(0)} triệu/m²`
          : 'N/A',
        searchParams: { location, area, propertyType },
      });
    } catch (err: any) {
      logger.error('[Valuation] Comparables error:', err);
      res.status(500).json({ error: 'Failed to fetch comparables' });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GET /api/valuation/cache-status (admin only)
  // ──────────────────────────────────────────────────────────────────────────
  router.get('/cache-status', authenticateToken, async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin only' });
    }
    const snapshot = marketDataService.getCacheSnapshot();
    res.json({
      cacheSize: marketDataService.cacheSize,
      entries: snapshot.map(e => ({
        location: e.location,
        pricePerM2Display: `${(e.pricePerM2 / 1_000_000).toFixed(0)} tr/m²`,
        confidence: e.confidence,
        source: e.source,
        fetchedAt: e.fetchedAt,
        expiresAt: e.expiresAt,
        isFresh: new Date(e.expiresAt) > new Date(),
      })),
    });
  });

  return router;
}
