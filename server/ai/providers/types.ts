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
}

export interface GenerateResult {
  text: string;
  model: string;
  provider: string;
}

export interface ProviderAdapter {
  readonly name: string;
  /** True neu da co API key (Secret) cho provider nay. */
  isConfigured(): boolean;
  /** Sinh noi dung 1 lan (non-stream). */
  generate(params: GenerateParams): Promise<GenerateResult>;
}
