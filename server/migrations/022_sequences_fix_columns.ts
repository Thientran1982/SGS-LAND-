import { PoolClient } from 'pg';
import { Migration } from './runner';

const migration: Migration = {
  description: 'Add missing trigger_event and is_active columns to sequences table',
  async up(client: PoolClient) {
    await client.query(`
      ALTER TABLE sequences
        ADD COLUMN IF NOT EXISTS trigger_event VARCHAR(100) NOT NULL DEFAULT 'MANUAL',
        ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
    `);

    await client.query(`
      UPDATE sequences
      SET trigger_event = COALESCE(
        trigger->>'event',
        trigger->>'type',
        'MANUAL'
      )
      WHERE trigger_event = 'MANUAL' AND trigger IS NOT NULL AND trigger != 'null'::jsonb;
    `);

    await client.query(`
      UPDATE sequences
      SET is_active = CASE
        WHEN status = 'ACTIVE' THEN true
        WHEN status = 'INACTIVE' THEN false
        ELSE true
      END
      WHERE status IS NOT NULL;
    `);
  }
};

export default migration;
