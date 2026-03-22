import { Pool } from 'pg';

export async function up(pool: Pool): Promise<void> {
  await pool.query(`
    ALTER TABLE contracts
      ADD COLUMN IF NOT EXISTS signed_place TEXT,
      ADD COLUMN IF NOT EXISTS contract_date DATE;
  `);
}

export async function down(pool: Pool): Promise<void> {
  await pool.query(`
    ALTER TABLE contracts
      DROP COLUMN IF EXISTS signed_place,
      DROP COLUMN IF EXISTS contract_date;
  `);
}
