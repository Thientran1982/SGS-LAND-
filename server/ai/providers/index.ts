/**
 * Provider dispatcher — chon adapter dua tren model (qua getProviderForModel).
 * Fallback an toan ve Gemini neu provider chua cau hinh key.
 */
import type { ProviderAdapter, GenerateParams, GenerateResult } from './types';
import { GoogleAdapter } from './googleAdapter';
import { AnthropicAdapter } from './anthropicAdapter';
import { OpenAiCompatibleAdapter } from './openaiAdapter';
import { getProviderForModel, ensureSafeModel, SAFE_MODEL_FALLBACK, isProviderConfigured } from '../modelPolicy';
import type { AiProvider } from '../modelPolicy';

const XAI_BASE_URL = process.env.XAI_BASE_URL || 'https://api.x.ai/v1';
const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
const BAI_BASE_URL = process.env.BAI_BASE_URL || 'https://api.b.ai/v1';

const ADAPTERS: Record<AiProvider, ProviderAdapter> = {
  google:    new GoogleAdapter(),
  anthropic: new AnthropicAdapter(),
  openai:    new OpenAiCompatibleAdapter('openai'),
  xai:       new OpenAiCompatibleAdapter('xai', XAI_BASE_URL),
  openrouter: new OpenAiCompatibleAdapter('openrouter', OPENROUTER_BASE_URL),
  bai: new OpenAiCompatibleAdapter('bai', BAI_BASE_URL),
};

export function getAdapter(provider: AiProvider): ProviderAdapter {
  return ADAPTERS[provider] || ADAPTERS.google;
}

/**
 * Sinh noi dung dung provider phu hop voi `model`.
 * Neu provider cua model chua co key -> fallback ve Gemini (SAFE_MODEL_FALLBACK).
 */
export async function generateWithPolicy(params: GenerateParams): Promise<GenerateResult> {
  let model = ensureSafeModel(params.model);
  let provider = getProviderForModel(model);

  if (!isProviderConfigured(provider)) {
    // Provider chua cau hinh key -> ha ve Gemini de khong gay loi runtime
    provider = 'google';
    model = ensureSafeModel(SAFE_MODEL_FALLBACK);
  } else if (provider === 'google') {
    model = ensureSafeModel(model);
  }

  const adapter = getAdapter(provider);
  return adapter.generate({ ...params, model });
}

export type { ProviderAdapter, GenerateParams, GenerateResult } from './types';
