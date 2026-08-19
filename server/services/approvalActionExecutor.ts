import { withTenantContext } from '../db';

const LEAD_STAGES = new Set(['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST']);

export function buildChangeLeadStageApproval(result: any, leadId: string, idempotencyKey: string) {
  if (result?.suggestedAction !== 'CHANGE_LEAD_STAGE') return undefined;
  const targetStage = String(result?.suggestedActionPayload?.targetStage || '');
  if (!LEAD_STAGES.has(targetStage)) return undefined;
  return {
    leadId,
    actionType: 'CHANGE_LEAD_STAGE' as const,
    payload: { targetStage, userMessage: String(result?.userMessage || '').slice(0, 500) },
    idempotencyKey: `${idempotencyKey}:CHANGE_LEAD_STAGE:${targetStage}`,
  };
}

export async function executeApprovedAction(tenantId: string, approvalId: string, reviewerId: string): Promise<any> {
  return withTenantContext(tenantId, async client => {
    const approvalResult = await client.query(
      `SELECT * FROM approval_requests
        WHERE tenant_id=$1 AND id=$2
        FOR UPDATE`,
      [tenantId, approvalId],
    );
    const request = approvalResult.rows[0];
    if (!request) throw new Error('APPROVAL_NOT_FOUND');
    if (request.status !== 'APPROVED') throw new Error('APPROVAL_NOT_APPROVED');
    if (request.reviewed_by !== reviewerId) throw new Error('APPROVAL_REVIEWER_MISMATCH');
    if (request.expires_at && new Date(request.expires_at).getTime() < Date.now()) throw new Error('APPROVAL_EXPIRED');
    if (request.resumed_at) return { approvalId, actionType: request.action_type, executed: false, reason: 'ALREADY_EXECUTED' };
    if (request.action_type !== 'CHANGE_LEAD_STAGE') throw new Error(`APPROVAL_ACTION_UNSUPPORTED:${request.action_type}`);
    const targetStage = String(request.payload?.targetStage || '');
    if (!LEAD_STAGES.has(targetStage)) throw new Error('APPROVAL_INVALID_TARGET_STAGE');

    const leadResult = await client.query(
      `UPDATE leads SET stage=$3, updated_at=CURRENT_TIMESTAMP
        WHERE id=$1 AND tenant_id=current_setting('app.current_tenant_id', true)::uuid
        RETURNING id, stage`,
      [request.lead_id, tenantId, targetStage],
    );
    if (!leadResult.rows[0]) throw new Error('APPROVAL_LEAD_NOT_FOUND');

    if (request.execution_id) {
      const executionResult = await client.query(
        `UPDATE agent_executions
            SET status='SUCCESS', current_step='END', output_json=$3::jsonb,
                approval_request_id=$4, paused_at=NULL, finished_at=NOW(),
                lease_expires_at=NOW(), updated_at=NOW()
          WHERE id=$1 AND tenant_id=$2 AND status='WAITING_APPROVAL'
          RETURNING id`,
        [request.execution_id, tenantId, JSON.stringify({ approvalId, actionType: request.action_type, leadId: request.lead_id, targetStage }), approvalId],
      );
      if (request.execution_id && !executionResult.rows[0]) throw new Error('APPROVAL_EXECUTION_NOT_WAITING');
    }
    await client.query(
      `UPDATE approval_requests SET resumed_at=NOW() WHERE tenant_id=$1 AND id=$2 AND resumed_at IS NULL`,
      [tenantId, approvalId],
    );
    return { approvalId, actionType: request.action_type, leadId: request.lead_id, targetStage, executed: true };
  });
}