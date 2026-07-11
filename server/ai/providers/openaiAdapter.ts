import OpenAI from 'openai';
import type { ProviderAdapter, GenerateParams, GenerateResult } from './types';
import { getProviderApiKey } from '../modelPolicy';
import type { AiProvider } from '../modelPolicy';

/**
 * Adapter dung chung cho OpenAI (ChatGPT) va xAI (Grok).
 * xAI dung API tuong thich OpenAI, chi khac baseURL.
 */
export class OpenAiCompatibleAdapter implements ProviderAdapter {
  readonly name: string;
  private provider: AiProvider;
  private baseURL?: string;
  private client: OpenAI | null = null;

  constructor(provider: AiProvider, baseURL?: string) {
    this.provider = provider;
    this.name = provider;
    this.baseURL = baseURL;
  }

  isConfigured(): boolean {
    return !!getProviderApiKey(this.provider);
  }

  private getClient(): OpenAI {
    if (this.client) return this.client;
    const apiKey = getProviderApiKey(this.provider);
    if (!apiKey) {
      throw new Error(`Chua cau hinh API key cho provider '${this.provider}'. Vui long them Secret tuong ung.`);
    }
    this.client = new OpenAI(this.baseURL ? { apiKey, baseURL: this.baseURL } : { apiKey });
    return this.client;
  }

  async generate(params: GenerateParams): Promise<GenerateResult> {
    const client = this.getClient();
    const messages: any[] = [];
    const sys = params.jsonMode
      ? (params.system ? params.system + '\n\nCHi tra ve JSON hop le, khong kem markdown/giai thich.' : 'Chi tra ve JSON hop le, khong kem markdown/giai thich.')
      : params.system;
    if (sys) messages.push({ role: 'system', content: sys });
    messages.push({ role: 'user', content: params.prompt });
    const resp = await client.chat.completions.create({
      model: params.model,
      messages,
      temperature: params.temperature,
      max_tokens: params.maxOutputTokens,
      ...(params.jsonMode ? { response_format: { type: 'json_object' as const } } : {}),
    });
    const text = resp.choices?.[0]?.message?.content ?? '';
    return { text: typeof text === 'string' ? text : '', model: params.model, provider: this.provider };
  }
}
