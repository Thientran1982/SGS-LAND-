export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  ts: number;
}

export interface ChatSendInput {
  text: string;
  history: ChatMessage[];
  lang?: string;
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
  constructor(message: string, opts: { status?: number; code?: string; retryAfter?: number } = {}) {
    super(message);
    this.name = "ChatTransportError";
    this.status = opts.status;
    this.code = opts.code;
    this.retryAfter = opts.retryAfter;
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
