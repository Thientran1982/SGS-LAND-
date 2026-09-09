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
import type { SocialPlatformContent, SocialPublishResult } from '../social-publishing/types';

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

export async function publishFacebookPageContent(input: {
  pageId: string;
  pageAccessToken: string;
  content: SocialPlatformContent;
  idempotencyKey: string;
}): Promise<SocialPublishResult> {
  const imageUrl = input.content.imageUrls[0];
  if (!imageUrl) {
    return {
      status: 'FAILED',
      retryable: false,
      errorCode: 'FACEBOOK_IMAGE_REQUIRED',
      safeMessage: 'Facebook publication cần ít nhất một ảnh đại diện.',
    };
  }

  try {
    const parsedImageUrl = new URL(imageUrl);
    if (!['http:', 'https:'].includes(parsedImageUrl.protocol)) throw new Error('unsupported protocol');
  } catch {
    return {
      status: 'FAILED',
      retryable: false,
      errorCode: 'FACEBOOK_IMAGE_URL_INVALID',
      safeMessage: 'URL ảnh Facebook phải là địa chỉ HTTP(S) tuyệt đối và công khai.',
    };
  }

  const path = `${encodeURIComponent(input.pageId)}/photos`;
  const body = {
    url: imageUrl,
    caption: input.content.text,
    published: true,
  };

  try {
    const { response, body: result } = await graphRequest(
      path,
      input.pageAccessToken,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-SGS-Delivery-Key': input.idempotencyKey,
        },
        body: JSON.stringify(body),
      },
    );
    const providerRequestId = response.headers.get('x-fb-trace-id') || undefined;
    if (response.ok && !result.error) {
      const postId = String(result.post_id || result.id || '').trim();
      if (!postId) {
        return {
          status: 'AMBIGUOUS',
          providerRequestId,
          errorCode: 'FACEBOOK_MISSING_POST_ID',
          safeMessage: 'Facebook phản hồi thành công nhưng không trả về post ID.',
        };
      }
      return {
        status: 'PUBLISHED',
        providerPostId: postId,
        providerPostUrl: providerPostUrl(postId),
        providerRequestId,
      };
    }

    const status = response.status;
    if (status === 429) {
      return {
        status: 'FAILED',
        retryable: true,
        providerRequestId,
        errorCode: 'FACEBOOK_RATE_LIMITED',
        safeMessage: 'Facebook giới hạn tần suất; publication sẽ được retry có backoff.',
      };
    }
    if (status >= 500 || !response.ok && !result.error) {
      return {
        status: 'AMBIGUOUS',
        providerRequestId,
        errorCode: 'FACEBOOK_OUTCOME_UNKNOWN',
        safeMessage: 'Facebook không xác nhận kết quả đăng; không tự retry để tránh đăng trùng.',
      };
    }
    return {
      status: 'FAILED',
      retryable: false,
      providerRequestId,
      errorCode: `FACEBOOK_${result.error?.code || status}`,
      safeMessage: `Facebook từ chối đăng bài: ${result.error?.message || `HTTP ${status}`}.`,
    };
  } catch {
    return {
      status: 'AMBIGUOUS',
      errorCode: 'FACEBOOK_NETWORK_OUTCOME_UNKNOWN',
      safeMessage: 'Mất kết nối sau khi gửi yêu cầu Facebook; cần kiểm tra thủ công, không tự retry.',
    };
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