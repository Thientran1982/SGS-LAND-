import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const migration: Migration = {
  description: 'Add Minh decision outcome ledger and controlled proactive rollout',
  async up(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS minh_decision_feedback (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        event_key TEXT NOT NULL,
        source_signal_id TEXT,
        approval_request_id UUID,
        human_question_id UUID,
        action_type TEXT NOT NULL,
        outcome TEXT NOT NULL CHECK (outcome IN (
          'APPROVED','REJECTED','EXECUTED','EXECUTION_FAILED','ANSWERED'
        )),
        feedback_category TEXT,
        metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_by UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, event_key)
      );
      CREATE INDEX IF NOT EXISTS idx_minh_decision_feedback_summary
        ON minh_decision_feedback (tenant_id, created_at DESC, action_type, outcome);
      CREATE INDEX IF NOT EXISTS idx_minh_decision_feedback_signal
        ON minh_decision_feedback (tenant_id, source_signal_id)
        WHERE source_signal_id IS NOT NULL;

      ALTER TABLE minh_decision_feedback ENABLE ROW LEVEL SECURITY;
      ALTER TABLE minh_decision_feedback FORCE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS tenant_isolation_v2 ON minh_decision_feedback;
      CREATE POLICY tenant_isolation_v2 ON minh_decision_feedback AS PERMISSIVE FOR ALL TO PUBLIC
        USING (NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), ''))
        WITH CHECK (NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), ''));

      INSERT INTO marketing_growth_capabilities
        (tenant_id, capability_key, role, cadence, rollout, active, metadata_json)
      SELECT id, 'MINH_PROACTIVE_DECISION_QUEUE', 'decision_queue', 'realtime',
             'CANARY_25', TRUE, '{"source":"minh_week_4"}'::jsonb
        FROM tenants
      ON CONFLICT (tenant_id, capability_key) DO NOTHING;
    `);
  },
  async down(client: PoolClient): Promise<void> {
    await client.query(`
      DELETE FROM marketing_growth_capabilities
       WHERE capability_key='MINH_PROACTIVE_DECISION_QUEUE';
      DROP TABLE IF EXISTS minh_decision_feedback CASCADE;
    `);
  },
};

export default migration;