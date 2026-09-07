import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const migration: Migration = {
  description: 'Safe approval action for reviewing repair spikes',
  async up(client: PoolClient): Promise<void> {
    await client.query(`
      ALTER TABLE approval_requests
        DROP CONSTRAINT IF EXISTS approval_requests_action_type_check;
      ALTER TABLE approval_requests
        ADD CONSTRAINT approval_requests_action_type_check
        CHECK (action_type IN (
          'CONFIRM_DEPOSIT','CHANGE_LEAD_STAGE','CREATE_PROPOSAL',
          'BOOK_VIEWING','SEND_DOCS','REVIEW_REPAIR_SPIKE'
        ));
    `);
  },
  async down(client: PoolClient): Promise<void> {
    await client.query(`
      DELETE FROM approval_requests WHERE action_type='REVIEW_REPAIR_SPIKE';
      ALTER TABLE approval_requests
        DROP CONSTRAINT IF EXISTS approval_requests_action_type_check;
      ALTER TABLE approval_requests
        ADD CONSTRAINT approval_requests_action_type_check
        CHECK (action_type IN (
          'CONFIRM_DEPOSIT','CHANGE_LEAD_STAGE','CREATE_PROPOSAL',
          'BOOK_VIEWING','SEND_DOCS'
        ));
    `);
  },
};

export default migration;