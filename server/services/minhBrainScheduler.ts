import { randomUUID } from 'node:crypto';
import { logger } from '../middleware/logger';

export const MINH_BRAIN_SCHEDULER_ENV = 'MINH_BRAIN_SCHEDULER_OVERLAY';
export const MINH_BRAIN_SCHEDULER_INTERVAL_MS = 15 * 60 * 1000;

export type MinhBrainSchedulerMode = 'off' | 'shadow';

export type MinhBrainSchedulerJob = {
  key: string;
  legacyOwner: string;
  observedOnly: true;
};

export type MinhBrainSchedulerSnapshot = {
  mode: MinhBrainSchedulerMode;
  enabled: boolean;
  startedAt: string | null;
  lastTickAt: string | null;
  lastTraceId: string | null;
  tickCount: number;
  tenantCount: number | null;
  lastStatus: 'NOT_STARTED' | 'OBSERVED' | 'DEGRADED';
  jobs: MinhBrainSchedulerJob[];
  detectorSummary: {
    enabled: boolean;
    lastRunAt: string | null;
    tenantRuns: number;
    opportunitiesFound: number;
    opportunitiesPersisted: number;
    degradedRuns: number;
    detectorStatus: Array<{
      detector: string;
      status: 'OBSERVED' | 'DEGRADED';
      tenantRuns: number;
      found: number;
      persisted: number;
      lastError?: string;
    }>;
  };
  modelPromotionSummary: {
    enabled: boolean;
    lastRunAt: string | null;
    tenantRuns: number;
    approvalRequests: number;
    rollbackRequests: number;
    degradedRuns: number;
  };
};

export type MinhOpportunityDetectorRunner = (
  tenantId: string,
  traceId: string,
) => Promise<Array<{
  detector: string;
  status: 'OBSERVED' | 'DEGRADED';
  found: number;
  persisted: number;
  error?: string;
}>>;

export type MinhModelPromotionRunner = (
  tenantId: string,
  now: Date,
  traceId: string,
) => Promise<{
  results?: Array<{ status?: string }>;
}>;

const LEGACY_JOBS: MinhBrainSchedulerJob[] = [
  { key: 'agent_operator_worker', legacyOwner: 'agentOperatorDaemon', observedOnly: true },
  { key: 'self_repair_loop', legacyOwner: 'selfRepairService', observedOnly: true },
  { key: 'free_followup_scheduler', legacyOwner: 'freeFollowupScheduler', observedOnly: true },
  { key: 'daily_report_scheduler', legacyOwner: 'dailyAdminReportService', observedOnly: true },
  { key: 'learning_cycle_scheduler', legacyOwner: 'learningCycleRunner', observedOnly: true },
];

let intervalTimer: NodeJS.Timeout | null = null;
let initialTimer: NodeJS.Timeout | null = null;
let tickInFlight = false;
let snapshot: MinhBrainSchedulerSnapshot = {
  mode: 'off',
  enabled: false,
  startedAt: null,
  lastTickAt: null,
  lastTraceId: null,
  tickCount: 0,
  tenantCount: null,
  lastStatus: 'NOT_STARTED',
  jobs: LEGACY_JOBS.map(job => ({ ...job })),
  detectorSummary: {
    enabled: false,
    lastRunAt: null,
    tenantRuns: 0,
    opportunitiesFound: 0,
    opportunitiesPersisted: 0,
    degradedRuns: 0,
    detectorStatus: [],
  },
  modelPromotionSummary: {
    enabled: false,
    lastRunAt: null,
    tenantRuns: 0,
    approvalRequests: 0,
    rollbackRequests: 0,
    degradedRuns: 0,
  },
};

export function getMinhBrainSchedulerMode(
  env: NodeJS.ProcessEnv = process.env,
): MinhBrainSchedulerMode {
  return String(env[MINH_BRAIN_SCHEDULER_ENV] || 'shadow').trim().toLowerCase() === 'shadow'
    ? 'shadow'
    : 'off';
}

export function getMinhBrainSchedulerSnapshot(): MinhBrainSchedulerSnapshot {
  return {
    ...snapshot,
    jobs: snapshot.jobs.map(job => ({ ...job })),
  };
}

export async function runMinhBrainSchedulerTick(
  getTenantIds: () => Promise<string[]>,
  now: () => Date = () => new Date(),
  runOpportunityDetectors?: MinhOpportunityDetectorRunner,
  runModelPromotion?: MinhModelPromotionRunner,
): Promise<MinhBrainSchedulerSnapshot> {
  if (tickInFlight) return getMinhBrainSchedulerSnapshot();
  tickInFlight = true;
  const traceId = randomUUID();
  const tickAt = now();
  try {
    const tenantIds = await getTenantIds();
    const detectorSummary = {
      ...snapshot.detectorSummary,
      enabled: Boolean(runOpportunityDetectors),
      lastRunAt: tickAt.toISOString(),
      tenantRuns: 0,
      opportunitiesFound: 0,
      opportunitiesPersisted: 0,
      degradedRuns: 0,
    };
    const modelPromotionSummary = {
      ...snapshot.modelPromotionSummary,
      enabled: Boolean(runModelPromotion),
      lastRunAt: tickAt.toISOString(),
      tenantRuns: 0,
      approvalRequests: 0,
      rollbackRequests: 0,
      degradedRuns: 0,
    };
    if (runOpportunityDetectors) {
      const detectorStatus = new Map<string, {
        detector: string;
        status: 'OBSERVED' | 'DEGRADED';
        tenantRuns: number;
        found: number;
        persisted: number;
        lastError?: string;
      }>();
      for (const tenantId of tenantIds) {
        try {
          const detectorResults = await runOpportunityDetectors(tenantId, traceId);
          detectorSummary.tenantRuns++;
          detectorSummary.opportunitiesFound += detectorResults.reduce((sum, result) => sum + result.found, 0);
          detectorSummary.opportunitiesPersisted += detectorResults.reduce((sum, result) => sum + result.persisted, 0);
          if (detectorResults.some(result => result.status === 'DEGRADED')) detectorSummary.degradedRuns++;
          for (const result of detectorResults) {
            const current = detectorStatus.get(result.detector) || {
              detector: result.detector,
              status: 'OBSERVED' as const,
              tenantRuns: 0,
              found: 0,
              persisted: 0,
            };
            current.status = result.status === 'DEGRADED' ? 'DEGRADED' : current.status;
            current.tenantRuns++;
            current.found += result.found;
            current.persisted += result.persisted;
            if (result.error) current.lastError = result.error;
            detectorStatus.set(result.detector, current);
          }
        } catch (error: any) {
          detectorSummary.degradedRuns++;
          logger.warn(`[MinhBrainScheduler] detector run degraded traceId=${traceId} tenant=${tenantId}: ${error?.message || error}`);
        }
      }
      detectorSummary.detectorStatus = [...detectorStatus.values()].sort((a, b) => a.detector.localeCompare(b.detector));
    }
    if (runModelPromotion) {
      for (const tenantId of tenantIds) {
        try {
          const result = await runModelPromotion(tenantId, tickAt, traceId);
          modelPromotionSummary.tenantRuns++;
          for (const item of result.results || []) {
            if (item.status === 'APPROVAL_REQUESTED') modelPromotionSummary.approvalRequests++;
            if (item.status === 'ROLLBACK_REQUESTED') modelPromotionSummary.rollbackRequests++;
          }
        } catch (error: any) {
          modelPromotionSummary.degradedRuns++;
          logger.warn(`[MinhBrainScheduler] model promotion degraded traceId=${traceId} tenant=${tenantId}: ${error?.message || error}`);
        }
      }
    }
    snapshot = {
      ...snapshot,
      mode: 'shadow',
      enabled: true,
      startedAt: snapshot.startedAt || tickAt.toISOString(),
      lastTickAt: tickAt.toISOString(),
      lastTraceId: traceId,
      tickCount: snapshot.tickCount + 1,
      tenantCount: tenantIds.length,
      lastStatus: 'OBSERVED',
      jobs: LEGACY_JOBS.map(job => ({ ...job })),
      detectorSummary,
      modelPromotionSummary,
    };
    logger.info(`[MinhBrainScheduler] shadow tick traceId=${traceId} tenants=${tenantIds.length} jobs=${LEGACY_JOBS.length}`);
  } catch (error: any) {
    snapshot = {
      ...snapshot,
      mode: 'shadow',
      enabled: true,
      startedAt: snapshot.startedAt || tickAt.toISOString(),
      lastTickAt: tickAt.toISOString(),
      lastTraceId: traceId,
      tickCount: snapshot.tickCount + 1,
      tenantCount: null,
      lastStatus: 'DEGRADED',
      jobs: LEGACY_JOBS.map(job => ({ ...job })),
      detectorSummary: {
        ...snapshot.detectorSummary,
        lastRunAt: tickAt.toISOString(),
      },
      modelPromotionSummary: {
        ...snapshot.modelPromotionSummary,
        enabled: Boolean(runModelPromotion),
        lastRunAt: tickAt.toISOString(),
        degradedRuns: snapshot.modelPromotionSummary.degradedRuns + (runModelPromotion ? 1 : 0),
      },
    };
    logger.warn(`[MinhBrainScheduler] shadow tick degraded traceId=${traceId}: ${error?.message || error}`);
  } finally {
    tickInFlight = false;
  }
  return getMinhBrainSchedulerSnapshot();
}

export function startMinhBrainSchedulerOverlay(
  getTenantIds: () => Promise<string[]>,
  options: {
    intervalMs?: number;
    initialDelayMs?: number;
    env?: NodeJS.ProcessEnv;
    runOpportunityDetectors?: MinhOpportunityDetectorRunner;
    runModelPromotion?: MinhModelPromotionRunner;
  } = {},
): { enabled: boolean; stop: () => void } {
  const mode = getMinhBrainSchedulerMode(options.env);
  if (mode === 'off') {
    snapshot = { ...snapshot, mode: 'off', enabled: false, lastStatus: 'NOT_STARTED' };
    return { enabled: false, stop: stopMinhBrainSchedulerOverlay };
  }
  if (intervalTimer || initialTimer) return { enabled: true, stop: stopMinhBrainSchedulerOverlay };

  snapshot = {
    ...snapshot,
    mode,
    enabled: true,
    startedAt: snapshot.startedAt || new Date().toISOString(),
    jobs: LEGACY_JOBS.map(job => ({ ...job })),
  };
  const intervalMs = options.intervalMs ?? MINH_BRAIN_SCHEDULER_INTERVAL_MS;
  const initialDelayMs = options.initialDelayMs ?? 5_000;
  const tick = () => {
    void runMinhBrainSchedulerTick(
      getTenantIds,
      () => new Date(),
      options.runOpportunityDetectors,
      options.runModelPromotion,
    );
  };
  initialTimer = setTimeout(() => {
    initialTimer = null;
    tick();
  }, initialDelayMs);
  initialTimer.unref?.();
  intervalTimer = setInterval(tick, intervalMs);
  intervalTimer.unref?.();
  logger.info(`[MinhBrainScheduler] shadow overlay started interval=${intervalMs}ms legacySchedulers=${LEGACY_JOBS.length}`);
  return { enabled: true, stop: stopMinhBrainSchedulerOverlay };
}

export function stopMinhBrainSchedulerOverlay(): void {
  if (initialTimer) clearTimeout(initialTimer);
  if (intervalTimer) clearInterval(intervalTimer);
  initialTimer = null;
  intervalTimer = null;
}