import { PoolClient } from 'pg';

const migration = {
  description: 'Fix documents stuck in PROCESSING status → ACTIVE',
  async up(client: PoolClient) {
    const result = await client.query(`
      UPDATE documents
      SET status = 'ACTIVE', updated_at = CURRENT_TIMESTAMP
      WHERE status = 'PROCESSING'
    `);
    const count = result.rowCount ?? 0;
    if (count > 0) {
      console.log(`[Migration 053] Fixed ${count} document(s): PROCESSING → ACTIVE`);
    }
  },
};

export default migration;
