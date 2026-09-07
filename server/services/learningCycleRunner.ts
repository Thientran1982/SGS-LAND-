import { createHash } from 'crypto';
import { pool, withTenantContext } from '../db';
import { logger } from '../middleware/logger';
import { agentMemoryService, scrubPii } from './agentMemoryService';
import { autonomousLearningService, assessFeedback } from './autonomousLearningService';
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
  return evaluation;
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