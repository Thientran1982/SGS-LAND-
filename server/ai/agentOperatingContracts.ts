import { createHash } from 'crypto';

export type AgentOutputEnvelope<T = unknown> = {
  content: T;
  confidence: number;
  evidence: Array<{ source: string; quote?: string }>;
  uncertainty?: string;
  canAct: boolean;
};

export type AgentEvent = {
  eventId: string;
  tenantId: string;
  type: string;
  occurredAt: string;
  actor: 'SYSTEM' | 'STAFF' | 'BUYER' | 'AGENT';
  payload: Record<string, unknown>;
  idempotencyKey: string;
};

export function clampConfidence(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export function gateAgentOutput<T>(
  content: T,
  confidence: unknown,
  options: { minimum?: number; evidence?: Array<{ source: string; quote?: string }>; uncertainty?: string } = {},
): AgentOutputEnvelope<T> {
  const score = clampConfidence(confidence);
  const minimum = options.minimum ?? 0.7;
  const evidence = options.evidence || [];
  const canAct = score >= minimum && evidence.length > 0;
  return {
    content,
    confidence: score,
    evidence,
    canAct,
    ...(canAct ? {} : { uncertainty: options.uncertainty || 'confidence_or_evidence_below_action_threshold' }),
  };
}

export function eventFingerprint(event: Pick<AgentEvent, 'tenantId' | 'type' | 'idempotencyKey'>): string {
  return createHash('sha256')
    .update(`${event.tenantId}:${event.type}:${event.idempotencyKey}`)
    .digest('hex');
}

export function shouldRetryAfterFailure(failures: number): 'RETRY' | 'REPLAN' | 'ESCALATE' {
  if (failures <= 0) return 'RETRY';
  if (failures === 1) return 'REPLAN';
  return 'ESCALATE';
}