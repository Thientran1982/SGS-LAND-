import { logger } from '../middleware/logger';
import type { DatabaseOperationalAlert } from '../dbHealth';

/**
 * Emits tenant-independent operational signals. This deliberately uses the
 * process logger instead of the database or a tenant notification channel:
 * database availability alerts must still work while Postgres is unavailable.
 */
export function emitOperationalAlert(alert: DatabaseOperationalAlert): void {
  const context = {
    alertKey: alert.alertKey,
    type: alert.type,
    service: alert.service,
    component: alert.component,
    severity: alert.severity,
    occurredAt: alert.occurredAt,
    outageStartedAt: alert.outageStartedAt,
    outageDurationMs: alert.outageDurationMs,
    thresholdMs: alert.thresholdMs,
    consecutiveFailures: alert.consecutiveFailures,
  };

  if (alert.type === 'database_outage') {
    logger.error('[OperationalAlert] Database outage threshold exceeded', context);
  } else {
    logger.info('[OperationalAlert] Database connection recovered', context);
  }
}

export const monitoringService = {
  emitOperationalAlert,
};