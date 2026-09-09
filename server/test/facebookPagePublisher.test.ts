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
      caption: 'Nhà phố ven sông\nGiá: 3 tỷ VNĐ',
      published: true,
    });
  });

  it('publishes all approved images as one album post', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'photo-1' }), {
        status: 200,
        headers: { 'x-fb-trace-id': 'trace-photo-1' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'photo-2' }), {
        status: 200,
        headers: { 'x-fb-trace-id': 'trace-photo-2' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        post_id: 'page-1_43',
      }), {
        status: 200,
        headers: { 'x-fb-trace-id': 'trace-feed-1' },
      }));

    await expect(publishFacebookPageContent({
      pageId: 'page-1',
      pageAccessToken: 'page-token',
      content: {
        platform: 'FACEBOOK_PAGE',
        title: 'B',
        text: 'B',
        link: 'https://sgsland.vn/p/SGS-002',
        imageUrls: ['https://cdn.test/first.jpg', 'https://cdn.test/second.jpg'],
        hashtags: [],
      },
      idempotencyKey: 'social:target-2:1',
    })).resolves.toMatchObject({
      status: 'PUBLISHED',
      providerPostId: 'page-1_43',
      providerRequestId: 'trace-photo-1,trace-photo-2,trace-feed-1',
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toContain('/page-1/photos');
    expect(fetchMock.mock.calls[1][0]).toContain('/page-1/photos');
    expect(fetchMock.mock.calls[2][0]).toContain('/page-1/feed');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      url: 'https://cdn.test/first.jpg',
      published: false,
    });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({
      url: 'https://cdn.test/second.jpg',
      published: false,
    });
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toMatchObject({
      message: 'B',
      link: 'https://sgsland.vn/p/SGS-002',
      attached_media: [
        { media_fbid: 'photo-1' },
        { media_fbid: 'photo-2' },
      ],
    });
  });

  it('keeps a partial album upload ambiguous and does not continue publishing', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'photo-1' }), {
        status: 200,
        headers: { 'x-fb-trace-id': 'trace-photo-1' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        error: { code: 190, message: 'Invalid token' },
      }), {
        status: 400,
        headers: { 'x-fb-trace-id': 'trace-photo-2' },
      }));

    await expect(publishFacebookPageContent({
      pageId: 'page-1',
      pageAccessToken: 'page-token',
      content: {
        platform: 'FACEBOOK_PAGE',
        title: 'B',
        text: 'B',
        link: null,
        imageUrls: ['https://cdn.test/first.jpg', 'https://cdn.test/second.jpg'],
        hashtags: [],
      },
      idempotencyKey: 'social:target-2-partial:1',
    })).resolves.toMatchObject({
      status: 'AMBIGUOUS',
      errorCode: 'FACEBOOK_ALBUM_UPLOAD_OUTCOME_UNKNOWN',
      providerRequestId: 'trace-photo-1,trace-photo-2',
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects an album larger than the provider limit before contacting Facebook', async () => {
    await expect(publishFacebookPageContent({
      pageId: 'page-1',
      pageAccessToken: 'page-token',
      content: {
        platform: 'FACEBOOK_PAGE',
        title: 'C',
        text: 'C',
        link: null,
        imageUrls: Array.from({ length: 11 }, (_, index) => `https://cdn.test/${index}.jpg`),
        hashtags: [],
      },
      idempotencyKey: 'social:target-2-too-many:1',
    })).resolves.toMatchObject({
      status: 'FAILED',
      errorCode: 'FACEBOOK_TOO_MANY_IMAGES',
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an album image URL before contacting Facebook', async () => {
    await expect(publishFacebookPageContent({
      pageId: 'page-1',
      pageAccessToken: 'page-token',
      content: {
        platform: 'FACEBOOK_PAGE',
        title: 'D',
        text: 'D',
        link: null,
        imageUrls: ['https://cdn.test/first.jpg', 'file:///second.jpg'],
        hashtags: [],
      },
      idempotencyKey: 'social:target-2-invalid:1',
    })).resolves.toMatchObject({
      status: 'FAILED',
      errorCode: 'FACEBOOK_IMAGE_URL_INVALID',
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('includes the provider trace when an album feed result is ambiguous', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'photo-1' }), {
        status: 200,
        headers: { 'x-fb-trace-id': 'trace-photo-1' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'photo-2' }), {
        status: 200,
        headers: { 'x-fb-trace-id': 'trace-photo-2' },
      }))
      .mockResolvedValueOnce(new Response('{}', {
        status: 200,
        headers: { 'x-fb-trace-id': 'trace-feed-1' },
      }));

    await expect(publishFacebookPageContent({
      pageId: 'page-1',
      pageAccessToken: 'page-token',
      content: {
        platform: 'FACEBOOK_PAGE',
        title: 'E',
        text: 'E',
        link: null,
        imageUrls: ['https://cdn.test/first.jpg', 'https://cdn.test/second.jpg'],
        hashtags: [],
      },
      idempotencyKey: 'social:target-2-missing-id:1',
    })).resolves.toMatchObject({
      status: 'AMBIGUOUS',
      errorCode: 'FACEBOOK_ALBUM_MISSING_POST_ID',
      providerRequestId: 'trace-photo-1,trace-photo-2,trace-feed-1',
    });
  });

  it('keeps the single-image photo contract unchanged', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      post_id: 'page-1_44',
    }), { status: 200 }));

    await expect(publishFacebookPageContent({
      pageId: 'page-1',
      pageAccessToken: 'page-token',
      content: {
        platform: 'FACEBOOK_PAGE',
        title: 'B',
        text: 'B',
        link: 'https://sgsland.vn/p/SGS-002',
        imageUrls: ['https://cdn.test/first.jpg'],
        hashtags: [],
      },
      idempotencyKey: 'social:target-2-single:1',
    })).resolves.toMatchObject({ status: 'PUBLISHED' });

    expect(fetchMock.mock.calls[0][0]).toContain('/page-1/photos');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      url: 'https://cdn.test/first.jpg',
      caption: 'B',
      published: true,
    });
  });

  it('rejects a publication without an image before contacting Facebook', async () => {
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
      idempotencyKey: 'social:target-3:1',
    })).resolves.toMatchObject({
      status: 'FAILED',
      errorCode: 'FACEBOOK_IMAGE_REQUIRED',
    });
    expect(fetchMock).not.toHaveBeenCalled();
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
        imageUrls: ['https://cdn.test/house.jpg'],
        hashtags: [],
      },
      idempotencyKey: 'social:target-4:1',
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
        imageUrls: ['https://cdn.test/house.jpg'],
        hashtags: [],
      },
      idempotencyKey: 'social:target-5:1',
    })).resolves.toMatchObject({
      status: 'AMBIGUOUS',
      errorCode: 'FACEBOOK_MISSING_POST_ID',
    });
  });
});