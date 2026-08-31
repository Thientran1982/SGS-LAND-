import { CHAT_ENDPOINTS, apiUrl } from "./endpoints";
import { ChatTransport, ChatTransportError } from "./types";
import { getCsrfToken } from "./csrf";

async function postJson<T>(path: string, body: any, apiBase?: string, errCode = "request_failed"): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), path === CHAT_ENDPOINTS.minhReply ? 90000 : 30000);
  let res: Response;
  try {
    res = await fetch(apiUrl(path, apiBase), {
      method: "POST",
      credentials: "include",
      signal: controller.signal,
      headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": await getCsrfToken(apiBase),
        },
      body: JSON.stringify(body),
    });
  } finally {
    clearTimeout(timeoutId);
  }
  if (!res.ok) {
    throw new ChatTransportError(errCode, { status: res.status });
  }
  return (await res.json()) as T;
}

function createClientRequestId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {}
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Client REST cho agent Minh (LangGraph) qua cac route public cua Express:
 * server.ts mount /api/public/leads, /api/public/livechat/*, /api/public/ai/livechat.
 * Realtime di kem qua socket.io (xem CHAT_SOCKET_EVENTS).
 */
export function createMinhClient(apiBase?: string) {
  return {
    createLead(name: string, phone: string, source = "WIDGET") {
      return postJson<{ id: string; success: boolean }>(
        CHAT_ENDPOINTS.publicCreateLead,
        { name, phone, source, stage: "NEW" },
        apiBase,
        "create_lead_failed",
      );
    },
    async sendMessage(
      leadId: string,
      content: string,
      direction: "INBOUND" | "OUTBOUND" = "INBOUND",
      metadata?: object,
      idempotencyKey?: string,
    ) {
      const data = await postJson<{ message: any }>(
        CHAT_ENDPOINTS.livechatMessage,
        { leadId, content, direction, metadata: metadata || {}, idempotencyKey },
        apiBase,
        "send_failed",
      );
      return data.message;
    },
    async getMessages(leadId: string) {
      const res = await fetch(apiUrl(CHAT_ENDPOINTS.livechatMessages(leadId), apiBase), { credentials: "include", cache: "no-store" });
      if (!res.ok) return null;
      return res.json();
    },
    captureLead(leadId: string | null, data: { name: string; phone: string; notes?: string }) {
      return postJson<{ id: string; score: number; success: boolean }>(
        CHAT_ENDPOINTS.livechatCaptureLead,
        { leadId, ...data },
        apiBase,
        "capture_failed",
      );
    },
    async escalate(leadId: string, reason: string, priority: "normal" | "high" | "urgent" = "normal") {
      const res = await fetch(apiUrl(CHAT_ENDPOINTS.livechatEscalate, apiBase), {
        method: "POST",
        credentials: "include",
        headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": await getCsrfToken(apiBase),
      },
        body: JSON.stringify({ leadId, reason, priority }),
      });
      return res.ok;
    },
    bookViewing(leadId: string, dateText: string, notes?: string) {
      return postJson<{ viewingId: string; scheduledAt: string; success: boolean }>(
        CHAT_ENDPOINTS.livechatBookViewing,
        { leadId, dateText, notes },
        apiBase,
        "book_failed",
      );
    },
    /** POST /api/public/ai/livechat -> { reply, artifact?, suggestedAction?, noReply? } */
    ask(leadId: string, message: string, lang?: string, inboundInteractionId?: string) {
      return postJson<any>(
        CHAT_ENDPOINTS.minhReply,
        { leadId, message, lang, inboundInteractionId },
        apiBase,
        "ai_failed",
      );
    },
  };
}

export type MinhClient = ReturnType<typeof createMinhClient>;

/** Bao MinhClient thanh ChatTransport de dung chung 1 component UI. */
export function createMinhTransport(getLeadId: () => string | null, apiBase?: string): ChatTransport {
  const client = createMinhClient(apiBase);
  return {
    name: "minh",
    async send(input) {
      const leadId = getLeadId();
      if (!leadId) throw new ChatTransportError("missing_lead_id", { code: "NO_LEAD" });
      const requestId = createClientRequestId();
      const inbound = await client.sendMessage(leadId, input.text, "INBOUND", {}, requestId);
      const data = await client.ask(leadId, input.text, input.lang, inbound?.id);
      const reply = typeof data?.reply === "string" ? data.reply : data?.reply?.content || "";
      return { reply, raw: data };
    },
  };
}

export { createClientRequestId };
