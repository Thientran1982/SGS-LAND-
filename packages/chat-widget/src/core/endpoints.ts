/**
 * SGS chat endpoints - SINGLE SOURCE OF TRUTH.
 *
 * Truoc day widget Vite (CRM) va widget Next (landing) tu hardcode URL rieng,
 * nen khi backend doi route thi 1 ben chet am tham. Moi route o day PHAI khop
 * voi Express backend (server.ts + server/routes/landingAiRoutes.ts).
 */
export const CHAT_ENDPOINTS = {
  csrfToken: "/api/csrf-token",
  landingAiConsult: "/api/landing-ai/consult",
  publicCreateLead: "/api/public/leads",
  livechatMessage: "/api/public/livechat/message",
  livechatAttachments: "/api/public/livechat/attachments",
  livechatMessages: (leadId: string) => `/api/public/livechat/messages/${leadId}`,
  livechatCaptureLead: "/api/public/livechat/capture-lead",
  livechatEscalate: "/api/public/livechat/escalate",
  livechatBookViewing: "/api/public/livechat/book-viewing",
  minhReply: "/api/public/ai/livechat",
} as const;

/** Ten su kien socket.io ma liveChatEngine dang emit/lang nghe. */
export const CHAT_SOCKET_EVENTS = {
  joinRoom: "join_livechat_room",
  leaveRoom: "leave_room",
  sendMessage: "send_message",
  receiveMessage: "receive_message",
  aiModeChanged: "ai_mode_changed",
  newInboundMessage: "new_inbound_message",
} as const;

function envBase(): string {
  try {
    const p: any = typeof process !== "undefined" ? process.env : undefined;
    return (p && (p.NEXT_PUBLIC_API_BASE_URL || p.VITE_API_BASE_URL)) || "";
  } catch {
    return "";
  }
}

/** Base URL rong = same-origin (dev di qua proxy cua Vite/Next). */
export function resolveApiBase(explicit?: string): string {
  return String(explicit || envBase() || "").replace(/\/+$/, "");
}

export function apiUrl(path: string, base?: string): string {
  return `${resolveApiBase(base)}${path}`;
}
