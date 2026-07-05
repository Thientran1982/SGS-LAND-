"use client";

import { getOrCreateVisitorId } from "./visitorId";
import { getStoredConsent } from "./consent";

// Chi ghi nhan hanh vi khi khach da dong y BEHAVIORAL cookie (opt-in that su).
// Endpoint /api/public/visitor/track o server cung tu kiem tra lai consent nay,
// day la lop chan o client de tranh goi mang khong can thiet.
const SESSION_KEY = "sgs_session_id";

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const created = `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.sessionStorage.setItem(SESSION_KEY, created);
    return created;
  } catch {
    return `s-${Date.now()}`;
  }
}

function hasBehavioralConsent(): boolean {
  const consent = getStoredConsent();
  return !!consent?.BEHAVIORAL;
}

interface TrackOptions {
  page?: string;
  pageLabel?: string;
  metadata?: Record<string, unknown>;
}

export function trackEvent(eventType: string, options: TrackOptions = {}): void {
  if (typeof window === "undefined") return;
  if (!hasBehavioralConsent()) return;

  const visitorId = getOrCreateVisitorId();
  if (!visitorId) return;

  const payload = {
    visitorId,
    sessionId: getOrCreateSessionId(),
    eventType,
    page: options.page ?? window.location.pathname,
    pageLabel: options.pageLabel,
    referrer: typeof document !== "undefined" ? document.referrer || undefined : undefined,
    metadata: options.metadata,
  };

  try {
    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      const ok = navigator.sendBeacon("/api/public/visitor/track", blob);
      if (ok) return;
    }
    fetch("/api/public/visitor/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Theo doi hanh vi la best-effort, khong duoc lam hong trai nghiem nguoi dung.
  }
}

export function trackPropertyView(listingCode: string | undefined | null, pageLabel?: string): void {
  if (!listingCode) return;
  trackEvent("property_view", { pageLabel, metadata: { listingCode } });
}

export function trackPageView(pageLabel?: string): void {
  trackEvent("pageview", { pageLabel });
}
