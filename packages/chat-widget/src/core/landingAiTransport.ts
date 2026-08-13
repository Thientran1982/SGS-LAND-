import { CHAT_ENDPOINTS, apiUrl } from "./endpoints";
import { getCsrfToken } from "./csrf";
import { ChatSendInput, ChatTransport, ChatTransportError } from "./types";

export interface LandingAiTransportOptions {
  apiBase?: string;
  project?: string;
  historyLimit?: number;
  /** So lan thu lai khi backend tra 429 (het quota) hoac 503 (qua tai). */
  retryOnBusy?: number;
  visitorInfo?: () => Record<string, any>;
}

function defaultVisitorInfo() {
  return {
    pageUrl: typeof window !== "undefined" ? window.location.href : undefined,
    referrer: typeof document !== "undefined" ? document.referrer || undefined : undefined,
  };
}

/**
 * Transport cho landing page: POST /api/landing-ai/consult (Gemini one-shot,
 * server/routes/landingAiRoutes.ts). Server tra 429 AI_QUOTA_EXCEEDED /
 * 503 AI_UNAVAILABLE kem `retryAfter` -> thu lai 1 lan roi moi bao loi that.
 */
export function createLandingAiTransport(opts: LandingAiTransportOptions = {}): ChatTransport {
  const { apiBase, project = "sgs-land", historyLimit = 10, retryOnBusy = 1 } = opts;

  const call = async (input: ChatSendInput) => {
    const history = [...input.history, { id: "pending", role: "user" as const, content: input.text, ts: Date.now() }]
      .filter((m) => m.id !== "welcome")
      .slice(-historyLimit)
      .map((m) => ({ role: m.role, content: m.content }));

    const res = await fetch(apiUrl(CHAT_ENDPOINTS.landingAiConsult, apiBase), {
      method: "POST",
      credentials: "include",
      signal: input.signal,
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": await getCsrfToken(apiBase),
      },
      body: JSON.stringify({
        project,
        messages: history,
        visitorInfo: opts.visitorInfo ? opts.visitorInfo() : defaultVisitorInfo(),
      }),
    });
    const data: any = await res.json().catch(() => ({}));
    return { res, data };
  };

  return {
    name: "landing-ai",
    async send(input) {
      let { res, data } = await call(input);
      let attempts = 0;
      while ((res.status === 429 || res.status === 503) && attempts < retryOnBusy) {
        attempts += 1;
        const waitSec = Math.min(Math.max(Number(data?.retryAfter) || 8, 3), 15);
        await new Promise((r) => setTimeout(r, waitSec * 1000));
        ({ res, data } = await call(input));
      }
      if (!res.ok || data?.ok === false) {
        throw new ChatTransportError(data?.error || `HTTP ${res.status}`, {
          status: res.status,
          code: data?.code,
          retryAfter: Number(data?.retryAfter) || undefined,
        });
      }
      return { reply: data?.reply || "", raw: data };
    },
  };
}
