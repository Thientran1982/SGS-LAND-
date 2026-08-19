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
  async createAndClaim(params: {
    tenantId: string;
    executionId: string;
    interactionId?: string;
    leadId: string;
    channel: string;
    content: string;
  }): Promise<OutboundClaim> {
    return withTenantContext(params.tenantId, async client => {
      const contentHash = createHash('sha256').update(params.content).digest('hex');
      const insertDeliveryKey = `agent-outbound:${params.executionId}`;
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
      const selected = await client.query(
        `SELECT * FROM agent_outbound_deliveries
          WHERE tenant_id = $1 AND execution_id = $2
          FOR UPDATE`,
        [params.tenantId, params.executionId],
      );
      const row = selected.rows[0];
      if (!row) throw new Error('Outbound delivery disappeared during claim');
      if (row.content_hash !== contentHash || row.channel !== params.channel || row.lead_id !== params.leadId) {
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
}

export const agentOutboundRepository = new AgentOutboundRepository();