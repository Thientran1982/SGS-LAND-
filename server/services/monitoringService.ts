import { logger } from '../middleware/logger';
import type { DatabaseOperationalAlert } from '../dbHealth';
import {
  claimSharedOperationalIncident,
  resolveSharedOperationalIncident,
} from './sharedCache';

const DATABASE_OPERATIONAL_COORDINATION_KEY = 'database-availability';
const DATABASE_OPERATIONAL_INCIDENT_TTL_MS = 24 * 60 * 60_000;
const DATABASE_OPERATIONAL_RESOLUTION_TTL_MS = 10 * 60_000;
let localFallbackIncidentActive = false;

type SharedOperationalIncident = {
  phase: 'active' | 'resolved';
  incidentId: string;
  outageStartedAt: string;
  thresholdMs: number;
  consecutiveFailures: number;
};

function localIncident(alert: DatabaseOperationalAlert): SharedOperationalIncident {
  return {
    phase: 'active',
    incidentId: `${process.pid}:${alert.outageStartedAt}:${Math.random().toString(36).slice(2)}`,
    outageStartedAt: alert.outageStartedAt,
    thresholdMs: alert.thresholdMs,
    consecutiveFailures: alert.consecutiveFailures,
  };
}

function logOperationalAlert(alert: DatabaseOperationalAlert): void {
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

/**
 * Emits tenant-independent operational signals. This deliberately uses the
 * process logger instead of the database or a tenant notification channel:
 * database availability alerts must still work while Postgres is unavailable.
 */
export async function emitOperationalAlert(alert: DatabaseOperationalAlert): Promise<void> {
  if (alert.type === 'database_outage') {
    const coordination = await claimSharedOperationalIncident(
      DATABASE_OPERATIONAL_COORDINATION_KEY,
      localIncident(alert),
      DATABASE_OPERATIONAL_INCIDENT_TTL_MS,
    );
    if (coordination.status === 'held') return;
    // A coordination outage deliberately falls back to the existing local
    // signal. Redis must never block database retries or health transitions.
    localFallbackIncidentActive = coordination.status === 'unavailable';
    logOperationalAlert(alert);
    return;
  }

  const coordination = await resolveSharedOperationalIncident<SharedOperationalIncident>(
    DATABASE_OPERATIONAL_COORDINATION_KEY,
    alert.occurredAt,
    DATABASE_OPERATIONAL_RESOLUTION_TTL_MS,
  );
  if (coordination.status === 'held') return;
  if (coordination.status === 'missing') {
    // Redis is reachable and no peer announced this incident. Do not emit an
    // unmatched recovery when a peer's outage claim is still racing us.
    return;
  }
  if (coordination.status === 'acquired' && coordination.value) {
    localFallbackIncidentActive = false;
    const incident = coordination.value;
    logOperationalAlert({
      ...alert,
      outageStartedAt: incident.outageStartedAt,
      outageDurationMs: Math.max(
        0,
        new Date(alert.occurredAt).getTime() - new Date(incident.outageStartedAt).getTime(),
      ),
      thresholdMs: incident.thresholdMs,
      consecutiveFailures: incident.consecutiveFailures,
    });
    return;
  }
  if (localFallbackIncidentActive) {
    // This process may have emitted the outage while Redis was unavailable.
    // Preserve the local fail-open recovery signal and close that fallback
    // lifecycle.
    localFallbackIncidentActive = false;
    logOperationalAlert(alert);
  }
}

export const monitoringService = {
  emitOperationalAlert,
};