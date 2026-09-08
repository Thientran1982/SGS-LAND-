import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  publishFacebookPageContent,
  verifyFacebookPageAccess,
} from '../services/facebookService';

describe('Facebook Page publisher contract', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('accepts a Page token only when Facebook returns the same Page ID', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      id: 'page-1',
      name: 'SGS Land',
      link: 'https://facebook.com/sgsland',
    }), { status: 200 }));

    await expect(verifyFacebookPageAccess('page-1', 'page-token')).resolves.toMatchObject({
      valid: true,
      pageName: 'SGS Land',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/page-1?fields=id,name,link&access_token='),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('publishes a single-image post and requires a provider post ID', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      post_id: 'page-1_42',
    }), {
      status: 200,
      headers: { 'x-fb-trace-id': 'trace-1' },
    }));

    const result = await publishFacebookPageContent({
      pageId: 'page-1',
      pageAccessToken: 'page-token',
      content: {
        platform: 'FACEBOOK_PAGE',
        title: 'Nhà phố ven sông',
        text: 'Nhà phố ven sông\nGiá: 3 tỷ VNĐ',
        link: 'https://sgsland.vn/p/SGS-001',
        imageUrls: ['https://cdn.test/house.jpg'],
        hashtags: ['#SGSLAND'],
      },
      idempotencyKey: 'social:target-1:1',
    });

    expect(result).toMatchObject({
      status: 'PUBLISHED',
      providerPostId: 'page-1_42',
      providerRequestId: 'trace-1',
    });
    expect(fetchMock.mock.calls[0][0]).toContain('/page-1/photos');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      url: 'https://cdn.test/house.jpg',
      published: true,
    });
  });

  it('keeps network and missing-ID outcomes ambiguous instead of retrying blindly', async () => {
    fetchMock.mockRejectedValueOnce(new Error('socket closed'));
    await expect(publishFacebookPageContent({
      pageId: 'page-1',
      pageAccessToken: 'page-token',
      content: {
        platform: 'FACEBOOK_PAGE',
        title: 'A',
        text: 'A',
        link: null,
        imageUrls: [],
        hashtags: [],
      },
      idempotencyKey: 'social:target-2:1',
    })).resolves.toMatchObject({
      status: 'AMBIGUOUS',
      errorCode: 'FACEBOOK_NETWORK_OUTCOME_UNKNOWN',
    });

    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 200 }));
    await expect(publishFacebookPageContent({
      pageId: 'page-1',
      pageAccessToken: 'page-token',
      content: {
        platform: 'FACEBOOK_PAGE',
        title: 'B',
        text: 'B',
        link: null,
        imageUrls: [],
        hashtags: [],
      },
      idempotencyKey: 'social:target-3:1',
    })).resolves.toMatchObject({
      status: 'AMBIGUOUS',
      errorCode: 'FACEBOOK_MISSING_POST_ID',
    });
  });
});