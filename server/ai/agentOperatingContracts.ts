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

/**
 * Week 0 contract: these are the only lifecycle states that a Minh run may
 * expose to operators and telemetry.  Runtime adapters may use their own
 * provider states internally, but they must map back to this vocabulary.
 */
export const MINH_RUN_STATES = [
  'RECEIVED',
  'RUNNING',
  'WAITING_PROVIDER',
  'WAITING_APPROVAL',
  'SUCCEEDED',
  'FAILED_RETRYABLE',
  'FAILED_FINAL',
  'BLOCKED',
  'ESCALATED',
] as const;

export type MinhRunState = typeof MINH_RUN_STATES[number];

const MINH_RUN_TRANSITIONS: Record<MinhRunState, readonly MinhRunState[]> = {
  RECEIVED: ['RUNNING', 'WAITING_PROVIDER', 'BLOCKED', 'FAILED_RETRYABLE'],
  RUNNING: [
    'WAITING_PROVIDER',
    'WAITING_APPROVAL',
    'SUCCEEDED',
    'FAILED_RETRYABLE',
    'FAILED_FINAL',
    'BLOCKED',
    'ESCALATED',
  ],
  WAITING_PROVIDER: ['RUNNING', 'FAILED_RETRYABLE', 'FAILED_FINAL', 'ESCALATED'],
  WAITING_APPROVAL: ['RUNNING', 'SUCCEEDED', 'FAILED_FINAL', 'ESCALATED'],
  FAILED_RETRYABLE: ['RUNNING', 'FAILED_FINAL', 'ESCALATED'],
  ESCALATED: ['RUNNING', 'WAITING_APPROVAL', 'SUCCEEDED', 'FAILED_FINAL'],
  SUCCEEDED: [],
  FAILED_FINAL: [],
  BLOCKED: [],
};

export function canTransitionMinhRunState(
  from: MinhRunState,
  to: MinhRunState,
): boolean {
  return MINH_RUN_TRANSITIONS[from].includes(to);
}

export type MinhErrorCode =
  | 'AGENT_TIMEOUT'
  | 'PROVIDER_UNAVAILABLE'
  | 'PROVIDER_OUTCOME_UNKNOWN'
  | 'TENANT_SCOPE_VIOLATION'
  | 'APPROVAL_REQUIRED'
  | 'DUPLICATE_INBOUND'
  | 'DB_COMMIT_RESTART';

export type MinhOperationalError = {
  code: MinhErrorCode;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown>;
};

export function createMinhOperationalError(
  code: MinhErrorCode,
  message: string,
  retryable: boolean,
  details?: Record<string, unknown>,
): MinhOperationalError {
  return { code, message, retryable, ...(details ? { details } : {}) };
}

export type MinhTraceContext = {
  requestId: string;
  inboundInteractionId: string;
  durableRunId: string;
  traceId: string;
  specialistCheckpointIds: string[];
  providerAttemptIds: string[];
  outboundInteractionId?: string;
};

/**
 * Outbound persistence happens after the durable run, so the outbound ID is
 * optional while a run is in progress and required for a delivered response.
 */
export function validateMinhTraceContext(
  context: Partial<MinhTraceContext>,
  options: { requireOutboundInteractionId?: boolean } = {},
): { valid: boolean; missing: string[] } {
  const required = [
    'requestId',
    'inboundInteractionId',
    'durableRunId',
    'traceId',
    'specialistCheckpointIds',
    'providerAttemptIds',
  ] as const;
  const missing: string[] = required.filter(key => {
    const value = context[key];
    return Array.isArray(value)
      ? false
      : typeof value !== 'string' || value.trim().length === 0;
  });
  if (
    options.requireOutboundInteractionId
    && (typeof context.outboundInteractionId !== 'string'
      || context.outboundInteractionId.trim().length === 0)
  ) {
    missing.push('outboundInteractionId');
  }
  return { valid: missing.length === 0, missing };
}

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