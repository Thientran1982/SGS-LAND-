/**
 * Phien chat voi agent Minh (CRM lead + socket.io + human takeover).
 *
 * Luong chuan (giong pages/LiveChat.tsx cua app Vite dang chay production):
 *   1. POST /api/public/leads             -> tao lead trong CRM (name + phone bat buoc)
 *   2. POST /api/public/livechat/message  -> luu tin nhan INBOUND cua khach
 *   3. POST /api/public/ai/livechat       -> agent Minh tra loi; { noReply: true } khi
 *                                            thread_status = HUMAN_TAKEOVER
 *   4. socket.io join_livechat_room(leadId) -> nhan receive_message + ai_mode_changed
 */
import { CHAT_SOCKET_EVENTS } from "./endpoints";
import { ChatTransportError } from "./types";
import type { ChatMessage, ChatTransport } from "./types";
import { createClientRequestId, createMinhClient } from "./minhTransport";

export const MINH_LEAD_STORAGE_KEY = "livechat_lead_id";
export const MINH_NAME_STORAGE_KEY = "livechat_lead_name";

export type MinhThreadStatus = "AI_ACTIVE" | "HUMAN_TAKEOVER";

export interface MinhSessionOptions {
  apiBase?: string;
  /** LINK | EMBED | QR | WEB | WIDGET - de CRM biet khach den tu dau. */
  source?: string;
}

export interface MinhRestored {
  leadId: string;
  name: string;
  threadStatus: MinhThreadStatus;
  messages: ChatMessage[];
}

export interface MinhSendResult {
  user: ChatMessage;
  assistant: ChatMessage | null;
  /** true = agent nguoi that da tiep quan, cau tra loi se den qua socket. */
  noReply: boolean;
  raw: any;
}

export interface MinhSocketHandlers {
  onMessage?: (msg: ChatMessage) => void;
  onModeChange?: (status: MinhThreadStatus) => void;
}

export interface MinhSession {
  getLeadId(): string | null;
  getLeadName(): string | null;
  hasLead(): boolean;
  reset(): void;
  /** Khoi phuc phien cu tu localStorage; null neu lead khong con hop le. */
  restore(): Promise<MinhRestored | null>;
  /** Tao lead moi trong CRM roi gui loi chao. */
  start(input: { name: string; phone: string; source?: string }): Promise<{
    leadId: string;
    name: string;
    welcome: ChatMessage;
  }>;
  /** Luu tin nhan khach + hoi agent Minh. */
  sendUserMessage(text: string, lang?: string): Promise<MinhSendResult>;
  /** Ket noi socket cho realtime + human takeover. Tra ve ham cleanup. */
  connect(handlers: MinhSocketHandlers): Promise<() => void>;
  /** Ban ChatTransport de dung chung voi AiChatWidget. */
  transport: ChatTransport;
}

function store(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** Interaction cua CRM -> ChatMessage cua widget. */
export function interactionToMessage(raw: any): ChatMessage | null {
  if (!raw || !raw.id) return null;
  const content = typeof raw.content === "string" ? raw.content : "";
  if (!content) return null;
  const ts = raw.timestamp ? new Date(raw.timestamp).getTime() : Date.now();
  return {
    id: String(raw.id),
    role: raw.direction === "INBOUND" ? "user" : "assistant",
    content,
    ts: Number.isFinite(ts) ? ts : Date.now(),
  };
}

function welcomeText(name: string): string {
  return (
    "Xin chào " +
    name +
    "! Mình là Minh - chuyên viên tư vấn của SGS LAND. Anh/chị đang quan tâm dự án nào ạ?"
  );
}

export function createMinhSession(options: MinhSessionOptions = {}): MinhSession {
  const apiBase = options.apiBase;
  const defaultSource = options.source || "WEB";
  const client = createMinhClient(apiBase);

  let leadId: string | null = null;
  let leadName: string | null = null;

  function readStored() {
    const s = store();
    if (!s) return;
    leadId = s.getItem(MINH_LEAD_STORAGE_KEY);
    leadName = s.getItem(MINH_NAME_STORAGE_KEY);
  }

  function persist(id: string, name: string) {
    leadId = id;
    leadName = name;
    const s = store();
    if (!s) return;
    s.setItem(MINH_LEAD_STORAGE_KEY, id);
    s.setItem(MINH_NAME_STORAGE_KEY, name);
  }

  function clear() {
    leadId = null;
    leadName = null;
    const s = store();
    if (!s) return;
    s.removeItem(MINH_LEAD_STORAGE_KEY);
    s.removeItem(MINH_NAME_STORAGE_KEY);
  }

  async function ask(text: string, lang?: string) {
    if (!leadId) throw new ChatTransportError("missing_lead_id", { code: "NO_LEAD" });
    let saved: any = null;
    const requestId = createClientRequestId();
    try {
      saved = await client.sendMessage(leadId, text, "INBOUND", {}, requestId);
    } catch {
      saved = null;
    }
    let data: any;
    try {
      data = await client.ask(leadId, text, lang, saved?.id);
    } catch (error) {
      // The AI request can finish on the server after a proxy/browser
      // connection is reset. Reconcile with the durable conversation (with
      // retries) before showing an error, otherwise the user sees a failure
      // while a reload immediately reveals the already-persisted reply.
      // Poll the durable conversation for a bounded window. The server keeps
      // processing the AI run after the HTTP connection is reset, so an
      // immediate single fetch can race the persisted reply and show an
      // error even though the reply lands moments later. This must still be
      // bounded: a database outage or dead proxy must never leave the widget
      // in its loading state for the full request timeout plus this poll.
      const findAssistantRow = (rows: any[]) => {
        const inboundIndex = saved?.id
          ? rows.findIndex((row) => String(row?.id) === String(saved.id))
          : rows.map((row) => String(row?.content || "").trim()).lastIndexOf(text);
        const candidateRows = inboundIndex >= 0 ? rows.slice(inboundIndex + 1) : rows;
        return [...candidateRows].reverse().find((row) =>
          String(row?.direction || "").toUpperCase() === "OUTBOUND" &&
          row?.metadata?.isAgent === true &&
          !row?.metadata?.isSysMsg
        );
      };
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      const reconcileDeadline = Date.now() + 30_000;
      let assistantRow: any = null;
      while (Date.now() < reconcileDeadline) {
        try {
          const recovered: any = await client.getMessages(leadId);
          const rows: any[] = Array.isArray(recovered?.messages) ? recovered.messages : [];
          assistantRow = findAssistantRow(rows);
          if (assistantRow) break;
        } catch {
          // transient fetch failure inside the poll window - retry next tick
        }
        if (Date.now() >= reconcileDeadline) break;
        await sleep(1500);
      }
      if (assistantRow) {
        data = { reply: assistantRow };
      } else {
        throw error;
      }
    }
    const userMsg =
      interactionToMessage(saved) ||
      ({ id: "local-" + Date.now(), role: "user", content: text, ts: Date.now() } as ChatMessage);
    if (data && data.noReply) {
      return { user: userMsg, assistant: null, noReply: true, raw: data } as MinhSendResult;
    }
    const r = data ? data.reply : null;
    const assistant =
      typeof r === "string"
        ? ({ id: "ai-" + Date.now(), role: "assistant", content: r, ts: Date.now() } as ChatMessage)
        : interactionToMessage(r);
    return { user: userMsg, assistant, noReply: false, raw: data } as MinhSendResult;
  }

  const session: MinhSession = {
    getLeadId: () => leadId,
    getLeadName: () => leadName,
    hasLead: () => {
      if (!leadId) readStored();
      return Boolean(leadId);
    },
    reset: clear,

    async restore() {
      readStored();
      if (!leadId) return null;
      try {
        const data: any = await client.getMessages(leadId);
        if (!data || !data.lead || !data.lead.id) {
          clear();
          return null;
        }
        persist(String(data.lead.id), data.lead.name || leadName || "");
        const list: any[] = Array.isArray(data.messages) ? data.messages : [];
        const messages = list
          .filter((m) => !(m && m.metadata && m.metadata.isSysMsg))
          .map(interactionToMessage)
          .filter(Boolean) as ChatMessage[];
        return {
          leadId: leadId as string,
          name: leadName || "",
          threadStatus:
            data.lead.threadStatus === "HUMAN_TAKEOVER" ? "HUMAN_TAKEOVER" : "AI_ACTIVE",
          messages,
        } as MinhRestored;
      } catch {
        clear();
        return null;
      }
    },

    async start(input) {
      const name = (input.name || "").trim();
      const phone = (input.phone || "").trim();
      if (!name || !phone) {
        throw new ChatTransportError("missing_contact", { code: "MISSING_CONTACT" });
      }
      const created: any = await client.createLead(name, phone, input.source || defaultSource);
      const id = String(created && created.id ? created.id : "");
      if (!id) throw new ChatTransportError("create_lead_failed", { code: "CREATE_LEAD_FAILED" });
      persist(id, name);
      let welcome: ChatMessage | null = null;
      try {
        const saved = await client.sendMessage(id, welcomeText(name), "OUTBOUND", {
          isAgent: true,
        });
        welcome = interactionToMessage(saved);
      } catch {
        welcome = null;
      }
      if (!welcome) {
        welcome = {
          id: "welcome-" + Date.now(),
          role: "assistant",
          content: welcomeText(name),
          ts: Date.now(),
        };
      }
      return { leadId: id, name, welcome };
    },

    sendUserMessage: (text, lang) => ask(text, lang),

    transport: {
      name: "minh",
      async send(input) {
        const res = await ask(input.text, input.lang);
        return { reply: res.assistant ? res.assistant.content : "", raw: res.raw };
      },
    },

    async connect(handlers: MinhSocketHandlers) {
      const noop = () => {};
      if (typeof window === "undefined") return noop;
      if (!leadId) readStored();
      const room = leadId;
      if (!room) return noop;
      let io: any;
      try {
        const mod: any = await import("socket.io-client");
        io = mod.io || mod.default;
      } catch {
        return noop;
      }
      if (typeof io !== "function") return noop;

      const socket = io(apiBase || undefined, {
        transports: ["websocket", "polling"],
        withCredentials: true,
        reconnectionAttempts: 5,
        timeout: 20000,
      });

      const join = () => {
        try {
          socket.emit(CHAT_SOCKET_EVENTS.joinRoom, room);
        } catch {
          /* ignore */
        }
      };
      const onMessage = (data: any) => {
        const raw = data && data.message ? data.message : data;
        if (!raw) return;
        if (raw.leadId && String(raw.leadId) !== room) return;
        const msg = interactionToMessage(raw);
        if (msg && handlers.onMessage) handlers.onMessage(msg);
      };
      const onMode = (data: any) => {
        if (data && data.leadId && String(data.leadId) !== room) return;
        const status: MinhThreadStatus =
          data && data.status === "HUMAN_TAKEOVER" ? "HUMAN_TAKEOVER" : "AI_ACTIVE";
        if (handlers.onModeChange) handlers.onModeChange(status);
      };

      socket.on("connect", join);
      socket.on(CHAT_SOCKET_EVENTS.receiveMessage, onMessage);
      socket.on(CHAT_SOCKET_EVENTS.aiModeChanged, onMode);
      if (socket.connected) join();

      return () => {
        try {
          socket.off("connect", join);
          socket.off(CHAT_SOCKET_EVENTS.receiveMessage, onMessage);
          socket.off(CHAT_SOCKET_EVENTS.aiModeChanged, onMode);
          socket.emit(CHAT_SOCKET_EVENTS.leaveRoom, room);
          socket.disconnect();
        } catch {
          /* ignore */
        }
      };
    },
  };

  readStored();
  return session;
}
