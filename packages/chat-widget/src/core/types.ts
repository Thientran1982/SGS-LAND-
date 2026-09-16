export type ChatRole = "user" | "assistant";

export interface ChatAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  kind: "image" | "document";
  url?: string;
  text?: string;
  contentHash?: string;
  textHash?: string;
  proof?: string;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  ts: number;
  attachments?: ChatAttachment[];
  runId?: string;
  inboundInteractionId?: string;
  intent?: string;
  clarificationReason?: string;
  missingData?: string[];
  clarificationRequired?: boolean;
  degraded?: boolean;
  degradedReason?: string;
  providerOutcome?: "PRIMARY" | "FALLBACK" | "TIMEOUT" | "UNAVAILABLE";
  sources?: unknown[];
  artifact?: unknown;
  suggestedAction?: unknown;
  responseEnvelope?: Record<string, unknown>;
  replyStatus?: "REPLY_PENDING" | "DELIVERED" | "FAILED";
  failureCode?: string;
}

export interface ChatSendInput {
  text: string;
  history: ChatMessage[];
  lang?: string;
  attachments?: ChatAttachment[];
  signal?: AbortSignal;
}

export interface ChatSendResult {
  reply: string;
  /** payload goc cua backend (artifact/suggestedAction cua agent Minh...). */
  raw?: any;
}

export class ChatTransportError extends Error {
  status?: number;
  code?: string;
  retryAfter?: number;
  inboundInteractionId?: string;
  constructor(message: string, opts: {
    status?: number;
    code?: string;
    retryAfter?: number;
    inboundInteractionId?: string;
  } = {}) {
    super(message);
    this.name = "ChatTransportError";
    this.status = opts.status;
    this.code = opts.code;
    this.retryAfter = opts.retryAfter;
    this.inboundInteractionId = opts.inboundInteractionId;
  }
}

/**
 * Giao thuc chung cho moi backend chat cua SGS.
 * Hien co 2 implementation: landing-ai (Gemini one-shot) va Minh (LangGraph + socket.io).
 */
export interface ChatTransport {
  name: string;
  send(input: ChatSendInput): Promise<ChatSendResult>;
}
