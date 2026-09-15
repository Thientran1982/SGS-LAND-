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

export interface LiveChatRunTimings {
  classifyMs?: number;
  memoryMs?: number;
  retrieveMs?: number;
  llmMs?: number;
  guardrailMs?: number;
  /** Database work before the durable agent starts (inbound interaction/lead lookup). */
  leadLookupDbMs?: number;
  inboundDbMs?: number;
  /** Conversation history read used to build the agent context. */
  historyDbMs?: number;
  /** Database work owned by durable execution (claim/checkpoints/lease/finalize). */
  agentExecutionDbMs?: number;
  /** Database write that persists the assistant interaction after execution. */
  outboundDbMs?: number;
  /** Kept for compatibility with existing aggregate consumers. */
  dbMs?: number;
  totalMs?: number;
  ttfbMs?: number;
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
  statusRateLimits: LiveChatStatusRateLimitSnapshot;
}

export type LiveChatRateLimitBackend = 'redis' | 'in-memory';
export type LiveChatRateLimitBackendSummary = LiveChatRateLimitBackend | 'mixed' | 'unknown';

export interface LiveChatStatusRateLimitSnapshot {
  endpoint: 'status_polling';
  environment: string;
  rateLimitName: string;
  windowMs: number;
  requestCount: number;
  limitedCount: number;
  limitedRatePercent: number;
  threshold: number;
  alertActive: boolean;
  lastRetryAfterSeconds: number | null;
  backend: LiveChatRateLimitBackendSummary;
  backendCounts: Record<LiveChatRateLimitBackend, number>;
  byTenant: Array<{
    tenantKey: string;
    requestCount: number;
    limitedCount: number;
    limitedRatePercent: number;
    threshold: number;
    alertActive: boolean;
    lastRetryAfterSeconds: number | null;
    backend: LiveChatRateLimitBackendSummary;
    backendCounts: Record<LiveChatRateLimitBackend, number>;
  }>;
}

export interface LiveChatTelemetryPersistenceState {
  version: 1;
  savedAt: number;
  databaseTimeoutAlertAt?: number;
  samples: Array<{
    key: string;
    tenantKey: string;
    at: number;
    acknowledgeMs?: number;
    finalReplyMs?: number;
  }>;
  databaseTimeouts: number[];
  slowEndpoints: Array<{
    endpoint: LiveChatTelemetryEndpoint;
    thresholdMs: number;
    lastDurationMs: number;
    lastAlertAt: number;
    eventTimes: number[];
  }>;
  statusRateLimitEvents?: Array<{
    tenantKey: string;
    at: number;
    limited: boolean;
    retryAfterSeconds?: number;
    backend: LiveChatRateLimitBackend;
  }>;
  statusRateLimitAlertAt?: number;
  statusRateLimitTenantAlerts?: Record<string, number>;
}

export interface LiveChatTelemetryPersistence {
  load: () => Promise<LiveChatTelemetryPersistenceState | null>;
  save: (state: LiveChatTelemetryPersistenceState) => Promise<void>;
}

export interface LiveChatTelemetryOptions {
  now?: () => number;
  windowMs?: number;
  historyThresholdMs?: number;
  messageThresholdMs?: number;
  databaseTimeoutWindowMs?: number;
  databaseTimeoutAlertThreshold?: number;
  statusRateLimitWindowMs?: number;
  statusRateLimitAlertThreshold?: number;
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

interface StatusRateLimitEvent {
  tenantKey: string;
  at: number;
  limited: boolean;
  retryAfterSeconds?: number;
  backend: LiveChatRateLimitBackend;
}

const DEFAULT_WINDOW_MS = 15 * 60_000;
const DEFAULT_HISTORY_THRESHOLD_MS = 1_500;
const DEFAULT_MESSAGE_THRESHOLD_MS = 1_500;
const DEFAULT_DATABASE_TIMEOUT_WINDOW_MS = 5 * 60_000;
const DEFAULT_DATABASE_TIMEOUT_ALERT_THRESHOLD = 3;
const DEFAULT_STATUS_RATE_LIMIT_WINDOW_MS = 5 * 60_000;
const DEFAULT_STATUS_RATE_LIMIT_ALERT_THRESHOLD = 10;
const ALERT_DEDUPE_MS = 60_000;
const PERSISTENCE_DEBOUNCE_MS = 1_000;
const PERSISTENCE_FAILURE_BACKOFF_MS = 30_000;
const MAX_PERSISTED_SAMPLES = 5_000;
const MAX_PERSISTED_EVENTS = 5_000;
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
  private readonly statusRateLimitWindowMs: number;
  private readonly statusRateLimitAlertThreshold: number;
  private readonly statusRateLimitEnvironment: string;
  private readonly statusRateLimitName = 'livechat_status';
  private readonly log: typeof logger;
  private readonly requests = new Map<string, RequestState>();
  private readonly samples: LatencySample[] = [];
  private readonly databaseTimeouts: number[] = [];
  private readonly slowEndpoints = new Map<LiveChatTelemetryEndpoint, SlowEndpointState>();
  private readonly statusRateLimitEvents: StatusRateLimitEvent[] = [];
  private databaseTimeoutAlertAt = Number.NEGATIVE_INFINITY;
  private statusRateLimitAlertAt = Number.NEGATIVE_INFINITY;
  private readonly statusRateLimitTenantAlerts = new Map<string, number>();
  private persistence: LiveChatTelemetryPersistence | null = null;
  private persistenceTimer: ReturnType<typeof setTimeout> | null = null;
  private persistenceInFlight = false;
  private persistencePromise: Promise<void> | null = null;
  private persistenceDirty = false;
  private persistenceBlockedUntil = 0;
  private hydrated = false;

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
    this.statusRateLimitWindowMs = positiveNumber(
      options.statusRateLimitWindowMs,
      envNumber('MINH_STATUS_RATE_LIMIT_WINDOW_MS', DEFAULT_STATUS_RATE_LIMIT_WINDOW_MS),
      1,
    );
    this.statusRateLimitAlertThreshold = positiveNumber(
      options.statusRateLimitAlertThreshold,
      envNumber('MINH_STATUS_RATE_LIMIT_ALERT_THRESHOLD', DEFAULT_STATUS_RATE_LIMIT_ALERT_THRESHOLD),
      1,
    );
    this.statusRateLimitEnvironment = ['production', 'development', 'test'].includes(process.env.NODE_ENV || '')
      ? process.env.NODE_ENV!
      : 'unknown';
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
    this.schedulePersistence();
  }

  configurePersistence(persistence: LiveChatTelemetryPersistence | null): void {
    this.persistence = persistence;
    this.hydrated = false;
  }

  async flushPersistenceNow(): Promise<void> {
    if (!this.persistence) return;
    if (this.persistenceTimer) {
      clearTimeout(this.persistenceTimer);
      this.persistenceTimer = null;
    }
    this.persistenceBlockedUntil = 0;
    if (this.persistenceInFlight) {
      await this.persistencePromise;
      return;
    }
    this.persistenceDirty = true;
    await this.flushPersistence();
  }

  async hydrateFromPersistence(): Promise<boolean> {
    if (!this.persistence || this.hydrated) return false;
    this.hydrated = true;
    try {
      const state = await this.persistence.load();
      if (!state || state.version !== 1) return false;

      const now = this.now();
      this.samples.splice(0, this.samples.length, ...state.samples
        .filter(sample => (
          typeof sample?.key === 'string'
          && typeof sample?.tenantKey === 'string'
          && Number.isFinite(sample?.at)
        ))
        .map(sample => ({
          key: sample.key,
          tenantKey: sample.tenantKey,
          at: Number(sample.at),
          acknowledgeMs: safeDuration(sample.acknowledgeMs),
          finalReplyMs: safeDuration(sample.finalReplyMs),
        })));
      this.databaseTimeouts.splice(0, this.databaseTimeouts.length, ...state.databaseTimeouts
        .filter(value => Number.isFinite(value))
        .map(Number));
      this.slowEndpoints.clear();
      for (const item of state.slowEndpoints || []) {
        if (!['history', 'message', 'ai'].includes(item?.endpoint)) continue;
        const eventTimes = (item.eventTimes || []).filter(value => Number.isFinite(value)).map(Number);
        this.slowEndpoints.set(item.endpoint, {
          thresholdMs: positiveNumber(item.thresholdMs, 0),
          count: eventTimes.length,
          lastDurationMs: safeDuration(item.lastDurationMs) || 0,
          lastAlertAt: Number.isFinite(item.lastAlertAt) ? Number(item.lastAlertAt) : Number.NEGATIVE_INFINITY,
          eventTimes,
        });
      }
      this.databaseTimeoutAlertAt = Number.isFinite(state.databaseTimeoutAlertAt)
        ? Number(state.databaseTimeoutAlertAt)
        : Number.NEGATIVE_INFINITY;
      this.statusRateLimitEvents.splice(0, this.statusRateLimitEvents.length, ...(state.statusRateLimitEvents || [])
        .filter(event => (
          typeof event?.tenantKey === 'string'
          && Number.isFinite(event?.at)
          && typeof event?.limited === 'boolean'
          && (event?.backend === 'redis' || event?.backend === 'in-memory')
        ))
        .map(event => ({
          tenantKey: event.tenantKey,
          at: Number(event.at),
          limited: event.limited,
          retryAfterSeconds: Number.isFinite(event.retryAfterSeconds)
            ? Math.max(0, Math.floor(Number(event.retryAfterSeconds)))
            : undefined,
          backend: event.backend,
        })));
      this.statusRateLimitAlertAt = Number.isFinite(state.statusRateLimitAlertAt)
        ? Number(state.statusRateLimitAlertAt)
        : Number.NEGATIVE_INFINITY;
      this.statusRateLimitTenantAlerts.clear();
      for (const [tenantKey, alertAt] of Object.entries(state.statusRateLimitTenantAlerts || {})) {
        if (typeof tenantKey === 'string' && Number.isFinite(alertAt)) {
          this.statusRateLimitTenantAlerts.set(tenantKey, Number(alertAt));
        }
      }
      this.prune(now);
      return true;
    } catch (error: any) {
      this.log.warn('[LiveChatTelemetry] persistence hydrate failed', {
        error: String(error?.message || error).slice(0, 200),
      });
      return false;
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

  recordRunTimings(params: {
    tenantId: string;
    runId?: string;
    leadId?: string;
    triggerSource?: string;
    timings: LiveChatRunTimings;
  }): void {
    const safeTimings: LiveChatRunTimings = {};
    for (const key of [
      'classifyMs',
      'memoryMs',
      'retrieveMs',
      'llmMs',
      'guardrailMs',
      'leadLookupDbMs',
      'inboundDbMs',
      'historyDbMs',
      'agentExecutionDbMs',
      'outboundDbMs',
      'dbMs',
      'totalMs',
      'ttfbMs',
    ] as const) {
      const duration = safeDuration(params.timings[key]);
      if (duration !== undefined) safeTimings[key] = duration;
    }
    this.log.info('[LiveChatTelemetry] run timings', {
      event: 'live_chat_run_timings',
      tenantKey: safeTenantKey(params.tenantId),
      runId: params.runId ? safeRequestKey(params.runId) : undefined,
      leadKey: params.leadId ? safeRequestKey(params.leadId) : undefined,
      triggerSource: params.triggerSource,
      ...safeTimings,
    });
  }

  recordStatusRateLimit(params: {
    tenantId: string;
    limited: boolean;
    retryAfterSeconds?: number;
    backend: LiveChatRateLimitBackend;
    rateLimitName?: string;
  }): void {
    const at = this.now();
    this.prune(at);
    const tenantKey = safeTenantKey(params.tenantId);
    const retryAfterSeconds = params.limited && Number.isFinite(params.retryAfterSeconds)
      ? Math.max(0, Math.floor(Number(params.retryAfterSeconds)))
      : undefined;
    this.statusRateLimitEvents.push({
      tenantKey,
      at,
      limited: params.limited,
      retryAfterSeconds,
      backend: params.backend,
    });
    this.statusRateLimitEvents.splice(0, Math.max(0, this.statusRateLimitEvents.length - MAX_PERSISTED_EVENTS));

    if (params.limited) {
      const tenantEvents = this.statusRateLimitEvents.filter(event => event.tenantKey === tenantKey);
      const limitedCount = tenantEvents.filter(event => event.limited).length;
      const globalLimitedCount = this.statusRateLimitEvents.filter(event => event.limited).length;
      const tenantAlertAt = this.statusRateLimitTenantAlerts.get(tenantKey) ?? Number.NEGATIVE_INFINITY;
      const alertScope = globalLimitedCount >= this.statusRateLimitAlertThreshold
        ? 'environment'
        : limitedCount >= this.statusRateLimitAlertThreshold
          ? 'tenant'
          : null;
      if (
        alertScope
        && at - (alertScope === 'environment' ? this.statusRateLimitAlertAt : tenantAlertAt) >= ALERT_DEDUPE_MS
      ) {
        if (alertScope === 'environment') this.statusRateLimitAlertAt = at;
        else this.statusRateLimitTenantAlerts.set(tenantKey, at);
        const snapshot = this.buildStatusRateLimitScope(
          alertScope === 'environment' ? this.statusRateLimitEvents : tenantEvents,
        );
        this.log.warn('[LiveChatTelemetry] status polling rate-limit threshold exceeded', {
          alert: 'live_chat_status_rate_limit_spike',
          scope: alertScope,
          environment: this.statusRateLimitEnvironment,
          tenantKey: alertScope === 'tenant' ? tenantKey : undefined,
          rateLimitName: params.rateLimitName || this.statusRateLimitName,
          windowMs: this.statusRateLimitWindowMs,
          count: snapshot.limitedCount,
          requestCount: snapshot.requestCount,
          limitedRatePercent: snapshot.limitedRatePercent,
          threshold: this.statusRateLimitAlertThreshold,
          retryAfterSeconds: snapshot.lastRetryAfterSeconds,
          backend: snapshot.backend,
        });
      }
    }
    this.schedulePersistence();
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
      statusRateLimits: this.getStatusRateLimitSnapshot(),
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
      if (this.checkSlowEndpoint(alertEndpoint, durationMs, at)) {
        this.schedulePersistence();
      }
    }
    if (stage === 'ack_sent' || stage === 'reply_sent') {
      this.recordSample(requestKey, state, at);
      this.schedulePersistence();
    }
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

  private exportPersistenceState(): LiveChatTelemetryPersistenceState {
    this.prune(this.now());
    const slowEndpoints = [...this.slowEndpoints.entries()].map(([endpoint, state]) => ({
      endpoint,
      thresholdMs: state.thresholdMs,
      lastDurationMs: state.lastDurationMs,
      lastAlertAt: state.lastAlertAt,
      eventTimes: state.eventTimes.slice(-MAX_PERSISTED_EVENTS),
    }));
    return {
      version: 1,
      savedAt: this.now(),
      databaseTimeoutAlertAt: this.databaseTimeoutAlertAt,
      samples: this.samples.slice(-MAX_PERSISTED_SAMPLES).map(sample => ({
        key: safeRequestKey(sample.key),
        tenantKey: sample.tenantKey,
        at: sample.at,
        ...(sample.acknowledgeMs === undefined ? {} : { acknowledgeMs: sample.acknowledgeMs }),
        ...(sample.finalReplyMs === undefined ? {} : { finalReplyMs: sample.finalReplyMs }),
      })),
      databaseTimeouts: this.databaseTimeouts.slice(-MAX_PERSISTED_EVENTS),
      slowEndpoints,
      statusRateLimitEvents: this.statusRateLimitEvents.slice(-MAX_PERSISTED_EVENTS),
      statusRateLimitAlertAt: this.statusRateLimitAlertAt,
      statusRateLimitTenantAlerts: Object.fromEntries(this.statusRateLimitTenantAlerts),
    };
  }

  private schedulePersistence(): void {
    if (!this.persistence) return;
    this.persistenceDirty = true;
    if (this.persistenceTimer || this.persistenceInFlight) return;
    const delayMs = Math.max(0, this.persistenceBlockedUntil - this.now());
    this.persistenceTimer = setTimeout(() => {
      this.persistenceTimer = null;
      void this.flushPersistence();
    }, Math.max(PERSISTENCE_DEBOUNCE_MS, delayMs));
    this.persistenceTimer.unref?.();
  }

  private async flushPersistence(): Promise<void> {
    if (!this.persistence || this.persistenceInFlight || !this.persistenceDirty) return;
    this.persistenceDirty = false;
    this.persistenceInFlight = true;
    const persistence = this.persistence;
    const savePromise = (async () => {
      try {
        await persistence.save(this.exportPersistenceState());
      } catch (error: any) {
        this.persistenceBlockedUntil = this.now() + PERSISTENCE_FAILURE_BACKOFF_MS;
        this.persistenceDirty = true;
        this.log.warn('[LiveChatTelemetry] persistence save failed', {
          error: String(error?.message || error).slice(0, 200),
        });
      } finally {
        this.persistenceInFlight = false;
        this.persistencePromise = null;
        if (this.persistenceDirty) this.schedulePersistence();
      }
    })();
    this.persistencePromise = savePromise;
    try {
      await savePromise;
    } catch {
      // The save task handles and logs its own error; this guard protects
      // callers such as graceful shutdown from a rejected persistence promise.
    }
  }

  private checkSlowEndpoint(endpoint: LiveChatTelemetryEndpoint, durationMs: number, at: number): boolean {
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
      return false;
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
    return true;
  }

  private getStatusRateLimitSnapshot(): LiveChatStatusRateLimitSnapshot {
    const events = this.statusRateLimitEvents;
    const scope = this.buildStatusRateLimitScope(events);
    const tenantKeys = [...new Set(events.map(event => event.tenantKey))];
    return {
      endpoint: 'status_polling',
      environment: this.statusRateLimitEnvironment,
      rateLimitName: this.statusRateLimitName,
      ...scope,
      byTenant: tenantKeys
        .map(tenantKey => ({
          tenantKey,
          ...this.buildStatusRateLimitScope(events.filter(event => event.tenantKey === tenantKey)),
        }))
        .sort((a, b) => b.limitedCount - a.limitedCount || b.requestCount - a.requestCount),
    };
  }

  private buildStatusRateLimitScope(
    events: StatusRateLimitEvent[],
  ): Omit<LiveChatStatusRateLimitSnapshot, 'endpoint' | 'environment' | 'rateLimitName' | 'byTenant'> {
    const limitedCount = events.filter(event => event.limited).length;
    const backendCounts: Record<LiveChatRateLimitBackend, number> = {
      redis: events.filter(event => event.backend === 'redis').length,
      'in-memory': events.filter(event => event.backend === 'in-memory').length,
    };
    const lastLimitedEvent = [...events].reverse().find(event => event.limited);
    const backendValues = (Object.keys(backendCounts) as LiveChatRateLimitBackend[])
      .filter(backend => backendCounts[backend] > 0);
    const backend: LiveChatRateLimitBackendSummary = backendValues.length === 0
      ? 'unknown'
      : backendValues.length === 1 ? backendValues[0] : 'mixed';
    return {
      windowMs: this.statusRateLimitWindowMs,
      requestCount: events.length,
      limitedCount,
      limitedRatePercent: events.length ? Math.round((limitedCount / events.length) * 10_000) / 100 : 0,
      threshold: this.statusRateLimitAlertThreshold,
      alertActive: limitedCount >= this.statusRateLimitAlertThreshold,
      lastRetryAfterSeconds: lastLimitedEvent?.retryAfterSeconds ?? null,
      backend,
      backendCounts,
    };
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
    while (
      this.statusRateLimitEvents.length
      && this.statusRateLimitEvents[0].at < at - this.statusRateLimitWindowMs
    ) {
      this.statusRateLimitEvents.shift();
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