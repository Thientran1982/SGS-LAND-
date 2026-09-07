import { describe, expect, it, vi } from 'vitest';
import {
  generateWithPolicy,
  normalizeProviderFallbackSettings,
  ProviderExhaustedError,
} from '../ai/providers';
import type { ProviderAdapter } from '../ai/providers';

function adapter(
  provider: string,
  generate: ProviderAdapter['generate'],
): ProviderAdapter {
  return {
    name: provider,
    isConfigured: () => true,
    generate,
  };
}

function unavailableAdapter(provider: string): ProviderAdapter {
  return {
    name: provider,
    isConfigured: () => false,
    generate: vi.fn(),
  };
}

describe('live-chat provider fallback policy', () => {
  it('normalizes fallback order and keeps provider toggles bounded to supported providers', () => {
    const settings = normalizeProviderFallbackSettings({
      order: ['xai', 'xai', 'not-a-provider', 'anthropic'],
      enabled: { xai: false, anthropic: true, 'not-a-provider': true },
    });

    expect(settings.order.slice(0, 2)).toEqual(['xai', 'anthropic']);
    expect(settings.order).not.toContain('not-a-provider');
    expect(settings.enabled).toMatchObject({
      anthropic: true,
      xai: false,
      openai: false,
      openrouter: false,
      bai: false,
    });
  });

  it('tries a configured cross-provider fallback after a quota response', async () => {
    const primary = adapter('google', vi.fn().mockRejectedValue(Object.assign(new Error('quota exceeded'), { status: 429 })));
    const fallback = adapter('anthropic', vi.fn().mockResolvedValue({
      text: 'Tôi đã nhận được câu hỏi của bạn.',
      model: 'claude-sonnet-4-5',
      provider: 'anthropic',
    }));

    const result = await generateWithPolicy(
      {
        model: 'gemini-2.5-flash',
        prompt: 'Xin chào',
        timeoutMs: 50,
      },
      { google: primary, anthropic: fallback },
    );

    expect(result.text).toContain('nhận được');
    expect(result.provider).toBe('anthropic');
    expect(result.fallbackUsed).toBe(true);
    expect(result.attempts).toEqual([
      expect.objectContaining({ provider: 'google', outcome: 'failed', status: 429 }),
      expect.objectContaining({ provider: 'anthropic', outcome: 'success' }),
    ]);
    expect(primary.generate).toHaveBeenCalledTimes(1);
    expect(fallback.generate).toHaveBeenCalledTimes(1);
  });

  it('records a timeout and fails honestly when no configured provider can answer', async () => {
    const primary = adapter('google', vi.fn(() => new Promise<never>(() => {})));
    const fallback = adapter('anthropic', vi.fn().mockRejectedValue(Object.assign(new Error('service unavailable'), { status: 503 })));

    await expect(generateWithPolicy(
      {
        model: 'gemini-2.5-flash',
        prompt: 'Xin chào',
        timeoutMs: 5,
      },
      {
        google: primary,
        anthropic: fallback,
        xai: unavailableAdapter('xai'),
      },
    )).rejects.toMatchObject({
      name: 'ProviderExhaustedError',
      status: 503,
      attempts: expect.arrayContaining([
        expect.objectContaining({ provider: 'google', outcome: 'failed', status: 504 }),
        expect.objectContaining({ provider: 'anthropic', outcome: 'failed', status: 503 }),
        expect.objectContaining({ provider: 'xai', outcome: 'skipped' }),
      ]),
    });
    expect(primary.generate).toHaveBeenCalledTimes(1);
    expect(fallback.generate).toHaveBeenCalledTimes(1);
  });

  it('does not expose the underlying provider error or prompt in the exhausted error', async () => {
    const primary = adapter('google', vi.fn().mockRejectedValue(
      Object.assign(new Error('provider secret=do-not-log prompt=customer@example.com'), { status: 503 }),
    ));

    try {
      await generateWithPolicy(
        { model: 'gemini-2.5-flash', prompt: 'private customer message' },
        {
          google: primary,
          anthropic: unavailableAdapter('anthropic'),
          xai: unavailableAdapter('xai'),
        },
      );
      throw new Error('expected provider exhaustion');
    } catch (error: any) {
      expect(error).toBeInstanceOf(ProviderExhaustedError);
      expect(error.message).not.toContain('customer@example.com');
      expect(error.message).not.toContain('do-not-log');
      expect(error.attempts).toEqual(expect.arrayContaining([
        expect.objectContaining({ provider: 'google', outcome: 'failed', status: 503 }),
      ]));
    }
  });
});