/**
 * Provider dispatcher — chon adapter dua tren model (qua getProviderForModel).
 * Fallback an toan ve Gemini neu provider chua cau hinh key.
 */
import type { ProviderAdapter, GenerateParams, GenerateResult } from './types';
import { GoogleAdapter } from './googleAdapter';
import { AnthropicAdapter } from './anthropicAdapter';
import { OpenAiCompatibleAdapter } from './openaiAdapter';
import {
  getProviderForModel,
  ensureSafeModel,
  SAFE_MODEL_FALLBACK,
  CROSS_PROVIDER_FALLBACK,
} from '../modelPolicy';
import type { AiProvider } from '../modelPolicy';
import { ProviderExhaustedError } from './types';
import type { ProviderAttempt } from './types';

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

function providerStatus(error: any): number | undefined {
  const candidates = [
    error?.status,
    error?.statusCode,
    error?.response?.status,
    error?.error?.status,
    error?.cause?.status,
  ];
  const direct = candidates.find(value => typeof value === 'number' && value >= 400 && value < 600);
  if (direct !== undefined) return direct;
  const numericStatus = candidates
    .filter(value => typeof value === 'string' && /^\d{3}$/.test(value))
    .map(value => Number(value))
    .find(value => value >= 400 && value < 600);
  if (numericStatus !== undefined) return numericStatus;

  const message = String(error?.message || error || '').toLowerCase();
  if (/\b429\b|rate.?limit|quota|resource_exhausted/.test(message)) return 429;
  if (/\b503\b|service unavailable|temporarily unavailable|overloaded|overload/.test(message)) return 503;
  if (/timeout|timed out|deadline[_ ]exceeded|etimedout|abort(ed)?/.test(message)) return 504;
  return undefined;
}

export function isProviderFallbackError(error: unknown): boolean {
  const status = providerStatus(error);
  return status === 408 || status === 429 || status === 503 || status === 504;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs?: number): Promise<T> {
  if (!timeoutMs || timeoutMs <= 0) return promise;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(Object.assign(new Error('AI provider timeout'), { status: 504 }));
    }, timeoutMs);
    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      error => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function addAttempt(
  attempts: ProviderAttempt[],
  provider: AiProvider,
  model: string,
  outcome: ProviderAttempt['outcome'],
  startedAt: number,
  status?: number,
): void {
  attempts.push({
    provider,
    model,
    outcome,
    status,
    latencyMs: Math.max(0, Date.now() - startedAt),
  });
}

/**
 * Sinh noi dung dung provider phu hop voi `model`.
 * Neu provider cua model loi timeout/429/503, thu lan luot cac provider
 * cheo da duoc cau hinh trong CROSS_PROVIDER_FALLBACK.
 *
 * `adapters` la tham so tuy chon de test dispatcher ma khong cham API that.
 */
export async function generateWithPolicy(
  params: GenerateParams,
  adapters: Partial<Record<AiProvider, ProviderAdapter>> = {},
): Promise<GenerateResult> {
  let model = ensureSafeModel(params.model);
  let provider = getProviderForModel(model);
  const attempts: ProviderAttempt[] = [];

  if (!getAdapter(provider).isConfigured() && !adapters[provider]?.isConfigured()) {
    // Provider chua cau hinh key -> chuyen sang model an toan neu co key.
    provider = 'google';
    model = ensureSafeModel(SAFE_MODEL_FALLBACK);
  }

  const candidates: Array<{ provider: AiProvider; model: string }> = [
    { provider, model },
    ...CROSS_PROVIDER_FALLBACK,
  ].filter((candidate, index, list) =>
    list.findIndex(item => item.provider === candidate.provider && item.model === candidate.model) === index,
  );

  let lastError: unknown;
  for (const [index, candidate] of candidates.entries()) {
    const adapter = adapters[candidate.provider] || getAdapter(candidate.provider);
    if (!adapter.isConfigured()) {
      addAttempt(attempts, candidate.provider, candidate.model, 'skipped', Date.now());
      continue;
    }

    const startedAt = Date.now();
    try {
      const result = await withTimeout(
        adapter.generate({ ...params, model: candidate.model }),
        params.timeoutMs,
      );
      addAttempt(attempts, candidate.provider, candidate.model, 'success', startedAt);
      return {
        ...result,
        model: result.model || candidate.model,
        provider: result.provider || candidate.provider,
        fallbackUsed: index > 0,
        attempts,
      };
    } catch (error) {
      const status = providerStatus(error);
      addAttempt(attempts, candidate.provider, candidate.model, 'failed', startedAt, status);
      lastError = error;
      if (!isProviderFallbackError(error)) break;
    }
  }

  throw new ProviderExhaustedError(attempts, lastError);
}

export type { ProviderAdapter, GenerateParams, GenerateResult, ProviderAttempt } from './types';
export { ProviderExhaustedError } from './types';
