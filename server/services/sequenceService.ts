import { pool } from '../db';

/**
 * Auto-enroll a lead into all ACTIVE sequences whose triggerEvent matches the new stage.
 * Called whenever a lead's stage changes in leadRoutes.
 */
export async function enrollLeadToMatchingSequences(
  _pool: any,
  tenantId: string,
  leadId: string,
  leadEmail: string,
  leadName: string,
  newStage: string,
): Promise<void> {
  try {
    // Find all active sequences for this tenant with matching triggerEvent
    const seqRes = await pool.query(
      `SELECT id, name, steps FROM sequences
       WHERE tenant_id = $1
         AND is_active = true
         AND trigger_event = $2
         AND jsonb_array_length(COALESCE(steps, '[]'::jsonb)) > 0`,
      [tenantId, newStage],
    );

    if (seqRes.rowCount === 0) return;

    for (const seq of seqRes.rows) {
      // Check if already enrolled (duplicate guard)
      const existRes = await pool.query(
        `SELECT id FROM sequence_enrollments
         WHERE sequence_id = $1 AND lead_email = $2 AND tenant_id = $3
         LIMIT 1`,
        [seq.id, leadEmail, tenantId],
      );
      if ((existRes.rowCount ?? 0) > 0) {
        console.log(`[Sequence] Lead ${leadEmail} already enrolled in seq ${seq.name}, skipping`);
        continue;
      }

      // Insert enrollment
      await pool.query(
        `INSERT INTO sequence_enrollments
           (tenant_id, sequence_id, lead_id, lead_email, name, status, current_step, enrolled_at)
         VALUES ($1, $2, $3, $4, $5, 'ACTIVE', 0, NOW())`,
        [tenantId, seq.id, leadId, leadEmail, leadName],
      );

      // Update sequence enrolled count
      await pool.query(
        `UPDATE sequences SET enrolled_count = enrolled_count + 1, updated_at = NOW() WHERE id = $1`,
        [seq.id],
      );

      console.log(`[Sequence] Auto-enrolled lead ${leadEmail} into sequence "${seq.name}" (stage: ${newStage})`);
    }
  } catch (err: any) {
    console.error('[Sequence] enrollLeadToMatchingSequences error:', err.message);
  }
}
