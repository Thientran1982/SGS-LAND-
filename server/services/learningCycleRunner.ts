import { createHash } from 'crypto';
import { pool, withTenantContext } from '../db';
import { logger } from '../middleware/logger';
import { agentMemoryService, scrubPii } from './agentMemoryService';
import {
  autonomousLearningService,
  assessFeedback,
  buildPromotionMetrics,
  DEFAULT_MODEL_PROMOTION_GATE,
  detectRuntimeRegression,
  evaluatePromotionGate,
  getModelPromotionLoopMode,
} from './autonomousLearningService';
import { approvalRequestRepository } from '../repositories/approvalRequestRepository';
import {
  computeMinhWeeklyKpiForAllTenants,
  runMinhConfidenceCalibrationForAllTenants,
} from './minhCalibrationService';

const INITIAL_RUN_DELAY_MS = 60_000;
const CONSOLIDATION_INTERVAL_MS = 24 * 60 * 60 * 1000;
// Asia/Saigon is UTC+7 year-round: Sunday 03:00 ICT = Saturday 20:00 UTC.
const WEEKLY_RUN_HOUR_UTC = 20;
// KPI follows the learning cycle at Sunday 04:00 ICT = Saturday 21:00 UTC.
const KPI_RUN_HOUR_UTC = 21;
let initialTimer: NodeJS.Timeout | null = null;
let weeklyTimer: NodeJS.Timeout | null = null;
let consolidationTimer: NodeJS.Timeout | null = null;
let kpiTimer: NodeJS.Timeout | null = null;
let learningRunInFlight = false;
let consolidationInFlight = false;

function isoWeekKey(date = new Date()): string {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((copy.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${copy.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function nextSundayAt3Utc(from = new Date()): number {
  const next = new Date(from);
  next.setUTCHours(WEEKLY_RUN_HOUR_UTC, 0, 0, 0);
  const daysUntilSaturday = (6 - next.getUTCDay() + 7) % 7;
  next.setUTCDate(next.getUTCDate() + daysUntilSaturday);
  if (next.getTime() <= from.getTime()) next.setUTCDate(next.getUTCDate() + 7);
  return Math.max(60_000, next.getTime() - from.getTime());
}

function nextSundayAt4Utc(from = new Date()): number {
  const next = new Date(from);
  next.setUTCHours(KPI_RUN_HOUR_UTC, 0, 0, 0);
  const daysUntilSaturday = (6 - next.getUTCDay() + 7) % 7;
  next.setUTCDate(next.getUTCDate() + daysUntilSaturday);
  if (next.getTime() <= from.getTime()) next.setUTCDate(next.getUTCDate() + 7);
  return Math.max(60_000, next.getTime() - from.getTime());
}

function parseJson(value: unknown): any {
  if (value && typeof value === 'object') return value;
  try { return JSON.parse(String(value || '{}')); } catch { return {}; }
}

async function evaluateGoldenSet(tenantId: string) {
  const [cases, weights] = await Promise.all([
    withTenantContext(tenantId, async client => (await client.query(
      `SELECT id, category, input_json, expected_json
         FROM ai_golden_set_cases
        WHERE tenant_id=$1 AND active=TRUE
        ORDER BY category, created_at, id
        LIMIT 200`,
      [tenantId],
    )).rows),
    agentMemoryService.getWeights(tenantId),
  ]);

  let matchTotal = 0;
  let matchCorrect = 0;
  let valuationTotal = 0;
  let valuationPassed = 0;
  const categoryCounts: Record<string, number> = {};

  for (const fixture of cases) {
    const input = parseJson(fixture.input_json);
    const expected = parseJson(fixture.expected_json);
    categoryCounts[fixture.category] = (categoryCounts[fixture.category] || 0) + 1;
    if (fixture.category === 'match') {
      matchTotal++;
      const factors = input?.payload?.factors || input?.factors || {};
      const score = (Object.keys(weights) as Array<keyof typeof weights>)
        .reduce((sum, factor) => sum + (factors[factor] === true ? Number(weights[factor]) : 0), 0);
      const predictedChosen = score > 0;
      if (predictedChosen === (expected?.chosen !== false)) matchCorrect++;
    } else if (fixture.category === 'valuation') {
      valuationTotal++;
      const payload = input?.payload || input;
      const relativeError = Number(payload?.relativeError);
      const expectedPrice = Number(expected?.expectedPricePerM2);
      const inputPrice = Number(input?.pricePerM2);
      const validObservedError = Number.isFinite(relativeError) && relativeError >= 0;
      const fallbackFixture = !validObservedError && expectedPrice > 0 && inputPrice > 0 && expectedPrice === inputPrice;
      if ((validObservedError && relativeError <= Number(expected?.maxRelativeError || 0.25)) || fallbackFixture) {
        valuationPassed++;
      }
    }
  }

  const matchAccuracy = matchTotal ? matchCorrect / matchTotal : 0;
  const valuationPassRate = valuationTotal ? valuationPassed / valuationTotal : 0;
  const summary = {
    fixtureVersion: 'golden-set-v1',
    casesEvaluated: cases.length,
    categoryCounts,
    match: { total: matchTotal, correct: matchCorrect, accuracy: Number(matchAccuracy.toFixed(4)) },
    valuation: { total: valuationTotal, passed: valuationPassed, passRate: Number(valuationPassRate.toFixed(4)) },
    weights,
    gates: {
      minimumCases: 20,
      matchAccuracy: 0.8,
      valuationPassRate: 0.7,
    },
  };
  return {
    passed: cases.length >= 20 && matchAccuracy >= 0.8 && valuationPassRate >= 0.7,
    summary,
  };
}

async function adjudicateFeedbackForTenant(tenantId: string) {
  const feedbackRows = await withTenantContext(tenantId, async client => (await client.query(
    `SELECT id, rating, correction, user_message, ai_response, metadata
       FROM ai_feedback
      WHERE tenant_id=$1
      ORDER BY created_at ASC
      LIMIT 100`,
    [tenantId],
  )).rows);
  const outcomes: Record<string, number> = { ACCEPTED: 0, REJECTED: 0, QUARANTINED: 0 };
  for (const feedback of feedbackRows) {
    const assessment = assessFeedback({
      rating: Number(feedback.rating) === 1 ? 1 : -1,
      correction: feedback.correction,
      userMessage: feedback.user_message,
      aiResponse: feedback.ai_response,
      metadata: parseJson(feedback.metadata),
    });
    try {
      await autonomousLearningService.adjudicateFeedback(tenantId, feedback.id, assessment);
      outcomes[assessment.status] = (outcomes[assessment.status] || 0) + 1;
    } catch (error: any) {
      logger.warn(`[LearningCycle] feedback adjudication skipped id=${feedback.id}: ${error?.message || error}`);
    }
  }

  const signalCount = await withTenantContext(tenantId, async client => (await client.query(
    `SELECT COUNT(*)::int AS count
       FROM agent_signals
      WHERE tenant_id=$1 AND signal_type='match_chosen'
        AND provenance IN ('system','staff','buyer')`,
    [tenantId],
  )).rows[0]?.count || 0);
  let draft: any = null;
  if (signalCount >= 10) {
    try {
      draft = await agentMemoryService.fitWeights(tenantId, 'learning-cycle');
    } catch (error: any) {
      logger.warn(`[LearningCycle] fitWeights skipped tenant=${tenantId}: ${error?.message || error}`);
    }
  }
  return { feedbackRows: feedbackRows.length, outcomes, matchChosenSignals: signalCount, draftId: draft?.id || null };
}

export async function runLearningCycleForTenant(
  tenantId: string,
  cycleKey = `weekly-${isoWeekKey()}`,
  traceId?: string,
) {
  const evaluation = await autonomousLearningService.runLockedEvaluationCycle({
    tenantId,
    cycleKey,
    fixtureVersion: 'golden-set-v1',
    traceId,
    run: async () => {
      const golden = await evaluateGoldenSet(tenantId);
      const feedback = await adjudicateFeedbackForTenant(tenantId);
      return {
        passed: golden.passed,
        summary: { ...golden.summary, feedback },
      };
    },
  });
  if (
    evaluation.claimed
    && evaluation.cycle?.status === 'PASSED'
    && getModelPromotionLoopMode() === 'shadow'
  ) {
    const summary = parseJson(evaluation.cycle.summary_json);
    const draftId = summary.feedback?.draftId;
    if (draftId) {
      const registered = await autonomousLearningService.registerWeightCandidate({
        tenantId,
        cycleId: String(evaluation.cycle.id),
        weightVersionId: String(draftId),
        summary,
        traceId,
      });
      const metrics = buildPromotionMetrics(summary);
      const gate = evaluatePromotionGate(metrics, DEFAULT_MODEL_PROMOTION_GATE);
      const candidate = registered.candidate;
      const transitioned = candidate.status === 'SHADOW'
        ? await autonomousLearningService.promoteCandidate(
          tenantId,
          String(candidate.id),
          'CANARY',
          gate,
          traceId,
        )
        : candidate;
      return {
        ...evaluation,
        candidate: {
          id: transitioned?.id || candidate.id,
          status: transitioned?.status || candidate.status,
          reused: registered.reused,
          gate,
        },
      };
    }
  }
  return evaluation;
}

type RuntimeMetrics = {
  safety: number;
  groundedness: number;
  quality: number;
  latencyP95Ms: number;
  costUsd: number;
  minSamples: number;
  errorRate: number;
};

async function sampleCandidateRuntimeMetrics(tenantId: string): Promise<RuntimeMetrics> {
  return withTenantContext(tenantId, async client => {
    const [usage, signals, feedback, executions] = await Promise.all([
      client.query(
        `SELECT COUNT(*)::int AS samples,
                COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms),0)::int AS latency_p95_ms,
                COALESCE(SUM(cost_usd),0)::float AS cost_usd
           FROM ai_usage_log
          WHERE tenant_id=$1 AND created_at >= NOW() - INTERVAL '24 hours'`,
        [tenantId],
      ),
      client.query(
        `SELECT COUNT(*)::int AS samples
           FROM agent_signals
          WHERE tenant_id=$1 AND signal_type='match_chosen'
            AND created_at >= NOW() - INTERVAL '24 hours'`,
        [tenantId],
      ),
      client.query(
        `SELECT COUNT(*)::int AS samples,
                COALESCE(AVG(CASE WHEN rating=1 THEN 1.0 ELSE 0.0 END),0)::float AS quality
           FROM ai_feedback
          WHERE tenant_id=$1 AND created_at >= NOW() - INTERVAL '24 hours'
            AND adjudication_status='ACCEPTED'`,
        [tenantId],
      ),
      client.query(
        `SELECT COUNT(*)::int AS samples,
                COALESCE(AVG(CASE WHEN status='ERROR' THEN 1.0 ELSE 0.0 END),0)::float AS error_rate
           FROM agent_executions
          WHERE tenant_id=$1 AND created_at >= NOW() - INTERVAL '24 hours'`,
        [tenantId],
      ),
    ]);
    const usageRow = usage.rows[0] || {};
    const signalSamples = Number(signals.rows[0]?.samples || 0);
    const feedbackSamples = Number(feedback.rows[0]?.samples || 0);
    const executionSamples = Number(executions.rows[0]?.samples || 0);
    const sampleCount = Math.max(
      Number(usageRow.samples || 0),
      signalSamples,
      feedbackSamples,
      executionSamples,
    );
    const errorRate = Math.max(0, Math.min(1, Number(executions.rows[0]?.error_rate || 0)));
    return {
      safety: Math.max(0, 1 - errorRate),
      groundedness: signalSamples > 0 ? 1 : 0,
      quality: feedbackSamples > 0 ? Math.max(0, Math.min(1, Number(feedback.rows[0]?.quality || 0))) : 0,
      latencyP95Ms: Math.max(0, Number(usageRow.latency_p95_ms || 0)),
      costUsd: Math.max(0, Number(usageRow.cost_usd || 0)),
      minSamples: sampleCount,
      errorRate,
    };
  });
}

export async function runModelPromotionLoopForTenant(
  tenantId: string,
  now = new Date(),
  traceId?: string,
) {
  if (getModelPromotionLoopMode() !== 'shadow') {
    return { skipped: true, reason: 'model_promotion_loop_disabled' };
  }

  const candidates = await withTenantContext(tenantId, async client => (await client.query(
    `SELECT * FROM ai_learning_candidates
      WHERE tenant_id=$1 AND status IN ('CANARY','ACTIVE')
      ORDER BY created_at ASC
      LIMIT 20`,
    [tenantId],
  )).rows);
  const results: Array<Record<string, unknown>> = [];

  for (const candidate of candidates) {
    const runtime = await sampleCandidateRuntimeMetrics(tenantId);
    await autonomousLearningService.recordRuntimeMetrics({
      tenantId,
      candidateId: String(candidate.id),
      metrics: runtime,
    });
    const ageHours = Math.max(0, (now.getTime() - new Date(candidate.created_at).getTime()) / 3600000);
    if (candidate.status === 'CANARY') {
      if (ageHours < 24 || runtime.minSamples < DEFAULT_MODEL_PROMOTION_GATE.minSamples) {
        results.push({
          candidateId: candidate.id,
          status: 'SOAKING',
          ageHours: Number(ageHours.toFixed(2)),
          sampleCount: runtime.minSamples,
        });
        continue;
      }
      const gate = evaluatePromotionGate(runtime, DEFAULT_MODEL_PROMOTION_GATE);
      if (!gate.passed) {
        await autonomousLearningService.promoteCandidate(tenantId, String(candidate.id), 'ACTIVE', gate, traceId)
          .catch(() => undefined);
        results.push({ candidateId: candidate.id, status: 'REJECTED', gate });
        continue;
      }
      const approval = await approvalRequestRepository.createLearningCandidateApproval({
        tenantId,
        actionType: 'PROMOTE_LEARNING_CANDIDATE',
        subjectType: 'learning_candidate',
        subjectId: String(candidate.id),
        idempotencyKey: `minh-learning:promote:${candidate.id}`,
        reasoning: 'Candidate đã soak đủ 24 giờ và vượt qua gate runtime; cần quản lý duyệt go-live.',
        payload: {
          schemaVersion: 1,
          candidateId: String(candidate.id),
          metrics: {
            safety: runtime.safety,
            groundedness: runtime.groundedness,
            quality: runtime.quality,
            latencyP95Ms: runtime.latencyP95Ms,
            costUsd: runtime.costUsd,
            minSamples: runtime.minSamples,
          },
          thresholds: DEFAULT_MODEL_PROMOTION_GATE,
          requiredApproval: true,
        },
      });
      if (!approval.reused) {
        await autonomousLearningService.recordAudit({
          tenantId,
          eventType: 'GO_LIVE_APPROVAL_REQUESTED',
          entityType: 'LEARNING_CANDIDATE',
          entityId: String(candidate.id),
          reason: 'canary_soak_and_runtime_gate_passed',
          metrics: runtime,
          traceId,
        });
      }
      results.push({ candidateId: candidate.id, status: 'APPROVAL_REQUESTED', approvalId: approval.id });
      continue;
    }

    if (runtime.minSamples < DEFAULT_MODEL_PROMOTION_GATE.minSamples) {
      results.push({
        candidateId: candidate.id,
        status: 'ACTIVE_WAITING_FOR_SAMPLES',
        sampleCount: runtime.minSamples,
      });
      continue;
    }

    const gateSummary = parseJson(candidate.gate_summary);
    const baseline = {
      safety: Number(gateSummary.metrics?.safety ?? 1),
      groundedness: Number(gateSummary.metrics?.groundedness ?? 1),
      quality: Number(gateSummary.metrics?.quality ?? 1),
      errorRate: 0,
      latencyP95Ms: Number(gateSummary.metrics?.latencyP95Ms ?? 0),
    };
    const regression = detectRuntimeRegression(runtime, baseline);
    if (regression.regressed) {
      const approval = await approvalRequestRepository.createLearningCandidateApproval({
        tenantId,
        actionType: 'ROLLBACK_LEARNING_CANDIDATE',
        subjectType: 'learning_candidate',
        subjectId: String(candidate.id),
        idempotencyKey: `minh-learning:rollback:${candidate.id}`,
        reasoning: `Runtime regression cần quản lý duyệt rollback: ${regression.failures.join(', ')}`,
        payload: {
          schemaVersion: 1,
          candidateId: String(candidate.id),
          failures: regression.failures,
          metrics: {
            safety: runtime.safety,
            groundedness: runtime.groundedness,
            quality: runtime.quality,
            latencyP95Ms: runtime.latencyP95Ms,
            costUsd: runtime.costUsd,
            minSamples: runtime.minSamples,
            errorRate: runtime.errorRate,
          },
          requiredApproval: true,
        },
      });
      if (!approval.reused) {
        await autonomousLearningService.recordAudit({
          tenantId,
          eventType: 'ROLLBACK_APPROVAL_REQUESTED',
          entityType: 'LEARNING_CANDIDATE',
          entityId: String(candidate.id),
          reason: regression.failures.join(','),
          metrics: runtime,
          traceId,
        });
      }
      results.push({ candidateId: candidate.id, status: 'ROLLBACK_REQUESTED', approvalId: approval.id });
    } else {
      results.push({ candidateId: candidate.id, status: 'ACTIVE_HEALTHY', sampleCount: runtime.minSamples });
    }
  }
  return { skipped: false, tenantId, results };
}

export async function runLearningCyclesForAllTenants(
  cycleKey = `weekly-${isoWeekKey()}`,
  traceId?: string,
) {
  if (learningRunInFlight) return { skipped: true, reason: 'learning_cycle_already_running' };
  learningRunInFlight = true;
  try {
    const tenants = (await pool.query(`SELECT id FROM tenants ORDER BY id`)).rows;
    const settled = await Promise.allSettled(tenants.map(row =>
      runLearningCycleForTenant(String(row.id), cycleKey, traceId),
    ));
    const results = settled.map((result, index) => ({
      tenantId: String(tenants[index].id),
      status: result.status,
      value: result.status === 'fulfilled' ? result.value : undefined,
      error: result.status === 'rejected' ? scrubPii(result.reason?.message || result.reason) : undefined,
    }));
    return { skipped: false, cycleKey, tenantCount: tenants.length, results };
  } finally {
    learningRunInFlight = false;
  }
}

export async function consolidateTenantMemory(tenantId: string) {
  const groups = await withTenantContext(tenantId, async client => (await client.query(
    `SELECT namespace, key, COUNT(*)::int AS count,
            ARRAY_AGG(value ORDER BY updated_at ASC) AS values
       FROM agent_store
      WHERE tenant_id=$1 AND kind='episodic'
      GROUP BY namespace, key
     HAVING COUNT(*) >= 3
      LIMIT 100`,
    [tenantId],
  )).rows);
  let consolidated = 0;
  for (const group of groups) {
    const values = (group.values || []).map((value: unknown) => scrubPii(value).replace(/\s+/g, ' ').trim()).filter(Boolean);
    if (values.length < 3) continue;
    const digest = createHash('sha256').update(`${group.namespace}:${group.key}`).digest('hex').slice(0, 16);
    const fact = await agentMemoryService.remember(
      tenantId,
      group.namespace,
      `consolidated:${group.key}:${digest}`,
      `Tổng hợp từ ${values.length} episodic: ${values.join(' | ')}`.slice(0, 9000),
      'fact',
      0.75,
    );
    await autonomousLearningService.recordAudit({
      tenantId,
      eventType: 'MEMORY_CONSOLIDATED',
      entityType: 'AGENT_MEMORY',
      entityId: fact.id,
      reason: 'episodic_key_repeated_at_least_three_times',
      metrics: { namespace: group.namespace, key: group.key, sourceCount: values.length },
    });
    consolidated++;
  }
  if (!groups.length) logger.info(`[MemoryConsolidation] tenant=${tenantId} chưa đủ 3 episodic cùng key`);
  return { tenantId, candidates: groups.length, consolidated };
}

export async function consolidateMemoryForAllTenants() {
  if (consolidationInFlight) return { skipped: true, reason: 'consolidation_already_running' };
  consolidationInFlight = true;
  try {
    const tenants = (await pool.query(`SELECT id FROM tenants ORDER BY id`)).rows;
    const results = await Promise.allSettled(tenants.map(row => consolidateTenantMemory(String(row.id))));
    return {
      skipped: false,
      tenantCount: tenants.length,
      results: results.map((result, index) => ({
        tenantId: String(tenants[index].id),
        status: result.status,
        value: result.status === 'fulfilled' ? result.value : undefined,
        error: result.status === 'rejected' ? scrubPii(result.reason?.message || result.reason) : undefined,
      })),
    };
  } finally {
    consolidationInFlight = false;
  }
}

export function startLearningCycleScheduler(getTenantIds: () => Promise<string[]>) {
  if (initialTimer || weeklyTimer || consolidationTimer) return { stop: stopLearningCycleScheduler };
  const runWeekly = async () => {
    try {
      const tenantIds = await getTenantIds();
      await Promise.allSettled(tenantIds.map(tenantId => runLearningCycleForTenant(tenantId)));
    } catch (error: any) {
      logger.warn(`[LearningCycle] scheduler failed: ${error?.message || error}`);
    } finally {
      weeklyTimer = setTimeout(runWeekly, nextSundayAt3Utc());
      weeklyTimer.unref?.();
    }
  };
  const runConsolidation = async () => {
    try {
      const [consolidation, calibration] = await Promise.allSettled([
        consolidateMemoryForAllTenants(),
        runMinhConfidenceCalibrationForAllTenants(),
      ]);
      if (consolidation.status === 'rejected') {
        logger.warn(`[MemoryConsolidation] run failed: ${consolidation.reason?.message || consolidation.reason}`);
      }
      if (calibration.status === 'rejected') {
        logger.warn(`[MinhCalibration] run failed: ${calibration.reason?.message || calibration.reason}`);
      }
    } catch (error: any) {
      logger.warn(`[DailyAgentMaintenance] scheduler failed: ${error?.message || error}`);
    } finally {
      consolidationTimer = setTimeout(runConsolidation, CONSOLIDATION_INTERVAL_MS);
      consolidationTimer.unref?.();
    }
  };
  const runKpi = async () => {
    try {
      await computeMinhWeeklyKpiForAllTenants();
    } catch (error: any) {
      logger.warn(`[MinhKpi] scheduler failed: ${error?.message || error}`);
    } finally {
      kpiTimer = setTimeout(runKpi, nextSundayAt4Utc());
      kpiTimer.unref?.();
    }
  };
  initialTimer = setTimeout(() => {
    initialTimer = null;
    void runLearningCyclesForAllTenants(`deploy-${new Date().toISOString().slice(0, 10)}`);
  }, INITIAL_RUN_DELAY_MS);
  initialTimer.unref?.();
  weeklyTimer = setTimeout(runWeekly, nextSundayAt3Utc());
  weeklyTimer.unref?.();
  consolidationTimer = setTimeout(runConsolidation, INITIAL_RUN_DELAY_MS + 30_000);
  consolidationTimer.unref?.();
  kpiTimer = setTimeout(runKpi, INITIAL_RUN_DELAY_MS + 45_000);
  kpiTimer.unref?.();
  return { stop: stopLearningCycleScheduler };
}

export function stopLearningCycleScheduler() {
  if (initialTimer) clearTimeout(initialTimer);
  if (weeklyTimer) clearTimeout(weeklyTimer);
  if (consolidationTimer) clearTimeout(consolidationTimer);
  if (kpiTimer) clearTimeout(kpiTimer);
  initialTimer = null;
  weeklyTimer = null;
  consolidationTimer = null;
  kpiTimer = null;
}