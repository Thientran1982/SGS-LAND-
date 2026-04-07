import { PoolClient } from 'pg';

const migration = {
  description: 'Fix listing status OPENING → AVAILABLE (data cleanup)',
  async up(client: PoolClient) {
    const result = await client.query(`
      UPDATE listings
      SET status = 'AVAILABLE'
      WHERE status = 'OPENING'
    `);
    const count = result.rowCount ?? 0;
    if (count > 0) {
      console.log(`[Migration 052] Fixed ${count} listing(s): OPENING → AVAILABLE`);
    }
  },
};

export default migration;
