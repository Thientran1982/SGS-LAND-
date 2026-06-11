// @ts-nocheck
// ─── API Client — SGS LAND Next.js ────────────────────────
// Thin wrapper around fetch for both Server & Client Components

import type {
  Listing,
  Project,
  BankRate,
  MarketStats,
  Lead,
  DashboardStats,
  ListingsQueryParams,
  ChatMessage,
  ValuationRequest,
  ValuationResult,
  ApiResponse,
} from "@/types";

type NextFetchRequestConfig = {
  revalidate?: number | false;
  tags?: string[];
};

const BASE_URL =
  typeof window === "undefined"
    ? (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000")
    : ""; // Browser: use Next.js API rewrites (/api → backend)

// ─── Generic fetch helper ─────────────────────────────────
async function apiFetch<T>(
  path: string,
  options: RequestInit & { next?: NextFetchRequestConfig } = {}
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    credentials: "include",
    ...options,
  });

  if (!res.ok) {
    throw new Error(`API ${res.status}: ${path}`);
  }

  return res.json() as Promise<T>;
}

// ─── Public API ────────────────────────────────────────────
export const publicApi = {
  // Listings
  getListings: (params?: ListingsQueryParams) => {
    const qs = params
      ? "?" + new URLSearchParams(params as Record<string, string>).toString()
      : "";
    return apiFetch<ApiResponse<Listing[]>>(`/api/public/listings${qs}`, {
      next: { revalidate: 300 },
    });
  },

  getListing: (code: string) =>
    apiFetch<Listing>(`/api/public/listings/${code}`, { cache: "no-store" }),

  getSimilarListings: (code: string) =>
    apiFetch<Listing[]>(`/api/public/listings/${code}/similar`, {
      next: { revalidate: 300 },
    }),

  // Projects
  getProject: (code: string, options?: RequestInit) =>
    apiFetch<Project>(`/api/public/projects/${code}`, {
      next: { revalidate: 300 },
      ...options,
    }),

  // Market stats
  getMarketStats: () =>
    apiFetch<MarketStats>("/api/public/market-stats", {
      next: { revalidate: 3600 },
    }),

  // Bank rates
  getBankRates: () =>
    apiFetch<BankRate[]>("/api/public/bank-rates", {
      next: { revalidate: 86400 },
    }),
};

// ─── Auth API ──────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    apiFetch<{ token: string; user: { id: string; name: string; email: string; role: string } }>(
      "/api/auth/login",
      { method: "POST", body: JSON.stringify({ email, password }) }
    ),

  logout: () => apiFetch<{ success: boolean }>("/api/auth/logout", { method: "POST" }),

  me: () =>
    apiFetch<{ id: string; name: string; email: string; role: string }>(
      "/api/auth/me",
      { cache: "no-store" }
    ),
};

// ─── CRM API (private) ────────────────────────────────────
export const crmApi = {
  getLeads: (params?: Record<string, string | number>) => {
    const qs = params
      ? "?" + new URLSearchParams(params as Record<string, string>).toString()
      : "";
    return apiFetch<ApiResponse<Lead[]>>(`/api/leads${qs}`, { cache: "no-store" });
  },

  getLead: (id: string) =>
    apiFetch<Lead>(`/api/leads/${id}`, { cache: "no-store" }),

  createLead: (data: Omit<Lead, "id" | "created_at" | "updated_at">) =>
    apiFetch<Lead>("/api/leads", { method: "POST", body: JSON.stringify(data) }),

  updateLead: (id: string, data: Partial<Lead>) =>
    apiFetch<Lead>(`/api/leads/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  getListings: (params?: Record<string, string | number>) => {
    const qs = params
      ? "?" + new URLSearchParams(params as Record<string, string>).toString()
      : "";
    return apiFetch<ApiResponse<Listing[]>>(`/api/listings${qs}`, { cache: "no-store" });
  },

  getDashboard: () =>
    apiFetch<DashboardStats>("/api/analytics/dashboard", { cache: "no-store" }),
};

// ─── AI API ────────────────────────────────────────────────
export const aiApi = {
  chat: (message: string, history: ChatMessage[]) =>
    apiFetch<{ reply: string; intent?: string }>(
      "/api/ai/chat",
      { method: "POST", body: JSON.stringify({ message, history }) }
    ),

  valuation: (data: ValuationRequest) =>
    apiFetch<ValuationResult>(
      "/api/ai/valuation",
      { method: "POST", body: JSON.stringify(data) }
    ),
};
