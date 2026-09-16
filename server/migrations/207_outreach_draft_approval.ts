import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const migration: Migration = {
  description: 'Add broker approval action for Week 8 outreach drafts without provider side effects',
  async up(client: PoolClient): Promise<void> {
    await client.query(`
      ALTER TABLE approval_requests
        DROP CONSTRAINT IF EXISTS approval_requests_action_type_check;
      ALTER TABLE approval_requests
        ADD CONSTRAINT approval_requests_action_type_check
        CHECK (action_type IN (
          'CONFIRM_DEPOSIT','CHANGE_LEAD_STAGE','CREATE_PROPOSAL',
          'BOOK_VIEWING','SEND_DOCS','REVIEW_REPAIR_SPIKE',
          'DRAFT_PROACTIVE_FOLLOWUP','REVIEW_LISTING_PRICE','REVIEW_CSAT_DROP',
          'PROMOTE_LEARNING_CANDIDATE','ROLLBACK_LEARNING_CANDIDATE',
          'DRAFT_OUTREACH'
        ));
      CREATE INDEX IF NOT EXISTS idx_approval_requests_outreach
        ON approval_requests (tenant_id, lead_id, status, requested_at DESC)
        WHERE action_type = 'DRAFT_OUTREACH';
    `);
  },
  async down(client: PoolClient): Promise<void> {
    await client.query(`
      DELETE FROM approval_requests WHERE action_type = 'DRAFT_OUTREACH';
      DROP INDEX IF EXISTS idx_approval_requests_outreach;
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
};

export default migration;