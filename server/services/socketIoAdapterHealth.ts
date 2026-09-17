/**
 * Track Socket.IO adapter readiness without performing a network probe.
 *
 * Redis adapter health is based on both ioredis pub/sub clients. A Redis
 * adapter is only safe for cross-process room operations when both clients
 * are ready; otherwise callers must fail closed instead of silently falling
 * back to process-local delivery.
 */

export type SocketIoAdapterStatus = 'healthy' | 'degraded' | 'connecting';

export type SocketIoAdapterHealth = {
  adapter: 'redis' | 'in-memory';
  configured: boolean;
  status: SocketIoAdapterStatus;
  distributed: boolean;
  broadcastAvailable: boolean;
  publisherStatus: string;
  subscriberStatus: string;
  reason: string | null;
  lastTransitionAt: string;
  generation: number;
};

type RedisClientLike = {
  status?: string;
  on: (event: string, listener: (...args: unknown[]) => void) => unknown;
};

const initialHealth: SocketIoAdapterHealth = {
  adapter: 'in-memory',
  configured: false,
  status: 'healthy',
  distributed: false,
  broadcastAvailable: true,
  publisherStatus: 'in-memory',
  subscriberStatus: 'in-memory',
  reason: null,
  lastTransitionAt: new Date(0).toISOString(),
  generation: 0,
};

let health: SocketIoAdapterHealth = { ...initialHealth };
let redisClients: { publisher: RedisClientLike; subscriber: RedisClientLike } | null = null;

function transition(
  status: SocketIoAdapterStatus,
  reason: string | null,
  publisherStatus = health.publisherStatus,
  subscriberStatus = health.subscriberStatus,
): void {
  const distributed = health.configured && status === 'healthy';
  const broadcastAvailable = !health.configured || status === 'healthy';
  if (
    health.status === status
    && health.reason === reason
    && health.publisherStatus === publisherStatus
    && health.subscriberStatus === subscriberStatus
  ) {
    return;
  }

  health = {
    ...health,
    status,
    distributed,
    broadcastAvailable,
    publisherStatus,
    subscriberStatus,
    reason,
    lastTransitionAt: new Date().toISOString(),
    generation: health.generation + 1,
  };
}

export function markSocketIoAdapterInMemory(): void {
  redisClients = null;
  health = {
    ...initialHealth,
    generation: health.generation + 1,
    lastTransitionAt: new Date().toISOString(),
  };
}

export function markSocketIoAdapterConnecting(): void {
  health = {
    ...health,
    adapter: 'redis',
    configured: true,
    status: 'connecting',
    distributed: false,
    broadcastAvailable: false,
    reason: 'redis_connecting',
    generation: health.generation + 1,
    lastTransitionAt: new Date().toISOString(),
  };
}

export function markSocketIoAdapterReady(): void {
  if (!health.configured) return;
  const publisherStatus = redisClients?.publisher.status || 'unknown';
  const subscriberStatus = redisClients?.subscriber.status || 'unknown';
  if (publisherStatus === 'ready' && subscriberStatus === 'ready') {
    transition('healthy', null, publisherStatus, subscriberStatus);
  } else {
    transition('degraded', 'redis_not_ready', publisherStatus, subscriberStatus);
  }
}

export function noteSocketIoAdapterFailure(reason = 'redis_disconnected'): void {
  if (!health.configured) return;
  transition(
    'degraded',
    reason,
    redisClients?.publisher.status || 'unknown',
    redisClients?.subscriber.status || 'unknown',
  );
}

export function attachSocketIoAdapterHealth(
  publisher: RedisClientLike,
  subscriber: RedisClientLike,
): void {
  redisClients = { publisher, subscriber };
  health = {
    ...health,
    adapter: 'redis',
    configured: true,
    status: 'connecting',
    distributed: false,
    broadcastAvailable: false,
    reason: 'redis_connecting',
    generation: health.generation + 1,
    publisherStatus: publisher.status || 'unknown',
    subscriberStatus: subscriber.status || 'unknown',
  };

  const refresh = () => {
    const publisherStatus = publisher.status || 'unknown';
    const subscriberStatus = subscriber.status || 'unknown';
    if (publisherStatus === 'ready' && subscriberStatus === 'ready') {
      transition('healthy', null, publisherStatus, subscriberStatus);
    } else {
      transition('degraded', 'redis_not_ready', publisherStatus, subscriberStatus);
    }
  };

  for (const client of [publisher, subscriber]) {
    client.on('ready', refresh);
    client.on('connect', refresh);
    client.on('reconnecting', () => {
      transition('degraded', 'redis_reconnecting', publisher.status || 'unknown', subscriber.status || 'unknown');
    });
    client.on('close', () => {
      transition('degraded', 'redis_disconnected', publisher.status || 'unknown', subscriber.status || 'unknown');
    });
    client.on('end', () => {
      transition('degraded', 'redis_disconnected', publisher.status || 'unknown', subscriber.status || 'unknown');
    });
    client.on('error', () => {
      transition('degraded', 'redis_error', publisher.status || 'unknown', subscriber.status || 'unknown');
    });
  }

  refresh();
}

export function getSocketIoAdapterHealth(): SocketIoAdapterHealth {
  return { ...health };
}
