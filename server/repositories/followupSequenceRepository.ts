/**
 * followupSequenceRepository.ts
 *
 * Data access for the follow-up agent system.
 *
 * Tables:
 *   follow_up_sequences  — one row per lead contact session (ACTIVE | COMPLETED | CANCELLED)
 *   follow_up_sends      — one row per scheduled touchpoint (D+1/3/5/7, PENDING → SENT/FAILED)
 *
 * All queries use withTenantContext (RLS) unless bypassed via pool directly
 * for internal cron operations (which add their own WHERE tenant_id = $n).
 */

import { Pool } from 'pg';
import { BaseRepository } from './baseRepository';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CreateSequenceInput {
  leadId: string;
  leadName?: string;
  leadPhone?: string;
  leadEmail?: string;
  leadZaloId?: string;
  source?: string;
  projectCode?: string;
}

export interface FollowUpSequence {
  id: string;
  tenant_id: string;
  lead_id: string;
  lead_name: string | null;
  lead_phone: string | null;
  lead_email: string | null;
  lead_zalo_id: string | null;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  cancel_reason: string | null;
  source: string;
  project_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface FollowUpSend {
  id: string;
  tenant_id: string;
  sequence_id: string;
  lead_id: string;
  day_number: 1 | 3 | 5 | 7;
  channel: 'ZALO' | 'SMS' | 'EMAIL' | null;
  status: 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED' | 'CANCELLED';
  message: string | null;
  sent_at: string | null;
  error: string | null;
  created_at: string;
}

export interface DueSend extends FollowUpSend {
  seq_lead_name: string | null;
  seq_lead_phone: string | null;
  seq_lead_email: string | null;
  seq_lead_zalo_id: string | null;
  seq_source: string;
}

class FollowUpSequenceRepository extends BaseRepository {
  constructor() {
    super('follow_up_sequences');
  }

  // ── Create sequence + pre-scheduled sends ─────────────────────────────────

  async createSequence(
    pool: Pool,
    tenantId: string,
    input: CreateSequenceInput,
  ): Promise<FollowUpSequence> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL app.tenant_id = '${tenantId}'`);

      const seqResult = await client.query(
        `INSERT INTO follow_up_sequences
           (tenant_id, lead_id, lead_name, lead_phone, lead_email, lead_zalo_id, source, project_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          tenantId,
          input.leadId,
          input.leadName || null,
          input.leadPhone || null,
          input.leadEmail || null,
          input.leadZaloId || null,
          input.source || 'LIVE_CHAT',
          input.projectCode || null,
        ],
      );
      const seq: FollowUpSequence = seqResult.rows[0];

      // Pre-insert D+1/3/5/7 as PENDING sends
      for (const day of [1, 3, 5, 7] as const) {
        await client.query(
          `INSERT INTO follow_up_sends (tenant_id, sequence_id, lead_id, day_number)
           VALUES ($1, $2, $3, $4)`,
          [tenantId, seq.id, input.leadId, day],
        );
      }

      await client.query('COMMIT');
      return seq;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ── Cancel sequence + all pending sends ───────────────────────────────────

  async cancelSequence(
    pool: Pool,
    tenantId: string,
    sequenceId: string,
    reason: string,
  ): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE follow_up_sequences
            SET status = 'CANCELLED', cancel_reason = $1, updated_at = NOW()
          WHERE id = $2 AND tenant_id = $3`,
        [reason, sequenceId, tenantId],
      );
      await client.query(
        `UPDATE follow_up_sends
            SET status = 'CANCELLED'
          WHERE sequence_id = $1 AND status = 'PENDING'`,
        [sequenceId],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ── Cancel by lead (e.g. lead converted to WON/LOST) ─────────────────────

  async cancelByLead(pool: Pool, leadId: string, reason: string): Promise<number> {
    const result = await pool.query(
      `UPDATE follow_up_sequences
          SET status = 'CANCELLED', cancel_reason = $1, updated_at = NOW()
        WHERE lead_id = $2 AND status = 'ACTIVE'
        RETURNING id`,
      [reason, leadId],
    );
    const ids = result.rows.map((r: any) => r.id);
    if (ids.length > 0) {
      await pool.query(
        `UPDATE follow_up_sends
            SET status = 'CANCELLED'
          WHERE sequence_id = ANY($1) AND status = 'PENDING'`,
        [ids],
      );
    }
    return ids.length;
  }

  // ── Query due sends (cron) ────────────────────────────────────────────────

  /**
   * Returns PENDING sends whose scheduled time has arrived:
   *   NOW() >= seq.created_at + (day_number || ' days')::interval
   * Skips cancelled sequences. Safe to call from cron without RLS context.
   * Returns max 200 rows per tick to bound execution time.
   */
  async getDueSends(pool: Pool): Promise<DueSend[]> {
    const result = await pool.query(`
      SELECT
        fs.*,
        seq.lead_name  AS seq_lead_name,
        seq.lead_phone AS seq_lead_phone,
        seq.lead_email AS seq_lead_email,
        seq.lead_zalo_id AS seq_lead_zalo_id,
        seq.source       AS seq_source
      FROM follow_up_sends fs
      JOIN follow_up_sequences seq ON seq.id = fs.sequence_id
      WHERE fs.status = 'PENDING'
        AND seq.status = 'ACTIVE'
        AND NOW() >= seq.created_at + (fs.day_number || ' days')::interval
      ORDER BY seq.created_at ASC
      LIMIT 200
    `);
    return result.rows;
  }

  // ── Mark send result ──────────────────────────────────────────────────────

  async markSent(
    pool: Pool,
    sendId: string,
    channel: 'ZALO' | 'SMS' | 'EMAIL',
    message: string,
  ): Promise<void> {
    await pool.query(
      `UPDATE follow_up_sends
          SET status = 'SENT', channel = $1, message = $2, sent_at = NOW()
        WHERE id = $3`,
      [channel, message, sendId],
    );
  }

  async markFailed(pool: Pool, sendId: string, error: string): Promise<void> {
    await pool.query(
      `UPDATE follow_up_sends
          SET status = 'FAILED', error = $1, sent_at = NOW()
        WHERE id = $2`,
      [error, sendId],
    );
  }

  async markSkipped(pool: Pool, sendId: string, reason: string): Promise<void> {
    await pool.query(
      `UPDATE follow_up_sends SET status = 'SKIPPED', error = $1 WHERE id = $2`,
      [reason, sendId],
    );
  }

  // ── Check if sequence already completed (all 4 days sent) ─────────────────

  async tryCompleteSequence(pool: Pool, sequenceId: string): Promise<void> {
    const result = await pool.query(
      `SELECT COUNT(*) AS pending_count
         FROM follow_up_sends
        WHERE sequence_id = $1 AND status = 'PENDING'`,
      [sequenceId],
    );
    if (Number(result.rows[0]?.pending_count) === 0) {
      await pool.query(
        `UPDATE follow_up_sequences
            SET status = 'COMPLETED', updated_at = NOW()
          WHERE id = $1 AND status = 'ACTIVE'`,
        [sequenceId],
      );
    }
  }

  // ── List sequences for dashboard ──────────────────────────────────────────

  async listSequences(
    pool: Pool,
    tenantId: string,
    options: { page?: number; pageSize?: number; status?: string } = {},
  ): Promise<{ sequences: any[]; total: number }> {
    const page = Math.max(1, options.page || 1);
    const pageSize = Math.min(100, options.pageSize || 20);
    const offset = (page - 1) * pageSize;

    const conditions: string[] = ['fus.tenant_id = $1'];
    const values: any[] = [tenantId];
    let p = 2;

    if (options.status) {
      conditions.push(`fus.status = $${p++}`);
      values.push(options.status);
    }

    const where = conditions.join(' AND ');

    const [rowsResult, countResult] = await Promise.all([
      pool.query(
        `SELECT
           fus.*,
           COALESCE(sent.sent_count, 0)    AS sent_count,
           COALESCE(sent.pending_count, 0) AS pending_count,
           COALESCE(sent.failed_count, 0)  AS failed_count,
           COALESCE(sent.channels, '{}')   AS channels
         FROM follow_up_sequences fus
         LEFT JOIN (
           SELECT
             sequence_id,
             COUNT(*) FILTER (WHERE status = 'SENT')    AS sent_count,
             COUNT(*) FILTER (WHERE status = 'PENDING') AS pending_count,
             COUNT(*) FILTER (WHERE status = 'FAILED')  AS failed_count,
             array_agg(DISTINCT channel) FILTER (WHERE channel IS NOT NULL) AS channels
           FROM follow_up_sends
           GROUP BY sequence_id
         ) sent ON sent.sequence_id = fus.id
         WHERE ${where}
         ORDER BY fus.created_at DESC
         LIMIT $${p} OFFSET $${p + 1}`,
        [...values, pageSize, offset],
      ),
      pool.query(
        `SELECT COUNT(*) AS total FROM follow_up_sequences fus WHERE ${where}`,
        values,
      ),
    ]);

    return {
      sequences: rowsResult.rows,
      total: Number(countResult.rows[0]?.total || 0),
    };
  }

  // ── Get sends for a specific sequence ────────────────────────────────────

  async getSends(pool: Pool, sequenceId: string): Promise<FollowUpSend[]> {
    const result = await pool.query(
      `SELECT * FROM follow_up_sends WHERE sequence_id = $1 ORDER BY day_number ASC`,
      [sequenceId],
    );
    return result.rows;
  }

  // ── Get active sequence for a lead (to avoid duplicates) ─────────────────

  async getActiveSequenceForLead(
    pool: Pool,
    tenantId: string,
    leadId: string,
  ): Promise<FollowUpSequence | null> {
    const result = await pool.query(
      `SELECT * FROM follow_up_sequences
        WHERE tenant_id = $1 AND lead_id = $2 AND status = 'ACTIVE'
        LIMIT 1`,
      [tenantId, leadId],
    );
    return result.rows[0] || null;
  }
}

export const followupSequenceRepository = new FollowUpSequenceRepository();
