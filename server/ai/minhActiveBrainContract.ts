/**
 * Contract for calling Minh an active brain.
 *
 * A proactive signal is not complete merely because it has a rationale and a
 * confidence score. Operators must be able to reconstruct the decision:
 * evidence, freshness, tenant scope, specialist choices, permission boundary,
 * retry behavior, and rollback target.
 */

export const MINH_ACTIVE_BRAIN_SCHEMA_VERSION = 1 as const;

export type MinhBrainActionMode = 'READ' | 'SUGGEST' | 'ACT';
export type MinhEvidenceFreshnessStatus = 'FRESH' | 'STALE' | 'UNKNOWN';

export type MinhActiveBrainEvidence = {
  id: string;
  source: string;
  tenantId: string;
  claim: string;
  observedAt: string;
  freshness: {
    status: MinhEvidenceFreshnessStatus;
    checkedAt: string;
    policy: string;
    reason: string;
    sourceObservedAt?: string | null;
  };
  facts?: Record<string, unknown>;
};

export type MinhSpecialistRun = {
  name: string;
  status: 'SUCCEEDED' | 'PARTIAL' | 'FAILED' | 'DEGRADED';
  runId?: string | null;
  evidenceIds?: string[];
};

export type MinhSpecialistSkipped = {
  name: string;
  reason: string;
};

export type MinhActiveBrainDecision = {
  schemaVersion: typeof MINH_ACTIVE_BRAIN_SCHEMA_VERSION;
  whyDetected: string;
  evidence: MinhActiveBrainEvidence[];
  tenant: {
    tenantId: string;
    scopeVerifiedAt: string;
    scope: 'TENANT_SCOPED';
  };
  specialists: {
    run: MinhSpecialistRun[];
    skipped: MinhSpecialistSkipped[];
  };
  action: {
    mode: MinhBrainActionMode;
    type: string;
    approvalRequired: boolean;
    approvalReason: string;
  };
  retry: {
    idempotencyKey: string;
    duplicateRecordBehavior: string;
    duplicateMessageBehavior: string;
  };
  rollback: {
    target: string;
    trigger: string;
    approvalRequired: boolean;
  };
};

export type MinhActiveBrainDecisionInput = Omit<MinhActiveBrainDecision, 'schemaVersion'> & {
  schemaVersion?: typeof MINH_ACTIVE_BRAIN_SCHEMA_VERSION;
};

function nonEmpty(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Returns every missing or inconsistent answer rather than silently
 * downgrading an incomplete decision to an "active brain" result.
 */
export function validateMinhActiveBrainDecision(value: unknown): string[] {
  const errors: string[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return ['decision must be an object'];
  }

  const decision = value as Partial<MinhActiveBrainDecision>;
  if (decision.schemaVersion !== MINH_ACTIVE_BRAIN_SCHEMA_VERSION) {
    errors.push('schemaVersion must be the current active-brain schema');
  }
  if (!nonEmpty(decision.whyDetected)) errors.push('whyDetected is required');

  if (!Array.isArray(decision.evidence) || decision.evidence.length === 0) {
    errors.push('at least one evidence item is required');
  } else {
    const tenantId = decision.tenant?.tenantId;
    decision.evidence.forEach((item, index) => {
      if (!item || typeof item !== 'object') {
        errors.push(`evidence[${index}] must be an object`);
        return;
      }
      const evidence = item as Partial<MinhActiveBrainEvidence>;
      if (!nonEmpty(evidence.id)) errors.push(`evidence[${index}].id is required`);
      if (!nonEmpty(evidence.source)) errors.push(`evidence[${index}].source is required`);
      if (!nonEmpty(evidence.claim)) errors.push(`evidence[${index}].claim is required`);
      if (!nonEmpty(evidence.observedAt)) errors.push(`evidence[${index}].observedAt is required`);
      if (!nonEmpty(evidence.tenantId)) errors.push(`evidence[${index}].tenantId is required`);
      if (tenantId && evidence.tenantId !== tenantId) {
        errors.push(`evidence[${index}] crosses the decision tenant scope`);
      }
      const freshness = evidence.freshness;
      if (!freshness || typeof freshness !== 'object') {
        errors.push(`evidence[${index}].freshness is required`);
      } else {
        if (!['FRESH', 'STALE', 'UNKNOWN'].includes(String(freshness.status))) {
          errors.push(`evidence[${index}].freshness.status is invalid`);
        }
        if (!nonEmpty(freshness.checkedAt)) errors.push(`evidence[${index}].freshness.checkedAt is required`);
        if (!nonEmpty(freshness.policy)) errors.push(`evidence[${index}].freshness.policy is required`);
        if (!nonEmpty(freshness.reason)) errors.push(`evidence[${index}].freshness.reason is required`);
      }
    });
  }

  const tenant = decision.tenant;
  if (!tenant || typeof tenant !== 'object') {
    errors.push('tenant scope is required');
  } else {
    if (!nonEmpty(tenant.tenantId)) errors.push('tenant.tenantId is required');
    if (!nonEmpty(tenant.scopeVerifiedAt)) errors.push('tenant.scopeVerifiedAt is required');
    if (tenant.scope !== 'TENANT_SCOPED') errors.push('tenant.scope must be TENANT_SCOPED');
  }

  const specialists = decision.specialists;
  if (!specialists || typeof specialists !== 'object') {
    errors.push('specialist run/skip records are required');
  } else {
    if (!Array.isArray(specialists.run)) errors.push('specialists.run must be an array');
    if (!Array.isArray(specialists.skipped)) errors.push('specialists.skipped must be an array');
    specialists.run?.forEach((item, index) => {
      if (!nonEmpty(item?.name)) errors.push(`specialists.run[${index}].name is required`);
      if (!['SUCCEEDED', 'PARTIAL', 'FAILED', 'DEGRADED'].includes(String(item?.status))) {
        errors.push(`specialists.run[${index}].status is invalid`);
      }
    });
    specialists.skipped?.forEach((item, index) => {
      if (!nonEmpty(item?.name)) errors.push(`specialists.skipped[${index}].name is required`);
      if (!nonEmpty(item?.reason)) errors.push(`specialists.skipped[${index}].reason is required`);
    });
  }

  const action = decision.action;
  if (!action || typeof action !== 'object') {
    errors.push('action classification is required');
  } else {
    if (!['READ', 'SUGGEST', 'ACT'].includes(String(action.mode))) {
      errors.push('action.mode must be READ, SUGGEST, or ACT');
    }
    if (!nonEmpty(action.type)) errors.push('action.type is required');
    if (typeof action.approvalRequired !== 'boolean') errors.push('action.approvalRequired is required');
    if (!nonEmpty(action.approvalReason)) errors.push('action.approvalReason is required');
  }

  const retry = decision.retry;
  if (!retry || typeof retry !== 'object') {
    errors.push('retry safety policy is required');
  } else {
    if (!nonEmpty(retry.idempotencyKey)) errors.push('retry.idempotencyKey is required');
    if (!nonEmpty(retry.duplicateRecordBehavior)) errors.push('retry.duplicateRecordBehavior is required');
    if (!nonEmpty(retry.duplicateMessageBehavior)) errors.push('retry.duplicateMessageBehavior is required');
  }

  const rollback = decision.rollback;
  if (!rollback || typeof rollback !== 'object') {
    errors.push('rollback plan is required');
  } else {
    if (!nonEmpty(rollback.target)) errors.push('rollback.target is required');
    if (!nonEmpty(rollback.trigger)) errors.push('rollback.trigger is required');
    if (typeof rollback.approvalRequired !== 'boolean') errors.push('rollback.approvalRequired is required');
  }

  return errors;
}

export function createMinhActiveBrainDecision(
  input: MinhActiveBrainDecisionInput,
): MinhActiveBrainDecision {
  const decision: MinhActiveBrainDecision = {
    ...input,
    schemaVersion: MINH_ACTIVE_BRAIN_SCHEMA_VERSION,
  };
  const errors = validateMinhActiveBrainDecision(decision);
  if (errors.length > 0) {
    throw new Error(`MINH_ACTIVE_BRAIN_CONTRACT_INVALID:${errors.join('|')}`);
  }
  return decision;
}

export function isMinhActiveBrainDecision(value: unknown): value is MinhActiveBrainDecision {
  return validateMinhActiveBrainDecision(value).length === 0;
}

export function reclassifyMinhActiveBrainAction(
  decision: MinhActiveBrainDecision,
  input: {
    mode: MinhBrainActionMode;
    type: string;
    approvalRequired: boolean;
    approvalReason: string;
    idempotencyKey: string;
    duplicateRecordBehavior: string;
    duplicateMessageBehavior: string;
  },
): MinhActiveBrainDecision {
  return createMinhActiveBrainDecision({
    ...decision,
    action: {
      mode: input.mode,
      type: input.type,
      approvalRequired: input.approvalRequired,
      approvalReason: input.approvalReason,
    },
    retry: {
      idempotencyKey: input.idempotencyKey,
      duplicateRecordBehavior: input.duplicateRecordBehavior,
      duplicateMessageBehavior: input.duplicateMessageBehavior,
    },
  });
}
