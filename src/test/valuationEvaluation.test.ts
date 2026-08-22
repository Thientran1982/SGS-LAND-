import { describe, expect, it } from 'vitest';
import { evaluateValuationGoldSet, shouldPromoteCalibration } from '../../server/services/valuationEvaluationService';
import type { VerifiedTransaction } from '../../server/data/valuationGoldSet';

const transaction = (id: string, locationKey = 'hcm|q1'): VerifiedTransaction => ({
  id, locationKey, location: 'Test', propertyType: 'townhouse_center',
  transactedAt: '2025-10-01', pricePerM2: 100_000_000,
  priceUnit: 'VND_PER_M2', verified: true, verificationSource: 'notary_deed',
});

describe('valuation gold-set evaluation', () => {
  it('reports errors, interval coverage, and rejects per segment', () => {
    const report = evaluateValuationGoldSet(
      [transaction('a'), transaction('b'), transaction('c', 'hanoi|q1')],
      [
        { transactionId: 'a', predictedPricePerM2: 90_000_000, intervalMin: 80_000_000, intervalMax: 110_000_000 },
        { transactionId: 'b', predictedPricePerM2: null, rejected: true },
      ],
    );
    expect(report.evaluatedCount).toBe(1);
    expect(report.rejectedCount).toBe(2);
    expect(report.rejectRate).toBeCloseTo(2 / 3);
    expect(report.mae).toBe(10_000_000);
    expect(report.mape).toBeCloseTo(0.1);
    expect(report.medianAbsoluteError).toBe(10_000_000);
    expect(report.intervalCoverage).toBe(1);
    expect(report.groups).toHaveLength(2);
    expect(report.groups.find(group => group.locationKey === 'hanoi|q1')?.rejectRate).toBe(1);
  });

  it('does not promote a candidate that regresses any safety metric', () => {
    const baseline = {
      sampleCount: 10, evaluatedCount: 10, rejectedCount: 0, rejectRate: 0,
      mae: 10, mape: 0.1, medianAbsoluteError: 8, intervalCoverage: 0.9,
    };
    const candidate = { ...baseline, mae: 9, intervalCoverage: 0.8 };
    expect(shouldPromoteCalibration(candidate, baseline)).toEqual({
      promote: false, reasons: ['interval_coverage_worse_than_baseline'],
    });
  });
});