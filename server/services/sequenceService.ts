/**
 * Auto-enroll a lead into all ACTIVE sequences whose triggerEvent matches the new stage.
 * Called whenever a lead's stage changes in leadRoutes.
 * Uses correct column names from migration 105_sequence_tracking.
 */
export async function enrollLeadToMatchingSequences(
  _pool: any,
  tenantId: string,
  _leadId: string,
  leadEmail: string,
  leadName: string,
  newStage: string,
): Promise<void> {
  try {
    if (!leadEmail) return;

    const seqRes = await _pool.query(
      `SELECT id, name FROM sequences
       WHERE tenant_id = $1
         AND is_active = true
         AND trigger_event = $2
         AND jsonb_array_length(COALESCE(steps, '[]'::jsonb)) > 0
         AND EXISTS (
           SELECT 1
             FROM leads l
            WHERE l.tenant_id = $1
              AND lower(l.email) = lower($3)
              AND COALESCE(l.marketing_email_consent, false) = true
              AND NOT (COALESCE(l.opt_out_channels, '[]'::jsonb) @> '"email"'::jsonb)
         )`,
      [tenantId, newStage, leadEmail],
    );

    if (!seqRes.rowCount) return;

    for (const seq of seqRes.rows) {
      await _pool.query(
        `INSERT INTO sequence_enrollments
           (tenant_id, sequence_id, lead_email, lead_name, step_index, status)
         VALUES ($1, $2, $3, $4, 0, 'PENDING')
         ON CONFLICT (sequence_id, lead_email) DO NOTHING`,
        [tenantId, seq.id, leadEmail, leadName || null],
      );
      console.log(`[Sequence] Auto-enrolled ${leadEmail} → "${seq.name}" (trigger: ${newStage})`);
    }
  } catch (err: any) {
    console.error('[Sequence] enrollLeadToMatchingSequences error:', err.message);
  }
}
