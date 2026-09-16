import { withTenantContext } from '../db';

export type LiveChatReplyOutboxStatus = 'REPLY_PENDING' | 'DELIVERED' | 'FAILED';

export interface LiveChatReplyOutboxRow {
  id: string;
  tenantId: string;
  leadId: string;
  inboundInteractionId: string;
  executionId: string | null;
  interactionId: string | null;
  status: LiveChatReplyOutboxStatus;
  response: Record<string, any>;
  failureCode: string | null;
  failureText: string | null;
  attempt: number;
  createdAt: string;
  updatedAt: string;
  deliveredAt: string | null;
}

function mapRow(row: any): LiveChatReplyOutboxRow {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    leadId: row.lead_id,
    inboundInteractionId: row.inbound_interaction_id,
    executionId: row.execution_id,
    interactionId: row.interaction_id,
    status: row.status,
    response: row.response_json || {},
    failureCode: row.failure_code,
    failureText: row.failure_text,
    attempt: Number(row.attempt || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deliveredAt: row.delivered_at,
  };
}

class LiveChatReplyOutboxRepository {
  async ensurePending(params: {
    tenantId: string;
    leadId: string;
    inboundInteractionId: string;
    executionId?: string | null;
  }): Promise<LiveChatReplyOutboxRow> {
    return withTenantContext(params.tenantId, async client => {
      const result = await client.query(
        `INSERT INTO livechat_reply_outbox
          (tenant_id, lead_id, inbound_interaction_id, execution_id, status)
         VALUES ($1, $2, $3, $4, 'REPLY_PENDING')
         ON CONFLICT (tenant_id, inbound_interaction_id) DO UPDATE
           SET lead_id = EXCLUDED.lead_id,
               execution_id = COALESCE(livechat_reply_outbox.execution_id, EXCLUDED.execution_id),
               updated_at = NOW()
         RETURNING *`,
        [
          params.tenantId,
          params.leadId,
          params.inboundInteractionId,
          params.executionId || null,
        ],
      );
      return mapRow(result.rows[0]);
    });
  }

  async get(tenantId: string, inboundInteractionId: string): Promise<LiveChatReplyOutboxRow | null> {
    return withTenantContext(tenantId, async client => {
      const result = await client.query(
        `SELECT * FROM livechat_reply_outbox
          WHERE tenant_id = $1 AND inbound_interaction_id = $2
          LIMIT 1`,
        [tenantId, inboundInteractionId],
      );
      return result.rows[0] ? mapRow(result.rows[0]) : null;
    });
  }

  async recordResponse(params: {
    tenantId: string;
    inboundInteractionId: string;
    executionId: string;
    response: Record<string, any>;
  }): Promise<LiveChatReplyOutboxRow | null> {
    return withTenantContext(params.tenantId, async client => {
      const result = await client.query(
        `UPDATE livechat_reply_outbox
            SET execution_id = $3,
                response_json = $4::jsonb,
                status = CASE WHEN status = 'DELIVERED' THEN status ELSE 'REPLY_PENDING' END,
                failure_code = NULL,
                failure_text = NULL,
                attempt = attempt + 1,
                updated_at = NOW()
          WHERE tenant_id = $1 AND inbound_interaction_id = $2
          RETURNING *`,
        [
          params.tenantId,
          params.inboundInteractionId,
          params.executionId,
          JSON.stringify(params.response || {}),
        ],
      );
      return result.rows[0] ? mapRow(result.rows[0]) : null;
    });
  }

  async markDelivered(params: {
    tenantId: string;
    inboundInteractionId: string;
    interactionId: string;
  }): Promise<LiveChatReplyOutboxRow | null> {
    return withTenantContext(params.tenantId, async client => {
      const result = await client.query(
        `UPDATE livechat_reply_outbox
            SET interaction_id = $3,
                status = 'DELIVERED',
                delivered_at = COALESCE(delivered_at, NOW()),
                updated_at = NOW()
          WHERE tenant_id = $1 AND inbound_interaction_id = $2
          RETURNING *`,
        [params.tenantId, params.inboundInteractionId, params.interactionId],
      );
      return result.rows[0] ? mapRow(result.rows[0]) : null;
    });
  }

  async markFailed(params: {
    tenantId: string;
    inboundInteractionId: string;
    code: string;
    error: string;
  }): Promise<LiveChatReplyOutboxRow | null> {
    return withTenantContext(params.tenantId, async client => {
      const result = await client.query(
        `UPDATE livechat_reply_outbox
            SET status = 'FAILED',
                failure_code = $3,
                failure_text = $4,
                updated_at = NOW()
          WHERE tenant_id = $1 AND inbound_interaction_id = $2
          RETURNING *`,
        [
          params.tenantId,
          params.inboundInteractionId,
          params.code.slice(0, 120),
          params.error.slice(0, 4000),
        ],
      );
      return result.rows[0] ? mapRow(result.rows[0]) : null;
    });
  }
}

export const liveChatReplyOutboxRepository = new LiveChatReplyOutboxRepository();