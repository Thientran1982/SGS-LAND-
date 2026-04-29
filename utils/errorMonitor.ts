/**
 * Error Monitor — Frontend error capture service
 * Bắt tất cả lỗi JavaScript chưa được xử lý và báo cáo về server.
 * Hoạt động ngầm, không ảnh hưởng UX người dùng.
 */

interface ErrorReport {
  type: 'frontend' | 'unhandled_promise' | 'chunk_load';
  severity: 'error' | 'warning' | 'critical';
  message: string;
  stack?: string;
  component?: string;
  path?: string;
  metadata?: Record<string, any>;
}

const ENDPOINT = '/api/error-logs';
const MAX_QUEUE = 20;
// Short debounce so the first crash gets reported quickly. Critically, if a
// crash triggers a page reload (chunk failures, blank-screen recovery, etc.)
// the error is lost unless we flush before unload — see the `pagehide`
// listener below which uses `navigator.sendBeacon` for guaranteed delivery.
const DEBOUNCE_MS = 500;
const DEDUP_WINDOW_MS = 30_000;

// Deduplicate: track last-seen messages to avoid flooding same error
const _seen = new Map<string, number>();
let _queue: ErrorReport[] = [];
let _flushTimer: ReturnType<typeof setTimeout> | null = null;

function dedupKey(msg: string, path?: string) {
  return `${path ?? ''}::${msg.slice(0, 120)}`;
}

function shouldSkip(report: ErrorReport): boolean {
  const key = dedupKey(report.message, report.path);
  const now = Date.now();
  const last = _seen.get(key);
  if (last && now - last < DEDUP_WINDOW_MS) return true;
  _seen.set(key, now);
  if (_seen.size > 200) {
    // Prune oldest entries
    const oldest = [..._seen.entries()].sort((a, b) => a[1] - b[1]).slice(0, 100);
    oldest.forEach(([k]) => _seen.delete(k));
  }
  return false;
}

function scheduleFlush() {
  if (_flushTimer) return;
  _flushTimer = setTimeout(flush, DEBOUNCE_MS);
}

function buildPayload(report: ErrorReport) {
  return JSON.stringify({
    ...report,
    path: report.path ?? window.location.pathname,
  });
}

// Best-effort delivery during page unload. `sendBeacon` is queued by the
// browser even after the document is destroyed, so it survives a reload
// triggered by the very crash we're trying to report.
function sendBeacon(report: ErrorReport): boolean {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') return false;
    const blob = new Blob([buildPayload(report)], { type: 'application/json' });
    return navigator.sendBeacon(ENDPOINT, blob);
  } catch {
    return false;
  }
}

async function flush() {
  _flushTimer = null;
  if (_queue.length === 0) return;
  const batch = _queue.splice(0, MAX_QUEUE);

  for (const report of batch) {
    try {
      await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: buildPayload(report),
        credentials: 'include',
        // `keepalive` lets the request survive a page navigation/reload that
        // happens immediately after the error (e.g. ChunkLoadError → reload).
        keepalive: true,
      });
    } catch {
      // Network error — silently discard, don't retry to avoid loops
    }
  }
}

// Synchronous, fire-and-forget flush used during `pagehide`/`beforeunload`.
// Uses `sendBeacon` first (most reliable during unload), falls back to a
// keepalive fetch if beacon refused (e.g. payload too large).
// Exported as `flushErrorsSync` so chunk-reload paths can guarantee
// delivery of the failing error report just before triggering a reload.
export function flushErrorsSync() {
  flushSync();
}

function flushSync() {
  if (_flushTimer) {
    clearTimeout(_flushTimer);
    _flushTimer = null;
  }
  if (_queue.length === 0) return;
  const batch = _queue.splice(0, MAX_QUEUE);
  for (const report of batch) {
    if (sendBeacon(report)) continue;
    try {
      // Best-effort fallback. Cannot await — page is unloading.
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: buildPayload(report),
        credentials: 'include',
        keepalive: true,
      }).catch(() => {});
    } catch {
      // ignore
    }
  }
}

export function captureError(report: ErrorReport) {
  if (shouldSkip(report)) return;
  if (_queue.length >= MAX_QUEUE) return;
  _queue.push(report);
  scheduleFlush();
}

export function captureException(error: unknown, context?: { component?: string; metadata?: Record<string, any> }) {
  const err = error instanceof Error ? error : new Error(String(error));

  const isChunk =
    err.message.includes('Failed to fetch dynamically imported module') ||
    err.message.includes('Importing a module script failed') ||
    err.message.includes('dynamically imported module') ||
    (err as any).name === 'ChunkLoadError';

  captureError({
    type: isChunk ? 'chunk_load' : 'frontend',
    severity: isChunk ? 'warning' : 'error',
    message: err.message,
    stack: err.stack,
    component: context?.component,
    metadata: context?.metadata,
  });
}

let _initialized = false;

export function initErrorMonitor() {
  if (_initialized || typeof window === 'undefined') return;
  _initialized = true;

  // Bắt lỗi JavaScript toàn cục
  window.addEventListener('error', (event) => {
    if (!event.error && !event.message) return;
    captureException(event.error ?? new Error(event.message), {
      metadata: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    });
  });

  // Bắt Promise bị từ chối chưa xử lý
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg =
      reason instanceof Error
        ? reason.message
        : typeof reason === 'string'
        ? reason
        : JSON.stringify(reason);

    captureError({
      type: 'unhandled_promise',
      severity: 'error',
      message: `Unhandled Promise Rejection: ${msg}`,
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  });

  // Flush any queued errors on unload. `pagehide` fires more reliably than
  // `beforeunload` on mobile and during back/forward navigation. This is
  // essential for catching the "table renders → blank page" bug, where a
  // chunk-load reload happens within the debounce window and would otherwise
  // drop the report before it reaches the server.
  window.addEventListener('pagehide', flushSync);
  window.addEventListener('beforeunload', flushSync);
}
