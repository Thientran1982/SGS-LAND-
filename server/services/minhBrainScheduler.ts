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
};

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
): Promise<MinhBrainSchedulerSnapshot> {
  if (tickInFlight) return getMinhBrainSchedulerSnapshot();
  tickInFlight = true;
  const traceId = randomUUID();
  const tickAt = now();
  try {
    const tenantIds = await getTenantIds();
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
    };
    logger.warn(`[MinhBrainScheduler] shadow tick degraded traceId=${traceId}: ${error?.message || error}`);
  } finally {
    tickInFlight = false;
  }
  return getMinhBrainSchedulerSnapshot();
}

export function startMinhBrainSchedulerOverlay(
  getTenantIds: () => Promise<string[]>,
  options: { intervalMs?: number; initialDelayMs?: number; env?: NodeJS.ProcessEnv } = {},
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
  const tick = () => { void runMinhBrainSchedulerTick(getTenantIds); };
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