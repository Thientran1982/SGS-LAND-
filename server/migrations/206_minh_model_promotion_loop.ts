import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const migration: Migration = {
  description: 'Add idempotent Minh model-promotion candidates, runtime metrics and approval actions',

  async up(client: PoolClient): Promise<void> {
    await client.query(`
      ALTER TABLE ai_learning_candidates
        ADD COLUMN IF NOT EXISTS candidate_key TEXT;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_learning_candidates_cycle_agent
        ON ai_learning_candidates (tenant_id, cycle_id, agent_key)
        WHERE cycle_id IS NOT NULL;
      ALTER TABLE ai_learning_runtime_metrics
        ADD COLUMN IF NOT EXISTS candidate_id UUID
          REFERENCES ai_learning_candidates(id) ON DELETE CASCADE;
      CREATE INDEX IF NOT EXISTS idx_ai_learning_runtime_candidate_window
        ON ai_learning_runtime_metrics (tenant_id, candidate_id, created_at DESC);
    `);

    await client.query(`
      ALTER TABLE approval_requests
        DROP CONSTRAINT IF EXISTS approval_requests_action_type_check;
      ALTER TABLE approval_requests
        ADD CONSTRAINT approval_requests_action_type_check
        CHECK (action_type IN (
          'CONFIRM_DEPOSIT','CHANGE_LEAD_STAGE','CREATE_PROPOSAL',
          'BOOK_VIEWING','SEND_DOCS','REVIEW_REPAIR_SPIKE',
          'DRAFT_PROACTIVE_FOLLOWUP','REVIEW_LISTING_PRICE','REVIEW_CSAT_DROP',
          'PROMOTE_LEARNING_CANDIDATE','ROLLBACK_LEARNING_CANDIDATE'
        ));
    `);
  },

  async down(client: PoolClient): Promise<void> {
    await client.query(`
      DELETE FROM approval_requests
       WHERE action_type IN ('PROMOTE_LEARNING_CANDIDATE','ROLLBACK_LEARNING_CANDIDATE');
      ALTER TABLE approval_requests
        DROP CONSTRAINT IF EXISTS approval_requests_action_type_check;
      ALTER TABLE approval_requests
        ADD CONSTRAINT approval_requests_action_type_check
        CHECK (action_type IN (
          'CONFIRM_DEPOSIT','CHANGE_LEAD_STAGE','CREATE_PROPOSAL',
          'BOOK_VIEWING','SEND_DOCS','REVIEW_REPAIR_SPIKE',
          'DRAFT_PROACTIVE_FOLLOWUP','REVIEW_LISTING_PRICE','REVIEW_CSAT_DROP'
        ));
      DROP INDEX IF EXISTS idx_ai_learning_runtime_candidate_window;
      ALTER TABLE ai_learning_runtime_metrics
        DROP COLUMN IF EXISTS candidate_id;
      DROP INDEX IF EXISTS idx_ai_learning_candidates_cycle_agent;
      ALTER TABLE ai_learning_candidates
        DROP COLUMN IF EXISTS candidate_key;
    `);
  },
};

export default migration;