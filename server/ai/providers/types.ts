/**
 * Provider adapter interface — chuan hoa cach goi cac nha cung cap AI khac nhau.
 * Moi adapter tu doc API key tu process.env (qua modelPolicy.getProviderApiKey).
 * KHONG bao gio nhan/luu key trong code.
 */

export interface GenerateParams {
  model: string;
  /** He thong / persona instruction (hoac system prompt) */
  system?: string;
  /** Noi dung nguoi dung */
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  /** Yeu cau tra ve JSON hop le (map tu Gemini responseMimeType application/json). */
  jsonMode?: boolean;
  /** Gioi han cho tung lan goi provider; dispatcher dung de chuyen fallback. */
  timeoutMs?: number;
  /** Optional inline images for vision-capable models. */
  images?: ProviderImagePart[];
  /** Optional visual document parts. Adapters choose the provider-native file shape. */
  files?: ProviderFilePart[];
}

export type ProviderEvidenceRef = {
  attachmentId: string;
  contentHash: string;
  extractionStatus?: 'NOT_APPLICABLE' | 'READY' | 'EMPTY' | 'FAILED';
};

export type ProviderAttachmentFailure = {
  code: 'ATTACHMENT_VISUAL_UNREADABLE';
  attachmentId?: string;
  attachmentName: string;
  extractionStatus?: ProviderEvidenceRef['extractionStatus'];
};

export type ProviderImagePart = {
  mimeType: string;
  dataBase64: string;
  filename?: string;
  source?: ProviderEvidenceRef;
};

export type ProviderFilePart = {
  mimeType: string;
  dataBase64: string;
  filename?: string;
  source?: ProviderEvidenceRef;
};

export interface ProviderAttempt {
  provider: string;
  model: string;
  outcome: 'success' | 'failed' | 'skipped';
  status?: number;
  latencyMs: number;
}

export interface GenerateResult {
  text: string;
  model: string;
  provider: string;
  /** Co dung provider/model fallback sau khi lan goi truoc that bai hay khong. */
  fallbackUsed?: boolean;
  attempts?: ProviderAttempt[];
}

/** Loi da thu het cac provider fallback ma khong co phan hoi hop le. */
export class ProviderExhaustedError extends Error {
  readonly attempts: ProviderAttempt[];
  readonly status?: number;
  readonly lastError?: unknown;
  readonly attachmentFailure?: ProviderAttachmentFailure;

  constructor(
    attempts: ProviderAttempt[],
    lastError?: unknown,
    attachmentFailure?: ProviderAttachmentFailure,
  ) {
    super('AI providers unavailable after configured fallback attempts');
    this.name = 'ProviderExhaustedError';
    this.attempts = attempts;
    this.status = [...attempts].reverse().find(attempt => attempt.status !== undefined)?.status;
    this.lastError = lastError;
    this.attachmentFailure = attachmentFailure;
  }
}

export interface ProviderAdapter {
  readonly name: string;
  /** True neu da co API key (Secret) cho provider nay. */
  isConfigured(): boolean;
  /** True when the selected model/provider accepts this native file part. */
  supportsFilePart?(mimeType: string): boolean;
  /** Sinh noi dung 1 lan (non-stream). */
  generate(params: GenerateParams): Promise<GenerateResult>;
}
