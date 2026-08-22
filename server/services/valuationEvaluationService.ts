import type { VerifiedTransaction } from '../data/valuationGoldSet';

export interface ValuationPrediction {
  transactionId: string;
  predictedPricePerM2: number | null;
  intervalMin?: number | null;
  intervalMax?: number | null;
  rejected?: boolean;
}

export interface EvaluationMetrics {
  sampleCount: number;
  evaluatedCount: number;
  rejectedCount: number;
  rejectRate: number;
  mae: number | null;
  mape: number | null;
  medianAbsoluteError: number | null;
  intervalCoverage: number | null;
}

export interface EvaluationGroup extends EvaluationMetrics {
  locationKey: string;
  propertyType: string;
}

export interface GoldSetEvaluation extends EvaluationMetrics {
  evaluatedAt: string;
  groups: EvaluationGroup[];
  predictions: ValuationPrediction[];
}

const median = (values: number[]): number | null => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

const metricsFor = (rows: Array<{ actual: number; prediction: ValuationPrediction }>): EvaluationMetrics => {
  const rejected = rows.filter(({ prediction }) =>
    prediction.rejected === true ||
    prediction.predictedPricePerM2 === null ||
    prediction.predictedPricePerM2 === undefined ||
    !Number.isFinite(prediction.predictedPricePerM2) ||
    prediction.predictedPricePerM2 <= 0,
  );
  const valid = rows.filter(({ prediction }) =>
    prediction.rejected !== true && Number.isFinite(prediction.predictedPricePerM2) &&
    (prediction.predictedPricePerM2 ?? 0) > 0,
  );
  const errors = valid.map(({ actual, prediction }) => Math.abs((prediction.predictedPricePerM2 as number) - actual));
  const covered = valid.filter(({ actual, prediction }) =>
    prediction.intervalMin != null && prediction.intervalMax != null &&
    prediction.intervalMin <= actual && actual <= prediction.intervalMax,
  );
  return {
    sampleCount: rows.length,
    evaluatedCount: valid.length,
    rejectedCount: rejected.length,
    rejectRate: rows.length ? rejected.length / rows.length : 0,
    mae: errors.length ? errors.reduce((sum, value) => sum + value, 0) / errors.length : null,
    mape: valid.length ? valid.reduce((sum, { actual, prediction }) =>
      sum + Math.abs((prediction.predictedPricePerM2 as number) - actual) / actual, 0) / valid.length : null,
    medianAbsoluteError: median(errors),
    intervalCoverage: valid.length ? covered.length / valid.length : null,
  };
};

export function evaluateValuationGoldSet(
  transactions: readonly VerifiedTransaction[],
  predictions: readonly ValuationPrediction[],
): GoldSetEvaluation {
  const verified = transactions.filter(row =>
    row.verified === true && row.priceUnit === 'VND_PER_M2' &&
    Number.isFinite(row.pricePerM2) && row.pricePerM2 > 0 &&
    Boolean(row.locationKey) && Boolean(row.propertyType) && Boolean(row.transactedAt),
  );
  const predictionById = new Map(predictions.map(prediction => [prediction.transactionId, prediction]));
  const joined = verified.map(actual => ({
    actual,
    prediction: predictionById.get(actual.id) || {
      transactionId: actual.id, predictedPricePerM2: null, rejected: true,
    },
  }));
  const groups = new Map<string, typeof joined>();
  for (const row of joined) {
    const key = `${row.actual.locationKey}\u0000${row.actual.propertyType}`;
    groups.set(key, [...(groups.get(key) || []), row]);
  }
  return {
    ...metricsFor(joined.map(row => ({ actual: row.actual.pricePerM2, prediction: row.prediction }))),
    evaluatedAt: new Date().toISOString(),
    groups: [...groups.entries()].map(([key, rows]) => {
      const [locationKey, propertyType] = key.split('\u0000');
      return { locationKey, propertyType, ...metricsFor(rows.map(row => ({
        actual: row.actual.pricePerM2, prediction: row.prediction,
      }))) };
    }),
    predictions: verified.map(actual => predictionById.get(actual.id) || {
      transactionId: actual.id, predictedPricePerM2: null, rejected: true,
    }),
  };
}

export interface PromotionDecision {
  promote: boolean;
  reasons: string[];
}

/** Calibration is promoted only when it does not regress any safety metric. */
export function shouldPromoteCalibration(candidate: EvaluationMetrics, baseline: EvaluationMetrics): PromotionDecision {
  const reasons: string[] = [];
  if (candidate.mae != null && baseline.mae != null && candidate.mae > baseline.mae) reasons.push('mae_worse_than_baseline');
  if (candidate.mape != null && baseline.mape != null && candidate.mape > baseline.mape) reasons.push('mape_worse_than_baseline');
  if (candidate.medianAbsoluteError != null && baseline.medianAbsoluteError != null &&
      candidate.medianAbsoluteError > baseline.medianAbsoluteError) reasons.push('median_absolute_error_worse_than_baseline');
  if (candidate.intervalCoverage != null && baseline.intervalCoverage != null &&
      candidate.intervalCoverage < baseline.intervalCoverage) reasons.push('interval_coverage_worse_than_baseline');
  if (candidate.rejectRate > baseline.rejectRate) reasons.push('reject_rate_worse_than_baseline');
  return { promote: reasons.length === 0, reasons };
}