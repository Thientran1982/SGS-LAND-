import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getConfig } = vi.hoisted(() => ({
  getConfig: vi.fn(),
}));

vi.mock('../repositories/enterpriseConfigRepository', () => ({
  enterpriseConfigRepository: {
    getConfig,
  },
}));

import { verifyZaloBroadcastAccess, zaloBroadcastPublisher } from '../social-publishing/zaloBroadcastPublisher';

const config = {
  zalo: {
    enabled: true,
    oaId: 'oa-1',
    accessToken: 'token',
    broadcastProbeUserId: 'probe-user-1',
  },
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Zalo OA broadcast publisher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getConfig.mockResolvedValue(config);
    vi.stubGlobal('fetch', vi.fn());
  });

  it('only reports READY after OA identity and broadcast permission probes pass', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(response({ error: 0, data: { oaid: 'oa-1' } }))
      .mockResolvedValueOnce(response({
        error: 0,
        data: { promotion: { daily_total: 1, daily_remain: 1 } },
      }));

    await expect(verifyZaloBroadcastAccess('tenant-1')).resolves.toMatchObject({
      ready: true,
      checks: { oaId: 'PASS', quota: 'PASS' },
    });
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'https://openapi.zalo.me/v3.0/oa/quota/message',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ user_id: 'probe-user-1' }) }),
    );
  });

  it('keeps permission denied unavailable', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({
      error: 0,
      data: { oaid: 'oa-1' },
    })).mockResolvedValueOnce(response({
      error: 2001,
      message: 'permission denied',
    }, 403));

    await expect(verifyZaloBroadcastAccess('tenant-1')).resolves.toMatchObject({
      ready: false,
      retryable: false,
      checks: { oaId: 'PASS', quota: 'FAIL' },
    });
  });

  it('returns a definitive failure when article creation is rejected', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(response({ error: 0, data: { oaid: 'oa-1' } }))
      .mockResolvedValueOnce(response({ error: 0, data: { promotion: { daily_total: 1 } } }))
      .mockResolvedValueOnce(response({ error: 400, message: 'invalid article' }, 400));

    await expect(zaloBroadcastPublisher.publish({
      tenantId: 'tenant-1',
      accountId: 'default',
      idempotencyKey: 'social:test:failure',
      content: {
        platform: 'ZALO_BROADCAST',
        title: 'Nhà phố',
        text: 'Nhà phố ven sông',
        link: null,
        imageUrls: ['https://cdn.test/home.jpg'],
        hashtags: [],
      },
    })).resolves.toMatchObject({
      status: 'FAILED',
      retryable: false,
      errorCode: 'ZALO_ARTICLE_CREATE_FAILED',
    });
  });

  it('requires provider confirmation ID for success', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(response({ error: 0, data: { oaid: 'oa-1' } }))
      .mockResolvedValueOnce(response({ error: 0, data: { promotion: { daily_total: 1 } } }))
      .mockResolvedValueOnce(response({ error: 0, data: { token: 'article-token' } }))
      .mockResolvedValueOnce(response({ error: 0, data: { id: 'article-1' } }))
      .mockResolvedValueOnce(response({ error: 0, data: {} }));

    await expect(zaloBroadcastPublisher.publish({
      tenantId: 'tenant-1',
      accountId: 'default',
      idempotencyKey: 'social:test:1',
      content: {
        platform: 'ZALO_BROADCAST',
        title: 'Nhà phố',
        text: 'Nhà phố ven sông',
        link: null,
        imageUrls: ['https://cdn.test/home.jpg'],
        hashtags: [],
      },
    })).resolves.toMatchObject({
      status: 'AMBIGUOUS',
      errorCode: 'ZALO_BROADCAST_CONFIRMATION_MISSING',
    });
  });

  it('returns PUBLISHED only with Zalo message ID', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(response({ error: 0, data: { oaid: 'oa-1' } }))
      .mockResolvedValueOnce(response({ error: 0, data: { promotion: { daily_total: 1 } } }))
      .mockResolvedValueOnce(response({ error: 0, data: { token: 'article-token' } }))
      .mockResolvedValueOnce(response({ error: 0, data: { id: 'article-1' } }))
      .mockResolvedValueOnce(response({ error: 0, data: { message_id: 'message-1' } }));

    await expect(zaloBroadcastPublisher.publish({
      tenantId: 'tenant-1',
      accountId: 'default',
      idempotencyKey: 'social:test:2',
      content: {
        platform: 'ZALO_BROADCAST',
        title: 'Nhà phố',
        text: 'Nhà phố ven sông',
        link: null,
        imageUrls: ['https://cdn.test/home.jpg'],
        hashtags: [],
      },
    })).resolves.toMatchObject({
      status: 'PUBLISHED',
      providerPostId: 'message-1',
      providerRequestId: 'zalo-broadcast:message-1',
    });
  });
});