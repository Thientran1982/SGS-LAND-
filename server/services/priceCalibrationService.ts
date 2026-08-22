/**
 * PriceCalibrationService — Self-learning AVM price engine
 *
 * Aggregates all price observations (AI, comps, transactions, manual)
 * stored in `market_price_history` and computes a calibrated price
 * per location in `avm_calibration`.
 *
 * Flow:
 *  1. MarketDataService writes every AI/comps fetch → market_price_history
 *  2. When a listing status → SOLD, the transaction price is recorded
 *  3. calibrateAll() (called nightly + on-demand) re-runs a robust weighted median
 *  4. ValuationEngine reads avm_calibration FIRST before static regional table
 *
 * Weight scheme (configurable per location):
 *   Transaction (actual sold): 50%  ← highest accuracy
 *   AI search (Gemini+Google): 35%  ← realtime but sometimes noisy
 *   Internal comps (own DB):   15%  ← limited by listing count
 *
 * When no transactions exist, weights shift to AI: 70% + comps: 30%.
 */

import { Pool } from 'pg';
import { createHash } from 'crypto';
import { logger } from '../middleware/logger';
import { valuationGoldSet, type VerifiedTransaction } from '../data/valuationGoldSet';
import {
  evaluateValuationGoldSet,
  type GoldSetEvaluation,
  type ValuationPrediction,
} from './valuationEvaluationService';

const CALIBRATION_WINDOW_DAYS = 90;
const TRANSACTION_WEIGHT = 0.50;
const AI_WEIGHT_WITH_TXN  = 0.35;
const COMPS_WEIGHT         = 0.15;
const AI_WEIGHT_NO_TXN     = 0.70;
const COMPS_WEIGHT_NO_TXN  = 0.30;

export function validateCalibrationSamples(samples: Array<{ price: number; count: number }>): {
  safe: boolean; poisoningScore: number; driftScore: number; reason?: string;
} {
  const prices = samples.filter(s => Number.isFinite(s.price) && s.price > 0).map(s => s.price);
  if (!prices.length) return { safe: false, poisoningScore: 1, driftScore: 0, reason: 'no_valid_samples' };
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const poisoningScore = max / min > 4 ? 1 : max / min > 2.5 ? 0.5 : 0;
  return {
    safe: poisoningScore < 1,
    poisoningScore,
    driftScore: 0,
    reason: poisoningScore >= 1 ? 'source_spread_exceeds_safety_limit' : undefined,
  };
}

export class PriceCalibrationService {
  private static instance: PriceCalibrationService;
  private pool: Pool | null = null;
  private calibrationTimer: NodeJS.Timeout | null = null;
  // RELIABILITY FIX (audit Medium): theo doi timer khoi dong de stop() don sach
  private startupTimer: NodeJS.Timeout | null = null;
  private isRunning = false;

  private constructor() {}

  static getInstance(): PriceCalibrationService {
    if (!PriceCalibrationService.instance) {
      PriceCalibrationService.instance = new PriceCalibrationService();
    }
    return PriceCalibrationService.instance;
  }

  /** Inject the PG pool from server startup */
  init(pool: Pool): void {
    this.pool = pool;
    // RELIABILITY FIX (audit Medium): guard chong dang ky timer trung neu init() bi goi lai
    if (this.calibrationTimer) {
      return;
    }
    // Run calibration at startup (after 30s delay) then every 6 hours
    this.startupTimer = setTimeout(() => this.calibrateAll().catch(e => logger.error('[Calibration] startup error:', e.message)), 30_000);
    if (typeof (this.startupTimer as any).unref === 'function') (this.startupTimer as any).unref();
    this.calibrationTimer = setInterval(
      () => this.calibrateAll().catch(e => logger.error('[Calibration] scheduled error:', e.message)),
      6 * 60 * 60 * 1_000,
    );
    // Consistent with the other in-process crons (bookingLifecycle, buyerPush,
    // campaignScheduler, tenantBranding) — unref() so this timer never keeps
    // the event loop alive on its own during a graceful shutdown.
    if (typeof (this.calibrationTimer as any).unref === 'function') (this.calibrationTimer as any).unref();
  }

  stop(): void {
    if (this.startupTimer) {
      clearTimeout(this.startupTimer);
      this.startupTimer = null;
    }
    if (this.calibrationTimer) {
      clearInterval(this.calibrationTimer);
      this.calibrationTimer = null;
    }
  }

  // ── Record a price observation ─────────────────────────────────────────────

  async recordObservation(opts: {
    locationKey: string;
    locationDisplay: string;
    pricePerM2: number;
    priceMin?: number;
    priceMax?: number;
    propertyType?: string;
    source: 'ai_search' | 'internal_comps' | 'manual' | 'transaction' | 'regional_table' | 'blended';
    confidence?: number;
    trendText?: string;
    sourceCount?: number;
    dataRecency?: string;
    listingId?: string | number;
    tenantId?: string;
  }): Promise<void> {
    if (!this.pool) return;
    if (!opts.pricePerM2 || opts.pricePerM2 < 1_000_000) return; // sanity guard
    try {
      await this.pool.query(
        `INSERT INTO market_price_history
           (location_key, location_display, price_per_m2, price_min, price_max,
            property_type, source, confidence, trend_text, source_count,
            data_recency, listing_id, tenant_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          opts.locationKey.slice(0, 120),
          opts.locationDisplay.slice(0, 255),
          Math.round(opts.pricePerM2),
          opts.priceMin ? Math.round(opts.priceMin) : null,
          opts.priceMax ? Math.round(opts.priceMax) : null,
          opts.propertyType || 'townhouse_center',
          opts.source,
          Math.round(Math.min(100, Math.max(0, opts.confidence ?? 60))),
          opts.trendText?.slice(0, 100) ?? null,
          opts.sourceCount ?? 1,
          opts.dataRecency ?? 'current_year',
          opts.listingId ?? null,
          opts.tenantId ?? null,
        ],
      );
    } catch (err: any) {
      logger.warn(`[Calibration] recordObservation failed: ${err.message}`);
    }
  }

  /** Called when a listing status changes to SOLD — records ground-truth price */
  async recordTransaction(opts: {
    locationKey: string;
    locationDisplay: string;
    pricePerM2: number;
    propertyType: string;
    confidence: number;
    listingId: string | number;
    tenantId: string;
  }): Promise<void> {
    await this.recordObservation({ ...opts, source: 'transaction' });
    // Trigger recalibration for this location in background
    setImmediate(() => this.calibrateLocation(opts.locationKey).catch(() => {}));
  }

  // ── Calibration logic ──────────────────────────────────────────────────────

  /** Re-calibrate all locations that have new history entries */
  async calibrateAll(): Promise<void> {
    if (!this.pool || this.isRunning) return;
    this.isRunning = true;
    const t0 = Date.now();
    try {
      const { rows } = await this.pool.query<{ location_key: string }>(
        `SELECT DISTINCT location_key FROM market_price_history
         WHERE recorded_at > NOW() - INTERVAL '${CALIBRATION_WINDOW_DAYS} days'`,
      );
      if (rows.length === 0) {
        logger.info('[Calibration] No new history — nothing to calibrate');
        return;
      }
      let updated = 0;
      for (const { location_key } of rows) {
        const ok = await this.calibrateLocation(location_key);
        if (ok) updated++;
      }
      logger.info(`[Calibration] calibrateAll done — ${updated}/${rows.length} updated in ${Date.now() - t0}ms`);
    } catch (err: any) {
      logger.error('[Calibration] calibrateAll error:', err.message);
    } finally {
      this.isRunning = false;
    }
  }

  /** Re-calibrate a single location */
  async calibrateLocation(locationKey: string): Promise<boolean> {
    if (!this.pool) return false;
    try {
      const { rows } = await this.pool.query<{
        source: string;
        median_price: string;
        cnt: string;
        location_display: string;
        property_type: string;
        avg_trend_text: string;
      }>(
        `SELECT
           source,
           ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_per_m2))) AS median_price,
           COUNT(*)::text            AS cnt,
           MAX(location_display)     AS location_display,
           property_type,
           MAX(trend_text)           AS avg_trend_text
         FROM market_price_history
         WHERE location_key = $1
           AND recorded_at  > NOW() - INTERVAL '${CALIBRATION_WINDOW_DAYS} days'
           AND price_per_m2 > 1000000
          GROUP BY source, property_type`,
        [locationKey],
      );
      if (rows.length === 0) return false;

      // A location key can contain observations from several property segments.
      // Never blend those prices. Prefer a segment with verified transactions;
      // otherwise use the segment with the most observations.
      const segmentScores = new Map<string, { txn: number; total: number }>();
      for (const row of rows) {
        const segment = row.property_type || 'townhouse_center';
        const score = segmentScores.get(segment) || { txn: 0, total: 0 };
        score.total += parseInt(row.cnt, 10) || 0;
        if (row.source === 'transaction') score.txn += parseInt(row.cnt, 10) || 0;
        segmentScores.set(segment, score);
      }
      const propertyType = [...segmentScores.entries()]
        .sort((a, b) => b[1].txn - a[1].txn || b[1].total - a[1].total)[0]?.[0]
        || 'townhouse_center';
      const segmentRows = rows.filter(row => (row.property_type || 'townhouse_center') === propertyType);

      const bySource: Record<string, { median: number; cnt: number }> = {};
      let locationDisplay = locationKey;
      let trendText: string | null = null;

      for (const r of segmentRows) {
        bySource[r.source] = { median: parseInt(r.median_price, 10), cnt: parseInt(r.cnt, 10) };
        locationDisplay = r.location_display || locationDisplay;
        trendText = trendText || r.avg_trend_text || null;
      }

      const aiPrice    = bySource['ai_search']?.median ?? bySource['blended']?.median ?? 0;
      const compsPrice = bySource['internal_comps']?.median ?? 0;
      const txnPrice   = bySource['transaction']?.median ?? 0;

      let calibrated: number;
      let aiW = 0, compsW = 0, txnW = 0;

      if (txnPrice > 0) {
        // Renormalize only over sources that really exist. Substituting the
        // transaction value for a missing source silently over-weighted it.
        txnW = TRANSACTION_WEIGHT;
        aiW = aiPrice > 0 ? AI_WEIGHT_WITH_TXN : 0;
        compsW = compsPrice > 0 ? COMPS_WEIGHT : 0;
      } else if (aiPrice > 0 && compsPrice > 0) {
        aiW    = AI_WEIGHT_NO_TXN;
        compsW = COMPS_WEIGHT_NO_TXN;
      } else if (aiPrice > 0) {
        aiW = 1;
      } else if (compsPrice > 0) {
        compsW = 1;
      }
      const weightTotal = aiW + compsW + txnW;
      if (weightTotal <= 0) return false;
      aiW /= weightTotal;
      compsW /= weightTotal;
      txnW /= weightTotal;
      calibrated = Math.round(
        (aiPrice * aiW) + (compsPrice * compsW) + (txnPrice * txnW)
      );

      if (!calibrated || calibrated < 1_000_000) return false;

      const totalSamples = Object.values(bySource).reduce((s, v) => s + v.cnt, 0);
      const sourceCount = Object.keys(bySource).length;
      // Confidence reflects evidence breadth, not just the fact that a row
      // exists. Keep sparse, non-transactional calibration below "high".
      const avgConfidence = Math.min(
        txnPrice > 0 && totalSamples >= 5 ? 90 : 82,
        42 + Math.min(totalSamples, 20) * 2 + (txnPrice > 0 ? 10 : 0) + Math.max(0, sourceCount - 1) * 4,
      );
      const sampleGuard = validateCalibrationSamples(Object.values(bySource).map(value => ({
        price: value.median, count: value.cnt,
      })));
      if (!sampleGuard.safe) {
        logger.warn(`[Calibration] rejected poisoned sample set for "${locationKey}": ${sampleGuard.reason}`);
        await this.pool.query(
          `INSERT INTO ai_calibration_versions
           (tenant_id,location_key,version,input_fingerprint,calibrated_price_per_m2,sample_count,
            quality_score,drift_score,poisoning_score,status,metadata_json)
           VALUES ($1,$2,COALESCE((SELECT MAX(version)+1 FROM ai_calibration_versions WHERE location_key=$2),1),
            $3,$4,$5,$6,$7,$8,'REJECTED',$9::jsonb)`,
          [null, locationKey, createHash('sha256').update(JSON.stringify(bySource)).digest('hex'),
            calibrated, totalSamples, avgConfidence / 100, sampleGuard.driftScore,
            sampleGuard.poisoningScore, JSON.stringify({ reason: sampleGuard.reason })],
        );
        return false;
      }
      const inputFingerprint = createHash('sha256').update(JSON.stringify({
        locationKey, bySource, calibrated, windowDays: CALIBRATION_WINDOW_DAYS,
      })).digest('hex');

      await this.pool.query(
        `INSERT INTO ai_calibration_versions
           (tenant_id,location_key,version,input_fingerprint,calibrated_price_per_m2,sample_count,
            quality_score,drift_score,poisoning_score,status,metadata_json)
         VALUES ($1,$2,COALESCE((SELECT MAX(version)+1 FROM ai_calibration_versions WHERE tenant_id IS NULL AND location_key=$2),1),
           $3,$4,$5,$6,$7,$8,'ACTIVE',$9::jsonb)
         ON CONFLICT (tenant_id, location_key, version) DO NOTHING`,
        [null, locationKey, inputFingerprint, calibrated, totalSamples, avgConfidence / 100,
          sampleGuard.driftScore, sampleGuard.poisoningScore, JSON.stringify({ sourceCounts: bySource })],
      );
      await this.pool.query(
        `INSERT INTO avm_calibration
           (location_key, location_display, calibrated_price_per_m2, property_type,
            sample_count, avg_ai_price, avg_comps_price, avg_transaction_price,
            ai_weight, comps_weight, txn_weight,
            confidence_score, trend_text, last_calibrated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW())
         ON CONFLICT (location_key) DO UPDATE SET
           calibrated_price_per_m2 = EXCLUDED.calibrated_price_per_m2,
           location_display        = EXCLUDED.location_display,
           property_type           = EXCLUDED.property_type,
           sample_count            = EXCLUDED.sample_count,
           avg_ai_price            = EXCLUDED.avg_ai_price,
           avg_comps_price         = EXCLUDED.avg_comps_price,
           avg_transaction_price   = EXCLUDED.avg_transaction_price,
           ai_weight               = EXCLUDED.ai_weight,
           comps_weight            = EXCLUDED.comps_weight,
           txn_weight              = EXCLUDED.txn_weight,
           confidence_score        = EXCLUDED.confidence_score,
           trend_text              = EXCLUDED.trend_text,
           last_calibrated_at      = NOW()`,
        [
          locationKey,
          locationDisplay,
          calibrated,
          propertyType,
          totalSamples,
          aiPrice || null,
          compsPrice || null,
          txnPrice || null,
          aiW,
          compsW,
          txnW,
          avgConfidence,
          trendText,
        ],
      );
      logger.debug(`[Calibration] ${locationKey} → ${(calibrated / 1_000_000).toFixed(0)}M/m² (${totalSamples} samples, txn=${txnPrice ? (txnPrice/1_000_000).toFixed(0) + 'M' : 'none'})`);
      return true;
    } catch (err: any) {
      logger.warn(`[Calibration] calibrateLocation failed for "${locationKey}": ${err.message}`);
      return false;
    }
  }

  // ── Query calibrated price ─────────────────────────────────────────────────

  /**
   * Returns the calibrated price for a location if one exists and is fresh.
   * Returns null if no calibration is available (fall through to static table).
   */
  async getCalibratedPrice(locationKey: string, maxAgeDays = 14): Promise<{
    pricePerM2: number;
    confidence: number;
    trendText: string | null;
    sampleCount: number;
    hasTxn: boolean;
    lastCalibrated: Date;
  } | null> {
    if (!this.pool) return null;
    try {
      const { rows } = await this.pool.query<{
        calibrated_price_per_m2: string;
        confidence_score: string;
        trend_text: string | null;
        sample_count: string;
        avg_transaction_price: string | null;
        last_calibrated_at: Date;
      }>(
        `SELECT calibrated_price_per_m2, confidence_score, trend_text,
                sample_count, avg_transaction_price, last_calibrated_at
         FROM avm_calibration
         WHERE location_key = $1
           AND last_calibrated_at > NOW() - INTERVAL '${maxAgeDays} days'
         LIMIT 1`,
        [locationKey],
      );
      if (rows.length === 0) return null;
      const r = rows[0];
      return {
        pricePerM2:     parseInt(r.calibrated_price_per_m2, 10),
        confidence:     parseInt(r.confidence_score, 10),
        trendText:      r.trend_text,
        sampleCount:    parseInt(r.sample_count, 10),
        hasTxn:         !!r.avg_transaction_price,
        lastCalibrated: r.last_calibrated_at,
      };
    } catch {
      return null;
    }
  }

  /**
   * Backtest the currently active location calibrations against verified
   * transactions. This intentionally does not write calibration data: a
   * report is evidence for a separate, guarded promotion decision.
   */
  async backtestGoldSet(
    transactions: readonly VerifiedTransaction[] = valuationGoldSet,
  ): Promise<GoldSetEvaluation> {
    const predictions: ValuationPrediction[] = [];
    if (this.pool) {
      const { rows } = await this.pool.query<{
        location_key: string;
        property_type: string;
        calibrated_price_per_m2: string;
      }>(
        `SELECT location_key, property_type, calibrated_price_per_m2
         FROM avm_calibration
         WHERE location_key = ANY($1::text[])`,
        [[...new Set(transactions.map(row => row.locationKey))]],
      );
      const bySegment = new Map(rows.map(row => [
        `${row.location_key}\u0000${row.property_type}`,
        Number(row.calibrated_price_per_m2),
      ]));
      for (const transaction of transactions) {
        const price = bySegment.get(`${transaction.locationKey}\u0000${transaction.propertyType}`);
        predictions.push(price && price > 0
          ? {
              transactionId: transaction.id,
              predictedPricePerM2: price,
              intervalMin: Math.round(price * 0.85),
              intervalMax: Math.round(price * 1.15),
            }
          : { transactionId: transaction.id, predictedPricePerM2: null, rejected: true });
      }
    }
    return evaluateValuationGoldSet(transactions, predictions);
  }

  // ── Admin: price history for a location ───────────────────────────────────

  async getPriceHistory(locationKey: string, days = 90): Promise<{
    recordedAt: Date;
    pricePerM2: number;
    source: string;
    confidence: number;
  }[]> {
    if (!this.pool) return [];
    try {
      const { rows } = await this.pool.query(
        `SELECT recorded_at, price_per_m2, source, confidence
         FROM market_price_history
         WHERE location_key = $1
           AND recorded_at > NOW() - INTERVAL '${days} days'
         ORDER BY recorded_at DESC
         LIMIT 200`,
        [locationKey],
      );
      return rows.map((r: any) => ({
        recordedAt: r.recorded_at,
        pricePerM2: parseInt(r.price_per_m2, 10),
        source:     r.source,
        confidence: parseInt(r.confidence, 10),
      }));
    } catch {
      return [];
    }
  }
}

export const priceCalibrationService = PriceCalibrationService.getInstance();
