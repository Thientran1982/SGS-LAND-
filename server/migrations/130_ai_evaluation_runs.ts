import { PoolClient } from 'pg';
import { Migration } from './runner';

const migration: Migration = {
  description: '130: Versioned AI evaluation runs and per-case scores',
  async up(client: PoolClient) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_evaluation_runs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name VARCHAR(160) NOT NULL,
        fixture_version VARCHAR(80) NOT NULL,
        variant VARCHAR(40) NOT NULL DEFAULT 'candidate',
        prompt_version VARCHAR(120),
        prompt_hash VARCHAR(128),
        model VARCHAR(120),
        provider VARCHAR(60),
        metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        total_cases INT NOT NULL DEFAULT 0,
        completed_cases INT NOT NULL DEFAULT 0,
        summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_ai_eval_runs_tenant_created
        ON ai_evaluation_runs (tenant_id, created_at DESC);
      CREATE TABLE IF NOT EXISTS ai_evaluation_results (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        run_id UUID NOT NULL REFERENCES ai_evaluation_runs(id) ON DELETE CASCADE,
        case_id VARCHAR(120) NOT NULL,
        channel VARCHAR(30) NOT NULL DEFAULT 'ZALO',
        input_hash VARCHAR(128),
        trace_id VARCHAR(120),
        actual_intent VARCHAR(100),
        expected_intent VARCHAR(100),
        actual_agent VARCHAR(100),
        expected_agent VARCHAR(100),
        output_text TEXT,
        scores_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        latency_ms INT,
        input_tokens INT,
        output_tokens INT,
        cost_usd NUMERIC(12,6),
        error_text TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (run_id, case_id)
      );
      CREATE INDEX IF NOT EXISTS idx_ai_eval_results_run
        ON ai_evaluation_results (tenant_id, run_id);
    `);
  },
  async down(client: PoolClient) {
    await client.query('DROP TABLE IF EXISTS ai_evaluation_results');
    await client.query('DROP TABLE IF EXISTS ai_evaluation_runs');
  },
};

export default migration;