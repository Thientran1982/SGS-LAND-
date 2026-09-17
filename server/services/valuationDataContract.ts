/**
 * Canonical units and provenance contract for valuation data.
 *
 * Keep this module dependency-free so routes, the AVM engine, and persistence
 * can validate the same values without importing one another.
 */

export const VALUATION_UNITS = {
  marketPricePerM2: 'VND_PER_M2',
  totalPrice: 'VND_TOTAL',
  area: 'M2',
  monthlyRent: 'MILLION_VND_PER_MONTH',
  yield: 'FRACTION',
} as const;

export type ValuationPriceUnit = typeof VALUATION_UNITS.marketPricePerM2;
export type ValuationSource =
  | 'AI'
  | 'SEED'
  | 'BLENDED'
  | 'REGIONAL_TABLE'
  | 'INTERNAL_COMPS'
  | 'TRANSACTION'
  | 'MANUAL';
export type ValuationFreshnessStatus = 'FRESH' | 'STALE' | 'UNKNOWN';

export interface MarketObservationProvenance {
  source: ValuationSource;
  locationKey: string;
  propertyType: string;
  priceUnit: ValuationPriceUnit;
  observedAt: string;
  fetchedAt?: string;
  expiresAt?: string | null;
  sourceCount: number;
  dataRecency?: string | null;
  scope: 'GLOBAL' | 'TENANT';
}

const MAX_PRICE_PER_M2 = 1_000_000_000;
const MAX_AREA_M2 = 100_000;
const MAX_MONTHLY_RENT_MILLION = 10_000;

export function normalizePricePerM2(value: unknown): number | null {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0 || numeric > MAX_PRICE_PER_M2) return null;
  return Math.round(numeric);
}

export function normalizeAreaM2(value: unknown): number | null {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0 || numeric > MAX_AREA_M2) return null;
  return numeric;
}

/** Rent is intentionally kept in million VND/month inside the AVM API. */
export function normalizeMonthlyRentMillionVnd(value: unknown): number | null {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0 || numeric > MAX_MONTHLY_RENT_MILLION) return null;
  return numeric;
}

export function normalizeYieldFraction(value: unknown): number | null {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0 || numeric > 1) return null;
  return numeric;
}

export function getFreshnessStatus(
  expiresAt: string | Date | null | undefined,
  nowMs = Date.now(),
): ValuationFreshnessStatus {
  if (!expiresAt) return 'UNKNOWN';
  const timestamp = new Date(expiresAt).getTime();
  if (!Number.isFinite(timestamp)) return 'UNKNOWN';
  return timestamp > nowMs ? 'FRESH' : 'STALE';
}

export function buildMarketObservationProvenance(input: {
  source: ValuationSource;
  locationKey: string;
  propertyType: string;
  observedAt: string;
  fetchedAt?: string;
  expiresAt?: string | null;
  sourceCount?: number;
  dataRecency?: string | null;
  tenantId?: string | null;
}): MarketObservationProvenance {
  return {
    source: input.source,
    locationKey: input.locationKey.slice(0, 120),
    propertyType: input.propertyType,
    priceUnit: VALUATION_UNITS.marketPricePerM2,
    observedAt: input.observedAt,
    fetchedAt: input.fetchedAt,
    expiresAt: input.expiresAt ?? null,
    sourceCount: Math.max(1, Math.round(input.sourceCount ?? 1)),
    dataRecency: input.dataRecency ?? null,
    scope: input.tenantId ? 'TENANT' : 'GLOBAL',
  };
}