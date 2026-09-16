import { createHash, randomUUID } from 'crypto';
import { pool, withTenantContext } from '../db';

export type OutboundClaimState = 'SEND' | 'SENT' | 'BUSY' | 'AMBIGUOUS' | 'FAILED';

export interface OutboundClaim {
  id: string;
  state: OutboundClaimState;
  claimToken?: string;
  deliveryKey?: string;
}

export type OutboundReconciliation = 'SENT' | 'FAILED';

class AgentOutboundRepository {
  private async insertAuditEvent(client: any, params: {
    tenantId: string;
    deliveryId: string;
    approvalRequestId: string;
    variantId: string;
    eventType: 'PROVIDER_LOOKUP' | 'OPERATOR_DECISION';
    provider: 'BREVO' | 'ZALO' | 'NONE';
    lookupStatus?: 'DELIVERED' | 'NOT_RECEIVED' | 'UNKNOWN' | 'UNSUPPORTED';
    providerEvent?: string;
    providerMessageId?: string;
    decisionStatus?: OutboundReconciliation;
    decisionNote?: string;
    operatorId?: string;
  }): Promise<any> {
    const result = await client.query(
      `INSERT INTO outreach_delivery_audit_events
        (tenant_id, delivery_id, approval_request_id, variant_id, event_type,
         provider, lookup_status, provider_event, provider_message_id,
         decision_status, decision_note, operator_id, operator_name)
       SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
              COALESCE(NULLIF(u.name, ''), NULLIF(u.email, ''), 'Unknown operator')
         FROM (SELECT 1) AS anchor
         LEFT JOIN users u
           ON u.tenant_id = $1 AND u.id = $12
       RETURNING id, event_type, provider, lookup_status, provider_event,
                 provider_message_id, decision_status, decision_note,
                 operator_id, operator_name, created_at`,
      [
        params.tenantId,
        params.deliveryId,
        params.approvalRequestId,
        params.variantId,
        params.eventType,
        params.provider,
        params.lookupStatus || null,
        params.providerEvent?.slice(0, 200) || null,
        params.providerMessageId?.slice(0, 500) || null,
        params.decisionStatus || null,
        params.decisionNote?.slice(0, 1000) || null,
        params.operatorId || null,
      ],
    );
    return result.rows[0];
  }

  async createAndClaim(params: {
    tenantId: string;
    executionId?: string;
    approvalRequestId?: string;
    variantId?: string;
    interactionId?: string;
    leadId: string;
    channel: string;
    content: string;
  }): Promise<OutboundClaim> {
    return withTenantContext(params.tenantId, async client => {
      if (!params.executionId && (!params.approvalRequestId || !params.variantId)) {
        throw new Error('Outbound delivery requires an execution or approval variant key');
      }
      const contentHash = createHash('sha256').update(params.content).digest('hex');
      const insertDeliveryKey = params.approvalRequestId
        ? `outreach-approval:${params.approvalRequestId}:${createHash('sha256').update(params.variantId || '').digest('hex').slice(0, 24)}`
        : `agent-outbound:${params.executionId}`;
      if (params.approvalRequestId) {
        await client.query(
          `INSERT INTO agent_outbound_deliveries
            (tenant_id, execution_id, approval_request_id, variant_id, interaction_id, lead_id, channel, content_hash, delivery_key)
           VALUES ($1,NULL,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (tenant_id, approval_request_id, variant_id)
           WHERE approval_request_id IS NOT NULL AND variant_id IS NOT NULL DO NOTHING`,
          [
            params.tenantId,
            params.approvalRequestId,
            params.variantId,
            params.interactionId || null,
            params.leadId,
            params.channel,
            contentHash,
            insertDeliveryKey,
          ],
        );
      } else {
        await client.query(
          `INSERT INTO agent_outbound_deliveries
            (tenant_id, execution_id, interaction_id, lead_id, channel, content_hash, delivery_key)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (tenant_id, execution_id) DO NOTHING`,
          [
            params.tenantId,
            params.executionId,
            params.interactionId || null,
            params.leadId,
            params.channel,
            contentHash,
            insertDeliveryKey,
          ],
        );
      }
      const selected = params.approvalRequestId
        ? await client.query(
          `SELECT * FROM agent_outbound_deliveries
            WHERE tenant_id=$1 AND approval_request_id=$2 AND variant_id=$3
            FOR UPDATE`,
          [params.tenantId, params.approvalRequestId, params.variantId],
        )
        : await client.query(
          `SELECT * FROM agent_outbound_deliveries
            WHERE tenant_id = $1 AND execution_id = $2
            FOR UPDATE`,
          [params.tenantId, params.executionId],
        );
      const row = selected.rows[0];
      if (!row) throw new Error('Outbound delivery disappeared during claim');
      if (
        row.content_hash !== contentHash
        || row.channel !== params.channel
        || row.lead_id !== params.leadId
        || (params.approvalRequestId && (
          row.approval_request_id !== params.approvalRequestId
          || row.variant_id !== params.variantId
        ))
      ) {
        throw new Error(`OUTBOUND_DELIVERY_CONFLICT:${row.id}`);
      }
      const deliveryKey = row.delivery_key || `agent-outbound:${row.id}`;
      if (row.status === 'SENT') return { id: row.id, state: 'SENT', deliveryKey };
      if (row.status === 'FAILED') return { id: row.id, state: 'FAILED', deliveryKey };
      if (row.status === 'SENDING' || row.status === 'UNKNOWN') {
        if (
          row.status === 'SENDING'
          && row.claimed_at
          && new Date(row.claimed_at).getTime() > Date.now() - 5 * 60_000
        ) {
          return { id: row.id, state: 'BUSY', deliveryKey };
        }
        if (row.status === 'SENDING') {
          await client.query(
            `UPDATE agent_outbound_deliveries
                SET status = 'UNKNOWN',
                    error_text = COALESCE(error_text, 'Delivery interrupted after send claim; automatic resend blocked'),
                    updated_at = NOW()
              WHERE id = $1 AND tenant_id = $2`,
            [row.id, params.tenantId],
          );
        }
        return { id: row.id, state: 'AMBIGUOUS', deliveryKey };
      }

      const claimToken = randomUUID();
      await client.query(
        `UPDATE agent_outbound_deliveries
            SET status = 'SENDING',
                claim_token = $3,
                attempt = attempt + 1,
                claimed_at = NOW(),
                updated_at = NOW()
          WHERE id = $1 AND tenant_id = $2 AND status = 'PENDING'`,
        [row.id, params.tenantId, claimToken],
      );
      return { id: row.id, state: 'SEND', claimToken, deliveryKey };
    });
  }

  async markSent(params: {
    tenantId: string;
    deliveryId: string;
    claimToken: string;
    providerMessageId?: string;
  }): Promise<void> {
    await withTenantContext(params.tenantId, async client => {
      const result = await client.query(
        `UPDATE agent_outbound_deliveries
            SET status = 'SENT',
                provider_message_id = $4,
                sent_at = NOW(),
                updated_at = NOW()
          WHERE id = $1 AND tenant_id = $2 AND claim_token = $3 AND status = 'SENDING'`,
        [params.deliveryId, params.tenantId, params.claimToken, params.providerMessageId || null],
      );
      if ((result.rowCount ?? 0) !== 1) throw new Error(`OUTBOUND_DELIVERY_CLAIM_LOST:${params.deliveryId}`);
    });
  }

  async markFailed(params: {
    tenantId: string;
    deliveryId: string;
    claimToken: string;
    error: string;
  }): Promise<void> {
    await withTenantContext(params.tenantId, client => client.query(
      `UPDATE agent_outbound_deliveries
          SET status = 'FAILED',
              error_text = $4,
              updated_at = NOW()
        WHERE id = $1 AND tenant_id = $2 AND claim_token = $3 AND status = 'SENDING'`,
      [params.deliveryId, params.tenantId, params.claimToken, params.error.slice(0, 4000)],
    ).then(() => undefined));
  }

  async markUnknown(params: {
    tenantId: string; deliveryId: string; claimToken: string; error: string;
  }): Promise<void> {
    await withTenantContext(params.tenantId, client => client.query(
      `UPDATE agent_outbound_deliveries
          SET status='UNKNOWN', error_text=$4, updated_at=NOW()
        WHERE id=$1 AND tenant_id=$2 AND claim_token=$3 AND status='SENDING'`,
      [params.deliveryId, params.tenantId, params.claimToken, params.error.slice(0, 4000)],
    ).then(() => undefined));
  }

  async recoverStaleSending(): Promise<Array<{ tenantId: string; leadId: string; deliveryId: string }>> {
    // This is the only cross-tenant operation. The migration grants the app
    // role EXECUTE on a SECURITY DEFINER function with one narrow UPDATE.
    const result = await pool.query(`SELECT * FROM recover_stale_agent_deliveries()`);
    return result.rows.map(row => ({
      tenantId: row.tenant_id,
      leadId: row.lead_id,
      deliveryId: row.delivery_id,
    }));
  }

  async listUnknown(tenantId: string, limit = 50): Promise<any[]> {
    return withTenantContext(tenantId, async client => (await client.query(
      `SELECT id, execution_id, interaction_id, lead_id, channel, delivery_key,
              attempt, provider_message_id, error_text, claimed_at, updated_at
         FROM agent_outbound_deliveries
        WHERE tenant_id=$1 AND status='UNKNOWN'
        ORDER BY updated_at DESC LIMIT $2`, [tenantId, limit],
    )).rows);
  }

  async findByApprovalVariant(
    tenantId: string,
    approvalRequestId: string,
    variantId: string,
  ): Promise<any | null> {
    return withTenantContext(tenantId, async client => {
      const result = await client.query(
        `SELECT id, approval_request_id, variant_id, lead_id, channel, status,
                delivery_key, provider_message_id, error_text, updated_at
           FROM agent_outbound_deliveries
          WHERE tenant_id=$1 AND approval_request_id=$2 AND variant_id=$3
          LIMIT 1`,
        [tenantId, approvalRequestId, variantId],
      );
      return result.rows[0] || null;
    });
  }

  async recordAuditEvent(params: {
    tenantId: string;
    deliveryId: string;
    approvalRequestId: string;
    variantId: string;
    eventType: 'PROVIDER_LOOKUP' | 'OPERATOR_DECISION';
    provider: 'BREVO' | 'ZALO' | 'NONE';
    lookupStatus?: 'DELIVERED' | 'NOT_RECEIVED' | 'UNKNOWN' | 'UNSUPPORTED';
    providerEvent?: string;
    providerMessageId?: string;
    decisionStatus?: OutboundReconciliation;
    decisionNote?: string;
    operatorId?: string;
  }): Promise<any> {
    return withTenantContext(params.tenantId, client => this.insertAuditEvent(client, params));
  }

  async listAuditEventsForDelivery(
    tenantId: string,
    deliveryId: string,
  ): Promise<any[]> {
    return withTenantContext(tenantId, async client => (await client.query(
      `SELECT id, event_type, provider, lookup_status, provider_event,
              provider_message_id, decision_status, decision_note,
              operator_id, operator_name, created_at
         FROM outreach_delivery_audit_events
        WHERE tenant_id=$1 AND delivery_id=$2
        ORDER BY created_at ASC, id ASC`,
      [tenantId, deliveryId],
    )).rows);
  }

  async listAuditEventsForApproval(
    tenantId: string,
    approvalRequestId: string,
  ): Promise<any[]> {
    return withTenantContext(tenantId, async client => (await client.query(
      `SELECT ae.id, ae.approval_request_id, ae.delivery_id, ae.variant_id,
              d.channel, ae.event_type, ae.provider, ae.lookup_status,
              ae.provider_event, ae.provider_message_id, ae.decision_status,
              ae.decision_note, ae.operator_id, ae.operator_name, ae.created_at
         FROM outreach_delivery_audit_events ae
         INNER JOIN agent_outbound_deliveries d
           ON d.id = ae.delivery_id
          AND d.tenant_id = ae.tenant_id
        WHERE ae.tenant_id = $1
          AND ae.approval_request_id = $2
        ORDER BY ae.created_at ASC, ae.id ASC`,
      [tenantId, approvalRequestId],
    )).rows);
  }

  async reconcileUnknown(params: {
    tenantId: string; deliveryId: string; status: OutboundReconciliation;
    providerMessageId?: string; note: string;
  }): Promise<any | null> {
    return withTenantContext(params.tenantId, async client => {
      const result = await client.query(
        `UPDATE agent_outbound_deliveries
            SET status=$3, provider_message_id=COALESCE($4,provider_message_id),
                error_text=$5, updated_at=NOW(), sent_at=CASE WHEN $3='SENT' THEN COALESCE(sent_at,NOW()) ELSE sent_at END
          WHERE tenant_id=$1 AND id=$2 AND status='UNKNOWN'
          RETURNING *`,
        [params.tenantId, params.deliveryId, params.status, params.providerMessageId || null, params.note.slice(0, 1000)],
      );
      return result.rows[0] || null;
    });
  }

  async reconcileUnknownWithAudit(params: {
    tenantId: string;
    deliveryId: string;
    status: OutboundReconciliation;
    providerMessageId?: string;
    note: string;
    approvalRequestId: string;
    variantId: string;
    provider: 'BREVO' | 'ZALO' | 'NONE';
    lookupStatus: 'DELIVERED' | 'NOT_RECEIVED' | 'UNKNOWN' | 'UNSUPPORTED';
    providerEvent?: string;
    operatorId: string;
  }): Promise<any | null> {
    return withTenantContext(params.tenantId, async client => {
      const result = await client.query(
        `UPDATE agent_outbound_deliveries
            SET status=$3, provider_message_id=COALESCE($4,provider_message_id),
                error_text=$5, updated_at=NOW(),
                sent_at=CASE WHEN $3='SENT' THEN COALESCE(sent_at,NOW()) ELSE sent_at END
          WHERE tenant_id=$1 AND id=$2 AND status='UNKNOWN'
          RETURNING *`,
        [
          params.tenantId,
          params.deliveryId,
          params.status,
          params.providerMessageId || null,
          params.note.slice(0, 1000),
        ],
      );
      const row = result.rows[0];
      if (!row) return null;
      await this.insertAuditEvent(client, {
        tenantId: params.tenantId,
        deliveryId: params.deliveryId,
        approvalRequestId: params.approvalRequestId,
        variantId: params.variantId,
        eventType: 'OPERATOR_DECISION',
        provider: params.provider,
        lookupStatus: params.lookupStatus,
        providerEvent: params.providerEvent,
        providerMessageId: row.provider_message_id || params.providerMessageId,
        decisionStatus: params.status,
        decisionNote: params.note,
        operatorId: params.operatorId,
      });
      return row;
    });
  }
}

export const agentOutboundRepository = new AgentOutboundRepository();