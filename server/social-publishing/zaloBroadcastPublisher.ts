import { enterpriseConfigRepository } from '../repositories/enterpriseConfigRepository';
import type {
  SocialPlatformContent,
  SocialPublishResult,
  SocialPublisher,
} from './types';

const ZALO_OA_INFO_API = 'https://openapi.zalo.me/v2.0/oa/getoa';
const ZALO_MESSAGE_QUOTA_API = 'https://openapi.zalo.me/v3.0/oa/quota/message';
const ZALO_ARTICLE_CREATE_API = 'https://openapi.zalo.me/v2.0/article/create';
const ZALO_ARTICLE_VERIFY_API = 'https://openapi.zalo.me/v2.0/article/verify';
const ZALO_BROADCAST_API = 'https://openapi.zalo.me/v2.0/oa/message';

type ZaloConfig = {
  enabled?: boolean;
  oaId?: string;
  accessToken?: string;
  broadcastProbeUserId?: string;
};

type ZaloResponse = {
  error?: number;
  message?: string;
  data?: Record<string, any>;
};

type VerificationCheck = 'PASS' | 'FAIL' | 'NOT_RUN';

type Availability = {
  ready: boolean;
  reasonCode?: ZaloBroadcastVerificationReasonCode;
  reason?: string;
  retryable?: boolean;
  checks?: {
    oaId: VerificationCheck;
    quota: VerificationCheck;
  };
};

export type ZaloBroadcastVerificationReasonCode =
  | 'READY'
  | 'CONFIG_UNAVAILABLE'
  | 'ZALO_NOT_CONNECTED'
  | 'PROBE_USER_MISSING'
  | 'OA_REQUEST_FAILED'
  | 'OA_ID_MISMATCH'
  | 'QUOTA_PERMISSION_DENIED'
  | 'QUOTA_REQUEST_FAILED'
  | 'QUOTA_RESPONSE_INVALID'
  | 'PROVIDER_UNAVAILABLE';

function apiError(body: ZaloResponse, fallback: string): string {
  const code = body.error === undefined ? '' : ` (${body.error})`;
  return `Zalo từ chối yêu cầu${code}: ${String(body.message || fallback).slice(0, 500)}`;
}

function isPermissionError(body: ZaloResponse, status: number): boolean {
  return status === 401
    || status === 403
    || [112, 224, 2001, 2002, 2003].includes(Number(body.error));
}

function classifyHttp(status: number): { retryable: boolean; ambiguous: boolean } {
  return {
    retryable: status === 408 || status === 425 || status === 429 || status >= 500,
    ambiguous: status === 408 || status === 425 || status >= 500,
  };
}

async function readZaloResponse(response: Response): Promise<ZaloResponse> {
  return response.json().catch(() => ({})) as Promise<ZaloResponse>;
}

async function zaloRequest(
  url: string,
  accessToken: string,
  init: RequestInit = {},
): Promise<{ response: Response; body: ZaloResponse }> {
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
      access_token: accessToken,
    },
    signal: init.signal || AbortSignal.timeout(12_000),
  });
  return { response, body: await readZaloResponse(response) };
}

async function getConfig(tenantId: string): Promise<ZaloConfig | null> {
  const config = await enterpriseConfigRepository.getConfig(tenantId);
  return (config?.zalo || null) as ZaloConfig | null;
}

/**
 * Zalo exposes no dry-run for POST /oa/message. The read-only OA identity
 * check plus the documented quota endpoint is the non-destructive live proof
 * that this tenant token has the "send and notify" permission required by
 * broadcast. Without a probe user we must remain NOT_READY.
 */
export async function verifyZaloBroadcastAccess(tenantId: string): Promise<Availability> {
  let config: ZaloConfig | null;
  try {
    config = await getConfig(tenantId);
  } catch {
    return {
      ready: false,
      reasonCode: 'CONFIG_UNAVAILABLE',
      retryable: true,
      reason: 'Không thể đọc cấu hình Zalo OA để xác minh quyền broadcast.',
    };
  }

  if (!config?.enabled || !config.oaId || !config.accessToken) {
    return {
      ready: false,
      reasonCode: 'ZALO_NOT_CONNECTED',
      retryable: false,
      reason: 'Tenant chưa kết nối Zalo OA hoặc thiếu OA Access Token.',
      checks: { oaId: 'NOT_RUN', quota: 'NOT_RUN' },
    };
  }
  if (!config.broadcastProbeUserId) {
    return {
      ready: false,
      reasonCode: 'PROBE_USER_MISSING',
      retryable: false,
      reason: 'Chưa có probe user để xác minh live quyền gửi tin và thông báo Zalo broadcast.',
      checks: { oaId: 'NOT_RUN', quota: 'NOT_RUN' },
    };
  }

  try {
    const identity = await zaloRequest(ZALO_OA_INFO_API, config.accessToken, { method: 'GET' });
    if (!identity.response.ok || identity.body.error !== 0) {
      const classification = classifyHttp(identity.response.status);
      return {
        ready: false,
        reasonCode: 'OA_REQUEST_FAILED',
        retryable: classification.retryable,
        reason: apiError(identity.body, `HTTP ${identity.response.status}`),
        checks: { oaId: 'FAIL', quota: 'NOT_RUN' },
      };
    }
    const returnedOaId = String(identity.body.data?.oaid || identity.body.data?.oa_id || '');
    if (!returnedOaId || returnedOaId !== String(config.oaId)) {
      return {
        ready: false,
        reasonCode: 'OA_ID_MISMATCH',
        retryable: false,
        reason: 'Zalo trả về OA ID khác với OA ID đã cấu hình cho tenant.',
        checks: { oaId: 'FAIL', quota: 'NOT_RUN' },
      };
    }

    const quota = await zaloRequest(ZALO_MESSAGE_QUOTA_API, config.accessToken, {
      method: 'POST',
      body: JSON.stringify({ user_id: config.broadcastProbeUserId }),
    });
    if (!quota.response.ok || quota.body.error !== 0) {
      const classification = classifyHttp(quota.response.status);
      return {
        ready: false,
        reasonCode: isPermissionError(quota.body, quota.response.status)
          ? 'QUOTA_PERMISSION_DENIED'
          : 'QUOTA_REQUEST_FAILED',
        retryable: classification.retryable,
        reason: isPermissionError(quota.body, quota.response.status)
          ? 'Zalo chưa cấp quyền gửi tin và thông báo cho OA account này.'
          : apiError(quota.body, `HTTP ${quota.response.status}`),
        checks: { oaId: 'PASS', quota: 'FAIL' },
      };
    }
    const promotion = quota.body.data?.promotion;
    if (!promotion || !Number.isFinite(Number(promotion.daily_total))) {
      return {
        ready: false,
        reasonCode: 'QUOTA_RESPONSE_INVALID',
        retryable: false,
        reason: 'Zalo không trả về hạn mức promotion; quyền broadcast chưa được xác minh.',
        checks: { oaId: 'PASS', quota: 'FAIL' },
      };
    }
    return { ready: true, reasonCode: 'READY', checks: { oaId: 'PASS', quota: 'PASS' } };
  } catch {
    return {
      ready: false,
      reasonCode: 'PROVIDER_UNAVAILABLE',
      retryable: true,
      reason: 'Không thể kết nối Zalo để xác minh quyền broadcast.',
      checks: { oaId: 'NOT_RUN', quota: 'NOT_RUN' },
    };
  }
}

function articleBody(content: SocialPlatformContent) {
  const text = content.text.slice(0, 10_000);
  return {
    type: 'normal',
    title: content.title.slice(0, 150),
    author: 'SGS LAND',
    cover: {
      cover_type: 'photo',
      photo_url: content.imageUrls[0],
      status: 'show',
    },
    description: text.slice(0, 300),
    body: [{ type: 'text', content: text }],
    status: 'show',
    comment: 'show',
  };
}

async function createArticle(
  accessToken: string,
  content: SocialPlatformContent,
): Promise<{ id?: string; ambiguous?: boolean; error?: string }> {
  const created = await zaloRequest(ZALO_ARTICLE_CREATE_API, accessToken, {
    method: 'POST',
    body: JSON.stringify(articleBody(content)),
  });
  if (!created.response.ok || created.body.error !== 0) {
    const classification = classifyHttp(created.response.status);
    return {
      ambiguous: classification.ambiguous,
      error: apiError(created.body, `HTTP ${created.response.status}`),
    };
  }
  const token = String(created.body.data?.token || '');
  if (!token) return { ambiguous: true, error: 'Zalo không trả article token để kiểm tra.' };

  const verified = await zaloRequest(ZALO_ARTICLE_VERIFY_API, accessToken, {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
  if (!verified.response.ok || verified.body.error !== 0) {
    const classification = classifyHttp(verified.response.status);
    return {
      ambiguous: true,
      error: apiError(verified.body, `Không thể xác minh article (HTTP ${verified.response.status})`),
    };
  }
  const id = String(verified.body.data?.id || '');
  return id ? { id } : { ambiguous: true, error: 'Zalo chưa trả article ID sau khi tạo.' };
}

export const zaloBroadcastPublisher: SocialPublisher = {
  platform: 'ZALO_BROADCAST',

  async isAvailable({ tenantId }) {
    return verifyZaloBroadcastAccess(tenantId);
  },

  async publish({ tenantId, content }): Promise<SocialPublishResult> {
    const availability = await verifyZaloBroadcastAccess(tenantId);
    if (!availability.ready) {
      return {
        status: 'FAILED',
        retryable: availability.retryable,
        errorCode: 'ZALO_BROADCAST_PERMISSION_NOT_VERIFIED',
        safeMessage: availability.reason || 'Zalo broadcast chưa được xác minh.',
      };
    }

    const config = await getConfig(tenantId);
    if (!config?.accessToken) {
      return {
        status: 'FAILED',
        retryable: false,
        errorCode: 'ZALO_OA_NOT_CONNECTED',
        safeMessage: 'Tenant chưa kết nối Zalo OA Access Token.',
      };
    }
    if (!content.imageUrls.length) {
      return {
        status: 'FAILED',
        retryable: false,
        errorCode: 'ZALO_BROADCAST_ASSET_REQUIRED',
        safeMessage: 'Zalo broadcast cần ít nhất một ảnh HTTPS để tạo article.',
      };
    }

    try {
      const article = await createArticle(config.accessToken, content);
      if (!article.id) {
        return {
          status: article.ambiguous ? 'AMBIGUOUS' : 'FAILED',
          retryable: false,
          errorCode: article.ambiguous ? 'ZALO_ARTICLE_OUTCOME_UNKNOWN' : 'ZALO_ARTICLE_CREATE_FAILED',
          safeMessage: article.error || 'Zalo không tạo được article.',
        };
      }

      const broadcast = await zaloRequest(ZALO_BROADCAST_API, config.accessToken, {
        method: 'POST',
        body: JSON.stringify({
          recipient: { target: {} },
          message: {
            attachment: {
              type: 'template',
              payload: {
                template_type: 'media',
                elements: [{ media_type: 'article', attachment_id: article.id }],
              },
            },
          },
        }),
      });
      if (!broadcast.response.ok || broadcast.body.error !== 0) {
        const classification = classifyHttp(broadcast.response.status);
        return {
          status: classification.ambiguous ? 'AMBIGUOUS' : 'FAILED',
          retryable: !classification.ambiguous && classification.retryable,
          errorCode: isPermissionError(broadcast.body, broadcast.response.status)
            ? 'ZALO_BROADCAST_PERMISSION_DENIED'
            : 'ZALO_BROADCAST_FAILED',
          safeMessage: apiError(broadcast.body, `HTTP ${broadcast.response.status}`),
        };
      }
      const messageId = String(broadcast.body.data?.message_id || '');
      if (!messageId) {
        return {
          status: 'AMBIGUOUS',
          errorCode: 'ZALO_BROADCAST_CONFIRMATION_MISSING',
          safeMessage: 'Zalo trả thành công nhưng thiếu broadcast message ID; cần đối soát thủ công.',
        };
      }
      return {
        status: 'PUBLISHED',
        providerPostId: messageId,
        providerRequestId: `zalo-broadcast:${messageId}`,
      };
    } catch (error: any) {
      return {
        status: 'AMBIGUOUS',
        errorCode: 'ZALO_BROADCAST_OUTCOME_UNKNOWN',
        safeMessage: String(error?.message || 'Không thể xác định kết quả Zalo broadcast.').slice(0, 500),
      };
    }
  },
};