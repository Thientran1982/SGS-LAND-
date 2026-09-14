import { createHash } from 'node:crypto';
import { logger } from '../middleware/logger';

export type LiveChatTelemetryStage =
  | 'request_received'
  | 'inbound_persisted'
  | 'history_read'
  | 'provider_completed'
  | 'outbound_persisted'
  | 'ack_sent'
  | 'reply_sent';

export type LiveChatTelemetryEndpoint = 'history' | 'message' | 'ai';

export interface LiveChatClientTimings {
  inboundPersistMs?: number;
  historyReadMs?: number;
  providerRoundTripMs?: number;
  acknowledgeMs?: number;
  finalReplyMs?: number;
}

export interface LiveChatLatencySummary {
  count: number;
  p50Ms: number;
  p95Ms: number;
}

export interface LiveChatTenantMetrics {
  tenantKey: string;
  acknowledgeLatency: LiveChatLatencySummary;
  finalReplyLatency: LiveChatLatencySummary;
}

export interface LiveChatTelemetrySnapshot {
  windowMs: number;
  generatedAt: string;
  acknowledgeLatency: LiveChatLatencySummary;
  finalReplyLatency: LiveChatLatencySummary;
  byTenant: LiveChatTenantMetrics[];
  slowEndpointAlerts: {
    endpoint: LiveChatTelemetryEndpoint;
    thresholdMs: number;
    count: number;
    lastDurationMs: number;
  }[];
  databaseConnectionTimeouts: {
    windowMs: number;
    count: number;
    threshold: number;
    alertActive: boolean;
  };
}

export interface LiveChatTelemetryOptions {
  now?: () => number;
  windowMs?: number;
  historyThresholdMs?: number;
  messageThresholdMs?: number;
  databaseTimeoutWindowMs?: number;
  databaseTimeoutAlertThreshold?: number;
  log?: typeof logger;
}

interface RequestState {
  tenantKey: string;
  startedAt: number;
  stages: Map<LiveChatTelemetryStage, number>;
  lastStageAt: number;
  clientTimings?: LiveChatClientTimings;
  expiresAt: number;
}

interface LatencySample {
  key: string;
  tenantKey: string;
  at: number;
  acknowledgeMs?: number;
  finalReplyMs?: number;
}

interface SlowEndpointState {
  thresholdMs: number;
  count: number;
  lastDurationMs: number;
  lastAlertAt: number;
  eventTimes: number[];
}

const DEFAULT_WINDOW_MS = 15 * 60_000;
const DEFAULT_HISTORY_THRESHOLD_MS = 1_500;
const DEFAULT_MESSAGE_THRESHOLD_MS = 1_500;
const DEFAULT_DATABASE_TIMEOUT_WINDOW_MS = 5 * 60_000;
const DEFAULT_DATABASE_TIMEOUT_ALERT_THRESHOLD = 3;
const ALERT_DEDUPE_MS = 60_000;
let requestSequence = 0;

function positiveNumber(value: unknown, fallback: number, minimum = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= minimum ? Math.floor(parsed) : fallback;
}

function envNumber(name: string, fallback: number, minimum = 0): number {
  return positiveNumber(process.env[name], fallback, minimum);
}

function safeTenantKey(value: unknown): string {
  return createHash('sha256').update(String(value || 'unknown')).digest('hex').slice(0, 16);
}

function safeRequestKey(value: unknown): string {
  return createHash('sha256').update(String(value || 'anonymous')).digest('hex').slice(0, 20);
}

function safeDuration(value: unknown): number | undefined {
  const duration = Number(value);
  return Number.isFinite(duration) && duration >= 0 && duration <= 24 * 60 * 60_000
    ? Math.floor(duration)
    : undefined;
}

function percentile(values: number[], fraction: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * fraction;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return Math.round(sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower));
}

function summary(values: number[]): LiveChatLatencySummary {
  return {
    count: values.length,
    p50Ms: percentile(values, 0.5),
    p95Ms: percentile(values, 0.95),
  };
}

function parseClientTimings(value: unknown): LiveChatClientTimings | undefined {
  if (typeof value !== 'string' || value.length > 500) return undefined;
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined;
    const timings: LiveChatClientTimings = {};
    for (const key of [
      'inboundPersistMs',
      'historyReadMs',
      'providerRoundTripMs',
      'acknowledgeMs',
      'finalReplyMs',
    ] as const) {
      const duration = safeDuration((parsed as Record<string, unknown>)[key]);
      if (duration !== undefined) timings[key] = duration;
    }
    return Object.keys(timings).length ? timings : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Content-free live-chat timings. This intentionally keeps only bounded
 * durations and hashed correlation keys. It is process-local so telemetry
 * cannot make a database outage slower or create another tenant data store.
 */
export class LiveChatTelemetry {
  private readonly now: () => number;
  private readonly windowMs: number;
  private readonly historyThresholdMs: number;
  private readonly messageThresholdMs: number;
  private readonly databaseTimeoutWindowMs: number;
  private readonly databaseTimeoutAlertThreshold: number;
  private readonly log: typeof logger;
  private readonly requests = new Map<string, RequestState>();
  private readonly samples: LatencySample[] = [];
  private readonly databaseTimeouts: number[] = [];
  private readonly slowEndpoints = new Map<LiveChatTelemetryEndpoint, SlowEndpointState>();
  private databaseTimeoutAlertAt = Number.NEGATIVE_INFINITY;

  constructor(options: LiveChatTelemetryOptions = {}) {
    this.now = options.now || (() => Date.now());
    this.windowMs = positiveNumber(
      options.windowMs,
      envNumber('MINH_TELEMETRY_WINDOW_MS', DEFAULT_WINDOW_MS),
    );
    this.historyThresholdMs = positiveNumber(
      options.historyThresholdMs,
      envNumber('MINH_HISTORY_LATENCY_ALERT_MS', DEFAULT_HISTORY_THRESHOLD_MS),
    );
    this.messageThresholdMs = positiveNumber(
      options.messageThresholdMs,
      envNumber('MINH_MESSAGE_LATENCY_ALERT_MS', DEFAULT_MESSAGE_THRESHOLD_MS),
    );
    this.databaseTimeoutWindowMs = positiveNumber(
      options.databaseTimeoutWindowMs,
      envNumber('MINH_DB_TIMEOUT_WINDOW_MS', DEFAULT_DATABASE_TIMEOUT_WINDOW_MS),
    );
    this.databaseTimeoutAlertThreshold = positiveNumber(
      options.databaseTimeoutAlertThreshold,
      envNumber('MINH_DB_TIMEOUT_ALERT_THRESHOLD', DEFAULT_DATABASE_TIMEOUT_ALERT_THRESHOLD),
      1,
    );
    this.log = options.log || logger;
  }

  begin(params: {
    tenantId: string;
    requestId?: string;
    endpoint: LiveChatTelemetryEndpoint;
    at?: number;
  }): LiveChatTelemetrySpan {
    const at = params.at ?? this.now();
    const correlationKey = params.requestId
      ? String(params.requestId)
      : `${params.endpoint}:${at}:${++requestSequence}`;
    const requestKey = `${safeTenantKey(params.tenantId)}:${safeRequestKey(correlationKey)}`;
    let state = this.requests.get(requestKey);
    if (!state || state.expiresAt <= at) {
      state = {
        tenantKey: safeTenantKey(params.tenantId),
        startedAt: at,
        stages: new Map(),
        lastStageAt: at,
        expiresAt: at + this.windowMs,
      };
      this.requests.set(requestKey, state);
    }
    const span = new LiveChatTelemetrySpan(this, requestKey, state, params.endpoint);
    span.mark('request_received', at);
    return span;
  }

  recordStage(params: {
    tenantId: string;
    requestId?: string;
    endpoint: LiveChatTelemetryEndpoint;
    stage: LiveChatTelemetryStage;
    at?: number;
    durationMs?: number;
  }): void {
    const span = this.begin(params);
    span.mark(params.stage, params.at, params.durationMs);
  }

  recordDatabaseConnectionTimeout(): void {
    const now = this.now();
    this.prune(now);
    this.databaseTimeouts.push(now);
    const count = this.databaseTimeouts.length;
    if (
      count >= this.databaseTimeoutAlertThreshold &&
      now - this.databaseTimeoutAlertAt >= ALERT_DEDUPE_MS
    ) {
      this.databaseTimeoutAlertAt = now;
      this.log.warn('[LiveChatTelemetry] database connection timeout threshold exceeded', {
        alert: 'database_connection_timeout_spike',
        windowMs: this.databaseTimeoutWindowMs,
        count,
        threshold: this.databaseTimeoutAlertThreshold,
      });
    }
  }

  recordClientTimings(params: {
    tenantId: string;
    requestId?: string;
    endpoint?: LiveChatTelemetryEndpoint;
    value?: unknown;
  }): void {
    const parsed = parseClientTimings(params.value);
    if (!parsed) return;
    const span = this.begin({
      tenantId: params.tenantId,
      requestId: params.requestId,
      endpoint: params.endpoint || 'ai',
    });
    span.setClientTimings(parsed);
  }

  getSnapshot(at = this.now()): LiveChatTelemetrySnapshot {
    this.prune(at);
    const acknowledge = this.samples
      .map(sample => sample.acknowledgeMs)
      .filter((value): value is number => value !== undefined);
    const finalReply = this.samples
      .map(sample => sample.finalReplyMs)
      .filter((value): value is number => value !== undefined);
    const byTenant = new Map<string, { acknowledge: number[]; finalReply: number[] }>();
    for (const sample of this.samples) {
      const entry = byTenant.get(sample.tenantKey) || { acknowledge: [], finalReply: [] };
      if (sample.acknowledgeMs !== undefined) entry.acknowledge.push(sample.acknowledgeMs);
      if (sample.finalReplyMs !== undefined) entry.finalReply.push(sample.finalReplyMs);
      byTenant.set(sample.tenantKey, entry);
    }
    const slowEndpointAlerts = [...this.slowEndpoints.entries()]
      .filter(([, state]) => state.count > 0)
      .map(([endpoint, state]) => ({
        endpoint,
        thresholdMs: state.thresholdMs,
        count: state.count,
        lastDurationMs: state.lastDurationMs,
      }));
    return {
      windowMs: this.windowMs,
      generatedAt: new Date(at).toISOString(),
      acknowledgeLatency: summary(acknowledge),
      finalReplyLatency: summary(finalReply),
      byTenant: [...byTenant.entries()].map(([tenantKey, values]) => ({
        tenantKey,
        acknowledgeLatency: summary(values.acknowledge),
        finalReplyLatency: summary(values.finalReply),
      })),
      slowEndpointAlerts,
      databaseConnectionTimeouts: {
        windowMs: this.databaseTimeoutWindowMs,
        count: this.databaseTimeouts.length,
        threshold: this.databaseTimeoutAlertThreshold,
        alertActive: this.databaseTimeouts.length >= this.databaseTimeoutAlertThreshold,
      },
    };
  }

  markInternal(
    requestKey: string,
    state: RequestState,
    endpoint: LiveChatTelemetryEndpoint,
    stage: LiveChatTelemetryStage,
    at = this.now(),
    explicitDurationMs?: number,
  ): void {
    const durationMs = safeDuration(explicitDurationMs) ?? Math.max(0, at - state.startedAt);
    const stageDurationMs = Math.max(0, at - state.lastStageAt);
    state.stages.set(stage, at);
    state.lastStageAt = at;
    state.expiresAt = at + this.windowMs;

    this.log.info('[LiveChatTelemetry] stage', {
      event: 'live_chat_stage',
      stage,
      endpoint,
      tenantKey: state.tenantKey,
      requestKey: safeRequestKey(requestKey),
      occurredAt: new Date(at).toISOString(),
      durationMs,
      stageDurationMs,
    });

    if (stage === 'history_read' || stage === 'inbound_persisted') {
      const alertEndpoint: LiveChatTelemetryEndpoint =
        stage === 'history_read' ? 'history' : 'message';
      this.checkSlowEndpoint(alertEndpoint, durationMs, at);
    }
    if (stage === 'ack_sent' || stage === 'reply_sent') this.recordSample(requestKey, state, at);
  }

  setClientTimingsInternal(requestKey: string, state: RequestState, timings: LiveChatClientTimings): void {
    const safeTimings: LiveChatClientTimings = {};
    for (const key of [
      'inboundPersistMs',
      'historyReadMs',
      'providerRoundTripMs',
      'acknowledgeMs',
      'finalReplyMs',
    ] as const) {
      const duration = safeDuration(timings[key]);
      if (duration !== undefined) safeTimings[key] = duration;
    }
    if (!Object.keys(safeTimings).length) return;
    state.clientTimings = safeTimings;
    this.log.info('[LiveChatTelemetry] client timings', {
      event: 'live_chat_client_timings',
      tenantKey: state.tenantKey,
      requestKey: safeRequestKey(requestKey),
      ...safeTimings,
    });
  }

  private recordSample(requestKey: string, state: RequestState, at: number): void {
    const acknowledgeAt = state.stages.get('ack_sent');
    const replyAt = state.stages.get('reply_sent');
    const sample: LatencySample = {
      key: requestKey,
      tenantKey: state.tenantKey,
      at,
      acknowledgeMs: acknowledgeAt === undefined ? undefined : Math.max(0, acknowledgeAt - state.startedAt),
      finalReplyMs: replyAt === undefined ? undefined : Math.max(0, replyAt - state.startedAt),
    };
    const existing = this.samples.findIndex(item => item.key === sample.key);
    if (existing >= 0) this.samples[existing] = { ...this.samples[existing], ...sample };
    else this.samples.push({ ...sample, at: state.startedAt });
  }

  private checkSlowEndpoint(endpoint: LiveChatTelemetryEndpoint, durationMs: number, at: number): void {
    const thresholdMs = endpoint === 'history' ? this.historyThresholdMs : this.messageThresholdMs;
    const state = this.slowEndpoints.get(endpoint) || {
      thresholdMs,
      count: 0,
      lastDurationMs: 0,
      lastAlertAt: Number.NEGATIVE_INFINITY,
      eventTimes: [],
    };
    state.thresholdMs = thresholdMs;
    state.lastDurationMs = durationMs;
    if (durationMs < thresholdMs) {
      this.slowEndpoints.set(endpoint, state);
      return;
    }
    state.eventTimes.push(at);
    state.count = state.eventTimes.length;
    if (at - state.lastAlertAt >= ALERT_DEDUPE_MS) {
      state.lastAlertAt = at;
      this.log.warn('[LiveChatTelemetry] endpoint latency threshold exceeded', {
        alert: 'live_chat_endpoint_latency',
        endpoint,
        durationMs,
        thresholdMs,
        count: state.count,
      });
    }
    this.slowEndpoints.set(endpoint, state);
  }

  private prune(at: number): void {
    const cutoff = at - this.windowMs;
    while (this.samples.length && this.samples[0].at < cutoff) this.samples.shift();
    while (this.databaseTimeouts.length && this.databaseTimeouts[0] < at - this.databaseTimeoutWindowMs) {
      this.databaseTimeouts.shift();
    }
    for (const state of this.slowEndpoints.values()) {
      while (state.eventTimes.length && state.eventTimes[0] < at - this.windowMs) state.eventTimes.shift();
      state.count = state.eventTimes.length;
    }
    for (const [key, state] of this.requests) {
      if (state.expiresAt < at) this.requests.delete(key);
    }
  }
}

export class LiveChatTelemetrySpan {
  constructor(
    private readonly telemetry: LiveChatTelemetry,
    private readonly requestKey: string,
    private readonly state: RequestState,
    private readonly endpoint: LiveChatTelemetryEndpoint,
  ) {}

  mark(stage: LiveChatTelemetryStage, at?: number, durationMs?: number): void {
    this.telemetry.markInternal(this.requestKey, this.state, this.endpoint, stage, at, durationMs);
  }

  setClientTimings(timings: LiveChatClientTimings): void {
    this.telemetry.setClientTimingsInternal(this.requestKey, this.state, timings);
  }
}

export function isDatabaseConnectionTimeout(error: unknown): boolean {
  const candidate = error as { code?: unknown; message?: unknown };
  if (candidate?.code === 'ETIMEDOUT') return true;
  const message = String(candidate?.message || error || '').toLowerCase();
  return (
    message.includes('timeout exceeded when trying to connect') ||
    message.includes('connection timeout') ||
    message.includes('database probe timed out') ||
    message.includes('timeout expired while connecting')
  );
}

export const liveChatTelemetry = new LiveChatTelemetry();