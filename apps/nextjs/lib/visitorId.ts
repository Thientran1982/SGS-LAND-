"use client";

// Sinh/doc visitorId an danh, luu trong localStorage, dung chung cho tracking + consent.
const VISITOR_ID_KEY = "sgs_visitor_id";

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `v-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getOrCreateVisitorId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(VISITOR_ID_KEY);
    if (existing) return existing;
    const created = randomId();
    window.localStorage.setItem(VISITOR_ID_KEY, created);
    return created;
  } catch {
    return randomId();
  }
}
