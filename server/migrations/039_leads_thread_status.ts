import { PoolClient } from 'pg';
import { Migration } from './runner';

const migration: Migration = {
  description: 'Add thread_status column to leads for persistent AI/manual mode per conversation',

  async up(client: PoolClient) {
    await client.query(`
      ALTER TABLE leads
      ADD COLUMN IF NOT EXISTS thread_status VARCHAR(50) NOT NULL DEFAULT 'AI_ACTIVE'
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_leads_thread_status
      ON leads (tenant_id, thread_status)
    `);
  },

  async down(client: PoolClient) {
    await client.query(`ALTER TABLE leads DROP COLUMN IF EXISTS thread_status`);
  },
};

export default migration;
