/**
 * Migration 006 — Fix schema mismatches between migrations and application code
 *
 * 1. users: add missing columns (password_hash, source, bio, metadata, last_login_at)
 *    and copy existing `password` data into `password_hash`.
 * 2. audit_logs: change actor_id and entity_id from UUID to VARCHAR(255) so the
 *    app can write email addresses and arbitrary string IDs without type errors.
 */

import type { Migration } from './runner';

const migration: Migration = {
  description: 'Fix schema mismatches: add missing users columns and relax audit_logs id types',

  async up(client) {
    // ── users: add missing columns ──────────────────────────────────────────
    await client.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS password_hash  VARCHAR(255),
        ADD COLUMN IF NOT EXISTS source         VARCHAR(50),
        ADD COLUMN IF NOT EXISTS bio            TEXT,
        ADD COLUMN IF NOT EXISTS metadata       JSONB,
        ADD COLUMN IF NOT EXISTS last_login_at  TIMESTAMP WITH TIME ZONE;
    `);

    // Copy existing plain `password` values into `password_hash` where not already set
    await client.query(`
      UPDATE users SET password_hash = password WHERE password_hash IS NULL AND password IS NOT NULL;
    `);

    // ── audit_logs: relax actor_id and entity_id to VARCHAR ─────────────────
    // Drop the FK constraint on actor_id so we can change its type
    await client.query(`
      DO $$
      DECLARE
        con_name TEXT;
      BEGIN
        SELECT tc.constraint_name INTO con_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'audit_logs'
          AND kcu.column_name = 'actor_id'
          AND tc.constraint_type = 'FOREIGN KEY'
        LIMIT 1;

        IF con_name IS NOT NULL THEN
          EXECUTE 'ALTER TABLE audit_logs DROP CONSTRAINT ' || quote_ident(con_name);
        END IF;
      END $$;
    `);

    // Drop the FK constraint on entity_id if it exists
    await client.query(`
      DO $$
      DECLARE
        con_name TEXT;
      BEGIN
        SELECT tc.constraint_name INTO con_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'audit_logs'
          AND kcu.column_name = 'entity_id'
          AND tc.constraint_type = 'FOREIGN KEY'
        LIMIT 1;

        IF con_name IS NOT NULL THEN
          EXECUTE 'ALTER TABLE audit_logs DROP CONSTRAINT ' || quote_ident(con_name);
        END IF;
      END $$;
    `);

    // Now change the column types to VARCHAR so non-UUID values are accepted
    await client.query(`
      ALTER TABLE audit_logs
        ALTER COLUMN actor_id  TYPE VARCHAR(255) USING actor_id::text,
        ALTER COLUMN entity_id TYPE VARCHAR(255) USING entity_id::text;
    `);
  },
};

export default migration;
