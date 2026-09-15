import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const migration: Migration = {
  description: 'Align Minh proactive source signal identifiers with agent_signals text ids',
  async up(client: PoolClient): Promise<void> {
    await client.query(`
      ALTER TABLE approval_requests
        ALTER COLUMN source_signal_id TYPE TEXT
        USING source_signal_id::text
    `);
  },
  async down(client: PoolClient): Promise<void> {
    await client.query(`
      ALTER TABLE approval_requests
        ALTER COLUMN source_signal_id TYPE UUID
        USING source_signal_id::uuid
    `);
  },
};

export default migration;