import type { Pool } from 'pg';
import { emailService } from './emailService';

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

type SequenceStep = {
  type?: string;
  delayHours?: number;
  subject?: string;
  content?: string;
  template?: string;
  body?: string;
};

function isDue(createdAt: Date, steps: SequenceStep[], index: number): boolean {
  const delayHours = steps.slice(0, index + 1).reduce((sum, step) => sum + Number(step.delayHours || 0), 0);
  return Date.now() >= createdAt.getTime() + delayHours * 60 * 60 * 1000;
}

function interpolate(value: string, name: string, email: string): string {
  return value
    .replace(/\{\{name\}\}/g, name || '')
    .replace(/\{\{email\}\}/g, email || '');
}

/**
 * Process due sequence steps. A short-lived row claim plus a PostgreSQL
 * advisory lock makes this safe when multiple app processes tick together.
 */
export async function processDueSequenceEnrollments(
  pool: Pool,
  opts: { dryRun?: boolean; batchSize?: number } = {},
): Promise<{ claimed: number; sent: number; failed: number; completed: number }> {
  const stats = { claimed: 0, sent: 0, failed: 0, completed: 0 };
  const lock = await pool.query<{ locked: boolean }>(
    'SELECT pg_try_advisory_lock(hashtext($1)) AS locked',
    ['sequence-enrollment-worker'],
  );
  if (!lock.rows[0]?.locked) return stats;

  try {
    const rows = await pool.query(
      `SELECT e.id, e.tenant_id, e.sequence_id, e.lead_email, e.lead_name,
              e.step_index, e.created_at, s.steps, l.marketing_email_consent,
              COALESCE(l.opt_out_channels, '[]'::jsonb) AS opt_out_channels
         FROM sequence_enrollments e
         JOIN sequences s ON s.id = e.sequence_id AND s.tenant_id = e.tenant_id
         LEFT JOIN leads l ON l.tenant_id = e.tenant_id
                          AND lower(l.email) = lower(e.lead_email)
        WHERE e.status = 'PENDING'
          AND s.is_active = true
        ORDER BY e.created_at ASC
        LIMIT $1`,
      [opts.batchSize ?? 100],
    );

    for (const row of rows.rows) {
      stats.claimed++;
      const steps = (Array.isArray(row.steps) ? row.steps : []) as SequenceStep[];
      let index = Number(row.step_index || 0);
      if (!row.marketing_email_consent || (row.opt_out_channels || []).includes('email')) {
        await pool.query(
          `UPDATE sequence_enrollments SET status = 'STOPPED', error = $2 WHERE id = $1`,
          [row.id, 'Consent revoked or email opted out'],
        );
        continue;
      }

      while (index < steps.length && !isDue(new Date(row.created_at), steps, index)) break;
      if (index >= steps.length) {
        await pool.query(`UPDATE sequence_enrollments SET status = 'COMPLETED' WHERE id = $1`, [row.id]);
        stats.completed++;
        continue;
      }

      const step = steps[index];
      if (!step || step.type !== 'EMAIL') {
        index++;
        await pool.query(
          `UPDATE sequence_enrollments
              SET step_index = $2, status = CASE WHEN $2 >= $3 THEN 'COMPLETED' ELSE 'PENDING' END
            WHERE id = $1`,
          [row.id, index, steps.length],
        );
        if (index >= steps.length) stats.completed++;
        continue;
      }

      const claimed = await pool.query(
        `UPDATE sequence_enrollments SET status = 'PROCESSING', error = NULL
          WHERE id = $1 AND status = 'PENDING' RETURNING id`,
        [row.id],
      );
      if (!claimed.rowCount) continue;

      const subject = interpolate(step.subject || 'SGS LAND – Thông tin dành cho bạn', row.lead_name || '', row.lead_email);
      const content = interpolate(step.content || step.body || step.template || '', row.lead_name || '', row.lead_email);
      if (opts.dryRun) {
        await pool.query(`UPDATE sequence_enrollments SET status = 'PENDING' WHERE id = $1`, [row.id]);
        stats.sent++;
        continue;
      }

      try {
        const result = await emailService.sendSequenceEmail(
          row.tenant_id,
          row.lead_email,
          subject,
          content,
          `sequence:${row.id}:step:${index}`,
        );
        if (!result.success) throw new Error(result.error || 'Sequence email failed');
        const nextIndex = index + 1;
        await pool.query(
          `UPDATE sequence_enrollments
              SET step_index = $2, status = CASE WHEN $2 >= $3 THEN 'COMPLETED' ELSE 'PENDING' END,
                  sent_at = NOW(), error = NULL
            WHERE id = $1`,
          [row.id, nextIndex, steps.length],
        );
        stats.sent++;
        if (nextIndex >= steps.length) stats.completed++;
      } catch (error: any) {
        await pool.query(
          `UPDATE sequence_enrollments SET status = 'PENDING', error = $2 WHERE id = $1`,
          [row.id, String(error?.message || error).slice(0, 1000)],
        );
        stats.failed++;
      }
    }
    return stats;
  } finally {
    await pool.query('SELECT pg_advisory_unlock(hashtext($1))', ['sequence-enrollment-worker']);
  }
}
