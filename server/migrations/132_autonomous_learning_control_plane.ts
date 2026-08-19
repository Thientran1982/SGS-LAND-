import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const migration: Migration = {
  description: 'Fail-closed autonomous learning control plane, feedback adjudication and calibration history',
  async up(client: PoolClient): Promise<void> {
    await client.query(`
      ALTER TABLE ai_feedback
        ADD COLUMN IF NOT EXISTS consent_status TEXT NOT NULL DEFAULT 'PENDING'
          CHECK (consent_status IN ('PENDING','OPTED_IN','OPTED_OUT','NOT_REQUIRED')),
        ADD COLUMN IF NOT EXISTS followup_stage SMALLINT NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS followup_next_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS quality_score NUMERIC(5,4),
        ADD COLUMN IF NOT EXISTS provenance_score NUMERIC(5,4),
        ADD COLUMN IF NOT EXISTS adjudication_status TEXT NOT NULL DEFAULT 'PENDING'
          CHECK (adjudication_status IN ('PENDING','ACCEPTED','REJECTED','QUARANTINED')),
        ADD COLUMN IF NOT EXISTS quarantine_reason TEXT,
        ADD COLUMN IF NOT EXISTS signal_eligible BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS source_fingerprint TEXT
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ai_feedback_followup_due
      ON ai_feedback (tenant_id, followup_next_at) WHERE followup_next_at IS NOT NULL`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ai_feedback_learning_status
      ON ai_feedback (tenant_id, adjudication_status, signal_eligible)`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_learning_cycles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        cycle_key TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'RUNNING'
          CHECK (status IN ('RUNNING','PASSED','FAILED','ROLLED_BACK','KILLED')),
        fixture_version TEXT,
        baseline_eval_run_id UUID,
        candidate_eval_run_id UUID,
        summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        error_text TEXT,
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        finished_at TIMESTAMPTZ,
        UNIQUE (tenant_id, cycle_key)
      );
      CREATE TABLE IF NOT EXISTS ai_learning_candidates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        cycle_id UUID REFERENCES ai_learning_cycles(id) ON DELETE SET NULL,
        agent_key TEXT NOT NULL,
        prompt_hash TEXT,
        model TEXT,
        artifact_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        status TEXT NOT NULL DEFAULT 'SHADOW'
          CHECK (status IN ('SHADOW','CANARY','ACTIVE','REJECTED','ROLLED_BACK','KILLED')),
        gate_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
        last_known_good BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS ai_promotion_decisions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        candidate_id UUID REFERENCES ai_learning_candidates(id) ON DELETE SET NULL,
        from_status TEXT,
        to_status TEXT NOT NULL,
        decision TEXT NOT NULL CHECK (decision IN ('PROMOTE','REJECT','ROLLBACK','KILL')),
        reason TEXT NOT NULL,
        metrics_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        trace_id TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS ai_calibration_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
        location_key TEXT NOT NULL,
        version INTEGER NOT NULL,
        input_fingerprint TEXT NOT NULL,
        calibrated_price_per_m2 NUMERIC NOT NULL,
        sample_count INTEGER NOT NULL DEFAULT 0,
        quality_score NUMERIC(5,4) NOT NULL DEFAULT 0,
        drift_score NUMERIC(5,4) NOT NULL DEFAULT 0,
        poisoning_score NUMERIC(5,4) NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'PENDING'
          CHECK (status IN ('PENDING','APPROVED','ACTIVE','REJECTED','ROLLED_BACK')),
        metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, location_key, version)
      );
      CREATE TABLE IF NOT EXISTS ai_learning_audit_events (
        id BIGSERIAL PRIMARY KEY,
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT,
        reason TEXT NOT NULL,
        metrics_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        trace_id TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_ai_learning_audit_tenant_time
        ON ai_learning_audit_events (tenant_id, created_at DESC);
      CREATE TABLE IF NOT EXISTS ai_learning_runtime_metrics (
        id BIGSERIAL PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        rollout_id UUID REFERENCES ai_rollouts(id) ON DELETE SET NULL,
        metric_window TEXT NOT NULL,
        sample_count INTEGER NOT NULL DEFAULT 0,
        safety NUMERIC(5,4),
        groundedness NUMERIC(5,4),
        quality NUMERIC(5,4),
        latency_p95_ms INTEGER,
        cost_usd NUMERIC(12,6),
        error_rate NUMERIC(5,4),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    for (const table of ['ai_learning_cycles', 'ai_learning_candidates', 'ai_promotion_decisions', 'ai_calibration_versions', 'ai_learning_audit_events', 'ai_learning_runtime_metrics']) {
      await client.query(`
        ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;
        ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS tenant_isolation_v2 ON ${table};
        CREATE POLICY tenant_isolation_v2 ON ${table} AS PERMISSIVE FOR ALL TO PUBLIC
          USING (NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
            AND (tenant_id IS NULL OR tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), '')))
          WITH CHECK (NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
            AND (tenant_id IS NULL OR tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), '')));
      `);
    }
    await client.query(`
      CREATE OR REPLACE FUNCTION prevent_ai_learning_audit_mutation() RETURNS trigger
      LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'ai_learning_audit_events is append-only'; END; $$;
      DROP TRIGGER IF EXISTS ai_learning_audit_append_only ON ai_learning_audit_events;
      CREATE TRIGGER ai_learning_audit_append_only
        BEFORE UPDATE OR DELETE ON ai_learning_audit_events
        FOR EACH ROW EXECUTE FUNCTION prevent_ai_learning_audit_mutation();
    `);
  },
  async down(client: PoolClient): Promise<void> {
    await client.query(`DROP TRIGGER IF EXISTS ai_learning_audit_append_only ON ai_learning_audit_events`);
    await client.query(`DROP FUNCTION IF EXISTS prevent_ai_learning_audit_mutation()`);
    await client.query(`DROP TABLE IF EXISTS ai_learning_runtime_metrics, ai_learning_audit_events, ai_calibration_versions,
      ai_promotion_decisions, ai_learning_candidates, ai_learning_cycles CASCADE`);
  },
};

export default migration;