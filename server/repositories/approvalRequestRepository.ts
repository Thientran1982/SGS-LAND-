import { pool, withTenantContext } from '../db';

export const MINH_PROACTIVE_CHANNEL = 'MINH_PROACTIVE';

// Week 5 decision-queue TTL: proactive suggestions sit in a staff review
// queue, not a synchronous in-flight action, so they must not inherit the
// generic 30-minute approval expiry used by create() below. A window that
// short silently locks staff out of approving/rejecting once it passes,
// because setStatus() requires expires_at > NOW().
export const DEFAULT_MINH_PROACTIVE_APPROVAL_TTL_HOURS = 24;
export const MINH_PROACTIVE_APPROVAL_TTL_HOURS = Math.max(
  1,
  Number(process.env.MINH_PROACTIVE_APPROVAL_TTL_HOURS || DEFAULT_MINH_PROACTIVE_APPROVAL_TTL_HOURS),
);

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
  'PROMOTE_LEARNING_CANDIDATE',
  'ROLLBACK_LEARNING_CANDIDATE',
  'DRAFT_OUTREACH',
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
    const expiresAt = data.expiresAt || new Date(Date.now() + MINH_PROACTIVE_APPROVAL_TTL_HOURS * 3600000);
    return withTenantContext(data.tenantId, async client => {
      const existing = await client.query(
        `SELECT * FROM approval_requests
          WHERE tenant_id=$1::uuid AND source_signal_id=$2::text
          LIMIT 1`,
        [data.tenantId, data.sourceSignalId || null],
      );
      if (existing.rows[0]) return { ...this.rowToEntity(existing.rows[0]), reused: 'DUPLICATE_SOURCE_SIGNAL' };

      await client.query(
        `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
        [`minh-proactive-budget:${data.tenantId}:${new Date().toISOString().slice(0, 10)}`],
      );

      // Week 5 rule: the same lead may not receive more than one proactive
      // suggestion per day, even if a different detector or signal flags it.
      if (data.leadId) {
        const existingForLead = await client.query(
          `SELECT * FROM approval_requests
             WHERE tenant_id=$1::uuid AND channel='MINH_PROACTIVE' AND lead_id=$2::uuid
               AND requested_at >= CURRENT_DATE
             ORDER BY requested_at ASC
             LIMIT 1`,
          [data.tenantId, data.leadId],
        );
        if (existingForLead.rows[0]) return { ...this.rowToEntity(existingForLead.rows[0]), reused: 'LEAD_DAILY_LIMIT' };
      }

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
         VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,$7::uuid,$8,$9,$10,$11::text,$12,$13)
         ON CONFLICT (tenant_id, source_signal_id)
           WHERE source_signal_id IS NOT NULL
         DO UPDATE SET id=approval_requests.id
         RETURNING *`,
        [
          data.tenantId, data.leadId || null, MINH_PROACTIVE_CHANNEL, data.actionType,
          JSON.stringify(data.payload || {}), data.reasoning || null, data.executionId || null,
          data.stepKey || null, data.idempotencyKey || null, expiresAt,
          data.sourceSignalId || null, data.subjectType || null, data.subjectId || null,
        ],
      );
      return { ...this.rowToEntity(result.rows[0]), reused: null as string | null };
    });
  }

  async createLearningCandidateApproval(data: CreateApprovalRequestData): Promise<any> {
    if (!data.subjectId || !data.idempotencyKey) throw new Error('LEARNING_APPROVAL_IDEMPOTENCY_REQUIRED');
    const expiresAt = data.expiresAt || new Date(Date.now() + MINH_PROACTIVE_APPROVAL_TTL_HOURS * 3600000);
    return withTenantContext(data.tenantId, async client => {
      await client.query(
        `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
        [`minh-learning-approval:${data.tenantId}:${data.subjectId}:${data.actionType}`],
      );
      const existing = await client.query(
        `SELECT * FROM approval_requests
          WHERE tenant_id=$1::uuid AND idempotency_key=$2
          LIMIT 1`,
        [data.tenantId, data.idempotencyKey],
      );
      if (existing.rows[0]) return { ...this.rowToEntity(existing.rows[0]), reused: true };
      const result = await client.query(
        `INSERT INTO approval_requests
          (tenant_id,lead_id,channel,action_type,payload,reasoning,idempotency_key,expires_at,subject_type,subject_id)
         VALUES ($1::uuid,NULL,$2,$3,$4::jsonb,$5,$6,$7,$8,$9)
         RETURNING *`,
        [
          data.tenantId,
          MINH_PROACTIVE_CHANNEL,
          data.actionType,
          JSON.stringify(data.payload || {}),
          data.reasoning || null,
          data.idempotencyKey,
          expiresAt,
          data.subjectType || 'learning_candidate',
          data.subjectId,
        ],
      );
      return { ...this.rowToEntity(result.rows[0]), reused: false };
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

  async findApprovedOutreachByTenant(tenantId: string, limit = 50): Promise<any[]> {
    const result = await pool.query(
      `SELECT ar.*, l.name AS lead_name, l.phone AS lead_phone,
              COALESCE((
                SELECT json_agg(json_build_object(
                  'deliveryId', d.id,
                  'executionId', d.execution_id,
                  'variantId', d.variant_id,
                  'status', d.status,
                  'channel', d.channel,
                  'deliveryKey', d.delivery_key,
                  'providerMessageId', d.provider_message_id,
                  'error', d.error_text,
                   'updatedAt', d.updated_at,
                   'auditHistory', COALESCE((
                     SELECT json_agg(json_build_object(
                       'id', ae.id,
                       'eventType', ae.event_type,
                       'provider', ae.provider,
                       'lookupStatus', ae.lookup_status,
                       'providerEvent', ae.provider_event,
                       'providerMessageId', ae.provider_message_id,
                       'decisionStatus', ae.decision_status,
                       'decisionNote', ae.decision_note,
                       'operatorId', ae.operator_id,
                       'operatorName', ae.operator_name,
                       'createdAt', ae.created_at
                     ) ORDER BY ae.created_at ASC, ae.id ASC)
                     FROM outreach_delivery_audit_events ae
                     WHERE ae.tenant_id = d.tenant_id
                       AND ae.delivery_id = d.id
                   ), '[]'::json)
                ) ORDER BY d.updated_at DESC)
                FROM agent_outbound_deliveries d
                WHERE d.tenant_id = ar.tenant_id
                  AND d.approval_request_id = ar.id
              ), '[]'::json) AS deliveries
       FROM approval_requests ar
       LEFT JOIN leads l ON l.id = ar.lead_id
       WHERE ar.tenant_id = $1
         AND ar.action_type = 'DRAFT_OUTREACH'
         AND ar.status = 'APPROVED'
         AND ar.resumed_at IS NOT NULL
       ORDER BY ar.reviewed_at DESC NULLS LAST
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
      deliveries: row.deliveries ?? [],
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
