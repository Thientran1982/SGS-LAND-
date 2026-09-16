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
import type { ChatAttachment, ChatMessage, ChatTransport } from "./types";
import { createClientRequestId, createMinhClient } from "./minhTransport";

export const MINH_LEAD_STORAGE_KEY = "livechat_lead_id";
export const MINH_NAME_STORAGE_KEY = "livechat_lead_name";
const MINH_RECONCILE_TIMEOUT_MS = 60_000;
const MINH_RECONCILE_POLL_MS = 1_500;
const MINH_PENDING_RUN_TTL_MS = 5 * 60_000;

export type MinhThreadStatus = "AI_ACTIVE" | "HUMAN_TAKEOVER";

export interface MinhSessionOptions {
  apiBase?: string;
  /** LINK | EMBED | QR | WEB | WIDGET - de CRM biet khach den tu dau. */
  source?: string;
  /** Tài khoản đã đăng nhập trên public site, nếu có. */
  authenticatedUser?: {
    id: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
}

export interface MinhRestored {
  leadId: string;
  name: string;
  threadStatus: MinhThreadStatus;
  messages: ChatMessage[];
}

export interface MinhPendingRun {
  runId?: string;
  inboundInteractionId: string;
  startedAt: number;
}

export interface MinhSendResult {
  user: ChatMessage;
  assistant: ChatMessage | null;
  /** true = agent nguoi that da tiep quan, cau tra loi se den qua socket. */
  noReply: boolean;
  /** true = server accepted the run but it is not complete yet. */
  pending?: boolean;
  raw: any;
}

export interface MinhSocketHandlers {
  onMessage?: (msg: ChatMessage) => void;
  onModeChange?: (status: MinhThreadStatus) => void;
  onRunStarted?: (event: MinhRunStartedEvent) => void;
  onRunProgress?: (event: MinhRunProgressEvent) => void;
  onRunFinished?: (event: MinhRunFinishedEvent) => void;
  onReconnectStatus?: (status: MinhPendingStatus | null) => void;
}

export interface MinhRunStartedEvent {
  leadId: string;
  runId: string;
  inboundInteractionId: string;
}

export interface MinhRunProgressEvent {
  leadId: string;
  runId: string;
  inboundInteractionId: string;
  phase: "classify" | "retrieve" | "specialist" | "compose" | "guardrail";
  elapsedMs: number;
}

export interface MinhRunFinishedEvent {
  leadId: string;
  runId: string;
  inboundInteractionId: string;
  status: "SUCCESS" | "FAILED" | "BLOCKED";
}

export type MinhPendingStatus = {
  status: "PROCESSING" | "SUCCESS" | "FAILED" | "NOT_FOUND";
  code?: string;
  retryAfter?: number;
  transient?: boolean;
};

export interface MinhSession {
  getLeadId(): string | null;
  getLeadName(): string | null;
  hasLead(): boolean;
  reset(): void;
  getPendingRun(): MinhPendingRun | null;
  savePendingRun(run: MinhPendingRun): void;
  clearPendingRun(inboundInteractionId?: string): void;
  /** Khoi phuc phien cu tu localStorage; null neu lead khong con hop le. */
  restore(): Promise<MinhRestored | null>;
  /** Tao lead moi trong CRM roi gui loi chao. */
  start(input: { name: string; phone?: string; email?: string; source?: string }): Promise<{
    leadId: string;
    name: string;
    welcome: ChatMessage;
  }>;
  /** Luu tin nhan khach + hoi agent Minh. */
  sendUserMessage(text: string, lang?: string, attachments?: ChatAttachment[]): Promise<MinhSendResult>;
  /** Retry the existing inbound request without persisting another visitor message. */
  retryUserMessage(inboundInteractionId: string, text: string, lang?: string, attachments?: ChatAttachment[]): Promise<MinhSendResult>;
  /** Ask a human agent to take over without creating another inbound message. */
  requestHumanEscalation(reason?: string): Promise<boolean>;
  uploadAttachments(files: File[]): Promise<ChatAttachment[]>;
  /** Ket noi socket cho realtime + human takeover. Tra ve ham cleanup. */
  connect(handlers: MinhSocketHandlers): Promise<() => void>;
  /** Lam moi message history ma khong xoa session khi mot lan fetch bi loi. */
  refreshMessages(): Promise<MinhRestored | null>;
  /** Doc trang thai durable run ma khong tai lai toan bo history. */
  getPendingStatus(inboundInteractionId: string): Promise<MinhPendingStatus | null>;
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
    attachments: Array.isArray(raw.metadata?.attachments) ? raw.metadata.attachments : undefined,
    runId: typeof raw.metadata?.agentRunId === "string" ? raw.metadata.agentRunId : undefined,
    inboundInteractionId:
      typeof raw.metadata?.inboundInteractionId === "string"
        ? raw.metadata.inboundInteractionId
        : undefined,
    intent: typeof raw.metadata?.intent === "string" ? raw.metadata.intent : undefined,
    missingData: Array.isArray(raw.metadata?.missingData)
      ? raw.metadata.missingData.filter((value: unknown): value is string => typeof value === "string")
      : undefined,
    clarificationRequired: raw.metadata?.clarificationRequired === true,
    degraded: raw.metadata?.degraded === true,
    degradedReason: typeof raw.metadata?.degradedReason === "string"
      ? raw.metadata.degradedReason
      : undefined,
    providerOutcome:
      raw.metadata?.providerOutcome === "PRIMARY" ||
      raw.metadata?.providerOutcome === "FALLBACK" ||
      raw.metadata?.providerOutcome === "TIMEOUT" ||
      raw.metadata?.providerOutcome === "UNAVAILABLE"
        ? raw.metadata.providerOutcome
        : undefined,
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
  const authenticatedUser = options.authenticatedUser?.id
    ? {
        id: String(options.authenticatedUser.id),
        name: options.authenticatedUser.name || "",
        email: options.authenticatedUser.email || "",
        phone: options.authenticatedUser.phone || "",
      }
    : null;
  const client = createMinhClient(apiBase);

  let leadId: string | null = null;
  let leadName: string | null = null;

  const storageKey = (base: string) =>
    authenticatedUser ? `${base}:${authenticatedUser.id}` : base;
  const pendingRunStorageKey = storageKey("livechat_pending_run");
  let consecutiveStatusFailures = 0;

  function readStored() {
    const s = store();
    if (!s) return;
    leadId = s.getItem(storageKey(MINH_LEAD_STORAGE_KEY));
    leadName = s.getItem(storageKey(MINH_NAME_STORAGE_KEY));
  }

  function persist(id: string, name: string) {
    leadId = id;
    leadName = name;
    const s = store();
    if (!s) return;
    s.setItem(storageKey(MINH_LEAD_STORAGE_KEY), id);
    s.setItem(storageKey(MINH_NAME_STORAGE_KEY), name);
  }

  function clear() {
    leadId = null;
    leadName = null;
    const s = store();
    if (!s) return;
    s.removeItem(storageKey(MINH_LEAD_STORAGE_KEY));
    s.removeItem(storageKey(MINH_NAME_STORAGE_KEY));
    s.removeItem(pendingRunStorageKey);
  }

  function readPendingRun(): MinhPendingRun | null {
    const s = store();
    if (!s) return null;
    try {
      const raw = s.getItem(pendingRunStorageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.inboundInteractionId !== "string" || !parsed.startedAt) return null;
      const startedAt = Number(parsed.startedAt);
      if (!Number.isFinite(startedAt)) return null;
      if (Date.now() - startedAt > MINH_PENDING_RUN_TTL_MS) {
        s.removeItem(pendingRunStorageKey);
        return null;
      }
      return {
        runId: typeof parsed.runId === "string" ? parsed.runId : undefined,
        inboundInteractionId: parsed.inboundInteractionId,
        startedAt,
      };
    } catch {
      return null;
    }
  }

  function savePendingRun(run: MinhPendingRun): void {
    try {
      consecutiveStatusFailures = 0;
      store()?.setItem(pendingRunStorageKey, JSON.stringify(run));
    } catch {
      /* localStorage is optional */
    }
  }

  function clearPendingRun(inboundInteractionId?: string): void {
    const current = readPendingRun();
    if (!inboundInteractionId || !current || current.inboundInteractionId === inboundInteractionId) {
      try {
        store()?.removeItem(pendingRunStorageKey);
      } catch {
        /* localStorage is optional */
      }
    }
  }

  async function ask(
    text: string,
    lang?: string,
    attachments: ChatAttachment[] = [],
    existingInboundInteractionId?: string,
  ) {
    if (!leadId) throw new ChatTransportError("missing_lead_id", { code: "NO_LEAD" });
    let saved: any = null;
    let inboundPersistMs: number | undefined;
    let historyReadMs: number | undefined;
    const requestId = createClientRequestId();
    const inboundStartedAt = Date.now();
    if (existingInboundInteractionId) {
      saved = {
        id: existingInboundInteractionId,
        direction: "INBOUND",
        content: text,
        metadata: { attachments },
      };
    } else try {
      saved = await client.sendMessage(leadId, text, "INBOUND", { attachments }, requestId);
      inboundPersistMs = Date.now() - inboundStartedAt;
    } catch (error: any) {
      // A response can be lost after the database committed. Recover the
      // durable inbound before deciding that the send failed. Never do this
      // for a clear client/rate-limit error: those requests were rejected
      // before they could have been persisted.
      const canBeAmbiguous =
        !error?.status || error.status >= 500 || error.status === 408;
      if (canBeAmbiguous) {
        try {
          const historyStartedAt = Date.now();
          const recovered: any = await client.getMessages(leadId);
          historyReadMs = Date.now() - historyStartedAt;
          const rows: any[] = Array.isArray(recovered?.messages) ? recovered.messages : [];
          saved = [...rows].reverse().find((row) =>
            String(row?.direction || "").toUpperCase() === "INBOUND" &&
            String(row?.content || "").trim() === text.trim(),
          ) || null;
        } catch {
          saved = null;
        }
      }
      if (!saved) throw error;
    }
    let data: any;
    let asyncAccepted = false;
    try {
      data = await client.ask(leadId, text, lang, saved?.id, attachments, requestId, {
        inboundPersistMs,
        historyReadMs,
      }, { retry: Boolean(existingInboundInteractionId) });
      if (data && (data as any).async === true) {
        asyncAccepted = true;
      }
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
      // in its loading state indefinitely.
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
      const reconcileDeadline = Date.now() + MINH_RECONCILE_TIMEOUT_MS;
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
        await sleep(MINH_RECONCILE_POLL_MS);
      }
      if (assistantRow) {
        data = { reply: assistantRow };
      } else {
        throw error;
      }
    }
    // 202 Accepted: return immediately. The UI starts a bounded background
    // reconcile while Socket.IO remains the preferred delivery path. Waiting
    // here made the user stare at the composer for the whole poll window.
    if (asyncAccepted) {
      data = {
        ...((data as any) || {}),
        async: true,
        pending: true,
      };
}

    const userMsg =
      interactionToMessage(saved) ||
      ({
        id: "local-" + Date.now(),
        role: "user",
        content: text,
        ts: Date.now(),
        attachments,
      } as ChatMessage);
    if (data && data.noReply) {
      return { user: userMsg, assistant: null, noReply: true, raw: data } as MinhSendResult;
    }
    const r = data ? data.reply : null;
    const assistant =
      typeof r === "string"
        ? ({ id: "ai-" + Date.now(), role: "assistant", content: r, ts: Date.now() } as ChatMessage)
        : interactionToMessage(r);
    return {
      user: userMsg,
      assistant,
      noReply: false,
      pending: Boolean(data?.pending),
      raw: data,
    } as MinhSendResult;
  }

  async function restoreAuthenticated(): Promise<MinhRestored> {
    const accountName = authenticatedUser?.name || authenticatedUser?.email || "Khách hàng";
    const started = await session.start({
      name: accountName,
      phone: authenticatedUser?.phone || "",
      email: authenticatedUser?.email || "",
      source: defaultSource,
    });
    return {
      leadId: started.leadId,
      name: started.name,
      threadStatus: "AI_ACTIVE",
      messages: [started.welcome],
    };
  }

  const session: MinhSession = {
    getLeadId: () => leadId,
    getLeadName: () => leadName,
    hasLead: () => {
      if (!leadId) readStored();
      return Boolean(leadId);
    },
    reset: clear,
    getPendingRun: readPendingRun,
    savePendingRun,
    clearPendingRun,

    async restore() {
      readStored();
      if (!leadId && authenticatedUser) return restoreAuthenticated();
      if (!leadId) return null;
      try {
        const data: any = await client.getMessages(leadId);
        if (!data || !data.lead || !data.lead.id) {
          clear();
          if (authenticatedUser) return restoreAuthenticated();
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
        if (authenticatedUser) return restoreAuthenticated();
        return null;
      }
    },

    async refreshMessages() {
      readStored();
      if (!leadId) return null;
      try {
        const data: any = await client.getMessages(leadId);
        if (!data?.lead?.id) return null;
        const list: any[] = Array.isArray(data.messages) ? data.messages : [];
        const messages = list
          .filter((m) => !(m && m.metadata && m.metadata.isSysMsg))
          .map(interactionToMessage)
          .filter(Boolean) as ChatMessage[];
        return {
          leadId: String(data.lead.id),
          name: data.lead.name || leadName || "",
          threadStatus:
            data.lead.threadStatus === "HUMAN_TAKEOVER" ? "HUMAN_TAKEOVER" : "AI_ACTIVE",
          messages,
        };
      } catch {
        return null;
      }
    },

    async getPendingStatus(inboundInteractionId: string) {
      readStored();
      if (!leadId || !inboundInteractionId) return null;
      try {
        const data: any = await client.getRunStatus(leadId, inboundInteractionId);
        if (!data || typeof data.status !== "string") return null;
        const status = String(data.status).toUpperCase();
        if (!["PROCESSING", "SUCCESS", "FAILED", "NOT_FOUND"].includes(status)) return null;
        consecutiveStatusFailures = 0;
        return {
          status: status as "PROCESSING" | "SUCCESS" | "FAILED" | "NOT_FOUND",
          code: typeof data.code === "string" ? data.code : undefined,
          retryAfter: Number.isFinite(Number(data.retryAfter))
            ? Math.max(0, Number(data.retryAfter))
            : undefined,
        };
      } catch (error: any) {
        consecutiveStatusFailures += 1;
        if (consecutiveStatusFailures > 5) {
          return {
            status: "FAILED",
            code: "STATUS_UNREACHABLE",
          };
        }
        // A throttled status read is not a failed AI run. Preserve the
        // server hint so the panel backs off instead of falling through to
        // an expensive history read on every 429/503 or network timeout.
        return {
          status: "PROCESSING",
          code: error instanceof ChatTransportError || error?.name === "ChatTransportError"
            ? (typeof error.code === "string" ? error.code : "LIVECHAT_STATUS_UNAVAILABLE")
            : "LIVECHAT_STATUS_UNAVAILABLE",
          retryAfter: Number.isFinite(Number(error?.retryAfter))
            ? Math.max(0, Number(error.retryAfter))
            : undefined,
          transient: true,
        };
      }
    },

    async start(input) {
      const name = (input.name || "").trim();
      const phone = (input.phone || "").trim();
      if (!name || (!phone && !authenticatedUser)) {
        throw new ChatTransportError("missing_contact", { code: "MISSING_CONTACT" });
      }
      const created: any = await client.createLead(name, phone, input.source || defaultSource, input.email);
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

    sendUserMessage: (text, lang, attachments) => ask(text, lang, attachments),
    retryUserMessage: (inboundInteractionId, text, lang, attachments) =>
      ask(text, lang, attachments, inboundInteractionId),
    requestHumanEscalation: async (reason = "degraded_provider_response") => {
      if (!leadId) throw new ChatTransportError("missing_lead_id", { code: "NO_LEAD" });
      return client.escalate(leadId, reason);
    },
    uploadAttachments: async (files) => {
      if (!leadId) throw new ChatTransportError("missing_lead_id", { code: "NO_LEAD" });
      return client.uploadAttachments(leadId, files);
    },

    transport: {
      name: "minh",
      async send(input) {
        const res = await ask(input.text, input.lang, input.attachments);
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
        // Next's public rewrite normalizes /socket.io/ to /socket.io with a
        // 308 redirect. Keep the Engine.IO path slashless so the handshake
        // reaches the Express Socket.IO server through the public proxy.
        path: "/socket.io",
        addTrailingSlash: false,
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
        if (raw.metadata?.isSysMsg) return;
        const msg = interactionToMessage(raw);
        if (msg && handlers.onMessage) handlers.onMessage(msg);
      };
      const pendingStatusAfterConnect = async () => {
        const pending = readPendingRun();
        if (!pending) return;
        const status = await session.getPendingStatus(pending.inboundInteractionId);
        handlers.onReconnectStatus?.(status);
      };
      const onMode = (data: any) => {
        if (data && data.leadId && String(data.leadId) !== room) return;
        const status: MinhThreadStatus =
          data && data.status === "HUMAN_TAKEOVER" ? "HUMAN_TAKEOVER" : "AI_ACTIVE";
        if (handlers.onModeChange) handlers.onModeChange(status);
      };

      const onConnect = () => {
        join();
        void pendingStatusAfterConnect();
      };
      socket.on("connect", onConnect);
      socket.on(CHAT_SOCKET_EVENTS.receiveMessage, onMessage);
      socket.on(CHAT_SOCKET_EVENTS.aiModeChanged, onMode);
      socket.on(CHAT_SOCKET_EVENTS.agentRunStarted, (data: MinhRunStartedEvent) => {
        if (!data || String(data.leadId) !== room) return;
        savePendingRun({
          runId: String(data.runId),
          inboundInteractionId: String(data.inboundInteractionId),
          startedAt: Date.now(),
        });
        handlers.onRunStarted?.(data);
      });
      socket.on(CHAT_SOCKET_EVENTS.agentRunProgress, (data: MinhRunProgressEvent) => {
        if (!data || String(data.leadId) !== room) return;
        handlers.onRunProgress?.(data);
      });
      socket.on(CHAT_SOCKET_EVENTS.agentRunFinished, (data: MinhRunFinishedEvent) => {
        if (!data || String(data.leadId) !== room) return;
        handlers.onRunFinished?.(data);
      });
      if (socket.connected) onConnect();

      return () => {
        try {
          socket.off("connect", onConnect);
          socket.off(CHAT_SOCKET_EVENTS.receiveMessage, onMessage);
          socket.off(CHAT_SOCKET_EVENTS.aiModeChanged, onMode);
          socket.off(CHAT_SOCKET_EVENTS.agentRunStarted);
          socket.off(CHAT_SOCKET_EVENTS.agentRunProgress);
          socket.off(CHAT_SOCKET_EVENTS.agentRunFinished);
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
