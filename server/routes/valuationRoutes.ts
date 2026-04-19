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
import { priceCalibrationService } from '../services/priceCalibrationService';
import { listingRepository } from '../repositories/listingRepository';
import { logger } from '../middleware/logger';
import { pool } from '../db';
import { getMonthlyQuotaStatus, monthlyValuationQuota, VALUATION_PLAN_LIMITS, getUserPlan } from '../middleware/rateLimiter';
import {
  recordValuationUsage,
  getMonthlyReport,
  getCostAlertConfig,
  setCostAlertConfig,
  checkHardCap,
  reportToCsv,
  currentPeriod,
  COST_CONSTANTS,
  getPlanQuotas,
  setPlanQuota,
  checkPlanQuota,
  DEFAULT_PLAN_QUOTAS_USD,
} from '../services/valuationUsageService';
import { getFeatureBreakdown } from '../services/aiUsageService';

function normalizeAddrKey(addr: string): string {
  return addr.toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
}

const VN_PROVINCE_TOKENS: Array<{ token: string; rx: RegExp }> = [
  { token: 'ha noi',      rx: /\b(ha noi|hanoi)\b/ },
  { token: 'ho chi minh', rx: /\b(ho chi minh|hcm|saigon|sai gon|tphcm|tp hcm)\b/ },
  { token: 'hai phong',   rx: /\bhai phong\b/ },
  { token: 'da nang',     rx: /\bda nang\b/ },
  { token: 'can tho',     rx: /\bcan tho\b/ },
  { token: 'dong nai',    rx: /\bdong nai\b/ },
  { token: 'binh duong',  rx: /\bbinh duong\b/ },
  { token: 'ba ria vung tau', rx: /\b(ba ria vung tau|vung tau|ba ria)\b/ },
  { token: 'long an',     rx: /\blong an\b/ },
  { token: 'tien giang',  rx: /\btien giang\b/ },
  { token: 'ben tre',     rx: /\bben tre\b/ },
  { token: 'tay ninh',    rx: /\btay ninh\b/ },
  { token: 'binh phuoc',  rx: /\bbinh phuoc\b/ },
  { token: 'lam dong',    rx: /\blam dong\b/ },
  { token: 'khanh hoa',   rx: /\bkhanh hoa\b/ },
  { token: 'ninh thuan',  rx: /\bninh thuan\b/ },
  { token: 'binh thuan',  rx: /\bbinh thuan\b/ },
  { token: 'phu yen',     rx: /\bphu yen\b/ },
  { token: 'binh dinh',   rx: /\bbinh dinh\b/ },
  { token: 'quang ngai',  rx: /\bquang ngai\b/ },
  { token: 'quang nam',   rx: /\bquang nam\b/ },
  { token: 'thua thien hue', rx: /\b(thua thien hue|hue)\b/ },
  { token: 'quang tri',   rx: /\bquang tri\b/ },
  { token: 'quang binh',  rx: /\bquang binh\b/ },
  { token: 'ha tinh',     rx: /\bha tinh\b/ },
  { token: 'nghe an',     rx: /\bnghe an\b/ },
  { token: 'thanh hoa',   rx: /\bthanh hoa\b/ },
  { token: 'ninh binh',   rx: /\bninh binh\b/ },
  { token: 'nam dinh',    rx: /\bnam dinh\b/ },
  { token: 'thai binh',   rx: /\bthai binh\b/ },
  { token: 'ha nam',      rx: /\bha nam\b/ },
  { token: 'hung yen',    rx: /\bhung yen\b/ },
  { token: 'hai duong',   rx: /\bhai duong\b/ },
  { token: 'bac ninh',    rx: /\bbac ninh\b/ },
  { token: 'bac giang',   rx: /\bbac giang\b/ },
  { token: 'vinh phuc',   rx: /\bvinh phuc\b/ },
  { token: 'phu tho',     rx: /\bphu tho\b/ },
  { token: 'thai nguyen', rx: /\bthai nguyen\b/ },
  { token: 'lang son',    rx: /\blang son\b/ },
  { token: 'cao bang',    rx: /\bcao bang\b/ },
  { token: 'bac kan',     rx: /\bbac kan\b/ },
  { token: 'tuyen quang', rx: /\btuyen quang\b/ },
  { token: 'ha giang',    rx: /\bha giang\b/ },
  { token: 'lao cai',     rx: /\blao cai\b/ },
  { token: 'yen bai',     rx: /\byen bai\b/ },
  { token: 'son la',      rx: /\bson la\b/ },
  { token: 'dien bien',   rx: /\bdien bien\b/ },
  { token: 'lai chau',    rx: /\blai chau\b/ },
  { token: 'hoa binh',    rx: /\bhoa binh\b/ },
  { token: 'kon tum',     rx: /\bkon tum\b/ },
  { token: 'gia lai',     rx: /\bgia lai\b/ },
  { token: 'dak lak',     rx: /\bdak lak\b/ },
  { token: 'dak nong',    rx: /\bdak nong\b/ },
  { token: 'an giang',    rx: /\ban giang\b/ },
  { token: 'kien giang',  rx: /\bkien giang\b/ },
  { token: 'ca mau',      rx: /\bca mau\b/ },
  { token: 'bac lieu',    rx: /\bbac lieu\b/ },
  { token: 'soc trang',   rx: /\bsoc trang\b/ },
  { token: 'tra vinh',    rx: /\btra vinh\b/ },
  { token: 'vinh long',   rx: /\bvinh long\b/ },
  { token: 'hau giang',   rx: /\bhau giang\b/ },
  { token: 'dong thap',   rx: /\bdong thap\b/ },
];

function detectProvinceToken(normKey: string): string | null {
  for (const { token, rx } of VN_PROVINCE_TOKENS) {
    if (rx.test(normKey)) return token;
  }
  return null;
}

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
  _userValuationRateLimit?: any,
): Router {
  const router = Router();

  // ──────────────────────────────────────────────────────────────────────────
  // GET /api/valuation/quota
  // Read-only quota status for authenticated users — no increment.
  // ──────────────────────────────────────────────────────────────────────────
  router.get('/quota', optionalAuth, async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user) {
      return res.json({
        authenticated: false,
        guestLimit: 2,
        message: 'Đăng nhập để xem quota định giá AI.',
      });
    }
    try {
      const userId: string = user.id || user.userId || 'unknown';
      const tenantId: string = user.tenantId || userId;
      const quota = await getMonthlyQuotaStatus(userId, tenantId);
      const planLabels: Record<string, string> = {
        INDIVIDUAL: 'Miễn phí',
        TEAM: 'Team ($49/tháng)',
        ENTERPRISE: 'Enterprise ($199/tháng)',
      };
      return res.json({
        authenticated: true,
        ...quota,
        planLabel: planLabels[quota.plan] || quota.plan,
        planLimits: VALUATION_PLAN_LIMITS,
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'Không thể kiểm tra quota.' });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // POST /api/valuation/advanced
  // Auth users: monthly quota (plan-based) | Guests: 2/day per IP
  // ──────────────────────────────────────────────────────────────────────────
  router.post(
    '/advanced',
    optionalAuth,
    // Hard-cap guard runs BEFORE quota middleware so blocked requests do not
    // consume the user's monthly quota counter. Guests have no tenantId and
    // skip the check (the cap protects a tenant budget).
    async (req: Request, res: Response, next: any) => {
      try {
        const user = (req as any).user;
        if (user?.tenantId) {
          const cap = await checkHardCap(user.tenantId);
          if (cap) {
            logger.warn(
              `[Valuation] Hard cap reached for tenant=${user.tenantId} ` +
              `($${cap.spentUsd.toFixed(2)} ≥ $${cap.thresholdUsd.toFixed(2)}, period=${cap.period})`
            );
            return res.status(429).json({
              error: 'AI_COST_HARD_CAP',
              message:
                `Đã tạm dừng định giá AI: chi phí ước tính tháng ${cap.period} ` +
                `($${cap.spentUsd.toFixed(2)}) đã chạm ngưỡng giới hạn ($${cap.thresholdUsd.toFixed(2)}). ` +
                `Liên hệ quản trị viên để nâng ngưỡng hoặc tắt chế độ tự động chặn.`,
              spentUsd: cap.spentUsd,
              thresholdUsd: cap.thresholdUsd,
              period: cap.period,
            });
          }

          // Per-plan cost quota check — blocks plans that have hit their
          // tenant-configured monthly USD limit (e.g. FREE users).
          const planId = await getUserPlan(user.tenantId);
          (req as any).resolvedPlanId = planId;
          const planCap = await checkPlanQuota(user.tenantId, planId);
          if (planCap) {
            logger.warn(
              `[Valuation] Plan quota reached: tenant=${user.tenantId} plan=${planCap.planId} ` +
              `($${planCap.spentUsd.toFixed(2)} ≥ $${planCap.limitUsd.toFixed(2)}, period=${planCap.period})`
            );
            return res.status(429).json({
              error: 'AI_COST_PLAN_QUOTA_EXCEEDED',
              message:
                `Gói ${planCap.planLabel} đã dùng hết hạn mức chi phí AI tháng ${planCap.period} ` +
                `($${planCap.spentUsd.toFixed(2)} / $${planCap.limitUsd.toFixed(2)} USD). ` +
                `Vui lòng nâng cấp gói thuê bao để tiếp tục sử dụng định giá AI.`,
              planId: planCap.planId,
              planLabel: planCap.planLabel,
              spentUsd: planCap.spentUsd,
              limitUsd: planCap.limitUsd,
              period: planCap.period,
              upgradeHint: 'Nâng cấp lên gói cao hơn (TEAM hoặc ENTERPRISE) để có hạn mức AI lớn hơn.',
            });
          }
        }
      } catch (err: any) {
        logger.warn('[Valuation] hard-cap check failed (continuing):', err?.message);
      }
      return next();
    },
    (req: Request, res: Response, next: any) => {
      // Auth users → monthlyValuationQuota; guests → guestValuationRateLimit
      if ((req as any).user) {
        return monthlyValuationQuota(req, res, next);
      }
      return guestValuationRateLimit(req, res, next);
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
        listingId,
        // Override flags
        skipCache = false,
        skipInternalComps = false,
      } = req.body;

      if (!address || !area || !roadWidth || !legal) {
        return res.status(400).json({
          error: 'Missing required fields: address, area, roadWidth, legal'
        });
      }

      // Sanitize free-text address before it reaches any AI prompt
      const sanitizedAddress: string = String(address)
        .slice(0, 300)
        .replace(/[`\\]/g, '')
        .replace(/\n{3,}/g, '\n')
        .replace(/\b(?:ignore|system\s+prompt|instruction|override|jailbreak)\b/gi, '[x]')
        .trim();
      if (!sanitizedAddress) return res.status(400).json({ error: 'Invalid address' });

      // Re-assign so rest of handler uses sanitized value
      (req.body as any).address = sanitizedAddress;
      const addressClean: string = sanitizedAddress;

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

      logger.info(`[Valuation] Request: "${addressClean}" | ${areaNum}m² | ${resolvedPropertyType} | road=${roadWidthNum}m${roadTypeLabel ? ' (' + roadTypeLabel + ')' : ''} | legal=${legalValue}${resolvedBuildingAge !== undefined ? ' | age=' + resolvedBuildingAge + 'yr' : ''}${direction ? ' | dir=' + direction : ''}${frontageWidth ? ' | mtien=' + frontageWidth + 'm' : ''}${bedrooms !== undefined ? ' | ' + bedrooms + 'PN' : ''}`);

      // Strip property-type prefix keywords (e.g. "căn hộ", "nhà phố") from the address
      // so the cache key is location-only, preventing the AI from returning type-specific
      // prices that confuse the type multiplier logic.
      const marketAddress = stripPropertyTypePrefix(addressClean);

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
            addressClean, areaNum, roadWidthNum, legal, propertyType,
            user?.tenantId,
            {
              buildingAge: resolvedBuildingAge,
              roadTypeLabel: roadTypeLabel || undefined,
              direction: direction || undefined,
              floorLevel: floorLevel !== undefined ? Number(floorLevel) : undefined,
              bedrooms: bedrooms !== undefined ? Number(bedrooms) : undefined,
              listingId: listingId || undefined,
            }
          );
          marketBasePrice = aiResult.basePrice;
          aiConfidence = aiResult.confidence;
          marketTrend = aiResult.marketTrend;
          monthlyRent = aiResult.incomeApproach?.monthlyRent;
          marketDataSource = 'AI_LIVE';
        } catch {
          // Regional table also uses correct type multiplier
          const regional = getRegionalBasePrice(addressClean, resolvedPropertyType);
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
        const regionalRef = getRegionalBasePrice(addressClean, resolvedPropertyType);
        const threshold   = regionalRef.price * 0.55;
        if (marketBasePrice < threshold) {
          logger.warn(
            `[Valuation] marketBasePrice ${(marketBasePrice/1_000_000).toFixed(0)}M < regional floor ` +
            `${(threshold/1_000_000).toFixed(0)}M for "${addressClean}" (${regionalRef.region}) — ` +
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
            location: addressClean,
            area: areaNum,
            propertyType: resolvedPropertyType,
            maxSamples: 15,
          });

          if (comps.count >= 2) {
            internalCompsMedian = comps.medianPricePerM2;
            internalCompsCount = comps.count;
            comparables = comps.samples;
            logger.info(`[Valuation] Internal comps: ${comps.count} listings, median=${(comps.medianPricePerM2 / 1_000_000).toFixed(0)} tr/m²`);
            // Feed internal comps signal into self-learning calibration
            const compsKey = normalizeAddrKey(addressClean);
            setImmediate(() =>
              priceCalibrationService.recordObservation({
                locationKey:     compsKey,
                locationDisplay: addressClean,
                pricePerM2:      comps.medianPricePerM2,
                propertyType:    resolvedPropertyType,
                source:          'internal_comps',
                confidence:      Math.min(85, 50 + comps.count * 5),
                tenantId:        user?.tenantId,
              }).catch(() => {})
            );
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
        const rlhf = await loadRlhfPriceCorrection(user.tenantId, addressClean, resolvedPropertyType);
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

      // ── Record usage for cost report (fire-and-forget) ────────────────────
      try {
        const aiCalls = marketDataSource === 'AI_LIVE' ? 2 : (cacheEntry ? 0 : 1);
        recordValuationUsage({
          tenantId: user?.tenantId || null,
          userId: user?.id || user?.userId || null,
          planId: (req as any).quotaInfo?.plan || (user ? null : 'GUEST'),
          endpoint: 'advanced',
          source: marketDataSource,
          aiCalls,
          isGuest: !user,
          ipAddress: req.ip,
          addressHint: addressClean.slice(0, 120),
        }).catch(() => {});
      } catch { /* never fail the response */ }

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
        // Quota info — helps frontend show remaining uses without extra round-trip
        quota: (req as any).quotaInfo || null,
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
    if (!['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD'].includes(user.role)) {
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
  // GET /api/valuation/teaser  (PUBLIC — no auth required)
  // Returns a rough price-range estimate using market_price_history only.
  // Zero AI token consumption. Used for guest-facing pre-registration UI.
  //
  // Query params:
  //   location  (string, required) — address / district / city
  //   area      (number, required) — property area in m²
  //   type      (string, optional) — PropertyType enum value
  //   listing_id (number, optional) — if provided, auto-resolves location+area
  // ──────────────────────────────────────────────────────────────────────────
  router.get('/teaser', async (req: Request, res: Response) => {
    const rawLocation = (req.query.location as string | undefined)?.trim();
    const rawArea     = req.query.area as string | undefined;
    const propertyType = (req.query.type as string | undefined) || 'townhouse_center';
    const listingIdParam = req.query.listing_id as string | undefined;

    let location = rawLocation;
    let area     = rawArea ? parseFloat(rawArea) : NaN;

    // Auto-resolve from listing when listing_id is provided
    if (listingIdParam) {
      const listingId = parseInt(listingIdParam, 10);
      if (!isNaN(listingId)) {
        try {
          const { withRlsBypass } = await import('../db');
          const lRow = await withRlsBypass((client) => client.query(
            `SELECT address, area, property_type FROM listings WHERE id = $1 LIMIT 1`,
            [listingId]
          ));
          if (lRow.rows.length > 0) {
            const l = lRow.rows[0];
            if (!location && l.address) location = l.address;
            if (isNaN(area) && l.area)   area     = parseFloat(l.area);
            if (propertyType === 'townhouse_center' && l.property_type) {
              // don't override user-supplied type
            }
          }
        } catch { /* ignore, proceed with query params */ }
      }
    }

    if (!location || isNaN(area) || area <= 0) {
      return res.status(400).json({ error: 'location and area are required' });
    }

    try {
      const normalKey = normalizeAddrKey(location);
      const inputProvince = detectProvinceToken(normalKey);

      // ── 1. Look up market_price_history (regional_table rows preferred) ──
      const histResult = await pool.query<{
        location_display: string;
        price_per_m2: string;
        price_min: string | null;
        price_max: string | null;
        confidence: number;
        trend_text: string | null;
        source: string;
        recorded_at: string;
        similarity: number;
      }>(
        `SELECT
           location_display,
           price_per_m2,
           price_min,
           price_max,
           confidence,
           trend_text,
           source,
           recorded_at,
           -- simple contains-score: 1 if exact, 0.5 if partial
           CASE
             WHEN location_key = $1 THEN 1.0
             WHEN location_key LIKE '%' || SPLIT_PART($1, ' ', 1) || '%' THEN 0.6
             WHEN $1 LIKE '%' || SPLIT_PART(location_key, ' ', 1) || '%' THEN 0.5
             ELSE 0.0
           END AS similarity
         FROM market_price_history
         WHERE
           location_key = $1
           OR (
             length($1) >= 6
             AND (
               location_key LIKE '%' || SPLIT_PART($1, ' ', array_length(string_to_array($1,' '),1)) || '%'
               OR $1 LIKE '%' || SPLIT_PART(location_key, ' ', array_length(string_to_array(location_key,' '),1)) || '%'
             )
           )
         ORDER BY similarity DESC, recorded_at DESC
         LIMIT 5`,
        [normalKey]
      );

      let pricePerM2: number;
      let priceMin: number;
      let priceMax: number;
      let locationDisplay: string;
      let confidence: number;
      let trendText: string;
      let dataSource: string;
      let dataAge: string;
      let foundMatch = false;

      // Cross-province collision guard: drop rows whose location_key references
      // a different VN province than the input address. Prevents Hai Phong's
      // "Ngô Quyền" district (also a common street name nationwide) from
      // bleeding into Đồng Nai/HCM addresses.
      const safeRows = inputProvince
        ? histResult.rows.filter(r => {
            const rowProvince = detectProvinceToken(r.location_display ? normalizeAddrKey(r.location_display) : '')
              || detectProvinceToken((r as any).location_key || '');
            return !rowProvince || rowProvince === inputProvince;
          })
        : histResult.rows;

      if (safeRows.length > 0) {
        const row = safeRows[0];
        pricePerM2     = parseInt(row.price_per_m2, 10);
        priceMin       = row.price_min ? parseInt(row.price_min, 10) : Math.round(pricePerM2 * 0.85);
        priceMax       = row.price_max ? parseInt(row.price_max, 10) : Math.round(pricePerM2 * 1.15);
        // Always prefer the user's input as the display label so the UI mirrors
        // the listing address exactly (no surprise district/province swap).
        locationDisplay = location;
        confidence      = row.confidence ?? 65;
        // Rebuild trend text from the input address — never echo the stored
        // trend_text directly because legacy rows may carry a stale region
        // label from a prior buggy regional inference.
        const cleanLoc  = location.replace(/\s+/g, ' ').trim().slice(0, 80);
        trendText       = row.source === 'regional_table'
          ? `Tham chiếu khu vực ${cleanLoc} — bảng giá cập nhật định kỳ`
          : `Ước tính thị trường tại ${cleanLoc}`;
        dataSource      = row.source === 'regional_table' ? 'Dữ liệu thị trường Q1/2025' : 'Dữ liệu thị trường';
        const recordedAt = new Date(row.recorded_at);
        const ageMs      = Date.now() - recordedAt.getTime();
        const ageDays    = Math.floor(ageMs / 86_400_000);
        dataAge          = ageDays < 7 ? 'Vừa cập nhật' : ageDays < 30 ? `${ageDays} ngày trước` : 'Hơn 1 tháng trước';
        foundMatch       = true;
      } else {
        // ── 2. Fallback to getRegionalBasePrice() from valuationEngine ────
        const fallbackResult = getRegionalBasePrice(location);
        pricePerM2     = fallbackResult.price;
        priceMin       = Math.round(fallbackResult.price * 0.80);
        priceMax       = Math.round(fallbackResult.price * 1.25);
        locationDisplay = location;
        confidence      = fallbackResult.confidence;
        const cleanLoc2 = location.replace(/\s+/g, ' ').trim().slice(0, 80);
        trendText       = `Tham chiếu khu vực ${cleanLoc2}`;
        dataSource      = 'Bảng giá tham chiếu';
        dataAge         = 'Dữ liệu tham chiếu';
      }

      // Apply property-type multiplier (same logic as advanced endpoint)
      const typeMult = PROPERTY_TYPE_PRICE_MULT[propertyType as PropertyType] ?? 1.0;
      if (typeMult !== 1.0 && propertyType !== 'townhouse_center' && propertyType !== 'townhouse_suburb') {
        pricePerM2 = Math.round(pricePerM2 * typeMult);
        priceMin   = Math.round(priceMin   * typeMult);
        priceMax   = Math.round(priceMax   * typeMult);
      }

      // Compute total value range
      const totalMin = Math.round(priceMin * area);
      const totalMid = Math.round(pricePerM2 * area);
      const totalMax = Math.round(priceMax * area);

      const formatBillion = (v: number) => {
        if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)} tỷ`;
        if (v >= 1_000_000)     return `${(v / 1_000_000).toFixed(0)} triệu`;
        return `${v.toLocaleString('vi-VN')} ₫`;
      };

      res.json({
        found:          foundMatch,
        locationDisplay,
        pricePerM2,
        priceMin,
        priceMax,
        pricePerM2Display: `${(pricePerM2 / 1_000_000).toFixed(0)} triệu/m²`,
        totalMin,
        totalMid,
        totalMax,
        totalMinDisplay: formatBillion(totalMin),
        totalMidDisplay: formatBillion(totalMid),
        totalMaxDisplay: formatBillion(totalMax),
        area,
        confidence,
        trendText,
        dataSource,
        dataAge,
      });
    } catch (err: any) {
      logger.error('[Valuation] Teaser error:', err);
      res.status(500).json({ error: 'Failed to compute teaser estimate' });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GET /api/valuation/cache-status (admin only)
  // ──────────────────────────────────────────────────────────────────────────
  router.get('/cache-status', authenticateToken, async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
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

  // ──────────────────────────────────────────────────────────────────────────
  // ADMIN: Monthly AI cost report (GET /admin/cost-report?month=YYYY-MM)
  // ──────────────────────────────────────────────────────────────────────────
  router.get('/admin/cost-report', authenticateToken, async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
      return res.status(403).json({ error: 'Admin only' });
    }
    try {
      const period = (req.query.month as string) || currentPeriod();
      if (!/^\d{4}-\d{2}$/.test(period)) {
        return res.status(400).json({ error: 'month must be YYYY-MM' });
      }
      const report = await getMonthlyReport(period, { tenantId: user.tenantId, topUsersLimit: 10 });
      const alertConfig = await getCostAlertConfig(user.tenantId);
      const featureBreakdown = await getFeatureBreakdown(period, { tenantId: user.tenantId });
      const planQuotas = await getPlanQuotas(user.tenantId, period);
      return res.json({
        report,
        alertConfig,
        planQuotas,
        scope: 'tenant',
        pricing: COST_CONSTANTS,
        featureBreakdown,
      });
    } catch (err: any) {
      logger.error('[Valuation cost-report] error', err);
      return res.status(500).json({ error: 'Failed to load cost report', detail: err.message });
    }
  });

  router.get('/admin/cost-report.csv', authenticateToken, async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
      return res.status(403).json({ error: 'Admin only' });
    }
    try {
      const period = (req.query.month as string) || currentPeriod();
      if (!/^\d{4}-\d{2}$/.test(period)) {
        return res.status(400).json({ error: 'month must be YYYY-MM' });
      }
      const report = await getMonthlyReport(period, { tenantId: user.tenantId, topUsersLimit: 50 });
      const csv = reportToCsv(report);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="valuation-cost-${period}.csv"`,
      );
      return res.send('\uFEFF' + csv); // BOM for Excel UTF-8
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to export CSV', detail: err.message });
    }
  });

  router.get('/admin/cost-alert-config', authenticateToken, async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!['SUPER_ADMIN', 'ADMIN'].includes(user.role)) return res.status(403).json({ error: 'Admin only' });
    try {
      const cfg = await getCostAlertConfig(user.tenantId);
      return res.json(cfg);
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed', detail: err.message });
    }
  });

  router.put('/admin/cost-alert-config', authenticateToken, async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!['SUPER_ADMIN', 'ADMIN'].includes(user.role)) return res.status(403).json({ error: 'Admin only' });
    try {
      const { thresholdUsd, alertEmail, warnPercent, hardCapEnabled } = req.body || {};
      const cfg = await setCostAlertConfig(user.tenantId, {
        thresholdUsd: Number(thresholdUsd) || 0,
        alertEmail: alertEmail ? String(alertEmail).slice(0, 255) : null,
        warnPercent: warnPercent !== undefined ? Number(warnPercent) : undefined,
        hardCapEnabled: !!hardCapEnabled,
      });
      return res.json(cfg);
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to save', detail: err.message });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // ADMIN: Per-plan AI cost quotas
  // ──────────────────────────────────────────────────────────────────────────
  router.get('/admin/plan-quotas', authenticateToken, async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!['SUPER_ADMIN', 'ADMIN'].includes(user.role)) return res.status(403).json({ error: 'Admin only' });
    try {
      const period = (req.query.month as string) || currentPeriod();
      if (!/^\d{4}-\d{2}$/.test(period)) {
        return res.status(400).json({ error: 'month must be YYYY-MM' });
      }
      const planQuotas = await getPlanQuotas(user.tenantId, period);
      return res.json({ period, planQuotas, defaults: DEFAULT_PLAN_QUOTAS_USD });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to load plan quotas', detail: err.message });
    }
  });

  router.put('/admin/plan-quotas', authenticateToken, async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!['SUPER_ADMIN', 'ADMIN'].includes(user.role)) return res.status(403).json({ error: 'Admin only' });
    try {
      const { planId, monthlyCostLimitUsd } = req.body || {};
      if (!planId || typeof planId !== 'string') {
        return res.status(400).json({ error: 'planId is required' });
      }
      const limit = Number(monthlyCostLimitUsd);
      if (!Number.isFinite(limit) || limit < 0) {
        return res.status(400).json({ error: 'monthlyCostLimitUsd must be a non-negative number' });
      }
      await setPlanQuota(user.tenantId, planId, limit);
      const planQuotas = await getPlanQuotas(user.tenantId);
      return res.json({ planQuotas });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to save plan quota', detail: err.message });
    }
  });

  return router;
}
