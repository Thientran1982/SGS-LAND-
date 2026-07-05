"use client";

import { getOrCreateVisitorId } from "./visitorId";

// Tuan thu Nghi dinh 13/2023/ND-CP va Luat 91/2025/QH15: mac dinh KHONG thu thap
// hanh vi neu khach chua dong y (opt-in), ESSENTIAL luon bat va khong the tat.
export type ConsentCategory = "ESSENTIAL" | "BEHAVIORAL" | "ADVERTISING";

export interface ConsentState {
  ESSENTIAL: boolean;
  BEHAVIORAL: boolean;
  ADVERTISING: boolean;
}

const STORAGE_KEY = "sgs_consent_v1";
const CONSENT_VERSION = "1.0";
export const CONSENT_EVENT = "sgs-consent-changed";

const DEFAULT_STATE: ConsentState = {
  ESSENTIAL: true,
  BEHAVIORAL: false,
  ADVERTISING: false,
};

export function getStoredConsent(): ConsentState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    return {
      ESSENTIAL: true,
      BEHAVIORAL: !!parsed.BEHAVIORAL,
      ADVERTISING: !!parsed.ADVERTISING,
    };
  } catch {
    return null;
  }
}

export function hasAnsweredConsent(): boolean {
  return getStoredConsent() !== null;
}

async function postConsent(category: ConsentCategory, granted: boolean, visitorId: string): Promise<void> {
  try {
    await fetch("/api/public/visitor/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        visitorId,
        category,
        granted,
        consentVersion: CONSENT_VERSION,
      }),
      keepalive: true,
    });
  } catch {
    // Ghi consent len server la best-effort; localStorage van la nguon su that cho UI.
  }
}

export async function saveConsent(next: Partial<Omit<ConsentState, "ESSENTIAL">>): Promise<ConsentState> {
  const merged: ConsentState = {
    ...DEFAULT_STATE,
    ...(getStoredConsent() ?? {}),
    ...next,
    ESSENTIAL: true,
  };

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch {
      // bo qua loi quota / che do an danh cua trinh duyet
    }
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: merged }));
  }

  const visitorId = getOrCreateVisitorId();
  if (visitorId) {
    // Luu vet append-only tung danh muc de co audit trail day du (khong ghi de).
    await Promise.all([
      postConsent("ESSENTIAL", true, visitorId),
      postConsent("BEHAVIORAL", merged.BEHAVIORAL, visitorId),
      postConsent("ADVERTISING", merged.ADVERTISING, visitorId),
    ]);
  }

  return merged;
}

export function acceptAll(): Promise<ConsentState> {
  return saveConsent({ BEHAVIORAL: true, ADVERTISING: true });
}

export function rejectNonEssential(): Promise<ConsentState> {
  return saveConsent({ BEHAVIORAL: false, ADVERTISING: false });
}
