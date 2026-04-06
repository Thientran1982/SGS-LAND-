/**
 * Advanced Valuation Routes
 *
 * POST /api/valuation/advanced   — Full multi-source, 7-coefficient valuation (guest + auth)
 * GET  /api/valuation/market-index — Cached market price by location
 * POST /api/valuation/market-index/refresh — Force refresh market data
 * GET  /api/valuation/comparables  — Internal comparable listings
 * GET  /api/valuation/cache-status  — Admin: view all cached entries
 */

import { Router, Request, Response } from 'express';
import { applyAVM, getRegionalBasePrice, estimateFallbackRent, PROPERTY_TYPE_PRICE_MULT } from '../valuationEngine';
import type { LegalStatus, PropertyType } from '../valuationEngine';
import { marketDataService } from '../services/marketDataService';
import { listingRepository } from '../repositories/listingRepository';
import { logger } from '../middleware/logger';
import { pool } from '../db';

// ─────────────────────────────────────────────────────────────────────────────
// RLHF price correction: reads historical valuation corrections from ai_feedback
// and computes a region-level adjustment ratio. Max ±20% cap.
// Only applied for authenticated (tenantId) requests with ≥3 corrections.
// ─────────────────────────────────────────────────────────────────────────────
async function loadRlhfPriceCorrection(
  tenantId: string,
  address: string,
  propertyType: string,
): Promise<{ factor: number; sampleCount: number }> {
  try {
    // Extract region tokens from address (last 2 comma-parts, e.g. "Bình Thạnh, TP.HCM")
    const addrParts = address.split(',').map(p => p.trim()).filter(Boolean);
    const regionTokens = addrParts.slice(-2).join(' ').toLowerCase();
    if (!regionTokens || regionTokens.length < 3) return { factor: 1.0, sampleCount: 0 };

    // Query recent corrections where:
    // - intent = 'ESTIMATE_VALUATION'
    // - rating = -1 (user corrected the price)
    // - correction contains a numeric VNĐ value
    // - user_message (address) overlaps with current region
    // - within last 90 days
    const res = await pool.query(
      `SELECT correction, ai_response, metadata
       FROM ai_feedback
       WHERE tenant_id = $1
         AND intent = 'ESTIMATE_VALUATION'
         AND rating = -1
         AND correction IS NOT NULL
         AND correction ~ '^[0-9]+$'
         AND created_at >= NOW() - INTERVAL '90 days'
       ORDER BY created_at DESC
       LIMIT 50`,
      [tenantId]
    );

    if (!res.rows || res.rows.length === 0) return { factor: 1.0, sampleCount: 0 };

    // Parse corrections and filter to same region + property type
    const ratios: number[] = [];
    for (const row of res.rows) {
      try {
        const meta = row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : {};
        // Check region match via metadata.address or ai_response
        const corrAddr = (meta.address || row.ai_response || '').toLowerCase();
        const corrPType = meta.propertyType || '';

        // Region overlap: at least one token from current region appears in correction address
        const tokens = regionTokens.split(/\s+/).filter(t => t.length > 3);
        const regionMatch = tokens.some(t => corrAddr.includes(t));
        if (!regionMatch) continue;

        // Property type match (optional — only filter if both known)
        if (corrPType && propertyType && corrPType !== propertyType) continue;

        // Compute ratio: actualPriceVnd / estimatedPriceVnd
        const actualVnd  = parseFloat(row.correction);
        // Estimated price in metadata (preferred) or parse from ai_response "X.XX tỷ VNĐ"
        let estimatedVnd: number | null = meta.totalPrice ? parseFloat(meta.totalPrice) : null;
        if (!estimatedVnd) {
          const m = (row.ai_response || '').match(/([\d.]+)\s*tỷ/);
          if (m) estimatedVnd = parseFloat(m[1]) * 1_000_000_000;
        }

        if (actualVnd > 0 && estimatedVnd && estimatedVnd > 0) {
          const ratio = actualVnd / estimatedVnd;
          // Sanity: only accept corrections between 0.5–2.0x (50% to 200% of estimate)
          if (ratio >= 0.5 && ratio <= 2.0) ratios.push(ratio);
        }
      } catch { /* skip malformed row */ }
    }

    if (ratios.length < 3) return { factor: 1.0, sampleCount: ratios.length };

    // Weighted average with recency (more recent = higher weight) — simple mean for now
    const avg = ratios.reduce((s, r) => s + r, 0) / ratios.length;

    // Blend: 70% engine estimate, 30% correction signal (avoid over-correcting)
    const blendedFactor = 0.70 + 0.30 * avg;

    // Cap at ±20%
    const capped = Math.max(0.80, Math.min(1.20, blendedFactor));
    logger.info(`[Valuation RLHF] Region "${regionTokens}" — ${ratios.length} corrections, avgRatio=${avg.toFixed(3)}, factor=${capped.toFixed(3)}`);
    return { factor: capped, sampleCount: ratios.length };
  } catch (err: any) {
    logger.warn('[Valuation RLHF] Could not load corrections:', err.message);
    return { factor: 1.0, sampleCount: 0 };
  }
}

/**
 * Strip property-type prefix keywords from an address string before market-data lookup.
 *
 * The market-data cache stores TOWNHOUSE reference prices keyed by location only.
 * When the user address includes type keywords (e.g. "căn hộ Vinhome …"), the AI
 * sometimes returns type-specific prices (apartment rates) instead of the townhouse
 * reference, causing the AVM to double-apply the type multiplier and undervalue the
 * property by ~40-50%.
 *
 * By stripping these prefixes we ensure the cache key is location-only and the AI
 * fetches a neutral reference price.
 */
function stripPropertyTypePrefix(address: string): string {
  const prefixes = [
    /^căn\s+hộ\s+/i,
    /^can\s+ho\s+/i,
    /^chung\s+cư\s+/i,
    /^nhà\s+phố\s+/i,
    /^nha\s+pho\s+/i,
    /^nhà\s+ở\s+/i,
    /^biệt\s+thự\s+/i,
    /^biet\s+thu\s+/i,
    /^đất\s+nền\s+/i,
    /^đất\s+/i,
    /^dat\s+nen\s+/i,
    /^kho\s+xưởng\s+/i,
    /^kho\s+xuong\s+/i,
    /^shophouse\s+/i,
    /^shop\s+house\s+/i,
    /^văn\s+phòng\s+/i,
    /^van\s+phong\s+/i,
    /^penthouse\s+/i,
    /^condotel\s+/i,
    /^officetel\s+/i,
    /^villa\s+/i,
    // Strip "dự án" / "du an" prefix so project names match regex correctly
    /^dự\s+án\s+/i,
    /^du\s+an\s+/i,
  ];
  let result = address.trim();
  for (const re of prefixes) {
    result = result.replace(re, '');
  }
  return result.trim();
}

export function createValuationRoutes(
  authenticateToken: any,
  aiRateLimit: any,
  optionalAuth: any,
  guestValuationRateLimit: any,
  userValuationRateLimit?: any,
): Router {
  const router = Router();

  // ──────────────────────────────────────────────────────────────────────────
  // POST /api/valuation/advanced
  // Guests: 1/day per IP | Auth users: 3/day per user ID
  // ──────────────────────────────────────────────────────────────────────────
  router.post(
    '/advanced',
    optionalAuth,
    (req: Request, res: Response, next: any) => {
      // Auth users → userValuationRateLimit (3/day); guests → guestValuationRateLimit (1/day)
      const limiter = (req as any).user
        ? (userValuationRateLimit || aiRateLimit)
        : guestValuationRateLimit;
      return limiter(req, res, next);
    },
    async (req: Request, res: Response) => {
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
        buildingAge,
        yearBuilt,
        bedrooms,
        monthlyRent: monthlyRentInput,
        roadTypeLabel,
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
      if (!['PINK_BOOK', 'CONTRACT', 'PENDING', 'WAITING'].includes(legalValue)) {
        return res.status(400).json({ error: 'legal must be PINK_BOOK, CONTRACT, PENDING, or WAITING' });
      }

      // Normalize buildingAge: prefer explicit buildingAge; fall back to computing from yearBuilt
      const CURRENT_YEAR_SERVER = new Date().getFullYear();
      let resolvedBuildingAge: number | undefined;
      if (buildingAge !== undefined && !isNaN(Number(buildingAge)) && Number(buildingAge) >= 0) {
        resolvedBuildingAge = Number(buildingAge);
      } else if (yearBuilt !== undefined && !isNaN(Number(yearBuilt))) {
        const yb = Number(yearBuilt);
        if (yb >= 1900 && yb <= CURRENT_YEAR_SERVER) {
          resolvedBuildingAge = CURRENT_YEAR_SERVER - yb;
        }
      }

      // ── Step 1: Get market base price (AI via cache) ──────────────────────
      let marketBasePrice: number;
      let aiConfidence: number;
      let marketTrend: string;
      let monthlyRent: number | undefined;
      let resolvedPropertyType: PropertyType;
      let marketDataSource: string;

      resolvedPropertyType = (propertyType || 'townhouse_center') as PropertyType;

      logger.info(`[Valuation] Request: "${address}" | ${areaNum}m² | ${resolvedPropertyType} | road=${roadWidthNum}m${roadTypeLabel ? ' (' + roadTypeLabel + ')' : ''} | legal=${legalValue}${resolvedBuildingAge !== undefined ? ' | age=' + resolvedBuildingAge + 'yr' : ''}${direction ? ' | dir=' + direction : ''}${frontageWidth ? ' | mtien=' + frontageWidth + 'm' : ''}${bedrooms !== undefined ? ' | ' + bedrooms + 'PN' : ''}`);

      // Strip property-type prefix keywords (e.g. "căn hộ", "nhà phố") from the address
      // so the cache key is location-only, preventing the AI from returning type-specific
      // prices that confuse the type multiplier logic.
      const marketAddress = stripPropertyTypePrefix(address);

      // Pass resolvedPropertyType so the cache uses a type-specific key
      // (e.g. "vinhome central park binh thanh:apartment_center") for non-townhouse types.
      // The cached price is then already accurate for that type and no multiplier is needed.
      const cacheEntry = skipCache ? null : await marketDataService.getMarketData(marketAddress, resolvedPropertyType);

      if (cacheEntry) {
        // Determine if this cache entry is type-specific (key contains ':' separator).
        // Type-specific entries have the correct price for the requested property type
        // and must NOT be multiplied again. Townhouse-reference entries (legacy baseline)
        // still need the type multiplier to project the price onto other property types.
        const isTypeSpecificCache = cacheEntry.normalizedKey.includes(':');
        let typeAdjustedPrice: number;
        if (isTypeSpecificCache) {
          // Price is already for the correct property type → use as-is
          typeAdjustedPrice = cacheEntry.pricePerM2;
          logger.info(`[Valuation] Cache hit (type-specific): ${cacheEntry.pricePerM2 / 1_000_000}tr/m² for ${resolvedPropertyType}`);
        } else {
          // Legacy townhouse reference → apply type multiplier
          const cacheTypeMult = PROPERTY_TYPE_PRICE_MULT[resolvedPropertyType] ?? 1.00;
          typeAdjustedPrice = resolvedPropertyType === 'townhouse_center' || resolvedPropertyType === 'townhouse_suburb'
            ? cacheEntry.pricePerM2
            : Math.round(cacheEntry.pricePerM2 * cacheTypeMult);
          logger.info(`[Valuation] Cache hit (townhouse ref): ${cacheEntry.pricePerM2 / 1_000_000}tr/m² → type-adjusted ${typeAdjustedPrice / 1_000_000}tr/m² (×${PROPERTY_TYPE_PRICE_MULT[resolvedPropertyType] ?? 1} for ${resolvedPropertyType})`);
        }
        marketBasePrice = typeAdjustedPrice;
        aiConfidence = cacheEntry.confidence;
        marketTrend = cacheEntry.marketTrend;
        // Rent from cache:
        // - For type-specific cache (apartment / villa / etc.): the cache was fetched
        //   with the correct property type, so the rent estimate IS type-accurate.
        //   Scale it by area (cache reference area = 70m²).
        // - For legacy townhouse-reference cache: only reuse rent for townhouse types.
        //   For other types let estimateFallbackRent() compute a type-specific value.
        if (cacheEntry.monthlyRentEstimate && cacheEntry.monthlyRentEstimate > 0) {
          const isTownhouseType = resolvedPropertyType === 'townhouse_center'
            || resolvedPropertyType === 'townhouse_suburb'
            || resolvedPropertyType === 'shophouse';
          if (isTypeSpecificCache || isTownhouseType) {
            const CACHE_RENT_REF_AREA = 70;
            const areaScale = Math.min(4, areaNum / CACHE_RENT_REF_AREA);
            monthlyRent = Math.round(cacheEntry.monthlyRentEstimate * areaScale * 10) / 10;
          }
        }
        marketDataSource = cacheEntry.source;
      } else {
        // Fallback to full AI call
        try {
          const { aiService } = await import('../ai');
          const aiResult = await aiService.getRealtimeValuation(
            address, areaNum, roadWidthNum, legal, propertyType,
            undefined,
            {
              buildingAge: resolvedBuildingAge,
              roadTypeLabel: roadTypeLabel || undefined,
              direction: direction || undefined,
              floorLevel: floorLevel !== undefined ? Number(floorLevel) : undefined,
              bedrooms: bedrooms !== undefined ? Number(bedrooms) : undefined,
            }
          );
          marketBasePrice = aiResult.basePrice;
          aiConfidence = aiResult.confidence;
          marketTrend = aiResult.marketTrend;
          monthlyRent = aiResult.incomeApproach?.monthlyRent;
          marketDataSource = 'AI_LIVE';
        } catch {
          // Regional table also uses correct type multiplier
          const regional = getRegionalBasePrice(address, resolvedPropertyType);
          marketBasePrice = regional.price;
          aiConfidence = regional.confidence;
          marketTrend = `Ước tính khu vực ${regional.region}`;
          marketDataSource = 'REGIONAL_TABLE';
        }
      }

      // ── Step 1b: Regional override guard ─────────────────────────────────
      // Cross-check marketBasePrice against the hardcoded regional/project table.
      // Known premium projects (Izumi, Aqua City, Phú Mỹ Hưng…) have reliable
      // streetOverride values. If the AI/cache returned a suspiciously low price
      // (< 55% of our known baseline), replace it with the regional value to avoid
      // under-valuation caused by Gemini returning generic district prices.
      {
        const regionalRef = getRegionalBasePrice(address, resolvedPropertyType);
        const threshold   = regionalRef.price * 0.55;
        if (marketBasePrice < threshold) {
          logger.warn(
            `[Valuation] marketBasePrice ${(marketBasePrice/1_000_000).toFixed(0)}M < regional floor ` +
            `${(threshold/1_000_000).toFixed(0)}M for "${address}" (${regionalRef.region}) — ` +
            `overriding to ${(regionalRef.price/1_000_000).toFixed(0)}M`
          );
          marketBasePrice  = regionalRef.price;
          aiConfidence     = Math.max(aiConfidence, regionalRef.confidence);
          marketDataSource = 'REGIONAL_OVERRIDE';
        }
      }

      // ── Step 2: Get internal comparable listings ──────────────────────────
      let internalCompsMedian: number | undefined;
      let internalCompsCount = 0;
      let comparables: any[] = [];

      if (!skipInternalComps && user?.tenantId) {
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
      // User-provided monthly rent (triệu VNĐ) takes precedence over all estimates
      if (monthlyRentInput !== undefined && !isNaN(Number(monthlyRentInput)) && Number(monthlyRentInput) > 0) {
        monthlyRent = Number(monthlyRentInput); // engine uses triệu VNĐ unit
      }
      if (!monthlyRent) {
        monthlyRent = estimateFallbackRent(marketBasePrice * areaNum, resolvedPropertyType, areaNum);
      }

      // NOTE on blending: when we hit the cache, `marketBasePrice` already IS the cache price.
      // Passing cachedMarketPrice = marketBasePrice would double-count it (same value treated as
      // two independent sources → artificial confidence boost). Only pass cachedMarketPrice
      // when the AI returned a FRESH price so the cache can serve as a cross-check.
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
        buildingAge: resolvedBuildingAge,
        bedrooms: bedrooms !== undefined ? Number(bedrooms) : undefined,
        // Multi-source blending — internal comps only (cache not double-counted)
        internalCompsMedian,
        internalCompsCount,
        // Only pass cachedMarketPrice when it is genuinely DIFFERENT from marketBasePrice
        // (i.e. when the route fetched a fresh AI price AND a cached reference is available)
        cachedMarketPrice: (!cacheEntry && marketDataSource === 'AI_LIVE') ? undefined : undefined,
        cachedConfidence: undefined,
      });

      // ── Step 4: Apply RLHF price correction (auth users with historical corrections) ──
      let rlhfFactor = 1.0;
      let rlhfSamples = 0;
      if (user?.tenantId) {
        const rlhf = await loadRlhfPriceCorrection(user.tenantId, address, resolvedPropertyType);
        rlhfFactor = rlhf.factor;
        rlhfSamples = rlhf.sampleCount;
      }

      // Apply RLHF factor to all price fields (only when correction is meaningful)
      const applyRlhf = (v: number) => rlhfFactor !== 1.0 ? Math.round(v * rlhfFactor) : v;
      const finalPricePerM2 = applyRlhf(avmResult.pricePerM2);
      const finalTotalPrice = applyRlhf(avmResult.totalPrice);
      const finalRangeMin   = applyRlhf(avmResult.rangeMin);
      const finalRangeMax   = applyRlhf(avmResult.rangeMax);
      const finalCompsPrice = avmResult.compsPrice ? applyRlhf(avmResult.compsPrice) : undefined;

      // ── Response ──────────────────────────────────────────────────────────
      const interactionId = crypto.randomUUID();
      res.json({
        interactionId,
        // Core valuation result
        basePrice: avmResult.marketBasePrice,
        pricePerM2: finalPricePerM2,
        totalPrice: finalTotalPrice,
        compsPrice: finalCompsPrice,
        rangeMin: finalRangeMin,
        rangeMax: finalRangeMax,
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
          rlhfFactor: rlhfFactor !== 1.0 ? rlhfFactor : undefined,
          rlhfSamples: rlhfSamples > 0 ? rlhfSamples : undefined,
        },
        comparables: {
          count: internalCompsCount,
          samples: comparables.slice(0, 5),
          medianPricePerM2: internalCompsMedian || null,
        },
        // Human-readable summary
        summary: {
          estimatedPrice: `${(finalTotalPrice / 1_000_000_000).toFixed(2)} tỷ VNĐ`,
          priceRange: `${(finalRangeMin / 1_000_000_000).toFixed(2)} – ${(finalRangeMax / 1_000_000_000).toFixed(2)} tỷ`,
          pricePerM2: `${(finalPricePerM2 / 1_000_000).toFixed(0)} triệu/m²`,
          confidenceLabel: avmResult.confidence >= 85 ? 'Rất cao' : avmResult.confidence >= 70 ? 'Cao' : avmResult.confidence >= 55 ? 'Trung bình' : 'Thấp',
          activeCoefficients: Object.keys(avmResult.coefficients).length,
          rlhfApplied: rlhfFactor !== 1.0,
        },
        // Echo back key inputs for display in result UI
        inputEcho: {
          area: areaNum,
          roadWidth: roadWidthNum,
          roadTypeLabel: roadTypeLabel || undefined,
          legal: legalValue,
          propertyType: resolvedPropertyType,
          buildingAge: resolvedBuildingAge,
          direction: direction || undefined,
          frontageWidth: frontageWidth !== undefined ? Number(frontageWidth) : undefined,
          bedrooms: bedrooms !== undefined ? Number(bedrooms) : undefined,
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
