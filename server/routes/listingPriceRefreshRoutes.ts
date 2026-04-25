/**
 * listingPriceRefreshRoutes.ts
 *
 * Endpoint nội bộ được QStash gọi mỗi ngày lúc 4:00 SA (ICT).
 * Agent AI tự động cập nhật giá từng căn theo thị trường bằng AVM engine:
 *   1. Lấy tất cả listing AVAILABLE/BOOKING/HOLD có area > 0
 *   2. Lấy giá thị trường từ cache (Redis / in-memory) theo địa chỉ
 *   3. Áp dụng hệ số AVM: tầng, hướng, diện tích, pháp lý...
 *   4. Nếu chênh lệch > threshold thì cập nhật và ghi log
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { logger } from '../middleware/logger';
import { applyAVM, getRegionalBasePrice, PROPERTY_TYPE_PRICE_MULT } from '../valuationEngine';
import type { PropertyType, LegalStatus } from '../valuationEngine';
import { marketDataService } from '../services/marketDataService';

const REFRESH_THRESHOLD = 0.05;      // Chênh lệch > 5% thì cập nhật
const BATCH_SIZE        = 50;         // Xử lý theo lô để tránh quá tải
const MAX_LISTINGS      = 2000;       // Giới hạn tổng số listing mỗi lần chạy

function mapListingType(type: string): PropertyType {
  const t = (type || '').toLowerCase();
  if (t === 'apartment')     return 'apartment_center';
  if (t === 'house')         return 'townhouse_center';
  if (t === 'villa')         return 'villa';
  if (t === 'land')          return 'land_urban';
  if (t === 'shophouse')     return 'shophouse';
  if (t === 'penthouse')     return 'penthouse';
  if (t === 'office')        return 'office';
  if (t === 'warehouse')     return 'warehouse';
  return 'townhouse_center';
}

function mapLegal(raw?: string): LegalStatus {
  if (!raw) return 'CONTRACT';
  const r = raw.toUpperCase();
  if (r.includes('PINK') || r === 'PINKBOOK') return 'PINK_BOOK';
  if (r === 'PENDING') return 'PENDING';
  if (r === 'WAITING') return 'WAITING';
  return 'CONTRACT';
}

function mapDirection(raw?: string): string {
  if (!raw) return 'S';
  const map: Record<string, string> = {
    north: 'N', nam: 'S', south: 'S', bac: 'N',
    east: 'E', dong: 'E', west: 'W', tay: 'W',
    northeast: 'NE', 'dong-bac': 'NE', 'đông bắc': 'NE',
    northwest: 'NW', 'tay-bac': 'NW', 'tây bắc': 'NW',
    southeast: 'SE', 'dong-nam': 'SE', 'đông nam': 'SE',
    southwest: 'SW', 'tay-nam': 'SW', 'tây nam': 'SW',
    n: 'N', s: 'S', e: 'E', w: 'W',
    ne: 'NE', nw: 'NW', se: 'SE', sw: 'SW',
  };
  const key = raw.toLowerCase().replace(/\s+/g, '-');
  return map[key] ?? 'S';
}

export function createListingPriceRefreshRouter(pool: Pool, cronSecret: string): Router {
  const router = Router();

  router.post('/api/internal/listing-price-refresh', async (req: Request, res: Response) => {
    const providedSecret =
      req.headers['x-internal-secret'] as string | undefined ||
      req.body?.secret as string | undefined;

    if (!providedSecret || providedSecret !== cronSecret) {
      logger.warn('[PriceRefresh] Từ chối — sai secret');
      return res.status(403).json({ error: 'Forbidden' });
    }

    const dryRun    = req.body?.dry_run === true;
    const tenantId  = req.body?.tenantId || 'all';
    const threshold = Number(req.body?.threshold ?? REFRESH_THRESHOLD);
    const startedAt = Date.now();

    logger.info(`[PriceRefresh] Bắt đầu${dryRun ? ' (dry-run)' : ''} — tenantId=${tenantId} — ${new Date().toISOString()}`);

    const stats = { total: 0, updated: 0, skipped: 0, failed: 0, skipped_no_market: 0 };

    try {
      const tenantFilter = tenantId === 'all' ? '' : `AND tenant_id = '${tenantId.replace(/'/g, "''")}'`;
      const { rows: listings } = await pool.query(`
        SELECT id, tenant_id, title, location, type, price, area,
               attributes, project_code
        FROM listings
        WHERE status IN ('AVAILABLE','BOOKING','HOLD')
          AND area IS NOT NULL AND area > 0
          AND location IS NOT NULL AND length(trim(location)) > 3
          ${tenantFilter}
        ORDER BY updated_at ASC
        LIMIT $1
      `, [MAX_LISTINGS]);

      stats.total = listings.length;
      logger.info(`[PriceRefresh] Tìm thấy ${listings.length} listing cần xem xét`);

      for (let i = 0; i < listings.length; i += BATCH_SIZE) {
        const batch = listings.slice(i, i + BATCH_SIZE);

        await Promise.all(batch.map(async (listing) => {
          try {
            const pType = mapListingType(listing.type);
            const area  = Number(listing.area);
            const attr  = listing.attributes || {};

            const marketEntry = await marketDataService.getMarketData(listing.location, pType).catch(() => null);

            let marketBasePrice: number;
            let confidence: number;
            let marketTrend: string;

            if (marketEntry && marketEntry.pricePerM2 > 0) {
              const mult = PROPERTY_TYPE_PRICE_MULT[pType] ?? 1.0;
              marketBasePrice = Math.round(marketEntry.pricePerM2 * mult);
              confidence      = marketEntry.confidence;
              marketTrend     = marketEntry.marketTrend;
            } else {
              const regional = getRegionalBasePrice(listing.location, pType);
              if (!regional || regional.price <= 0) {
                stats.skipped_no_market++;
                return;
              }
              marketBasePrice = regional.price;
              confidence      = 40;
              marketTrend     = 'stable';
            }

            const avmInput = {
              marketBasePrice,
              area,
              roadWidth:    Number(attr.roadWidth) || 6,
              legal:        mapLegal(attr.legalStatus),
              confidence,
              marketTrend,
              propertyType: pType,
              floorLevel:   Number(attr.floor)     || undefined,
              direction:    mapDirection(attr.direction),
              frontageWidth: Number(attr.frontage) || undefined,
              furnishing:   attr.furnishing        || undefined,
              buildingAge:  Number(attr.buildingAge)|| undefined,
              bedrooms:     Number(attr.bedrooms)  || undefined,
            };

            const avmResult = applyAVM(avmInput as any);
            const newPrice  = Math.round(avmResult.totalPrice);
            const oldPrice  = Number(listing.price) || 0;

            if (oldPrice > 0) {
              const diff = Math.abs(newPrice - oldPrice) / oldPrice;
              if (diff < threshold) {
                stats.skipped++;
                return;
              }
            }

            if (!dryRun) {
              await pool.query(
                `UPDATE listings SET price = $1, updated_at = NOW() WHERE id = $2`,
                [newPrice, listing.id]
              );

              await pool.query(
                `INSERT INTO listing_price_refresh_log
                   (tenant_id, listing_id, old_price, new_price, price_per_m2, confidence, source)
                 VALUES ($1,$2,$3,$4,$5,$6,'avm_cron')`,
                [
                  listing.tenant_id, listing.id,
                  oldPrice || null, newPrice,
                  Math.round(avmResult.pricePerM2),
                  avmResult.confidence,
                ]
              );
            }

            stats.updated++;
          } catch (err: any) {
            logger.warn(`[PriceRefresh] Lỗi listing ${listing.id}: ${err.message}`);
            stats.failed++;
          }
        }));
      }

      const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
      logger.info(`[PriceRefresh] Hoàn thành trong ${elapsed}s — ${JSON.stringify(stats)}`);

      return res.json({
        ok: true,
        dryRun,
        elapsed_s: parseFloat(elapsed),
        stats,
      });
    } catch (err: any) {
      logger.error('[PriceRefresh] Lỗi nghiêm trọng:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}
