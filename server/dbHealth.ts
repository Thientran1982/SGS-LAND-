export type DatabaseHealthStatus = 'healthy' | 'unavailable';

export interface DatabaseHealthSnapshot {
  available: boolean;
  status: DatabaseHealthStatus;
  consecutiveFailures: number;
  lastError?: string;
  lastErrorAt?: string;
  lastHealthyAt?: string;
  nextRetryAt?: string;
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

export class DatabaseHealthTracker {
  private snapshot: DatabaseHealthSnapshot = {
    available: true,
    status: 'healthy',
    consecutiveFailures: 0,
  };

  markHealthy(now = new Date()): DatabaseHealthSnapshot {
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
}