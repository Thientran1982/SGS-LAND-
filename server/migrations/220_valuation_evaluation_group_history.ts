import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const migration: Migration = {
  description: '220: Persist valuation evaluation metrics for each location and property type',
  async up(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS valuation_evaluation_run_groups (
        run_id UUID NOT NULL REFERENCES valuation_evaluation_runs(id) ON DELETE CASCADE,
        location_key TEXT NOT NULL,
        property_type TEXT NOT NULL,
        sample_count INTEGER NOT NULL DEFAULT 0,
        evaluated_count INTEGER NOT NULL DEFAULT 0,
        rejected_count INTEGER NOT NULL DEFAULT 0,
        reject_rate NUMERIC(8,6) NOT NULL DEFAULT 0,
        mae NUMERIC,
        mape NUMERIC,
        median_absolute_error NUMERIC,
        interval_coverage NUMERIC(8,6),
        PRIMARY KEY (run_id, location_key, property_type)
      );
      CREATE INDEX IF NOT EXISTS idx_valuation_evaluation_run_groups_segment
        ON valuation_evaluation_run_groups (location_key, property_type, run_id);
    `);
  },
  async down(client: PoolClient): Promise<void> {
    await client.query('DROP TABLE IF EXISTS valuation_evaluation_run_groups');
  },
};

export default migration;