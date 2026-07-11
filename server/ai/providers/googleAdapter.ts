import { GoogleGenAI } from '@google/genai';
import type { ProviderAdapter, GenerateParams, GenerateResult } from './types';
import { getProviderApiKey } from '../modelPolicy';

/** Adapter cho Google Gemini (dung @google/genai da co san). */
export class GoogleAdapter implements ProviderAdapter {
  readonly name = 'google';
  private client: GoogleGenAI | null = null;

  isConfigured(): boolean {
    return !!getProviderApiKey('google');
  }

  private getClient(): GoogleGenAI {
    if (this.client) return this.client;
    const apiKey = getProviderApiKey('google');
    if (!apiKey) throw new Error('Chua cau hinh GEMINI_API_KEY/GOOGLE_API_KEY.');
    this.client = new GoogleGenAI({ apiKey });
    return this.client;
  }

  async generate(params: GenerateParams): Promise<GenerateResult> {
    const client = this.getClient();
    const resp = await client.models.generateContent({
      model: params.model,
      contents: params.prompt,
      config: {
        systemInstruction: params.system,
        temperature: params.temperature,
        maxOutputTokens: params.maxOutputTokens,
      },
    });
    return { text: (resp as any).text ?? '', model: params.model, provider: 'google' };
  }
}
