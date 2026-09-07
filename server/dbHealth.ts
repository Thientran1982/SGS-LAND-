export type DatabaseHealthStatus = 'healthy' | 'unavailable';

export type DatabaseOperationalAlertType = 'database_outage' | 'database_recovered';

export interface DatabaseOperationalAlert {
  type: DatabaseOperationalAlertType;
  alertKey: 'database-availability';
  service: 'sgs-land-api';
  component: 'database';
  severity: 'critical' | 'info';
  occurredAt: string;
  outageStartedAt: string;
  outageDurationMs: number;
  thresholdMs: number;
  consecutiveFailures: number;
}

export interface DatabaseHealthSnapshot {
  available: boolean;
  status: DatabaseHealthStatus;
  consecutiveFailures: number;
  lastError?: string;
  lastErrorAt?: string;
  lastHealthyAt?: string;
  nextRetryAt?: string;
  outageStartedAt?: string;
}

const TRANSIENT_ERROR_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ECONNABORTED',
  'ETIMEDOUT',
  'EPIPE',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'ENOTFOUND',
  '57P01', // admin_shutdown
  '57P02', // crash_shutdown
  '57P03', // cannot_connect_now
  '08000', // connection_exception
  '08001', // sqlclient_unable_to_establish_sqlconnection
  '08003', // connection_does_not_exist
  '08004', // sqlserver_rejected_establishment_of_sqlconnection
  '08006', // connection_failure
  '08007', // transaction_resolution_unknown
  '08S01', // communication_link_failure
]);

const TRANSIENT_ERROR_MESSAGES = [
  'connection terminated unexpectedly',
  'connection terminated',
  'administrator command',
  'server closed the connection unexpectedly',
  'the database system is starting up',
  'the database system is shutting down',
  'connection refused',
  'connection reset',
  'socket hang up',
  'timeout expired',
];

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message ?? error);
  }
  return String(error);
}

/**
 * Connection failures are expected during a managed Postgres restart. Keep
 * this deliberately narrow so SQL errors and programming errors still reach
 * the normal request error path (and fatal process handling).
 */
export function isTransientDatabaseError(error: unknown): boolean {
  const candidate = error as { code?: unknown };
  const code = typeof candidate?.code === 'string' ? candidate.code : '';
  if (TRANSIENT_ERROR_CODES.has(code)) return true;

  const message = errorMessage(error).toLowerCase();
  return TRANSIENT_ERROR_MESSAGES.some((fragment) => message.includes(fragment));
}

export const DEFAULT_DATABASE_OUTAGE_ALERT_THRESHOLD_MS = 5 * 60_000;
export const DATABASE_OUTAGE_ALERT_THRESHOLD_ENV = 'DB_OUTAGE_ALERT_THRESHOLD_MS';

export function getDatabaseOutageAlertThresholdMs(
  env: Record<string, string | undefined> = process.env,
): number {
  const raw = env[DATABASE_OUTAGE_ALERT_THRESHOLD_ENV]?.trim();
  const configured = raw ? Number(raw) : Number.NaN;
  return Number.isFinite(configured) && configured >= 0
    ? Math.floor(configured)
    : DEFAULT_DATABASE_OUTAGE_ALERT_THRESHOLD_MS;
}

export interface DatabaseHealthTrackerOptions {
  outageAlertThresholdMs?: number;
  onOperationalAlert?: (alert: DatabaseOperationalAlert) => void;
}

export class DatabaseHealthTracker {
  private snapshot: DatabaseHealthSnapshot = {
    available: true,
    status: 'healthy',
    consecutiveFailures: 0,
  };
  private readonly outageAlertThresholdMs: number;
  private readonly onOperationalAlert?: (alert: DatabaseOperationalAlert) => void;
  private outageAlertTimer: NodeJS.Timeout | null = null;
  private outageStartedAtMs: number | null = null;
  private outageAlertEmitted = false;

  constructor(options: DatabaseHealthTrackerOptions = {}) {
    this.outageAlertThresholdMs = options.outageAlertThresholdMs ??
      getDatabaseOutageAlertThresholdMs();
    this.onOperationalAlert = options.onOperationalAlert;
  }

  markHealthy(now = new Date()): DatabaseHealthSnapshot {
    const wasUnavailable = this.snapshot.status === 'unavailable';
    if (wasUnavailable && this.outageAlertEmitted && this.outageStartedAtMs !== null) {
      this.dispatchOperationalAlert({
        type: 'database_recovered',
        alertKey: 'database-availability',
        service: 'sgs-land-api',
        component: 'database',
        severity: 'info',
        occurredAt: now.toISOString(),
        outageStartedAt: new Date(this.outageStartedAtMs).toISOString(),
        outageDurationMs: Math.max(0, now.getTime() - this.outageStartedAtMs),
        thresholdMs: this.outageAlertThresholdMs,
        consecutiveFailures: this.snapshot.consecutiveFailures,
      });
    }
    this.clearOutageState();
    this.snapshot = {
      available: true,
      status: 'healthy',
      consecutiveFailures: 0,
      lastHealthyAt: now.toISOString(),
    };
    return this.getSnapshot();
  }

  markUnavailable(error: unknown, nextRetryAt?: Date, now = new Date()): DatabaseHealthSnapshot {
    const message = errorMessage(error);
    const wasUnavailable = this.snapshot.status === 'unavailable';
    if (!wasUnavailable) {
      this.outageStartedAtMs = now.getTime();
      this.outageAlertEmitted = false;
      this.snapshot = {
        ...this.snapshot,
        outageStartedAt: now.toISOString(),
      };
      this.scheduleOutageAlert();
    }
    this.snapshot = {
      ...this.snapshot,
      available: false,
      status: 'unavailable',
      consecutiveFailures: this.snapshot.consecutiveFailures + 1,
      lastError: message,
      lastErrorAt: now.toISOString(),
      ...(nextRetryAt ? { nextRetryAt: nextRetryAt.toISOString() } : {}),
    };
    return this.getSnapshot();
  }

  getSnapshot(): DatabaseHealthSnapshot {
    return { ...this.snapshot };
  }

  private scheduleOutageAlert(): void {
    this.clearOutageAlertTimer();
    this.outageAlertTimer = setTimeout(() => {
      this.outageAlertTimer = null;
      if (
        this.snapshot.status !== 'unavailable' ||
        this.outageAlertEmitted ||
        this.outageStartedAtMs === null
      ) {
        return;
      }

      this.outageAlertEmitted = true;
      const now = new Date();
      this.dispatchOperationalAlert({
        type: 'database_outage',
        alertKey: 'database-availability',
        service: 'sgs-land-api',
        component: 'database',
        severity: 'critical',
        occurredAt: now.toISOString(),
        outageStartedAt: new Date(this.outageStartedAtMs).toISOString(),
        outageDurationMs: Math.max(0, now.getTime() - this.outageStartedAtMs),
        thresholdMs: this.outageAlertThresholdMs,
        consecutiveFailures: this.snapshot.consecutiveFailures,
      });
    }, this.outageAlertThresholdMs);
    this.outageAlertTimer.unref?.();
  }

  private dispatchOperationalAlert(alert: DatabaseOperationalAlert): void {
    try {
      this.onOperationalAlert?.(alert);
    } catch {
      // Alerting must never change database recovery or request behavior.
    }
  }

  private clearOutageState(): void {
    this.clearOutageAlertTimer();
    this.outageStartedAtMs = null;
    this.outageAlertEmitted = false;
  }

  private clearOutageAlertTimer(): void {
    if (this.outageAlertTimer) {
      clearTimeout(this.outageAlertTimer);
      this.outageAlertTimer = null;
    }
  }
}