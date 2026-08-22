import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const migration: Migration = {
  description: '145: Versioned valuation drift thresholds and audit history',
  async up(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS valuation_drift_threshold_configs (
        id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        version INTEGER NOT NULL DEFAULT 1,
        mae_vnd_per_m2 NUMERIC NOT NULL,
        mape NUMERIC NOT NULL,
        consecutive_runs INTEGER NOT NULL,
        updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS valuation_drift_threshold_changes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        version INTEGER NOT NULL,
        author_id UUID REFERENCES users(id) ON DELETE SET NULL,
        changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        old_mae_vnd_per_m2 NUMERIC,
        new_mae_vnd_per_m2 NUMERIC NOT NULL,
        old_mape NUMERIC,
        new_mape NUMERIC NOT NULL,
        old_consecutive_runs INTEGER,
        new_consecutive_runs INTEGER NOT NULL
      );
      INSERT INTO valuation_drift_threshold_configs
        (id, version, mae_vnd_per_m2, mape, consecutive_runs)
      VALUES (1, 1, 20000000, 0.2, 3)
      ON CONFLICT (id) DO NOTHING;
      ALTER TABLE valuation_evaluation_runs
        ADD COLUMN IF NOT EXISTS threshold_version INTEGER,
        ADD COLUMN IF NOT EXISTS threshold_mae_vnd_per_m2 NUMERIC,
        ADD COLUMN IF NOT EXISTS threshold_mape NUMERIC,
        ADD COLUMN IF NOT EXISTS threshold_consecutive_runs INTEGER;
    `);
  },
  async down(client: PoolClient): Promise<void> {
    await client.query('DROP TABLE IF EXISTS valuation_drift_threshold_changes, valuation_drift_threshold_configs');
    await client.query(`
      ALTER TABLE valuation_evaluation_runs
        DROP COLUMN IF EXISTS threshold_version,
        DROP COLUMN IF EXISTS threshold_mae_vnd_per_m2,
        DROP COLUMN IF EXISTS threshold_mape,
        DROP COLUMN IF EXISTS threshold_consecutive_runs
    `);
  },
};

export default migration;