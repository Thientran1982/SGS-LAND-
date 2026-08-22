import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const migration: Migration = {
  description: '144: Persist valuation gold-set backtest runs for error trend monitoring',
  async up(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS valuation_evaluation_runs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        evaluated_at TIMESTAMPTZ NOT NULL,
        sample_count INTEGER NOT NULL DEFAULT 0,
        evaluated_count INTEGER NOT NULL DEFAULT 0,
        rejected_count INTEGER NOT NULL DEFAULT 0,
        reject_rate NUMERIC(8,6) NOT NULL DEFAULT 0,
        mae NUMERIC,
        mape NUMERIC,
        median_absolute_error NUMERIC,
        interval_coverage NUMERIC(8,6),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_valuation_evaluation_runs_evaluated
        ON valuation_evaluation_runs (evaluated_at DESC);
    `);
  },
  async down(client: PoolClient): Promise<void> {
    await client.query('DROP TABLE IF EXISTS valuation_evaluation_runs');
  },
};

export default migration;