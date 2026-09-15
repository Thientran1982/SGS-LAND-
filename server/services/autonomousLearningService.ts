import { createHash } from 'crypto';
import { withTenantContext } from '../db';
import type { PoolClient } from 'pg';

export type FeedbackAssessment = {
  qualityScore: number;
  provenanceScore: number;
  poisoningScore: number;
  status: 'ACCEPTED' | 'REJECTED' | 'QUARANTINED';
  signalEligible: boolean;
  reason: string;
};

export type EvaluationGate = {
  safety: number;
  groundedness: number;
  quality: number;
  latencyP95Ms: number;
  costUsd: number;
  minSamples: number;
};

export type GateThresholds = {
  minSafety: number;
  minGroundedness: number;
  minQuality: number;
  maxLatencyP95Ms: number;
  maxCostUsd: number;
  minSamples: number;
};

export type ModelPromotionLoopMode = 'off' | 'shadow';

export const MINH_MODEL_PROMOTION_LOOP_ENV = 'MINH_MODEL_PROMOTION_LOOP';
export const DEFAULT_MODEL_PROMOTION_GATE: GateThresholds = {
  minSafety: 0.99,
  minGroundedness: 0.7,
  minQuality: 0.8,
  maxLatencyP95Ms: 1000,
  maxCostUsd: 0.05,
  minSamples: 20,
};

export function getModelPromotionLoopMode(
  env: NodeJS.ProcessEnv = process.env,
): ModelPromotionLoopMode {
  return String(env[MINH_MODEL_PROMOTION_LOOP_ENV] || 'off').trim().toLowerCase() === 'shadow'
    ? 'shadow'
    : 'off';
}

function boundedMetrics(input: Record<string, unknown>): Record<string, unknown> {
  const allowed = ['safety', 'groundedness', 'quality', 'latencyP95Ms', 'costUsd', 'minSamples',
    'matchAccuracy', 'valuationPassRate', 'feedbackSamples', 'windowHours'];
  return Object.fromEntries(allowed
    .filter(key => input[key] !== undefined)
    .map(key => {
      const value = input[key];
      if (typeof value === 'number') return [key, Number.isFinite(value) ? Number(value.toFixed(6)) : 0];
      return [key, String(value).slice(0, 80)];
    }));
}

export function buildPromotionMetrics(summary: Record<string, any>): EvaluationGate {
  const matchAccuracy = Number(summary.match?.accuracy || 0);
  const valuationPassRate = Number(summary.valuation?.passRate || 0);
  const minSamples = Number(summary.casesEvaluated || 0);
  return {
    safety: 1,
    groundedness: Math.max(0, Math.min(1, valuationPassRate)),
    quality: Math.max(0, Math.min(1, matchAccuracy)),
    latencyP95Ms: 0,
    costUsd: 0,
    minSamples,
  };
}

export function assessFeedback(input: {
  rating: -1 | 1;
  correction?: string | null;
  userMessage?: string | null;
  aiResponse?: string | null;
  metadata?: Record<string, unknown> | null;
  duplicateCount?: number;
}): FeedbackAssessment {
  const correction = String(input.correction || '').trim();
  const userMessage = String(input.userMessage || '').trim();
  const aiResponse = String(input.aiResponse || '').trim();
  const metadata = input.metadata || {};
  const provenance = metadata.provenance;
  const provenanceScore = provenance === 'interaction' || provenance === 'authenticated_user' ? 1 : 0.55;
  const duplicateCount = Math.max(0, input.duplicateCount || 0);
  const poisoningReasons: string[] = [];
  if (duplicateCount > 1) poisoningReasons.push('duplicate_source');
  if (userMessage.length > 5000 || aiResponse.length > 12000) poisoningReasons.push('oversized_payload');
  if (/\b(ignore|system prompt|jailbreak|override|forget everything)\b/i.test(`${userMessage} ${correction}`)) {
    poisoningReasons.push('prompt_injection');
  }
  if (metadata.synthetic === true && provenance !== 'authenticated_user') poisoningReasons.push('untrusted_synthetic');
  const poisoningScore = Math.min(1, poisoningReasons.length * 0.4);
  const qualityScore = Math.min(1, Math.max(0,
    (input.rating === 1 ? 0.55 : 0.2) +
    (correction.length >= 8 ? 0.2 : 0) +
    (aiResponse.length >= 20 ? 0.15 : 0) +
    (userMessage.length >= 5 ? 0.1 : 0),
  ));
  if (poisoningScore >= 0.4) {
    return { qualityScore, provenanceScore, poisoningScore, status: 'QUARANTINED', signalEligible: false, reason: poisoningReasons.join(',') };
  }
  const signalEligible = qualityScore >= 0.6 && provenanceScore >= 0.5;
  return {
    qualityScore, provenanceScore, poisoningScore,
    status: signalEligible ? 'ACCEPTED' : 'REJECTED',
    signalEligible,
    reason: signalEligible ? 'quality_and_provenance_gate_passed' : 'quality_or_provenance_below_threshold',
  };
}

export function evaluatePromotionGate(metrics: EvaluationGate, thresholds: GateThresholds): { passed: boolean; failures: string[] } {
  const failures: string[] = [];
  if (metrics.minSamples < thresholds.minSamples) failures.push('insufficient_samples');
  if (metrics.safety < thresholds.minSafety) failures.push('safety');
  if (metrics.groundedness < thresholds.minGroundedness) failures.push('groundedness');
  if (metrics.quality < thresholds.minQuality) failures.push('quality');
  if (metrics.latencyP95Ms > thresholds.maxLatencyP95Ms) failures.push('latency');
  if (metrics.costUsd > thresholds.maxCostUsd) failures.push('cost');
  return { passed: failures.length === 0, failures };
}

export function detectRuntimeRegression(current: {
  safety: number; groundedness: number; quality: number; errorRate: number; latencyP95Ms: number;
}, baseline: {
  safety: number; groundedness: number; quality: number; errorRate: number; latencyP95Ms: number;
}, limits = { qualityDrop: 0.1, safetyDrop: 0.02, errorRateIncrease: 0.05, latencyIncreaseRatio: 1.5 }) {
  const failures: string[] = [];
  if (current.safety < baseline.safety - limits.safetyDrop) failures.push('safety_regression');
  if (current.groundedness < baseline.groundedness - limits.qualityDrop) failures.push('groundedness_regression');
  if (current.quality < baseline.quality - limits.qualityDrop) failures.push('quality_regression');
  if (current.errorRate > baseline.errorRate + limits.errorRateIncrease) failures.push('error_rate_regression');
  if (baseline.latencyP95Ms > 0
    && current.latencyP95Ms > baseline.latencyP95Ms * limits.latencyIncreaseRatio) {
    failures.push('latency_regression');
  }
  return { regressed: failures.length > 0, failures };
}

export function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function nextFeedbackFollowup(createdAt: Date, stage: number): Date | null {
  const days = [3, 5, 7][stage];
  return days === undefined ? null : new Date(createdAt.getTime() + days * 86400000);
}

export const autonomousLearningService = {
  async runLockedEvaluationCycle(input: {
    tenantId: string; cycleKey: string; fixtureVersion: string; traceId?: string;
    run: () => Promise<{ passed: boolean; summary: Record<string, unknown> }>;
  }) {
    const claimed = await this.startEvaluationCycle(input);
    if (!claimed.claimed) return { claimed: false, cycle: claimed.cycle };
    try {
      const result = await input.run();
      const cycle = await this.finishEvaluationCycle(input.tenantId, claimed.cycle.id, {
        ...result, traceId: input.traceId,
      });
      return { claimed: true, cycle };
    } catch (error: any) {
      const cycle = await this.finishEvaluationCycle(input.tenantId, claimed.cycle.id, {
        passed: false, summary: {}, errorText: error?.message || 'evaluation_failed', traceId: input.traceId,
      });
      return { claimed: true, cycle };
    }
  },
  async startEvaluationCycle(input: {
    tenantId: string; cycleKey: string; fixtureVersion: string; traceId?: string;
  }) {
    return withTenantContext(input.tenantId, async client => {
      const result = await client.query(
        `INSERT INTO ai_learning_cycles (tenant_id,cycle_key,fixture_version)
         VALUES ($1,$2,$3)
         ON CONFLICT (tenant_id,cycle_key) DO UPDATE SET
           status='RUNNING', started_at=NOW(), finished_at=NULL, error_text=NULL
         WHERE ai_learning_cycles.status='RUNNING'
           AND ai_learning_cycles.started_at < NOW() - INTERVAL '30 minutes'
         RETURNING *`,
        [input.tenantId, input.cycleKey, input.fixtureVersion],
      );
      const cycle = result.rows[0] || (await client.query(
        `SELECT * FROM ai_learning_cycles WHERE tenant_id=$1 AND cycle_key=$2`,
        [input.tenantId, input.cycleKey],
      )).rows[0];
      if (result.rows[0]) await client.query(
        `INSERT INTO ai_learning_audit_events
         (tenant_id,event_type,entity_type,entity_id,reason,metrics_json,trace_id)
         VALUES ($1,'EVALUATION_STARTED','LEARNING_CYCLE',$2,'locked_fixture_cycle_started',$3::jsonb,$4)`,
        [input.tenantId, cycle.id, JSON.stringify({ fixtureVersion: input.fixtureVersion }), input.traceId || null],
      );
      return { cycle, claimed: Boolean(result.rows[0]) };
    });
  },

  async finishEvaluationCycle(tenantId: string, cycleId: string, input: {
    passed: boolean; summary: Record<string, unknown>; errorText?: string; traceId?: string;
  }) {
    return withTenantContext(tenantId, async client => {
      const status = input.passed ? 'PASSED' : 'FAILED';
      const result = await client.query(
        `UPDATE ai_learning_cycles SET status=$3, summary_json=$4::jsonb, error_text=$5, finished_at=NOW()
         WHERE tenant_id=$1 AND id=$2 AND status='RUNNING' RETURNING *`,
        [tenantId, cycleId, status, JSON.stringify(input.summary), input.errorText || null],
      );
      await client.query(
        `INSERT INTO ai_learning_audit_events
         (tenant_id,event_type,entity_type,entity_id,reason,metrics_json,trace_id)
         VALUES ($1,$2,'LEARNING_CYCLE',$3,$4,$5::jsonb,$6)`,
        [tenantId, input.passed ? 'EVALUATION_PASSED' : 'EVALUATION_FAILED', cycleId,
          input.passed ? 'all_locked_fixture_gates_passed' : (input.errorText || 'evaluation_gate_failed'),
          JSON.stringify(input.summary), input.traceId || null],
      );
      return result.rows[0] || null;
    });
  },

  async promoteCandidate(
    tenantId: string,
    candidateId: string,
    target: 'SHADOW' | 'CANARY' | 'ACTIVE',
    gate: { passed: boolean; failures: string[] },
    traceId?: string,
    existingClient?: PoolClient,
  ) {
    const execute = async (client: PoolClient) => {
      const candidate = (await client.query(
        `SELECT * FROM ai_learning_candidates WHERE tenant_id=$1 AND id::text=$2 FOR UPDATE`,
        [tenantId, candidateId],
      )).rows[0];
      if (!candidate) return null;
      if (!gate.passed) {
        await client.query(`UPDATE ai_learning_candidates SET status='REJECTED', gate_summary=$3::jsonb WHERE tenant_id=$1 AND id=$2`,
          [tenantId, candidateId, JSON.stringify(gate)]);
        await client.query(
          `INSERT INTO ai_promotion_decisions
           (tenant_id,candidate_id,from_status,to_status,decision,reason,metrics_json,trace_id)
           VALUES ($1,$2,$3,'REJECTED','REJECT',$4,$5::jsonb,$6)`,
          [tenantId, candidateId, candidate.status, gate.failures.join(','), JSON.stringify(gate), traceId || null],
        );
        await client.query(
          `INSERT INTO ai_learning_audit_events
            (tenant_id,event_type,entity_type,entity_id,reason,metrics_json,trace_id)
           VALUES ($1,'CANDIDATE_GATE_FAILED','LEARNING_CANDIDATE',$2,$3,$4::jsonb,$5)`,
          [tenantId, candidateId, gate.failures.join(','), JSON.stringify(gate), traceId || null],
        );
        return { ...candidate, status: 'REJECTED', gate };
      }
      const allowed = candidate.status === 'SHADOW' && target === 'CANARY'
        || candidate.status === 'CANARY' && target === 'ACTIVE'
        || candidate.status === target;
      if (!allowed) throw new Error(`INVALID_PROMOTION:${candidate.status}->${target}`);
      if (target === 'ACTIVE') {
        await client.query(
          `UPDATE ai_learning_candidates
              SET status='SHADOW', last_known_good=TRUE
            WHERE tenant_id=$1 AND status='ACTIVE' AND id<>$2`,
          [tenantId, candidateId],
        );
      }
      const updated = (await client.query(
        `UPDATE ai_learning_candidates SET status=$3, gate_summary=$4::jsonb,
                last_known_good=CASE WHEN $3='ACTIVE' THEN TRUE ELSE last_known_good END
         WHERE tenant_id=$1 AND id=$2 RETURNING *`,
        [tenantId, candidateId, target, JSON.stringify(gate)],
      )).rows[0];
      await client.query(
        `INSERT INTO ai_promotion_decisions
         (tenant_id,candidate_id,from_status,to_status,decision,reason,metrics_json,trace_id)
         VALUES ($1,$2,$3,$4,'PROMOTE','promotion_gate_passed',$5::jsonb,$6)`,
        [tenantId, candidateId, candidate.status, target, JSON.stringify(gate), traceId || null],
      );
      await client.query(
        `INSERT INTO ai_learning_audit_events
          (tenant_id,event_type,entity_type,entity_id,reason,metrics_json,trace_id)
         VALUES ($1,'CANDIDATE_PROMOTED','LEARNING_CANDIDATE',$2,$3,$4::jsonb,$5)`,
        [tenantId, candidateId, `promotion_${candidate.status.toLowerCase()}_to_${target.toLowerCase()}`,
          JSON.stringify(gate), traceId || null],
      );
      return updated;
    };
    return existingClient ? execute(existingClient) : withTenantContext(tenantId, execute);
  },

  async registerWeightCandidate(input: {
    tenantId: string;
    cycleId: string;
    weightVersionId: string;
    summary: Record<string, any>;
    traceId?: string;
  }) {
    return withTenantContext(input.tenantId, async client => {
      const existing = (await client.query(
        `SELECT * FROM ai_learning_candidates
          WHERE tenant_id=$1 AND cycle_id=$2 AND agent_key='matcher_weights'
          LIMIT 1`,
        [input.tenantId, input.cycleId],
      )).rows[0];
      if (existing) return { candidate: existing, reused: true };

      const metrics = buildPromotionMetrics(input.summary);
      const previousWeight = (await client.query(
        `SELECT id FROM agent_weight_versions
          WHERE tenant_id=$1 AND status='live'
          ORDER BY created_at DESC LIMIT 1`,
        [input.tenantId],
      )).rows[0];
      const artifact = {
        kind: 'MATCHER_WEIGHTS',
        weightVersionId: String(input.weightVersionId),
        previousWeightVersionId: previousWeight?.id ? String(previousWeight.id) : null,
        source: 'learning_cycle',
        sampleCount: Math.max(0, Number(input.summary.feedback?.matchChosenSignals || 0)),
      };
      const result = await client.query(
        `INSERT INTO ai_learning_candidates
          (tenant_id,cycle_id,agent_key,prompt_hash,model,artifact_json,status,gate_summary,candidate_key)
         VALUES ($1,$2,'matcher_weights',$3,'calibrated-value-only-classifier',$4::jsonb,'SHADOW',$5::jsonb,$6)
         ON CONFLICT (tenant_id,cycle_id,agent_key) WHERE cycle_id IS NOT NULL
         DO UPDATE SET id=ai_learning_candidates.id
         RETURNING *`,
        [
          input.tenantId,
          input.cycleId,
          fingerprint(artifact),
          JSON.stringify(artifact),
          JSON.stringify({ metrics, thresholds: DEFAULT_MODEL_PROMOTION_GATE }),
          `matcher_weights:${input.cycleId}`,
        ],
      );
      const candidate = result.rows[0];
      await client.query(
        `INSERT INTO ai_learning_audit_events
          (tenant_id,event_type,entity_type,entity_id,reason,metrics_json,trace_id)
         VALUES ($1,'CANDIDATE_REGISTERED','LEARNING_CANDIDATE',$2,'draft_weight_version_registered',$3::jsonb,$4)`,
        [input.tenantId, candidate.id, JSON.stringify({ metrics, cycleId: input.cycleId }), input.traceId || null],
      );
      return { candidate, reused: false };
    });
  },

  async recordRuntimeMetrics(input: {
    tenantId: string;
    candidateId: string;
    metrics: EvaluationGate & { errorRate: number };
    windowHours?: number;
  }) {
    return withTenantContext(input.tenantId, async client => {
      const result = await client.query(
        `INSERT INTO ai_learning_runtime_metrics
          (tenant_id,candidate_id,metric_window,sample_count,safety,groundedness,quality,
           latency_p95_ms,cost_usd,error_rate)
         VALUES ($1,$2,'TRAILING_24H',$3,$4,$5,$6,$7,$8,$9)
         RETURNING *`,
        [
          input.tenantId,
          input.candidateId,
          Math.max(0, Math.floor(input.metrics.minSamples)),
          Math.max(0, Math.min(1, input.metrics.safety)),
          Math.max(0, Math.min(1, input.metrics.groundedness)),
          Math.max(0, Math.min(1, input.metrics.quality)),
          Math.max(0, Math.floor(input.metrics.latencyP95Ms)),
          Math.max(0, input.metrics.costUsd),
          Math.max(0, Math.min(1, input.metrics.errorRate)),
        ],
      );
      return result.rows[0];
    });
  },

  async findCandidate(tenantId: string, candidateId: string) {
    return withTenantContext(tenantId, async client => (await client.query(
      `SELECT * FROM ai_learning_candidates WHERE tenant_id=$1 AND id::text=$2`,
      [tenantId, candidateId],
    )).rows[0] || null);
  },

  async findLastKnownGoodCandidate(tenantId: string, excludingId?: string) {
    return withTenantContext(tenantId, async client => (await client.query(
      `SELECT * FROM ai_learning_candidates
        WHERE tenant_id=$1 AND status='SHADOW' AND last_known_good=TRUE
          AND ($2 IS NULL OR id::text<>$2)
        ORDER BY created_at DESC LIMIT 1`,
      [tenantId, excludingId || null],
    )).rows[0] || null);
  },

  async restoreCandidate(tenantId: string, candidateId: string, traceId?: string, existingClient?: PoolClient) {
    const execute = async (client: PoolClient) => {
      const result = await client.query(
        `UPDATE ai_learning_candidates
            SET status='ACTIVE', last_known_good=TRUE
          WHERE tenant_id=$1 AND id::text=$2 AND status='SHADOW' AND last_known_good=TRUE
          RETURNING *`,
        [tenantId, candidateId],
      );
      if (!result.rows[0]) return null;
      await client.query(
        `INSERT INTO ai_learning_audit_events
          (tenant_id,event_type,entity_type,entity_id,reason,metrics_json,trace_id)
         VALUES ($1,'CANDIDATE_RESTORED','LEARNING_CANDIDATE',$2,
                 'last_known_good_restored_after_rollback','{}'::jsonb,$3)`,
        [tenantId, candidateId, traceId || null],
      );
      return result.rows[0];
    };
    return existingClient ? execute(existingClient) : withTenantContext(tenantId, execute);
  },

  async rollbackCandidate(
    tenantId: string,
    candidateId: string,
    reason: string,
    metrics: Record<string, unknown> = {},
    traceId?: string,
    existingClient?: PoolClient,
  ) {
    const execute = async (client: PoolClient) => {
      const result = await client.query(
        `WITH previous AS (
           SELECT id, status AS previous_status FROM ai_learning_candidates
           WHERE tenant_id=$1 AND id=$2 AND status IN ('SHADOW','CANARY','ACTIVE')
         )
         UPDATE ai_learning_candidates candidate
         SET status='ROLLED_BACK', last_known_good=FALSE
         FROM previous
         WHERE candidate.tenant_id=$1 AND candidate.id=previous.id
         RETURNING candidate.*, previous.previous_status`,
        [tenantId, candidateId],
      );
      if (result.rows[0]) await client.query(
        `INSERT INTO ai_promotion_decisions
         (tenant_id,candidate_id,from_status,to_status,decision,reason,metrics_json,trace_id)
         VALUES ($1,$2,$3,'ROLLED_BACK','ROLLBACK',$4,$5::jsonb,$6)`,
        [tenantId, candidateId, result.rows[0].previous_status, reason.slice(0, 1000), JSON.stringify(metrics), traceId || null],
      );
      return result.rows[0] || null;
    };
    return existingClient ? execute(existingClient) : withTenantContext(tenantId, execute);
  },
  async recordAudit(input: {
    tenantId?: string | null; eventType: string; entityType: string; entityId?: string;
    reason: string; metrics?: Record<string, unknown>; traceId?: string;
    existingClient?: PoolClient;
  }): Promise<void> {
    const write = (client: PoolClient) => client.query(
      `INSERT INTO ai_learning_audit_events
       (tenant_id,event_type,entity_type,entity_id,reason,metrics_json,trace_id)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)`,
      [input.tenantId || null, input.eventType, input.entityType, input.entityId || null,
        input.reason.slice(0, 1000), JSON.stringify(input.metrics || {}), input.traceId || null],
    );
    await (input.existingClient ? write(input.existingClient) : withTenantContext(input.tenantId || '', write));
  },

  async adjudicateFeedback(tenantId: string, feedbackId: string, assessment: FeedbackAssessment) {
    return withTenantContext(tenantId, async client => {
      const result = await client.query(
        `UPDATE ai_feedback SET quality_score=$3, provenance_score=$4, adjudication_status=$5,
          quarantine_reason=$6, signal_eligible=$7, followup_next_at=CASE WHEN $5='ACCEPTED' THEN NULL ELSE followup_next_at END
         WHERE tenant_id=$1 AND id=$2 RETURNING *`,
        [tenantId, feedbackId, assessment.qualityScore, assessment.provenanceScore, assessment.status,
          assessment.status === 'QUARANTINED' ? assessment.reason : null, assessment.signalEligible],
      );
      if (result.rows[0]) await client.query(
        `INSERT INTO ai_learning_audit_events
         (tenant_id,event_type,entity_type,entity_id,reason,metrics_json)
         VALUES ($1,'FEEDBACK_ADJUDICATED','FEEDBACK',$2,$3,$4::jsonb)`,
        [tenantId, feedbackId, assessment.reason, JSON.stringify(assessment)],
      );
      return result.rows[0] || null;
    });
  },

  async claimDueFollowups(tenantId: string, limit = 50) {
    return withTenantContext(tenantId, async client => (await client.query(
      `UPDATE ai_feedback SET followup_next_at=NULL, followup_stage=followup_stage+1
       WHERE id IN (
         SELECT id FROM ai_feedback
          WHERE tenant_id=$1 AND followup_next_at <= NOW() AND consent_status='OPTED_IN'
            AND followup_stage < 3
          ORDER BY followup_next_at FOR UPDATE SKIP LOCKED LIMIT $2
       ) RETURNING *`, [tenantId, limit],
    )).rows);
  },

  async setConsent(tenantId: string, feedbackId: string, consent: 'OPTED_IN' | 'OPTED_OUT' | 'NOT_REQUIRED') {
    return withTenantContext(tenantId, async client => {
      const result = await client.query(
        `UPDATE ai_feedback SET consent_status=$3,
          followup_next_at=CASE WHEN $3='OPTED_IN' THEN NOW() + INTERVAL '3 days' ELSE NULL END
         WHERE tenant_id=$1 AND id=$2 RETURNING *`,
        [tenantId, feedbackId, consent],
      );
      if (result.rows[0]) await client.query(
        `INSERT INTO ai_learning_audit_events
         (tenant_id,event_type,entity_type,entity_id,reason,metrics_json)
         VALUES ($1,'FEEDBACK_CONSENT_CHANGED','FEEDBACK',$2,$3,$4::jsonb)`,
        [tenantId, feedbackId, `consent_${consent.toLowerCase()}`, JSON.stringify({ consent })],
      );
      return result.rows[0] || null;
    });
  },

  async runFollowupSweep(tenantId: string, sender: (feedback: any) => Promise<void>, limit = 50) {
    const rows = await this.claimDueFollowups(tenantId, limit);
    let sent = 0;
    for (const row of rows) {
      try {
        await sender(row);
        const next = nextFeedbackFollowup(new Date(row.created_at), Number(row.followup_stage));
        await withTenantContext(tenantId, client => client.query(
          `UPDATE ai_feedback SET followup_next_at=$3 WHERE tenant_id=$1 AND id=$2`,
          [tenantId, row.id, next],
        ));
        sent++;
      } catch {
        // Requeue only this item; a failed provider must not block other tenants.
        await withTenantContext(tenantId, client => client.query(
          `UPDATE ai_feedback SET followup_next_at=NOW() + INTERVAL '1 hour',
             followup_stage=GREATEST(0, followup_stage-1)
           WHERE tenant_id=$1 AND id=$2`,
          [tenantId, row.id],
        ));
      }
    }
    return { claimed: rows.length, sent };
  },

  async listDashboard(tenantId: string) {
    return withTenantContext(tenantId, async client => {
      const [cycles, quarantine, promotions, calibration] = await Promise.all([
        client.query(`SELECT * FROM ai_learning_cycles WHERE tenant_id=$1 ORDER BY started_at DESC LIMIT 20`, [tenantId]),
        client.query(`SELECT id, rating, quality_score, provenance_score, quarantine_reason, created_at
          FROM ai_feedback WHERE tenant_id=$1 AND adjudication_status='QUARANTINED' ORDER BY created_at DESC LIMIT 50`, [tenantId]),
        client.query(`SELECT * FROM ai_promotion_decisions WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 50`, [tenantId]),
        client.query(`SELECT * FROM ai_calibration_versions WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 50`, [tenantId]),
      ]);
      return { cycles: cycles.rows, quarantine: quarantine.rows, promotions: promotions.rows, calibration: calibration.rows };
    });
  },
};