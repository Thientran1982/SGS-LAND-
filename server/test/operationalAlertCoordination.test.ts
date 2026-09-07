import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  claimSharedOperationalIncident,
  resolveSharedOperationalIncident,
  setSharedCacheRedisForTesting,
} from '../services/sharedCache';
import { emitOperationalAlert } from '../services/monitoringService';
import { logger } from '../middleware/logger';

process.env.NODE_ENV = 'test';

type Incident = {
  phase: 'active' | 'resolved';
  incidentId: string;
  outageStartedAt: string;
  thresholdMs: number;
  consecutiveFailures: number;
  resolvedAt?: string;
};

function createRedisDouble() {
  const values = new Map<string, { value: string; expiresAt: number }>();
  let now = 0;

  const expire = (key: string): string | null => {
    const item = values.get(key);
    if (!item) return null;
    if (item.expiresAt <= now) {
      values.delete(key);
      return null;
    }
    return item.value;
  };

  return {
    advance(ms: number) {
      now += ms;
    },
    eval: async (script: string, keys: string[], args: string[]) => {
      const key = keys[0];
      const current = expire(key);
      if (script.includes('state["phase"] == "resolved"')) {
        if (!current) {
          values.set(key, { value: args[0], expiresAt: now + Number(args[1]) });
          return [1, args[0]];
        }
        const state = JSON.parse(current) as Incident;
        if (state.phase === 'resolved') {
          values.set(key, { value: args[0], expiresAt: now + Number(args[1]) });
          return [1, args[0]];
        }
        return [0, current];
      }

      if (!current) return [-1, ''];
      const state = JSON.parse(current) as Incident;
      if (state.phase !== 'active') return [0, current];
      const resolved = JSON.stringify({ ...state, phase: 'resolved', resolvedAt: args[0] });
      values.set(key, { value: resolved, expiresAt: now + Number(args[1]) });
      return [1, resolved];
    },
    get: async <T>(key: string) => {
      const value = expire(key);
      return value ? JSON.parse(value) as T : null;
    },
    set: async () => 'OK',
    del: async () => 0,
    scan: async () => ['0', []],
  };
}

const outage = {
  type: 'database_outage' as const,
  alertKey: 'database-availability' as const,
  service: 'sgs-land-api' as const,
  component: 'database' as const,
  severity: 'critical' as const,
  occurredAt: '2026-09-07T12:05:00.000Z',
  outageStartedAt: '2026-09-07T12:00:00.000Z',
  outageDurationMs: 300_000,
  thresholdMs: 300_000,
  consecutiveFailures: 4,
};

const recovery = {
  ...outage,
  type: 'database_recovered' as const,
  severity: 'info' as const,
  occurredAt: '2026-09-07T12:08:30.000Z',
  outageDurationMs: 510_000,
};

afterEach(() => {
  setSharedCacheRedisForTesting(undefined);
  vi.restoreAllMocks();
});

describe('shared operational alert coordination', () => {
  test('converges concurrent claims and emits one matching recovery', async () => {
    const redis = createRedisDouble();
    setSharedCacheRedisForTesting(redis as any);

    const claims = await Promise.all(
      Array.from({ length: 16 }, (_, index) => claimSharedOperationalIncident(
        'database-availability',
        {
          phase: 'active',
          incidentId: `instance-${index}`,
          outageStartedAt: outage.outageStartedAt,
          thresholdMs: outage.thresholdMs,
          consecutiveFailures: outage.consecutiveFailures,
        },
        1_000,
      )),
    );
    expect(claims.filter(result => result.status === 'acquired')).toHaveLength(1);
    expect(claims.filter(result => result.status === 'held')).toHaveLength(15);

    const recoveries = await Promise.all(
      Array.from({ length: 16 }, () => resolveSharedOperationalIncident<Incident>(
        'database-availability',
        recovery.occurredAt,
        100,
      )),
    );
    expect(recoveries.filter(result => result.status === 'acquired')).toHaveLength(1);
    expect(recoveries.filter(result => result.status === 'held')).toHaveLength(15);
    expect(recoveries.find(result => result.status === 'acquired')).toMatchObject({
      value: {
        phase: 'resolved',
        outageStartedAt: outage.outageStartedAt,
      },
    });
  });

  test('logs one page and one recovery for two backend instances', async () => {
    setSharedCacheRedisForTesting(createRedisDouble() as any);
    const outageError = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    const recoveryInfo = vi.spyOn(logger, 'info').mockImplementation(() => undefined);

    await Promise.all([emitOperationalAlert(outage), emitOperationalAlert(outage)]);
    await Promise.all([emitOperationalAlert(recovery), emitOperationalAlert(recovery)]);

    expect(outageError).toHaveBeenCalledTimes(1);
    expect(recoveryInfo).toHaveBeenCalledTimes(1);
    expect(recoveryInfo.mock.calls[0][1]).toMatchObject({
      type: 'database_recovered',
      outageStartedAt: outage.outageStartedAt,
      outageDurationMs: recovery.outageDurationMs,
      thresholdMs: outage.thresholdMs,
      consecutiveFailures: outage.consecutiveFailures,
    });
  });

  test('allows a new incident after the active lease expires', async () => {
    const redis = createRedisDouble();
    setSharedCacheRedisForTesting(redis as any);
    const incident = {
      phase: 'active' as const,
      incidentId: 'first',
      outageStartedAt: outage.outageStartedAt,
      thresholdMs: outage.thresholdMs,
      consecutiveFailures: outage.consecutiveFailures,
    };

    expect(await claimSharedOperationalIncident('database-availability', incident, 100))
      .toMatchObject({ status: 'acquired' });
    expect(await claimSharedOperationalIncident('database-availability', { ...incident, incidentId: 'duplicate' }, 100))
      .toMatchObject({ status: 'held' });
    redis.advance(100);
    expect(await claimSharedOperationalIncident('database-availability', { ...incident, incidentId: 'next' }, 100))
      .toMatchObject({ status: 'acquired' });
  });

  test('does not emit an unmatched recovery while a shared outage claim is racing', async () => {
    setSharedCacheRedisForTesting(createRedisDouble() as any);
    const recoveryInfo = vi.spyOn(logger, 'info').mockImplementation(() => undefined);

    await emitOperationalAlert(recovery);

    expect(recoveryInfo).not.toHaveBeenCalled();
  });

  test('fails open when the coordination store is unavailable', async () => {
    setSharedCacheRedisForTesting({
      get: async () => null,
      set: async () => 'OK',
      del: async () => 0,
      scan: async () => ['0', []],
      eval: async () => {
        throw new Error('simulated Redis outage');
      },
    } as any);

    await expect(claimSharedOperationalIncident('database-availability', { phase: 'active' }, 100))
      .resolves.toMatchObject({ status: 'unavailable' });
    await expect(resolveSharedOperationalIncident('database-availability', recovery.occurredAt, 100))
      .resolves.toMatchObject({ status: 'unavailable' });
  });
});