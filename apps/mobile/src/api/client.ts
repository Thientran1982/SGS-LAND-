// Tiny fetch wrapper. Keep zero deps — we don't need axios on mobile.
//
// The base URL is read from the EXPO_PUBLIC_API_BASE_URL env var (resolved at
// build time by Expo). Defaults to the production marketplace so a fresh
// `expo start` against a real device still talks to live data without
// configuration. For local dev against a Replit workspace, set:
//
//   EXPO_PUBLIC_API_BASE_URL=https://<your-repl>.replit.dev
//
// in `apps/mobile/.env` (or `.env.local`).
//
// Buyer auth (Task #52): when a JWT is present in secure storage we
// automatically attach `Authorization: Bearer <token>` so any logged-in
// request reaches the user-scoped endpoints. On 401 we clear the cached
// token and notify subscribers so the UI can prompt re-login.

import Constants from 'expo-constants';
import { clearBuyerToken, getBuyerToken } from '../storage/auth';

const FALLBACK_BASE_URL = 'https://sgsland.vn';

export function getApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (fromEnv && fromEnv.trim()) return fromEnv.replace(/\/+$/, '');
  // expo-constants exposes EAS-injected values too (extra.apiBaseUrl) — fall
  // back to that before hitting prod, so devs can override via app.config.
  const extra: unknown = Constants?.expoConfig?.extra;
  if (extra && typeof extra === 'object' && 'apiBaseUrl' in extra) {
    const candidate = (extra as { apiBaseUrl?: unknown }).apiBaseUrl;
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.replace(/\/+$/, '');
    }
  }
  return FALLBACK_BASE_URL;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean | undefined | null>;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Set to false to skip auto-attaching the buyer JWT (e.g. on the auth endpoints themselves). */
  auth?: boolean;
}

export class ApiError extends Error {
  status: number;
  payload: unknown;
  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

// ── Auth-failure subscribers ────────────────────────────────────────────────
// Components (e.g. AuthContext) can subscribe so they re-render the login UI
// when a token expires server-side mid-session.
type UnauthorizedListener = () => void;
const unauthorizedListeners = new Set<UnauthorizedListener>();
export function onApiUnauthorized(fn: UnauthorizedListener): () => void {
  unauthorizedListeners.add(fn);
  return () => unauthorizedListeners.delete(fn);
}
function notifyUnauthorized() {
  unauthorizedListeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* listener crash shouldn't poison the request flow */
    }
  });
}

export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {}, params, timeoutMs = 20_000, signal, auth = true } = opts;

  let url = `${getApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  if (params) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null || v === '') continue;
      sp.set(k, String(v));
    }
    const qs = sp.toString();
    if (qs) url += `?${qs}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  // Propagate caller's abort signal too (TanStack Query passes one on cancel).
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  // Inject buyer JWT when present and not explicitly disabled / pre-set.
  const finalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...headers,
  };
  if (auth && !finalHeaders.Authorization && !finalHeaders.authorization) {
    const token = await getBuyerToken();
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
  }

  try {
    const res = await fetch(url, {
      method,
      headers: finalHeaders,
      body: body && method !== 'GET' ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const ctype = res.headers.get('content-type') || '';
    const isJson = ctype.includes('application/json');
    const payload = isJson ? await res.json().catch(() => null) : await res.text();

    if (!res.ok) {
      // Auto-clear stale tokens on auth failure so the next request doesn't
      // re-send a known-bad credential. Only triggers for requests that did
      // attach a token (avoid clearing on intentional 401s like wrong OTP).
      if (res.status === 401 && auth && finalHeaders.Authorization) {
        await clearBuyerToken().catch(() => {});
        notifyUnauthorized();
      }
      let msg: string | null = null;
      if (isJson && payload && typeof payload === 'object' && 'error' in payload) {
        const errField = (payload as { error?: unknown }).error;
        if (errField != null) msg = String(errField);
      }
      throw new ApiError(msg || `Request failed (${res.status})`, res.status, payload);
    }

    return payload as T;
  } finally {
    clearTimeout(timer);
  }
}
