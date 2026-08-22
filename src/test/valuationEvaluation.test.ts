import { describe, expect, it } from 'vitest';
import { assessValuationDrift, evaluateValuationGoldSet, shouldPromoteCalibration } from '../../server/services/valuationEvaluationService';
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

  it('blocks promotion signal after three rising MAE runs over the threshold', () => {
    const assessment = assessValuationDrift([
      { mae: 21_000_000, mape: 0.1 },
      { mae: 22_000_000, mape: 0.11 },
      { mae: 23_000_000, mape: 0.12 },
    ]);
    expect(assessment.status).toBe('BLOCKED');
    expect(assessment.promotionBlocked).toBe(true);
    expect(assessment.consecutiveMaeRuns).toBe(3);
    expect(assessment.reasons).toContain('mae_above_threshold_with_consecutive_increases');
  });

  it('warns but does not block before the consecutive-run requirement', () => {
    const assessment = assessValuationDrift([
      { mae: 19_000_000, mape: 0.1 },
      { mae: 21_000_000, mape: 0.1 },
    ]);
    expect(assessment.status).toBe('WARNING');
    expect(assessment.promotionBlocked).toBe(false);
  });

  it('does not bridge a missing metric when counting consecutive increases', () => {
    const assessment = assessValuationDrift([
      { mae: 21_000_000, mape: null },
      { mae: null, mape: 0.1 },
      { mae: 23_000_000, mape: 0.2 },
    ]);
    expect(assessment.consecutiveMaeRuns).toBe(1);
    expect(assessment.promotionBlocked).toBe(false);
  });
});