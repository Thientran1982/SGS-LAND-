import { leadRepository } from '../repositories/leadRepository';
import { approvalRequestRepository } from '../repositories/approvalRequestRepository';
import { agentExecutionRepository } from '../repositories/agentExecutionRepository';

const LEAD_STAGES = new Set(['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST']);

export async function executeApprovedAction(tenantId: string, approvalId: string, reviewerId: string): Promise<any> {
  const request = await approvalRequestRepository.findById(tenantId, approvalId);
  if (!request) throw new Error('APPROVAL_NOT_FOUND');
  if (request.status !== 'APPROVED') throw new Error('APPROVAL_NOT_APPROVED');
  if (request.reviewedBy !== reviewerId && !request.resumedAt) throw new Error('APPROVAL_REVIEWER_MISMATCH');
  if (request.expiresAt && new Date(request.expiresAt).getTime() < Date.now()) throw new Error('APPROVAL_EXPIRED');
  if (request.actionType !== 'CHANGE_LEAD_STAGE') throw new Error(`APPROVAL_ACTION_UNSUPPORTED:${request.actionType}`);

  const targetStage = String(request.payload?.targetStage || '');
  if (!LEAD_STAGES.has(targetStage)) throw new Error('APPROVAL_INVALID_TARGET_STAGE');
  const lead = await leadRepository.update(tenantId, request.leadId, { stage: targetStage }, reviewerId, 'ADMIN');
  if (!lead) throw new Error('APPROVAL_LEAD_NOT_FOUND');

  if (request.executionId) {
    const execution = await agentExecutionRepository.get(tenantId, request.executionId);
    if (execution?.status === 'WAITING_APPROVAL') {
      await agentExecutionRepository.resumeApproved(tenantId, request.executionId, request.stepKey || 'APPROVAL_RESUME');
      const resumed = await agentExecutionRepository.get(tenantId, request.executionId);
      if (resumed) {
        await agentExecutionRepository.finish({
          tenantId,
          executionId: resumed.id,
          claimToken: resumed.claimToken,
          status: 'SUCCESS',
          output: { approvalId, actionType: request.actionType, leadId: request.leadId, targetStage },
        });
      }
    }
  }
  return { approvalId, actionType: request.actionType, leadId: request.leadId, targetStage, executed: true };
}