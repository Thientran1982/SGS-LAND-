import { PoolClient } from 'pg';

export async function up(client: PoolClient): Promise<void> {
  // Older deployments may already contain duplicate session events. Keep the
  // first event for each session before adding the replay-safety constraint.
  await client.query(`
    WITH ranked AS (
      SELECT ctid,
             ROW_NUMBER() OVER (
               PARTITION BY tenant_id, session_id, event_type, source
               ORDER BY created_at ASC, id ASC
             ) AS row_number
      FROM lead_journey_memory
      WHERE session_id IS NOT NULL
    )
    DELETE FROM lead_journey_memory journey
    USING ranked
    WHERE journey.ctid = ranked.ctid
      AND ranked.row_number > 1;
  `);

  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_journey_session_event_unique
      ON lead_journey_memory (tenant_id, session_id, event_type, source)
      WHERE session_id IS NOT NULL;
  `);
}

export async function down(client: PoolClient): Promise<void> {
  await client.query('DROP INDEX IF EXISTS idx_lead_journey_session_event_unique');
}

export default {
  up,
  down,
  description: 'Make live-chat customer memory and lead journey writes replay-safe per session',
};