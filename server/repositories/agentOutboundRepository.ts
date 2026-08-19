import { createHash, randomUUID } from 'crypto';
import { pool, withTenantContext } from '../db';

export type OutboundClaimState = 'SEND' | 'SENT' | 'BUSY' | 'AMBIGUOUS' | 'FAILED';

export interface OutboundClaim {
  id: string;
  state: OutboundClaimState;
  claimToken?: string;
}

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
      await client.query(
        `INSERT INTO agent_outbound_deliveries
          (tenant_id, execution_id, interaction_id, lead_id, channel, content_hash)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (tenant_id, execution_id) DO NOTHING`,
        [
          params.tenantId,
          params.executionId,
          params.interactionId || null,
          params.leadId,
          params.channel,
          contentHash,
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
      if (row.status === 'SENT') return { id: row.id, state: 'SENT' };
      if (row.status === 'FAILED') return { id: row.id, state: 'FAILED' };
      if (row.status === 'SENDING' || row.status === 'UNKNOWN') {
        if (
          row.status === 'SENDING'
          && row.claimed_at
          && new Date(row.claimed_at).getTime() > Date.now() - 5 * 60_000
        ) {
          return { id: row.id, state: 'BUSY' };
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
        return { id: row.id, state: 'AMBIGUOUS' };
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
      return { id: row.id, state: 'SEND', claimToken };
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

  async recoverStaleSending(): Promise<Array<{ tenantId: string; leadId: string; deliveryId: string }>> {
    const result = await pool.query(
      `UPDATE agent_outbound_deliveries
          SET status = 'UNKNOWN',
              error_text = COALESCE(error_text, 'Delivery claim expired; automatic resend blocked'),
              updated_at = NOW()
        WHERE status = 'SENDING'
          AND claimed_at < NOW() - INTERVAL '5 minutes'
        RETURNING id, tenant_id, lead_id`,
    );
    return result.rows.map(row => ({
      tenantId: row.tenant_id,
      leadId: row.lead_id,
      deliveryId: row.id,
    }));
  }
}

export const agentOutboundRepository = new AgentOutboundRepository();