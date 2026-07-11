import Anthropic from '@anthropic-ai/sdk';
import type { ProviderAdapter, GenerateParams, GenerateResult } from './types';
import { getProviderApiKey } from '../modelPolicy';

/** Adapter cho Anthropic (Claude). */
export class AnthropicAdapter implements ProviderAdapter {
  readonly name = 'anthropic';
  private client: Anthropic | null = null;

  isConfigured(): boolean {
    return !!getProviderApiKey('anthropic');
  }

  private getClient(): Anthropic {
    if (this.client) return this.client;
    const apiKey = getProviderApiKey('anthropic');
    if (!apiKey) {
      throw new Error("Chua cau hinh ANTHROPIC_API_KEY. Vui long them Secret.");
    }
    this.client = new Anthropic({ apiKey });
    return this.client;
  }

  async generate(params: GenerateParams): Promise<GenerateResult> {
    const client = this.getClient();
    const resp = await client.messages.create({
      model: params.model,
      max_tokens: params.maxOutputTokens ?? 1024,
      temperature: params.temperature,
      system: params.jsonMode
        ? (params.system ? params.system + '\n\nChi tra ve JSON hop le, khong kem markdown/giai thich.' : 'Chi tra ve JSON hop le, khong kem markdown/giai thich.')
        : params.system,
      messages: [{ role: 'user', content: params.prompt }],
    });
    const text = (resp.content || [])
      .map((b: any) => (b.type === 'text' ? b.text : ''))
      .join('');
    return { text, model: params.model, provider: 'anthropic' };
  }
}
