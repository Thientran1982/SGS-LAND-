/**
 * Facebook Messenger Send API Service
 *
 * Sends messages from a connected Facebook Page back to users
 * via the Messenger Platform Send API.
 *
 * Docs: https://developers.facebook.com/docs/messenger-platform/send-messages
 */
import { logger } from '../middleware/logger';
import { enterpriseConfigRepository } from '../repositories/enterpriseConfigRepository';
import {
  FACEBOOK_PAGE_MAX_IMAGES,
  type SocialPlatformContent,
  type SocialPublishResult,
} from '../social-publishing/types';

const FB_GRAPH_VERSION = process.env.FB_GRAPH_VERSION || 'v19.0';
const FB_GRAPH_API = `https://graph.facebook.com/${FB_GRAPH_VERSION}`;
export interface FacebookSendResult {
  success: boolean;
  messageId?: string;
  recipientId?: string;
  error?: string;
}

type FacebookGraphResult = {
  id?: string;
  post_id?: string;
  name?: string;
  link?: string;
  message_id?: string;
  recipient_id?: string;
  error?: { code?: number; message?: string; type?: string };
  [key: string]: unknown;
};

async function graphRequest(
  path: string,
  accessToken: string,
  init: RequestInit = {},
): Promise<{ response: Response; body: FacebookGraphResult }> {
  const separator = path.includes('?') ? '&' : '?';
  const response = await fetch(
    `${FB_GRAPH_API}/${path}${separator}access_token=${encodeURIComponent(accessToken)}`,
    {
      ...init,
      signal: init.signal || AbortSignal.timeout(12_000),
    },
  );
  const body = await response.json().catch(() => ({})) as FacebookGraphResult;
  return { response, body };
}

export async function verifyFacebookPageAccess(
  pageId: string,
  pageAccessToken: string,
): Promise<{ valid: boolean; pageId?: string; pageName?: string; pageUrl?: string; reason?: string; retryable?: boolean }> {
  if (!pageId || !pageAccessToken) {
    return { valid: false, reason: 'Thiếu Page ID hoặc Page Access Token.' };
  }

  try {
    const { response, body } = await graphRequest(
      `${encodeURIComponent(pageId)}?fields=id,name,link`,
      pageAccessToken,
    );
    if (!response.ok || body.error) {
      return {
        valid: false,
        retryable: response.status === 429 || response.status >= 500,
        reason: `Facebook từ chối xác minh Page (${body.error?.message || `HTTP ${response.status}`}).`,
      };
    }
    if (String(body.id || '') !== String(pageId)) {
      return { valid: false, reason: 'Facebook trả về Page ID khác với Page ID đã nhập.' };
    }
    return {
      valid: true,
      pageId: String(body.id),
      pageName: body.name ? String(body.name) : undefined,
      pageUrl: body.link ? String(body.link) : undefined,
    };
  } catch {
    return { valid: false, retryable: true, reason: 'Không thể kết nối Facebook để xác minh Page.' };
  }
}
/**
 * Send a text message to a Facebook user via Page Messenger.
 * @param pageAccessToken - Page Access Token (stored in enterprise config)
 * @param recipientId     - Facebook user PSID (from webhook sender.id)
 * @param text            - Message content (max 2000 chars)
 */
export async function sendFacebookTextMessage(
  pageAccessToken: string,
  recipientId: string,
  text: string,
  deliveryKey?: string,
): Promise<FacebookSendResult> {
  try {
    const body = {
      recipient: { id: recipientId },
      message: { text: text.slice(0, 2000) },
      messaging_type: 'RESPONSE',
    };
    const url = `${FB_GRAPH_API}/me/messages?access_token=${encodeURIComponent(pageAccessToken)}`;

    const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
    if (!response.ok) {
      const err: any = new Error(`HTTP ${response.status}`);
      err.status = response.status;
      throw err;
    }
    const json: any = await response.json();
    if (json.error) {
      logger.warn(`[Facebook] Send failed: code=${json.error.code} message=${json.error.message}`);
      return {
        success: false,
        error: `Facebook API error ${json.error.code}: ${json.error.message}`,
      };
    }
    logger.info(`[Facebook] Message sent to ${recipientId}, msgId=${json.message_id}, deliveryKey=${deliveryKey || 'none'}`);
    return {
      success: true,
      messageId: json.message_id,
      recipientId: json.recipient_id,
    };
  } catch (err: any) {
    logger.error('[Facebook] Network error sending message:', err);
    return { success: false, error: err.message };
  }
}

function providerPostUrl(postId: string): string {
  return `https://www.facebook.com/${encodeURIComponent(postId)}`;
}

function providerRequestId(traceIds: string[]): string | undefined {
  return traceIds.length ? traceIds.join(',') : undefined;
}

function validateImageUrls(imageUrls: string[]): string | null {
  for (const imageUrl of imageUrls) {
    try {
      const parsedImageUrl = new URL(imageUrl);
      if (parsedImageUrl.protocol !== 'https:') throw new Error('unsupported protocol');
    } catch {
      return imageUrl;
    }
  }
  return null;
}

function invalidImageResult(): SocialPublishResult {
  return {
    status: 'FAILED',
    retryable: false,
    errorCode: 'FACEBOOK_IMAGE_URL_INVALID',
    safeMessage: 'URL ảnh Facebook phải là địa chỉ HTTPS tuyệt đối và công khai.',
  };
}

function safeImageUrlLabel(imageUrl: string): string {
  try {
    const parsedImageUrl = new URL(imageUrl);
    return `${parsedImageUrl.origin}${parsedImageUrl.pathname}`;
  } catch {
    return 'URL ảnh đã cung cấp';
  }
}

function logFacebookProviderFailure(
  phase: string,
  pageId: string,
  response: Response,
  body: FacebookGraphResult,
  details: Record<string, unknown> = {},
): void {
  logger.error('[Facebook] Public publication request failed', {
    phase,
    pageId,
    httpStatus: response.status,
    providerErrorCode: body.error?.code,
    providerErrorType: body.error?.type,
    providerErrorMessage: body.error?.message,
    facebookTraceId: response.headers.get('x-fb-trace-id') || undefined,
    ...details,
  });
}

function ambiguousAlbumResult(
  errorCode: string,
  safeMessage: string,
  traceIds: string[],
): SocialPublishResult {
  return {
    status: 'AMBIGUOUS',
    providerRequestId: providerRequestId(traceIds),
    errorCode,
    safeMessage,
  };
}

export async function publishFacebookPageContent(input: {
  pageId: string;
  pageAccessToken: string;
  content: SocialPlatformContent;
  idempotencyKey: string;
}): Promise<SocialPublishResult> {
  const imageUrls = Array.isArray(input.content.imageUrls)
    ? input.content.imageUrls
    : [];
  if (!imageUrls.length) {
    logger.error('[Facebook] Refusing publication without approved images', {
      pageId: input.pageId,
      imageCount: 0,
      idempotencyKey: input.idempotencyKey,
    });
    return {
      status: 'FAILED',
      retryable: false,
      errorCode: 'FACEBOOK_IMAGE_REQUIRED',
      safeMessage: 'Facebook publication cần ít nhất một ảnh đại diện.',
    };
  }
  if (imageUrls.length > FACEBOOK_PAGE_MAX_IMAGES) {
    logger.error('[Facebook] Refusing publication with too many images', {
      pageId: input.pageId,
      imageCount: imageUrls.length,
      maxImages: FACEBOOK_PAGE_MAX_IMAGES,
      idempotencyKey: input.idempotencyKey,
    });
    return {
      status: 'FAILED',
      retryable: false,
      errorCode: 'FACEBOOK_TOO_MANY_IMAGES',
      safeMessage: `Facebook publication chỉ hỗ trợ tối đa ${FACEBOOK_PAGE_MAX_IMAGES} ảnh trong một album.`,
    };
  }

  const invalidImageUrl = validateImageUrls(imageUrls);
  if (invalidImageUrl) {
    logger.error('[Facebook] Refusing publication with an invalid image URL', {
      pageId: input.pageId,
      imageUrl: safeImageUrlLabel(invalidImageUrl),
      idempotencyKey: input.idempotencyKey,
    });
    return invalidImageResult();
  }

  for (const imageUrl of imageUrls) {
    const validation = await validatePublicImage(imageUrl);
    if (!validation.valid) {
      logger.error('[Facebook] Approved image is not publicly fetchable', {
        pageId: input.pageId,
        imageUrl: safeImageUrlLabel(imageUrl),
        reason: validation.reason,
        idempotencyKey: input.idempotencyKey,
      });
      return unavailableImageResult(imageUrl, validation.reason);
    }
  }

  const pagePath = encodeURIComponent(input.pageId);
  const traceIds: string[] = [];
  const requestHeaders = {
    'Content-Type': 'application/json',
    'X-SGS-Delivery-Key': input.idempotencyKey,
  };

  // A single image can be published directly as a Page photo. Keeping this
  // path preserves the existing provider contract for the common case.
  if (imageUrls.length === 1) {
    const path = `${pagePath}/photos`;
    const body = {
      url: imageUrls[0],
      caption: input.content.text,
      published: true,
    };
    try {
      const { response, body: result } = await graphRequest(
        path,
        input.pageAccessToken,
        {
          method: 'POST',
          headers: requestHeaders,
          body: JSON.stringify(body),
        },
      );
      const requestTraceId = response.headers.get('x-fb-trace-id') || undefined;
      if (requestTraceId) traceIds.push(requestTraceId);
      if (response.ok && !result.error) {
        const postId = String(result.post_id || result.id || '').trim();
        if (!postId) {
          logger.error('[Facebook] Single-photo response did not include a post ID', {
            pageId: input.pageId,
            imageUrl: safeImageUrlLabel(imageUrls[0]),
            httpStatus: response.status,
            facebookTraceId: requestTraceId,
            idempotencyKey: input.idempotencyKey,
          });
          return ambiguousAlbumResult(
            'FACEBOOK_MISSING_POST_ID',
            'Facebook phản hồi thành công nhưng không trả về post ID.',
            traceIds,
          );
        }
        return {
          status: 'PUBLISHED',
          providerPostId: postId,
          providerPostUrl: providerPostUrl(postId),
          providerRequestId: providerRequestId(traceIds),
        };
      }

      logFacebookProviderFailure('single-photo', input.pageId, response, result, {
        imageUrl: safeImageUrlLabel(imageUrls[0]),
        idempotencyKey: input.idempotencyKey,
      });
      const status = response.status;
      if (status === 429) {
        return {
          status: 'FAILED',
          retryable: true,
          providerRequestId: providerRequestId(traceIds),
          errorCode: 'FACEBOOK_RATE_LIMITED',
          safeMessage: 'Facebook giới hạn tần suất; publication sẽ được retry có backoff.',
        };
      }
      if (status >= 500 || !response.ok && !result.error) {
        return ambiguousAlbumResult(
          'FACEBOOK_OUTCOME_UNKNOWN',
          'Facebook không xác nhận kết quả đăng; không tự retry để tránh đăng trùng.',
          traceIds,
        );
      }
      return {
        status: 'FAILED',
        retryable: false,
        providerRequestId: providerRequestId(traceIds),
        errorCode: `FACEBOOK_${result.error?.code || status}`,
        safeMessage: `Facebook từ chối đăng bài: ${result.error?.message || `HTTP ${status}`}.`,
      };
    } catch (error) {
      logger.error('[Facebook] Single-photo publication request threw an error', {
        pageId: input.pageId,
        imageUrl: safeImageUrlLabel(imageUrls[0]),
        errorMessage: error instanceof Error ? error.message : String(error),
        idempotencyKey: input.idempotencyKey,
      });
      return ambiguousAlbumResult(
        'FACEBOOK_NETWORK_OUTCOME_UNKNOWN',
        'Mất kết nối sau khi gửi yêu cầu Facebook; cần kiểm tra thủ công, không tự retry.',
        traceIds,
      );
    }
  }

  const mediaIds: string[] = [];
  try {
    for (const [index, imageUrl] of imageUrls.entries()) {
      const { response, body: result } = await graphRequest(
        `${pagePath}/photos`,
        input.pageAccessToken,
        {
          method: 'POST',
          headers: {
            ...requestHeaders,
            'X-SGS-Album-Photo-Index': String(index),
          },
          body: JSON.stringify({
            url: imageUrl,
            published: false,
          }),
        },
      );
      const requestTraceId = response.headers.get('x-fb-trace-id') || undefined;
      if (requestTraceId) traceIds.push(requestTraceId);
      if (response.ok && !result.error) {
        const mediaId = String(result.id || result.post_id || '').trim();
        if (!mediaId) {
          logger.error('[Facebook] Album photo response did not include a media ID', {
            pageId: input.pageId,
            imageIndex: index,
            imageUrl: safeImageUrlLabel(imageUrl),
            httpStatus: response.status,
            facebookTraceId: requestTraceId,
            idempotencyKey: input.idempotencyKey,
          });
          return ambiguousAlbumResult(
            'FACEBOOK_ALBUM_MISSING_MEDIA_ID',
            `Facebook đã xử lý ${mediaIds.length + 1}/${imageUrls.length} ảnh nhưng không trả về media ID; cần kiểm tra thủ công, không tự retry.`,
            traceIds,
          );
        }
        mediaIds.push(mediaId);
        continue;
      }

      logFacebookProviderFailure('album-photo', input.pageId, response, result, {
        imageIndex: index,
        imageUrl: safeImageUrlLabel(imageUrl),
        idempotencyKey: input.idempotencyKey,
      });
      const status = response.status;
      if (mediaIds.length > 0 || status >= 500 || (!response.ok && !result.error)) {
        return ambiguousAlbumResult(
          'FACEBOOK_ALBUM_UPLOAD_OUTCOME_UNKNOWN',
          `Facebook không xác nhận đầy đủ album (${mediaIds.length}/${imageUrls.length} ảnh đã được nhận); cần kiểm tra thủ công, không tự retry.`,
          traceIds,
        );
      }
      if (status === 429) {
        return {
          status: 'FAILED',
          retryable: true,
          providerRequestId: providerRequestId(traceIds),
          errorCode: 'FACEBOOK_RATE_LIMITED',
          safeMessage: 'Facebook giới hạn tần suất; publication sẽ được retry có backoff.',
        };
      }
      return {
        status: 'FAILED',
        retryable: false,
        providerRequestId: providerRequestId(traceIds),
        errorCode: `FACEBOOK_${result.error?.code || status}`,
        safeMessage: `Facebook từ chối đăng album: ${result.error?.message || `HTTP ${status}`}.`,
      };
    }

    const { response, body: result } = await graphRequest(
      `${pagePath}/feed`,
      input.pageAccessToken,
      {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify({
          message: input.content.text,
          // Do not send a link field together with attached_media. Facebook
          // may render the link preview and silently omit the album photos.
          attached_media: mediaIds.map(mediaFbid => ({ media_fbid: mediaFbid })),
        }),
      },
    );
    const requestTraceId = response.headers.get('x-fb-trace-id') || undefined;
    if (requestTraceId) traceIds.push(requestTraceId);
    if (response.ok && !result.error) {
      const postId = String(result.post_id || result.id || '').trim();
      if (!postId) {
        logger.error('[Facebook] Album feed response did not include a post ID', {
          pageId: input.pageId,
          imageCount: mediaIds.length,
          httpStatus: response.status,
          facebookTraceId: requestTraceId,
          idempotencyKey: input.idempotencyKey,
        });
        return ambiguousAlbumResult(
          'FACEBOOK_ALBUM_MISSING_POST_ID',
          `Facebook đã nhận ${mediaIds.length} ảnh nhưng không trả về post ID; cần kiểm tra thủ công, không tự retry.`,
          traceIds,
        );
      }
      return {
        status: 'PUBLISHED',
        providerPostId: postId,
        providerPostUrl: providerPostUrl(postId),
        providerRequestId: providerRequestId(traceIds),
      };
    }

    logFacebookProviderFailure('album-feed', input.pageId, response, result, {
      imageCount: mediaIds.length,
      idempotencyKey: input.idempotencyKey,
    });
    return ambiguousAlbumResult(
      'FACEBOOK_ALBUM_OUTCOME_UNKNOWN',
      `Facebook không xác nhận kết quả album sau khi đã nhận ${mediaIds.length} ảnh; cần kiểm tra thủ công, không tự retry.`,
      traceIds,
    );
  } catch (error) {
    logger.error('[Facebook] Album publication request threw an error', {
      pageId: input.pageId,
      uploadedImageCount: mediaIds.length,
      imageCount: imageUrls.length,
      errorMessage: error instanceof Error ? error.message : String(error),
      idempotencyKey: input.idempotencyKey,
    });
    return ambiguousAlbumResult(
      'FACEBOOK_ALBUM_NETWORK_OUTCOME_UNKNOWN',
      `Mất kết nối sau khi gửi album (${mediaIds.length}/${imageUrls.length} ảnh đã được nhận); cần kiểm tra thủ công, không tự retry.`,
      traceIds,
    );
  }
}
/**
 * Find the Page Access Token for a given Facebook Page ID from enterprise config.
 * Returns null if the page is not configured or has no access token.
 */
export async function getFacebookPageAccessToken(
  tenantId: string,
  pageId: string
): Promise<string | null> {
  try {
    const config = await enterpriseConfigRepository.getConfig(tenantId);
    const pages: any[] = config?.facebookPages || [];
    const page = pages.find((p: any) => p.id === pageId);
    return page?.accessToken || null;
  } catch {
    return null;
  }
}
/**
 * Find any configured Facebook Page for this tenant.
 * Returns the first page that has an access token (for tenants with a single page).
 */
export async function getFacebookDefaultPage(
  tenantId: string
): Promise<{ pageId: string; accessToken: string } | null> {
  try {
    const config = await enterpriseConfigRepository.getConfig(tenantId);
    const pages: any[] = config?.facebookPages || [];
    const page = pages.find((p: any) => p.accessToken);
    if (!page) return null;
    return { pageId: page.id, accessToken: page.accessToken };
  } catch {
    return null;
  }
}

function unavailableImageResult(imageUrl: string, reason: string): SocialPublishResult {
  return {
    status: 'FAILED',
    retryable: false,
    errorCode: 'FACEBOOK_IMAGE_NOT_PUBLIC',
    safeMessage: `Facebook không thể tải ảnh công khai (${safeImageUrlLabel(imageUrl)}): ${reason}. Không gửi yêu cầu đăng tới Facebook.`,
  };
}

async function validatePublicImage(imageUrl: string): Promise<{ valid: true } | { valid: false; reason: string }> {
  try {
    // This probe intentionally has no provider token, cookies, or authorization
    // headers. Facebook must be able to retrieve the image as an anonymous client.
    const response = await fetch(imageUrl, {
      method: 'GET',
      redirect: 'follow',
      credentials: 'omit',
      headers: { Accept: 'image/*' },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return { valid: false, reason: `origin trả về HTTP ${response.status}` };
    }

    const contentType = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
    if (!contentType?.startsWith('image/')) {
      return {
        valid: false,
        reason: `origin không trả về nội dung ảnh (Content-Type: ${contentType || 'không có'})`,
      };
    }

    const body = await response.arrayBuffer();
    if (body.byteLength === 0) {
      return { valid: false, reason: 'origin trả về nội dung ảnh rỗng' };
    }

    return { valid: true };
  } catch {
    return { valid: false, reason: 'không thể kết nối tới origin ảnh' };
  }
}
