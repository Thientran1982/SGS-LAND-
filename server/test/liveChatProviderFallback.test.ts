import { describe, expect, it, vi } from 'vitest';
import { zipSync } from 'fflate';
import sharp from 'sharp';
import {
  generateWithPolicy,
  normalizeProviderFallbackSettings,
  ProviderExhaustedError,
} from '../ai/providers';
import { renderDocumentVisualPages } from '../ai/documentVisualRenderer';
import { classifyLiveChatProviderOutcome } from '../ai/liveChatEngine';
import type { ProviderAdapter } from '../ai/providers';

function adapter(
  provider: string,
  generate: ProviderAdapter['generate'],
): ProviderAdapter {
  return {
    name: provider,
    isConfigured: () => true,
    supportsFilePart: () => true,
    generate,
  };
}

function unavailableAdapter(provider: string): ProviderAdapter {
  return {
    name: provider,
    isConfigured: () => false,
    supportsFilePart: () => true,
    generate: vi.fn(),
  };
}

describe('live-chat provider fallback policy', () => {
  it('uses stable outcomes for fallback, timeout, and unavailable responses', () => {
    expect(classifyLiveChatProviderOutcome([
      { provider: 'google', model: 'gemini', outcome: 'failed', status: 429, latencyMs: 10 },
      { provider: 'anthropic', model: 'claude', outcome: 'success', latencyMs: 20 },
    ], true)).toEqual({
      outcome: 'FALLBACK',
      degraded: true,
      degradedReason: 'PRIMARY_PROVIDER_UNAVAILABLE',
    });
    expect(classifyLiveChatProviderOutcome([
      { provider: 'google', model: 'gemini', outcome: 'failed', status: 504, latencyMs: 10 },
    ], false)).toEqual({
      outcome: 'TIMEOUT',
      degraded: true,
      degradedReason: 'PROVIDER_TIMEOUT',
    });
    expect(classifyLiveChatProviderOutcome([
      { provider: 'google', model: 'gemini', outcome: 'failed', status: 503, latencyMs: 10 },
    ], false)).toEqual({
      outcome: 'UNAVAILABLE',
      degraded: true,
      degradedReason: 'ALL_CONFIGURED_PROVIDERS_UNAVAILABLE',
    });
  });

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

  it('preserves authenticated image and visual-document parts through policy dispatch', async () => {
    let received: any;
    const google = adapter('google', vi.fn(async (params) => {
      received = params;
      return { text: 'Đã đọc tài liệu trực quan.', model: params.model, provider: 'google' };
    }));

    await generateWithPolicy(
      {
        model: 'gemini-2.5-flash',
        prompt: 'Đọc ảnh và biểu đồ, chỉ nêu điều nhìn thấy.',
        timeoutMs: 50,
        images: [{
          mimeType: 'image/png',
          dataBase64: 'aW1hZ2U=',
          source: { attachmentId: 'chat-image.png', contentHash: 'a'.repeat(64) },
        }],
        files: [{
          mimeType: 'application/pdf',
          dataBase64: 'cGRm',
          filename: 'brochure.pdf',
          source: {
            attachmentId: 'chat-brochure.pdf',
            contentHash: 'b'.repeat(64),
            extractionStatus: 'FAILED',
          },
        }],
      },
      { google },
    );

    expect(received.images).toHaveLength(1);
    expect(received.files).toMatchObject([{
      mimeType: 'application/pdf',
      filename: 'brochure.pdf',
      source: expect.objectContaining({
        extractionStatus: 'FAILED',
        contentHash: 'b'.repeat(64),
      }),
    }]);
  });

  it('renders an unsupported DOCX as bounded page images before dispatch', async () => {
    const page = await sharp({
      create: {
        width: 4,
        height: 4,
        channels: 3,
        background: { r: 220, g: 30, b: 30 },
      },
    }).png().toBuffer();
    const docx = Buffer.from(zipSync({
      '[Content_Types].xml': new TextEncoder().encode('<Types/>'),
      'word/media/image1.png': page,
    }));
    let received: any;
    const google = adapter('google', vi.fn(async (params) => {
      received = params;
      return { text: 'Đã đọc bản scan.', model: params.model, provider: 'google' };
    }));
    google.supportsFilePart = () => false;

    await generateWithPolicy(
      {
        model: 'gemini-2.5-flash',
        prompt: 'Đọc bản scan',
        timeoutMs: 100,
        files: [{
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          dataBase64: docx.toString('base64'),
          filename: 'scan.docx',
          source: {
            attachmentId: 'scan.docx',
            contentHash: 'c'.repeat(64),
            extractionStatus: 'EMPTY',
          },
        }],
      },
      { google },
      { maxAttempts: 1 },
    );

    expect(received.files).toBeUndefined();
    expect(received.images).toHaveLength(1);
    expect(received.images[0]).toMatchObject({
      mimeType: 'image/png',
      filename: 'scan.docx.page-1.png',
      source: {
        attachmentId: 'scan.docx',
        contentHash: 'c'.repeat(64),
        extractionStatus: 'EMPTY',
      },
    });
  });

  it('renders only the first bounded PDF pages and preserves attachment evidence', async () => {
    const pdf = Buffer.from(
      'JVBERi0xLjMKJf////8KNyAwIG9iago8PAovVHlwZSAvUGFnZQovUGFyZW50IDEgMCBSCi9NZWRpYUJveCBbMCAwIDYxMiA3OTJdCi9Db250ZW50cyA1IDAgUgovUmVzb3VyY2VzIDYgMCBSCi9Vc2VyVW5pdCAxCj4+CmVuZG9iago2IDAgb2JqCjw8Ci9Qcm9jU2V0IFsvUERGIC9UZXh0IC9JbWFnZUIgL0ltYWdlQyAvSW1hZ2VJXQovRm9udCA8PAovRjEgOCAwIFIKPj4KL0NvbG9yU3BhY2UgPDwKPj4KPj4KZW5kb2JqCjUgMCBvYmoKPDwKL0xlbmd0aCAxMDYKL0ZpbHRlciAvRmxhdGVEZWNvZGUKPj4Kc3RyZWFtCnicZYk7CgJREATzOUVfwPX1+/QoiIGwBmbCZGKku9kG3j9xAjMpKOhqoiQ7pvxY8drsY/xrl/hFwiucnNqhIzbbXwlWxGqP02hqopZkqNeirlXNh965F8/iJX/XOKM8ETebw+72BZgGGtYKZW5kc3RyZWFtCmVuZG9iagoxMCAwIG9iagooUERGS2l0KQplbmRvYmoKMTEgMCBvYmoKKFBERktpdCkKZW5kb2JqCjEyIDAgb2JqCihEOjIwMjYwOTE3MDQ0OTE2WikKZW5kb2JqCjkgMCBvYmoKPDwKL1Byb2R1Y2VyIDEwIDAgUgovQ3JlYXRvciAxMSAwIFIKL0NyZWF0aW9uRGF0ZSAxMiAwIFIKPj4KZW5kb2JqCjggMCBvYmoKPDwKL1R5cGUgL0ZvbnQKL0Jhc2VGb250IC9IZWx2ZXRpY2EKL1N1YnR5cGUgL1R5cGUxCi9FbmNvZGluZyAvV2luQW5zaUVuY29kaW5nCj4+CmVuZG9iago0IDAgb2JqCjw8Cj4+CmVuZG9iagozIDAgb2JqCjw8Ci9UeXBlIC9DYXRhbG9nCi9QYWdlcyAxIDAgUgovTmFtZXMgMiAwIFIKPj4KZW5kb2JqCjEgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9Db3VudCAxCi9LaWRzIFs3IDAgUl0KPj4KZW5kb2JqCjIgMCBvYmoKPDwKL0Rlc3RzIDw8CiAgL05hbWVzIFsKXQo+Pgo+PgplbmRvYmoKeHJlZgowIDEzCjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDc1NyAwMDAwMCBuIAowMDAwMDAwODE0IDAwMDAwIG4gCjAwMDAwMDA2OTUgMDAwMDAgbiAKMDAwMDAwMDY3NCAwMDAwMCBuIAowMDAwMDAwMjM4IDAwMDAwIG4gCjAwMDAwMDAxMzEgMDAwMDAgbiAKMDAwMDAwMDAxNSAwMDAwMCBuIAowMDAwMDAwNTc3IDAwMDAwIG4gCjAwMDAwMDA1MDIgMDAwMDAgbiAKMDAwMDAwMDQxNiAwMDAwMCBuIAowMDAwMDAwNDQxIDAwMDAwIG4gCjAwMDAwMDA0NjYgMDAwMDAgbiAKdHJhaWxlcgo8PAovU2l6ZSAxMwovUm9vdCAzIDAgUgovSW5mbyA5IDAgUgovSUQgWzxjNTUzYTdlYTVhYmFmYzVhMzg3MmZhYTMwNzZiMzYyZD4gPGM1NTNhN2VhNWFiYWZjNWEzODcyZmFhMzA3NmIzNjJkPl0KPj4Kc3RhcnR4cmVmCjg2MQolJUVPRgo=',
      'base64',
    );
    const pages = await renderDocumentVisualPages({
      mimeType: 'application/pdf',
      dataBase64: pdf.toString('base64'),
      filename: 'scan.pdf',
      source: {
        attachmentId: 'scan.pdf',
        contentHash: 'd'.repeat(64),
        extractionStatus: 'FAILED',
      },
    });

    expect(pages).toHaveLength(1);
    expect(pages[0]).toMatchObject({
      mimeType: 'image/png',
      source: {
        attachmentId: 'scan.pdf',
        contentHash: 'd'.repeat(64),
        extractionStatus: 'FAILED',
      },
    });
  });

  it('moves from an unavailable non-Google primary model to Gemini', async () => {
    const primary = adapter('openrouter', vi.fn().mockRejectedValue(
      Object.assign(new Error('payment required'), { status: 402 }),
    ));
    const google = adapter('google', vi.fn().mockResolvedValue({
      text: 'Tôi đã kiểm tra thông tin và có thể tư vấn tiếp.',
      model: 'gemini-2.5-flash',
      provider: 'google',
    }));

    const result = await generateWithPolicy(
      {
        model: 'z-ai/glm-5.3',
        prompt: 'Tư vấn vay vốn',
        timeoutMs: 50,
      },
      { openrouter: primary, google },
      { includeGoogleFallback: true, maxAttempts: 2 },
    );

    expect(result.provider).toBe('google');
    expect(result.fallbackUsed).toBe(true);
    expect(primary.generate).toHaveBeenCalledTimes(1);
    expect(google.generate).toHaveBeenCalledTimes(1);
    expect(result.attempts).toEqual([
      expect.objectContaining({ provider: 'openrouter', outcome: 'failed', status: 402 }),
      expect.objectContaining({ provider: 'google', outcome: 'success' }),
    ]);
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