import type { PoolClient } from 'pg';
import type { Migration } from './runner';

/**
 * 1. Sequences: when the migration history was replayed on 2026-09-04,
 *    140_refresh_default_sequences re-inserted its seven default journeys while
 *    its DELETE (run without an RLS bypass) removed nothing, so every default
 *    campaign appears twice. Exact duplicates (same tenant, name, trigger and
 *    steps) are merged into one — the copy with the most enrollments, then the
 *    oldest — and their non-conflicting enrollments are moved to it. Any other
 *    rows that still share a name get a numeric suffix, then a unique index
 *    keeps one name per tenant.
 * 2. scoring_configs.version: the scoring repository reads and writes this
 *    column, but the runtime role cannot add it, so saving the configuration
 *    failed. Add it here as the owner.
 */

const DUPLICATES_SQL = `
  WITH enr AS (
    SELECT sequence_id, count(*) AS n FROM sequence_enrollments GROUP BY sequence_id
  ), ranked AS (
    SELECT s.id,
           first_value(s.id) OVER w AS keeper_id,
           row_number() OVER w AS rn
      FROM sequences s
      LEFT JOIN enr ON enr.sequence_id = s.id
    WINDOW w AS (
      PARTITION BY s.tenant_id, lower(btrim(s.name)), COALESCE(s.trigger_event, ''), md5(COALESCE(s.steps::text, '[]'))
      ORDER BY COALESCE(enr.n, 0) DESC, s.created_at ASC NULLS LAST, s.id
    )
  )
  SELECT id, keeper_id FROM ranked WHERE rn > 1`;

const SAME_NAME_SQL = `
  SELECT id, rn FROM (
    SELECT id, row_number() OVER (PARTITION BY tenant_id, lower(btrim(name)) ORDER BY created_at ASC NULLS LAST, id) AS rn
      FROM sequences
  ) r WHERE rn > 1`;

async function withBypass<T>(client: PoolClient, fn: () => Promise<T>): Promise<T> {
  const prev = (await client.query(`SELECT current_setting('app.bypass_rls', true) AS v`)).rows[0]?.v ?? '';
  await client.query(`SELECT set_config('app.bypass_rls', 'on', true)`);
  try {
    return await fn();
  } finally {
    await client.query(`SELECT set_config('app.bypass_rls', $1, true)`, [prev]);
  }
}

const migration: Migration = {
  description: 'Merge duplicated default sequences, enforce unique sequence names per tenant, add scoring_configs.version',

  async report(client: PoolClient): Promise<void> {
    await withBypass(client, async () => {
      const dup = await client.query(DUPLICATES_SQL);
      const same = await client.query(SAME_NAME_SQL);
      console.log(`  exact duplicate sequences to merge: ${dup.rowCount}; same-name rows (incl. duplicates): ${same.rowCount}`);
    });
  },

  async up(client: PoolClient): Promise<void> {
    await client.query(`ALTER TABLE scoring_configs ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1`);

    await withBypass(client, async () => {
      const dup = await client.query(DUPLICATES_SQL);
      for (const { id, keeper_id } of dup.rows) {
        await client.query(
          `UPDATE sequence_enrollments e SET sequence_id = $2
            WHERE e.sequence_id = $1
              AND NOT EXISTS (SELECT 1 FROM sequence_enrollments k
                               WHERE k.sequence_id = $2 AND lower(k.lead_email) = lower(e.lead_email))`,
          [id, keeper_id],
        );
        // Remaining enrollments are the same leads already enrolled in the keeper (FK cascades).
        await client.query('DELETE FROM sequences WHERE id = $1', [id]);
      }

      const same = await client.query(SAME_NAME_SQL);
      for (const { id, rn } of same.rows) {
        await client.query(`UPDATE sequences SET name = left(btrim(name), 240) || ' (' || $2 || ')' WHERE id = $1`, [id, String(rn)]);
      }
      // A suffixed name could collide with an existing one; fall back to an id-based suffix.
      const still = await client.query(SAME_NAME_SQL);
      for (const { id } of still.rows) {
        await client.query(`UPDATE sequences SET name = left(btrim(name), 240) || ' #' || left(id::text, 6) WHERE id = $1`, [id]);
      }
    });

    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS uniq_sequences_tenant_name ON sequences (tenant_id, lower(btrim(name)))`);
  },

  async down(client: PoolClient): Promise<void> {
    await client.query('DROP INDEX IF EXISTS uniq_sequences_tenant_name');
  },
};

export default migration;
