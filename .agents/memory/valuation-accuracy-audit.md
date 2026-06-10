---
name: Valuation Engine Accuracy Audit
description: Key accuracy bugs and fixes in SGS-AVM v3 valuation engine (valuationEngine.ts + valuationRoutes.ts)
---

## Rule
Always derive fallback rent from `marketBasePrice × area × grossYieldCap / 12` (location-scaled), NOT from the flat `FALLBACK_RENT_PER_M2` table. The flat table is location-invariant and causes ±15–45% bias in the final reconciled price.

**Why:** A 70m² apartment_center in Q.1 vs Bình Tân both got 0.28 × 70 = 19.6tr/month from the table, but market rents differ 2–3×. This biased the income approach which has 45% weight in reconciliation.

**How to apply:** In `valuationRoutes.ts` Step 3 (fallback rent block), use:
```ts
const capRate = DEFAULT_CAP_RATES[resolvedPropertyType] ?? 0.04;
const yieldBasedRent = (marketBasePrice * areaNum * capRate / 12) / 1_000_000;
```
With sanity-check [0.003, 10] triệu/m²/month. Fall back to `estimateFallbackRent` only for out-of-range edge cases. Fixed in this session.

## Bug Fixed
`cachedMarketPrice: (!cacheEntry && ...) ? undefined : undefined` — both branches were `undefined` (dead ternary). Removed; `cachedMarketPrice: undefined` now explicit with clear comment.

## Architecture Notes
- `rentSource: 'user' | 'ai_cache' | 'fallback'` now tracked and returned in API response `sources` field.
- Divergence guard (>50% → 95/5 comps/income) protects against extreme fallback rent errors for land types.
- RLHF correction: requires ≥3 corrections, blends 70% engine + 30% signal, capped ±20%.
- `DEFAULT_CAP_RATES` is now imported directly in `valuationRoutes.ts` for fallback rent calculation.
