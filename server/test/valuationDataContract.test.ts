import { describe, expect, it } from 'vitest';

import {
  buildMarketObservationProvenance,
  getFreshnessStatus,
  normalizeAreaM2,
  normalizeMonthlyRentMillionVnd,
  normalizePricePerM2,
  normalizeYieldFraction,
  VALUATION_UNITS,
} from '../services/valuationDataContract';

describe('valuation data contract', () => {
  it('keeps market and total prices in distinct explicit units', () => {
    expect(VALUATION_UNITS.marketPricePerM2).toBe('VND_PER_M2');
    expect(VALUATION_UNITS.totalPrice).toBe('VND_TOTAL');
    expect(normalizePricePerM2('125000000')).toBe(125_000_000);
    expect(normalizePricePerM2(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('rejects invalid or implausible area, rent, and yield values', () => {
    expect(normalizeAreaM2(80)).toBe(80);
    expect(normalizeAreaM2(0)).toBeNull();
    expect(normalizeAreaM2(Number.NaN)).toBeNull();
    expect(normalizeMonthlyRentMillionVnd(25)).toBe(25);
    expect(normalizeMonthlyRentMillionVnd(Number.POSITIVE_INFINITY)).toBeNull();
    expect(normalizeYieldFraction(0.045)).toBe(0.045);
    expect(normalizeYieldFraction(1.2)).toBeNull();
  });

  it('makes freshness and provenance explicit instead of inferring them from a cache key', () => {
    const now = Date.parse('2026-09-17T00:00:00.000Z');
    expect(getFreshnessStatus('2026-09-18T00:00:00.000Z', now)).toBe('FRESH');
    expect(getFreshnessStatus('2026-09-16T00:00:00.000Z', now)).toBe('STALE');
    expect(getFreshnessStatus(null, now)).toBe('UNKNOWN');

    expect(buildMarketObservationProvenance({
      source: 'AI',
      locationKey: 'quan 1 tp hcm',
      propertyType: 'apartment_center',
      observedAt: '2026-09-17T00:00:00.000Z',
      expiresAt: '2026-09-18T00:00:00.000Z',
      tenantId: null,
    })).toMatchObject({
      source: 'AI',
      propertyType: 'apartment_center',
      priceUnit: 'VND_PER_M2',
      scope: 'GLOBAL',
      sourceCount: 1,
    });
  });
});