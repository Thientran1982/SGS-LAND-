import type { Pool } from 'pg';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VerifiedTransaction } from '../../server/data/valuationGoldSet';
import { priceCalibrationService } from '../../server/services/priceCalibrationService';

describe('valuation evaluation group history persistence', () => {
  afterEach(() => {
    priceCalibrationService.stop();
  });

  it('stores each run and its per-group measurements together and reads null metrics unchanged', async () => {
    const transactions: VerifiedTransaction[] = [
      {
        id: 'evaluated-transaction',
        locationKey: 'city|district-one',
        location: 'District One',
        propertyType: 'townhouse_center',
        transactedAt: '2026-01-10',
        pricePerM2: 100,
        priceUnit: 'VND_PER_M2',
        verified: true,
        verificationSource: 'notary_deed',
      },
      {
        id: 'rejected-transaction',
        locationKey: 'city|district-two',
        location: 'District Two',
        propertyType: 'apartment_suburb',
        transactedAt: '2026-01-11',
        pricePerM2: 200,
        priceUnit: 'VND_PER_M2',
        verified: true,
        verificationSource: 'owner_contract',
      },
    ];
    let savedRun: any = null;
    let savedGroups: any[] = [];
    const client = {
      query: vi.fn(async (sql: string, values: any[] = []) => {
        if (sql.includes('INSERT INTO valuation_evaluation_runs')) {
          savedRun = values;
          return { rows: [{ id: 'run-1' }] };
        }
        if (sql.includes('INSERT INTO valuation_evaluation_run_groups')) {
          savedGroups = JSON.parse(values[1]);
        }
        return { rows: [] };
      }),
      release: vi.fn(),
    };
    const pool = {
      connect: vi.fn(async () => client),
      query: vi.fn(async (sql: string) => {
        if (sql.includes('FROM avm_calibration')) {
          return { rows: [{ location_key: 'city|district-one', property_type: 'townhouse_center', calibrated_price_per_m2: '90' }] };
        }
        if (sql.includes('FROM valuation_drift_threshold_configs')) return { rows: [] };
        if (sql.includes('FROM valuation_evaluation_runs')) {
          return {
            rows: [{
              id: 'run-1',
              evaluated_at: savedRun[0],
              sample_count: savedRun[1],
              evaluated_count: savedRun[2],
              rejected_count: savedRun[3],
              reject_rate: savedRun[4],
              mae: savedRun[5],
              mape: savedRun[6],
              median_absolute_error: savedRun[7],
              interval_coverage: savedRun[8],
              threshold_version: savedRun[9],
              threshold_mae_vnd_per_m2: savedRun[10],
              threshold_mape: savedRun[11],
              threshold_consecutive_runs: savedRun[12],
            }],
          };
        }
        if (sql.includes('FROM valuation_evaluation_run_groups')) {
          return {
            rows: savedGroups.map(group => ({
              run_id: 'run-1',
              location_key: group.location_key,
              property_type: group.property_type,
              sample_count: group.sample_count,
              evaluated_count: group.evaluated_count,
              rejected_count: group.rejected_count,
              reject_rate: group.reject_rate,
              mae: group.mae,
              mape: group.mape,
              median_absolute_error: group.median_absolute_error,
              interval_coverage: group.interval_coverage,
            })),
          };
        }
        return { rows: [] };
      }),
    } as unknown as Pool;
    priceCalibrationService.init(pool);

    const evaluation = await priceCalibrationService.backtestGoldSet(transactions);
    const history = await priceCalibrationService.getEvaluationHistory();

    expect(evaluation.groups).toHaveLength(2);
    expect(client.query).toHaveBeenCalledWith('BEGIN');
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(savedGroups).toHaveLength(2);
    expect(savedGroups.find(group => group.location_key === 'city|district-one')).toMatchObject({
      sample_count: 1,
      evaluated_count: 1,
      mae: 10,
      mape: 0.1,
    });
    expect(savedGroups.find(group => group.location_key === 'city|district-two')).toMatchObject({
      sample_count: 1,
      evaluated_count: 0,
      mae: null,
      mape: null,
    });
    expect(history[0].evaluatedAt).toBe(evaluation.evaluatedAt);
    expect(history[0].groups.find(group => group.locationKey === 'city|district-two')).toMatchObject({
      sampleCount: 1,
      mae: null,
      mape: null,
    });
    expect(client.release).toHaveBeenCalledOnce();
  });
});