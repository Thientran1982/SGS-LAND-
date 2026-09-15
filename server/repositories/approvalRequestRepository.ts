import { pool, withTenantContext } from '../db';

export const MINH_PROACTIVE_CHANNEL = 'MINH_PROACTIVE';

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
  'REVIEW_REPAIR_SPIKE',
  'DRAFT_PROACTIVE_FOLLOWUP',
  'REVIEW_LISTING_PRICE',
  'REVIEW_CSAT_DROP',
] as const;

export type HighImpactAction = typeof HIGH_IMPACT_ACTIONS[number];

export function isHighImpactAction(action: string | undefined | null): action is HighImpactAction {
  return !!action && (HIGH_IMPACT_ACTIONS as readonly string[]).includes(action);
}

export interface CreateApprovalRequestData {
  tenantId: string;
  leadId?: string | null;
  channel?: string;
  actionType: HighImpactAction;
  payload?: Record<string, any>;
  reasoning?: string;
  executionId?: string;
  stepKey?: string;
  idempotencyKey?: string;
  expiresAt?: Date;
  sourceSignalId?: string | null;
  subjectType?: string | null;
  subjectId?: string | null;
}

class ApprovalRequestRepository {
  async create(data: CreateApprovalRequestData): Promise<any> {
    const result = await pool.query(
      `INSERT INTO approval_requests
       (tenant_id, lead_id, channel, action_type, payload, reasoning, execution_id, step_key, idempotency_key, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, NOW() + INTERVAL '30 minutes'))
       ON CONFLICT (tenant_id, idempotency_key) WHERE idempotency_key IS NOT NULL
       DO UPDATE SET id = approval_requests.id
       RETURNING *`,
      [data.tenantId, data.leadId || null, data.channel || null, data.actionType, JSON.stringify(data.payload || {}),
        data.reasoning || null, data.executionId || null, data.stepKey || null, data.idempotencyKey || null, data.expiresAt || null],
    );
    return this.rowToEntity(result.rows[0]);
  }

  async createProactive(data: CreateApprovalRequestData, dailyBudget: number): Promise<any> {
    return withTenantContext(data.tenantId, async client => {
      const existing = await client.query(
        `SELECT * FROM approval_requests
          WHERE tenant_id=$1::uuid AND source_signal_id=$2::text
          LIMIT 1`,
        [data.tenantId, data.sourceSignalId || null],
      );
      if (existing.rows[0]) return this.rowToEntity(existing.rows[0]);

      await client.query(
        `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
        [`minh-proactive-budget:${data.tenantId}:${new Date().toISOString().slice(0, 10)}`],
      );
      const budgetResult = await client.query(
        `SELECT COUNT(*)::int AS used
           FROM approval_requests
          WHERE tenant_id=$1::uuid
            AND channel='MINH_PROACTIVE'
            AND requested_at >= CURRENT_DATE`,
        [data.tenantId],
      );
      const used = Number(budgetResult.rows[0]?.used || 0);
      if (used >= dailyBudget) {
        const error = new Error(`MINH_PROACTIVE_BUDGET_EXCEEDED:${used}/${dailyBudget}`);
        (error as any).code = 'MINH_PROACTIVE_BUDGET_EXCEEDED';
        throw error;
      }

      const result = await client.query(
        `INSERT INTO approval_requests
          (tenant_id, lead_id, channel, action_type, payload, reasoning, execution_id,
           step_key, idempotency_key, expires_at, source_signal_id, subject_type, subject_id)
         VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,$7::uuid,$8,$9,COALESCE($10,NOW()+INTERVAL '30 minutes'),$11::text,$12,$13)
         ON CONFLICT (tenant_id, source_signal_id)
           WHERE source_signal_id IS NOT NULL
         DO UPDATE SET id=approval_requests.id
         RETURNING *`,
        [
          data.tenantId, data.leadId || null, MINH_PROACTIVE_CHANNEL, data.actionType,
          JSON.stringify(data.payload || {}), data.reasoning || null, data.executionId || null,
          data.stepKey || null, data.idempotencyKey || null, data.expiresAt || null,
          data.sourceSignalId || null, data.subjectType || null, data.subjectId || null,
        ],
      );
      return this.rowToEntity(result.rows[0]);
    });
  }

  async findPendingProactiveByTenant(tenantId: string, limit = 50): Promise<any[]> {
    const result = await withTenantContext(tenantId, client => client.query(
      `SELECT ar.*, l.name AS lead_name, l.phone AS lead_phone
         FROM approval_requests ar
         LEFT JOIN leads l ON l.id = ar.lead_id
        WHERE ar.tenant_id=$1::uuid AND ar.channel='MINH_PROACTIVE' AND ar.status='PENDING'
        ORDER BY ar.requested_at DESC
        LIMIT $2`,
      [tenantId, limit],
    ));
    return result.rows.map(row => this.rowToEntity(row));
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
         AND expires_at > NOW()
       RETURNING *`,
      [tenantId, id, status, reviewedBy, reviewNote || null],
    );
    return result.rows[0] ? this.rowToEntity(result.rows[0]) : null;
  }

  async markResumed(tenantId: string, id: string): Promise<any | null> {
    const result = await pool.query(
      `UPDATE approval_requests
       SET resumed_at = NOW()
       WHERE tenant_id = $1 AND id = $2 AND status = 'APPROVED' AND resumed_at IS NULL
       RETURNING *`,
      [tenantId, id],
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
      executionId: row.execution_id,
      stepKey: row.step_key,
      idempotencyKey: row.idempotency_key,
      expiresAt: row.expires_at,
      resumedAt: row.resumed_at,
      sourceSignalId: row.source_signal_id,
      subjectType: row.subject_type,
      subjectId: row.subject_id,
      createdAt: row.created_at,
    };
  }
}

export const approvalRequestRepository = new ApprovalRequestRepository();
