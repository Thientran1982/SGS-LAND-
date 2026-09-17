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

  supportsFilePart(mimeType: string): boolean {
    // Gemini's inline document path is portable for PDF. DOCX must be
    // represented as page images instead of being sent as an unknown part.
    return mimeType === 'application/pdf';
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
      contents: params.images?.length
        ? [{
            role: 'user',
            parts: [
              { text: params.prompt },
              ...params.images.map(image => ({
                inlineData: { mimeType: image.mimeType, data: image.dataBase64 },
              })),
              ...(params.files || []).map(file => ({
                inlineData: { mimeType: file.mimeType, data: file.dataBase64 },
              })),
            ],
          }]
        : params.files?.length
          ? [{
              role: 'user',
              parts: [
                { text: params.prompt },
                ...(params.files || []).map(file => ({
                  inlineData: { mimeType: file.mimeType, data: file.dataBase64 },
                })),
              ],
            }]
          : params.prompt,
      config: {
        systemInstruction: params.system,
        temperature: params.temperature,
        maxOutputTokens: params.maxOutputTokens,
      },
    });
    return { text: (resp as any).text ?? '', model: params.model, provider: 'google' };
  }
}
