import { CHAT_ENDPOINTS, apiUrl } from "./endpoints";

/**
 * Express bao ve POST route bang double-submit CSRF (cookie `csrf_token`
 * + header `X-CSRF-Token`). Doc tu cookie, neu chua co thi mint qua route
 * duoc mien CSRF.
 */
export async function getCsrfToken(apiBase?: string): Promise<string> {
  const fromCookie = () => {
    if (typeof document === "undefined") return "";
    const m = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : "";
  };
  const existing = fromCookie();
  if (existing) return existing;
  try {
    const r = await fetch(apiUrl(CHAT_ENDPOINTS.csrfToken, apiBase), { credentials: "include" });
    const j = await r.json().catch(() => ({} as any));
    return j?.csrfToken || fromCookie();
  } catch {
    return fromCookie();
  }
}
