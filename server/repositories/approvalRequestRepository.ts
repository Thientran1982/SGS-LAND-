import { pool } from '../db';

/**
 * approval_requests -- hang doi cho Permission Broker.
 * Khi AI de xuat 1 hanh dong "high-impact" (CONFIRM_DEPOSIT, CHANGE_LEAD_STAGE,
 * CREATE_PROPOSAL, BOOK_VIEWING, SEND_DOCS), thay vi tu dong thuc thi, mot dong
 * PENDING duoc tao o day de nhan vien duyet qua tab moi trong Inbox.
 */

export const HIGH_IMPACT_ACTIONS = [
  'CONFIRM_DEPOSIT',
  'CHANGE_LEAD_STAGE',
  'CREATE_PROPOSAL',
  'BOOK_VIEWING',
  'SEND_DOCS',
] as const;

export type HighImpactAction = typeof HIGH_IMPACT_ACTIONS[number];

export function isHighImpactAction(action: string | undefined | null): action is HighImpactAction {
  return !!action && (HIGH_IMPACT_ACTIONS as readonly string[]).includes(action);
}

export interface CreateApprovalRequestData {
  tenantId: string;
  leadId: string;
  channel?: string;
  actionType: HighImpactAction;
  payload?: Record<string, any>;
  reasoning?: string;
}

class ApprovalRequestRepository {
  async create(data: CreateApprovalRequestData): Promise<any> {
    const result = await pool.query(
      `INSERT INTO approval_requests (tenant_id, lead_id, channel, action_type, payload, reasoning)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [data.tenantId, data.leadId, data.channel || null, data.actionType, JSON.stringify(data.payload || {}), data.reasoning || null],
    );
    return this.rowToEntity(result.rows[0]);
  }

  /** Danh sach PENDING cho tab duyet trong Inbox, moi nhat truoc */
  async findPendingByTenant(tenantId: string, limit = 50): Promise<any[]> {
    const result = await pool.query(
      `SELECT ar.*, l.name AS lead_name, l.phone AS lead_phone
       FROM approval_requests ar
       LEFT JOIN leads l ON l.id = ar.lead_id
       WHERE ar.tenant_id = $1 AND ar.status = 'PENDING'
       ORDER BY ar.requested_at DESC
       LIMIT $2`,
      [tenantId, limit],
    );
    return result.rows.map(r => this.rowToEntity(r));
  }

  async findById(tenantId: string, id: string): Promise<any | null> {
    const result = await pool.query(
      `SELECT * FROM approval_requests WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id],
    );
    return result.rows[0] ? this.rowToEntity(result.rows[0]) : null;
  }

  async countPending(tenantId: string): Promise<number> {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS count FROM approval_requests WHERE tenant_id = $1 AND status = 'PENDING'`,
      [tenantId],
    );
    return result.rows[0]?.count || 0;
  }

  async setStatus(
    tenantId: string,
    id: string,
    status: 'APPROVED' | 'REJECTED',
    reviewedBy: string,
    reviewNote?: string,
  ): Promise<any | null> {
    const result = await pool.query(
      `UPDATE approval_requests
       SET status = $3, reviewed_by = $4, reviewed_at = NOW(), review_note = $5
       WHERE tenant_id = $1 AND id = $2 AND status = 'PENDING'
       RETURNING *`,
      [tenantId, id, status, reviewedBy, reviewNote || null],
    );
    return result.rows[0] ? this.rowToEntity(result.rows[0]) : null;
  }

  private rowToEntity(row: Record<string, any>): any {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      leadId: row.lead_id,
      leadName: row.lead_name ?? undefined,
      leadPhone: row.lead_phone ?? undefined,
      channel: row.channel,
      actionType: row.action_type,
      payload: row.payload,
      reasoning: row.reasoning,
      status: row.status,
      requestedAt: row.requested_at,
      reviewedBy: row.reviewed_by,
      reviewedAt: row.reviewed_at,
      reviewNote: row.review_note,
      createdAt: row.created_at,
    };
  }
}

export const approvalRequestRepository = new ApprovalRequestRepository();
