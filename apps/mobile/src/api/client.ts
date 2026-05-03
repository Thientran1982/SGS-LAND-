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

import Constants from 'expo-constants';

const FALLBACK_BASE_URL = 'https://sgsland.vn';

export function getApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (fromEnv && fromEnv.trim()) return fromEnv.replace(/\/+$/, '');
  // expo-constants exposes EAS-injected values too (extra.apiBaseUrl) — fall
  // back to that before hitting prod, so devs can override via app.config.
  const fromExtra = (Constants?.expoConfig?.extra as any)?.apiBaseUrl;
  if (typeof fromExtra === 'string' && fromExtra.trim()) {
    return fromExtra.replace(/\/+$/, '');
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

export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {}, params, timeoutMs = 20_000, signal } = opts;

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

  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...headers,
      },
      body: body && method !== 'GET' ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const ctype = res.headers.get('content-type') || '';
    const isJson = ctype.includes('application/json');
    const payload = isJson ? await res.json().catch(() => null) : await res.text();

    if (!res.ok) {
      const msg =
        (isJson && payload && typeof payload === 'object' && 'error' in payload
          ? String((payload as any).error)
          : null) || `Request failed (${res.status})`;
      throw new ApiError(msg, res.status, payload);
    }

    return payload as T;
  } finally {
    clearTimeout(timer);
  }
}
