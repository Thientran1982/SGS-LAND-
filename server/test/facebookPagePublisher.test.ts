import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '../middleware/logger';
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
    vi.restoreAllMocks();
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
    fetchMock.mockResolvedValueOnce(new Response('image bytes', {
      status: 200,
      headers: { 'content-type': 'image/jpeg' },
    })).mockResolvedValueOnce(new Response(JSON.stringify({
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
    expect(fetchMock.mock.calls[1][0]).toContain('/page-1/photos');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({
      url: 'https://cdn.test/house.jpg',
      caption: 'Nhà phố ven sông\nGiá: 3 tỷ VNĐ',
      published: true,
    });
  });

  it('publishes all approved images as one album post', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('image bytes', {
        status: 200,
        headers: { 'content-type': 'image/jpeg' },
      }))
      .mockResolvedValueOnce(new Response('image bytes', {
        status: 200,
        headers: { 'content-type': 'image/jpeg' },
      }))
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

    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(fetchMock.mock.calls[2][0]).toContain('/page-1/photos');
    expect(fetchMock.mock.calls[3][0]).toContain('/page-1/photos');
    expect(fetchMock.mock.calls[4][0]).toContain('/page-1/feed');
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toMatchObject({
      url: 'https://cdn.test/first.jpg',
      published: false,
    });
    expect(JSON.parse(fetchMock.mock.calls[3][1].body)).toMatchObject({
      url: 'https://cdn.test/second.jpg',
      published: false,
    });
    expect(JSON.parse(fetchMock.mock.calls[4][1].body)).toMatchObject({
      message: 'B',
      attached_media: [
        { media_fbid: 'photo-1' },
        { media_fbid: 'photo-2' },
      ],
    });
    expect(JSON.parse(fetchMock.mock.calls[4][1].body)).not.toHaveProperty('link');
  });

  it('keeps a partial album upload ambiguous and does not continue publishing', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('image bytes', {
        status: 200,
        headers: { 'content-type': 'image/jpeg' },
      }))
      .mockResolvedValueOnce(new Response('image bytes', {
        status: 200,
        headers: { 'content-type': 'image/jpeg' },
      }))
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

    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('logs the provider reason when Facebook rejects an album image upload', async () => {
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    fetchMock
      .mockResolvedValueOnce(new Response('image bytes', {
        status: 200,
        headers: { 'content-type': 'image/jpeg' },
      }))
      .mockResolvedValueOnce(new Response('image bytes', {
        status: 200,
        headers: { 'content-type': 'image/jpeg' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        error: { code: 190, type: 'OAuthException', message: 'Invalid token' },
      }), {
        status: 400,
        headers: { 'x-fb-trace-id': 'trace-photo-rejected' },
      }));

    await expect(publishFacebookPageContent({
      pageId: 'page-1',
      pageAccessToken: 'page-token',
      content: {
        platform: 'FACEBOOK_PAGE',
        title: 'B',
        text: 'B',
        link: 'https://sgsland.vn/bds/house-page-uuid',
        imageUrls: ['https://cdn.test/first.jpg', 'https://cdn.test/second.jpg'],
        hashtags: [],
      },
      idempotencyKey: 'social:target-upload-rejected:1',
    })).resolves.toMatchObject({
      status: 'FAILED',
      errorCode: 'FACEBOOK_190',
      safeMessage: expect.stringContaining('Invalid token'),
    });

    expect(errorSpy).toHaveBeenCalledWith(
      '[Facebook] Public publication request failed',
      expect.objectContaining({
        phase: 'album-photo',
        pageId: 'page-1',
        httpStatus: 400,
        providerErrorCode: 190,
        providerErrorMessage: 'Invalid token',
        facebookTraceId: 'trace-photo-rejected',
      }),
    );
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

  it('rejects an HTTP image URL before contacting Facebook', async () => {
    await expect(publishFacebookPageContent({
      pageId: 'page-1',
      pageAccessToken: 'page-token',
      content: {
        platform: 'FACEBOOK_PAGE',
        title: 'D',
        text: 'D',
        link: null,
        imageUrls: ['http://cdn.test/first.jpg'],
        hashtags: [],
      },
      idempotencyKey: 'social:target-http-image:1',
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
        headers: { 'content-type': 'image/jpeg' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'photo-2' }), {
        status: 200,
        headers: { 'content-type': 'image/jpeg' },
      }))
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
    fetchMock
      .mockResolvedValueOnce(new Response('image bytes', {
        status: 200,
        headers: { 'content-type': 'image/jpeg' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
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

    expect(fetchMock.mock.calls[1][0]).toContain('/page-1/photos');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({
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
    fetchMock.mockResolvedValueOnce(new Response('image bytes', {
      status: 200,
      headers: { 'content-type': 'image/jpeg' },
    })).mockRejectedValueOnce(new Error('socket closed'));
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

    fetchMock
      .mockResolvedValueOnce(new Response('image bytes', {
        status: 200,
        headers: { 'content-type': 'image/jpeg' },
      }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));
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

describe('Facebook album contract smoke', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const albumContent = (imageUrls = [
    'https://cdn.test/album-first.jpg',
    'https://cdn.test/album-second.jpg',
  ]) => ({
    platform: 'FACEBOOK_PAGE' as const,
    title: 'Album smoke',
    text: 'Album smoke caption',
    link: 'https://sgsland.vn/p/SMOKE-001',
    imageUrls,
    hashtags: ['#SMOKE'],
  });

  const publishAlbum = (idempotencyKey = 'smoke:facebook-album:1') =>
    publishFacebookPageContent({
      pageId: 'page-1',
      pageAccessToken: 'fake-page-token',
      content: albumContent(),
      idempotencyKey,
    });

  const expectPhotoRequest = (
    call: unknown[],
    imageUrl: string,
    index: number,
    idempotencyKey: string,
  ) => {
    expect(call[0]).toContain('/page-1/photos?access_token=fake-page-token');
    expect(call[1]).toMatchObject({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-SGS-Delivery-Key': idempotencyKey,
        'X-SGS-Album-Photo-Index': String(index),
      },
    });
    expect(JSON.parse(String((call[1] as RequestInit).body))).toEqual({
      url: imageUrl,
      published: false,
    });
  };

  it('uploads unpublished photos in order, then creates one feed post', async () => {
    const idempotencyKey = 'smoke:facebook-album:order';
    fetchMock
      .mockResolvedValueOnce(new Response('image bytes', {
        status: 200,
        headers: { 'content-type': 'image/jpeg' },
      }))
      .mockResolvedValueOnce(new Response('image bytes', {
        status: 200,
        headers: { 'content-type': 'image/jpeg' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'media-1' }), {
        status: 200,
        headers: { 'x-fb-trace-id': 'trace-media-1' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'media-2' }), {
        status: 200,
        headers: { 'x-fb-trace-id': 'trace-media-2' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ post_id: 'page-1_album-1' }), {
        status: 200,
        headers: { 'x-fb-trace-id': 'trace-feed-1' },
      }));

    await expect(publishAlbum(idempotencyKey)).resolves.toMatchObject({
      status: 'PUBLISHED',
      providerPostId: 'page-1_album-1',
      providerRequestId: 'trace-media-1,trace-media-2,trace-feed-1',
    });

    expect(fetchMock).toHaveBeenCalledTimes(5);
    expectPhotoRequest(fetchMock.mock.calls[2], 'https://cdn.test/album-first.jpg', 0, idempotencyKey);
    expectPhotoRequest(fetchMock.mock.calls[3], 'https://cdn.test/album-second.jpg', 1, idempotencyKey);
    expect(fetchMock.mock.calls[4][0]).toContain('/page-1/feed?access_token=fake-page-token');
    expect(fetchMock.mock.calls[4][1]).toMatchObject({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-SGS-Delivery-Key': idempotencyKey,
      },
    });
    expect(JSON.parse(String((fetchMock.mock.calls[4][1] as RequestInit).body))).toEqual({
      message: 'Album smoke caption',
      attached_media: [
        { media_fbid: 'media-1' },
        { media_fbid: 'media-2' },
      ],
    });
  });

  it('keeps a timeout after a partial upload ambiguous', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('image bytes', {
        status: 200,
        headers: { 'content-type': 'image/jpeg' },
      }))
      .mockResolvedValueOnce(new Response('image bytes', {
        status: 200,
        headers: { 'content-type': 'image/jpeg' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'media-1' }), {
        status: 200,
        headers: { 'x-fb-trace-id': 'trace-media-1' },
      }))
      .mockRejectedValueOnce(new DOMException('The operation timed out', 'TimeoutError'));

    await expect(publishAlbum('smoke:facebook-album:timeout')).resolves.toMatchObject({
      status: 'AMBIGUOUS',
      errorCode: 'FACEBOOK_ALBUM_NETWORK_OUTCOME_UNKNOWN',
      providerRequestId: 'trace-media-1',
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[4]).toBeUndefined();
  });

  it('keeps a provider rejection after one accepted photo partial and ambiguous', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('image bytes', {
        status: 200,
        headers: { 'content-type': 'image/jpeg' },
      }))
      .mockResolvedValueOnce(new Response('image bytes', {
        status: 200,
        headers: { 'content-type': 'image/jpeg' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'media-1' }), {
        status: 200,
        headers: { 'x-fb-trace-id': 'trace-media-1' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        error: { code: 100, message: 'contract changed' },
      }), {
        status: 400,
        headers: { 'x-fb-trace-id': 'trace-media-2' },
      }));

    await expect(publishAlbum('smoke:facebook-album:partial')).resolves.toMatchObject({
      status: 'AMBIGUOUS',
      errorCode: 'FACEBOOK_ALBUM_UPLOAD_OUTCOME_UNKNOWN',
      providerRequestId: 'trace-media-1,trace-media-2',
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[4]).toBeUndefined();
  });

  it('keeps a successful photo response without a media ID ambiguous', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('image bytes', {
        status: 200,
        headers: { 'content-type': 'image/jpeg' },
      }))
      .mockResolvedValueOnce(new Response('image bytes', {
        status: 200,
        headers: { 'content-type': 'image/jpeg' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'x-fb-trace-id': 'trace-media-missing' },
      }));

    await expect(publishAlbum('smoke:facebook-album:missing-media')).resolves.toMatchObject({
      status: 'AMBIGUOUS',
      errorCode: 'FACEBOOK_ALBUM_MISSING_MEDIA_ID',
      providerRequestId: 'trace-media-missing',
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[3]).toBeUndefined();
  });

  it('keeps a feed response without a post ID ambiguous', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('image bytes', {
        status: 200,
        headers: { 'content-type': 'image/jpeg' },
      }))
      .mockResolvedValueOnce(new Response('image bytes', {
        status: 200,
        headers: { 'content-type': 'image/jpeg' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'media-1' }), {
        status: 200,
        headers: { 'x-fb-trace-id': 'trace-media-1' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'media-2' }), {
        status: 200,
        headers: { 'x-fb-trace-id': 'trace-media-2' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'x-fb-trace-id': 'trace-feed-missing' },
      }));

    await expect(publishAlbum('smoke:facebook-album:missing-post')).resolves.toMatchObject({
      status: 'AMBIGUOUS',
      errorCode: 'FACEBOOK_ALBUM_MISSING_POST_ID',
      providerRequestId: 'trace-media-1,trace-media-2,trace-feed-missing',
    });
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(fetchMock.mock.calls[5]).toBeUndefined();
  });

  it('rejects an image that is not publicly fetchable before contacting Facebook', async () => {
    fetchMock.mockResolvedValueOnce(new Response('private', {
      status: 403,
      headers: { 'content-type': 'text/html' },
    }));

    const result = await publishFacebookPageContent({
      pageId: 'page-1',
      pageAccessToken: 'fake-page-token',
      content: albumContent(['https://cdn.test/private.jpg?signature=secret']),
      idempotencyKey: 'smoke:facebook-image-not-public',
    });

    expect(result).toMatchObject({
      status: 'FAILED',
      retryable: false,
      errorCode: 'FACEBOOK_IMAGE_NOT_PUBLIC',
    });
    expect(result.safeMessage).toContain('https://cdn.test/private.jpg');
    expect(result.safeMessage).not.toContain('signature=secret');
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe('https://cdn.test/private.jpg?signature=secret');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'GET',
      redirect: 'follow',
      credentials: 'omit',
      headers: { Accept: 'image/*' },
    });
    expect(JSON.stringify(fetchMock.mock.calls[0][1])).not.toContain('fake-page-token');
  });
});
