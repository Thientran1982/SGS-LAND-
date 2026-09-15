import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const migration: Migration = {
  description: 'Add tenant-scoped Minh proactive decision queue actions',
  async up(client: PoolClient): Promise<void> {
    await client.query(`
      ALTER TABLE approval_requests
        ALTER COLUMN lead_id DROP NOT NULL,
        ADD COLUMN IF NOT EXISTS source_signal_id UUID,
        ADD COLUMN IF NOT EXISTS subject_type TEXT,
        ADD COLUMN IF NOT EXISTS subject_id TEXT
    `);
    await client.query(`
      ALTER TABLE approval_requests
        DROP CONSTRAINT IF EXISTS approval_requests_action_type_check;
      ALTER TABLE approval_requests
        ADD CONSTRAINT approval_requests_action_type_check
        CHECK (action_type IN (
          'CONFIRM_DEPOSIT','CHANGE_LEAD_STAGE','CREATE_PROPOSAL',
          'BOOK_VIEWING','SEND_DOCS','REVIEW_REPAIR_SPIKE',
          'DRAFT_PROACTIVE_FOLLOWUP','REVIEW_LISTING_PRICE','REVIEW_CSAT_DROP'
        ));
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_approval_requests_source_signal
        ON approval_requests (tenant_id, source_signal_id)
        WHERE source_signal_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_approval_requests_proactive_queue
        ON approval_requests (tenant_id, channel, status, requested_at DESC)
        WHERE channel = 'MINH_PROACTIVE';
    `);
  },
  async down(client: PoolClient): Promise<void> {
    await client.query(`
      DELETE FROM approval_requests
       WHERE action_type IN ('DRAFT_PROACTIVE_FOLLOWUP','REVIEW_LISTING_PRICE','REVIEW_CSAT_DROP');
      DROP INDEX IF EXISTS idx_approval_requests_source_signal;
      DROP INDEX IF EXISTS idx_approval_requests_proactive_queue;
      ALTER TABLE approval_requests
        DROP CONSTRAINT IF EXISTS approval_requests_action_type_check;
      ALTER TABLE approval_requests
        ADD CONSTRAINT approval_requests_action_type_check
        CHECK (action_type IN (
          'CONFIRM_DEPOSIT','CHANGE_LEAD_STAGE','CREATE_PROPOSAL',
          'BOOK_VIEWING','SEND_DOCS','REVIEW_REPAIR_SPIKE'
        ));
      ALTER TABLE approval_requests
        DROP COLUMN IF EXISTS subject_id,
        DROP COLUMN IF EXISTS subject_type,
        DROP COLUMN IF EXISTS source_signal_id;
      ALTER TABLE approval_requests
        ALTER COLUMN lead_id SET NOT NULL;
    `);
  },
};

export default migration;