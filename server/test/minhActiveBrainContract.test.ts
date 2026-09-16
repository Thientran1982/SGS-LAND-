import { describe, expect, it } from 'vitest';
import {
  createMinhActiveBrainDecision,
  isMinhActiveBrainDecision,
  reclassifyMinhActiveBrainAction,
  validateMinhActiveBrainDecision,
} from '../ai/minhActiveBrainContract';

const tenantId = 'tenant-a';

function validDecision() {
  return createMinhActiveBrainDecision({
    whyDetected: 'Lead có điểm cao nhưng không có tương tác trong 3 ngày.',
    evidence: [{
      id: 'evidence-1',
      source: 'detector:COLD_LEAD',
      tenantId,
      claim: 'Điểm lead 86 và snapshot tenant cho thấy 3 ngày không có tương tác.',
      observedAt: '2026-09-16T05:00:00.000Z',
      freshness: {
        status: 'FRESH',
        checkedAt: '2026-09-16T05:00:00.000Z',
        policy: 'tenant_detector_snapshot',
        reason: 'Đã đọc lại dữ liệu tenant trong lần quét hiện tại.',
        sourceObservedAt: '2026-09-13T05:00:00.000Z',
      },
      facts: { score: 86, inactiveDays: 3 },
    }],
    tenant: {
      tenantId,
      scopeVerifiedAt: '2026-09-16T05:00:00.000Z',
      scope: 'TENANT_SCOPED',
    },
    specialists: {
      run: [],
      skipped: [{
        name: 'specialist_followup_review',
        reason: 'Observe phase chỉ chạy detector Read-only.',
      }],
    },
    action: {
      mode: 'READ',
      type: 'OBSERVE_OPPORTUNITY',
      approvalRequired: false,
      approvalReason: 'Không có mutation hoặc provider call.',
    },
    retry: {
      idempotencyKey: 'proactive-opportunity:COLD_LEAD:lead:lead-1:2026-09-16',
      duplicateRecordBehavior: 'REPLAY_EXISTING_TENANT_SIGNAL',
      duplicateMessageBehavior: 'NO_PROVIDER_MESSAGE',
    },
    rollback: {
      target: 'DISABLE_PROACTIVE_ROLLOUT_AND_RESTORE_LAST_KNOWN_GOOD_POLICY',
      trigger: 'Detector regression',
      approvalRequired: true,
    },
  });
}

describe('Minh active brain decision contract', () => {
  it('requires explicit answers for evidence, freshness, tenant, specialists, action, retry, and rollback', () => {
    const decision = validDecision();

    expect(isMinhActiveBrainDecision(decision)).toBe(true);
    expect(decision.schemaVersion).toBe(1);
    expect(decision.tenant.tenantId).toBe(tenantId);
    expect(decision.evidence[0].freshness.status).toBe('FRESH');
    expect(decision.specialists.run).toEqual([]);
    expect(decision.specialists.skipped[0].reason).toContain('Read-only');
    expect(decision.action.mode).toBe('READ');
    expect(decision.action.approvalRequired).toBe(false);
    expect(decision.retry.idempotencyKey).toBeTruthy();
    expect(decision.rollback.target).toContain('LAST_KNOWN_GOOD');
  });

  it('fails closed when one of the ten answers is removed or evidence crosses tenant scope', () => {
    const decision = validDecision();
    const incomplete = {
      ...decision,
      whyDetected: '',
      retry: { ...decision.retry, idempotencyKey: '' },
      rollback: { ...decision.rollback, target: '' },
      evidence: [{ ...decision.evidence[0], tenantId: 'tenant-b' }],
    };

    const errors = validateMinhActiveBrainDecision(incomplete);
    expect(errors).toEqual(expect.arrayContaining([
      'whyDetected is required',
      'evidence[0] crosses the decision tenant scope',
      'retry.idempotencyKey is required',
      'rollback.target is required',
    ]));
    expect(isMinhActiveBrainDecision(incomplete)).toBe(false);
  });

  it('reclassifies a read observation as a broker-gated suggestion without losing evidence', () => {
    const decision = validDecision();
    const suggestion = reclassifyMinhActiveBrainAction(decision, {
      mode: 'SUGGEST',
      type: 'DRAFT_PROACTIVE_FOLLOWUP',
      approvalRequired: true,
      approvalReason: 'Broker must review before any follow-up.',
      idempotencyKey: 'approval:signal-1:DRAFT_PROACTIVE_FOLLOWUP',
      duplicateRecordBehavior: 'REPLAY_EXISTING_APPROVAL_REQUEST',
      duplicateMessageBehavior: 'NO_PROVIDER_MESSAGE_UNTIL_MANUAL_SEND',
    });

    expect(suggestion.evidence).toEqual(decision.evidence);
    expect(suggestion.action).toMatchObject({
      mode: 'SUGGEST',
      type: 'DRAFT_PROACTIVE_FOLLOWUP',
      approvalRequired: true,
    });
    expect(suggestion.retry.duplicateRecordBehavior).toBe('REPLAY_EXISTING_APPROVAL_REQUEST');
    expect(isMinhActiveBrainDecision(suggestion)).toBe(true);
  });
});
