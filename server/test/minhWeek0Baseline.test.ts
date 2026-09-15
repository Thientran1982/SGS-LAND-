import { describe, expect, it } from 'vitest';
import {
  canTransitionMinhRunState,
  createMinhOperationalError,
  eventFingerprint,
  gateAgentOutput,
  validateMinhTraceContext,
} from '../ai/agentOperatingContracts';
import { inspectAgentOutput } from '../ai/agentGuardrails';
import {
  AGENT_ORCHESTRATION_REGISTRY,
  getAgentCapabilityForIntent,
} from '../ai/agentOrchestrationRegistry';

describe('Minh Week 0 baseline contracts', () => {
  it('freezes lifecycle transitions and prevents terminal-state resurrection', () => {
    expect(canTransitionMinhRunState('RECEIVED', 'RUNNING')).toBe(true);
    expect(canTransitionMinhRunState('RUNNING', 'WAITING_APPROVAL')).toBe(true);
    expect(canTransitionMinhRunState('FAILED_RETRYABLE', 'RUNNING')).toBe(true);
    expect(canTransitionMinhRunState('SUCCEEDED', 'RUNNING')).toBe(false);
    expect(canTransitionMinhRunState('BLOCKED', 'SUCCEEDED')).toBe(false);
  });

  it('keeps machine-readable error codes and retry intent stable', () => {
    expect(createMinhOperationalError(
      'PROVIDER_OUTCOME_UNKNOWN',
      'Provider outcome must be reconciled before another send.',
      false,
    )).toEqual({
      code: 'PROVIDER_OUTCOME_UNKNOWN',
      message: 'Provider outcome must be reconciled before another send.',
      retryable: false,
    });
  });

  it('requires every trace link and supports the post-persistence outbound link', () => {
    const incomplete = validateMinhTraceContext({
      requestId: 'request-1',
      inboundInteractionId: 'inbound-1',
      durableRunId: 'run-1',
      traceId: 'trace-1',
      providerAttemptIds: ['provider-1'],
    });
    expect(incomplete.valid).toBe(false);
    expect(incomplete.missing).toContain('specialistCheckpointIds');

    const delivered = validateMinhTraceContext({
      requestId: 'request-1',
      inboundInteractionId: 'inbound-1',
      durableRunId: 'run-1',
      traceId: 'trace-1',
      specialistCheckpointIds: ['checkpoint-1'],
      providerAttemptIds: ['provider-1'],
      outboundInteractionId: 'outbound-1',
    }, { requireOutboundInteractionId: true });
    expect(delivered).toEqual({ valid: true, missing: [] });
  });

  it('keeps event fingerprints tenant-scoped and action gating evidence-first', () => {
    const base = { type: 'INBOUND_MESSAGE', idempotencyKey: 'same-event' };
    expect(eventFingerprint({ tenantId: 'tenant-a', ...base }))
      .not.toBe(eventFingerprint({ tenantId: 'tenant-b', ...base }));

    expect(gateAgentOutput('answer', 0.95, {
      evidence: [{ source: 'official-source', quote: 'verified' }],
    }).canAct).toBe(true);
    expect(gateAgentOutput('answer', 0.95).canAct).toBe(false);
    expect(inspectAgentOutput({
      content: 'Đã chuẩn bị xác nhận đặt cọc.',
      suggestedAction: 'CONFIRM_DEPOSIT',
      sources: [{ source: 'official-source' }],
    })).toMatchObject({
      approvalRequired: true,
      flags: ['HIGH_IMPACT_ACTION'],
    });
  });

  it('has one registry owner per intent and only the writer owns synthesis intents', () => {
    const skillKeys = AGENT_ORCHESTRATION_REGISTRY.map(item => item.skillKey);
    expect(new Set(skillKeys).size).toBe(skillKeys.length);

    for (const intent of ['DIRECT_ANSWER', 'CLARIFY']) {
      expect(getAgentCapabilityForIntent(intent)).toMatchObject({
        mode: 'writer',
        role: 'writer',
      });
    }
    for (const capability of AGENT_ORCHESTRATION_REGISTRY) {
      for (const intent of capability.intents) {
        expect(getAgentCapabilityForIntent(intent)?.skillKey).toBe(capability.skillKey);
      }
    }
  });
});