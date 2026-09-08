/**
 * Zalo OA Messaging Service
 *
 * Wraps the Zalo Official Account API v3.0 to send messages from an Official Account
 * back to users who have sent a message first (customer-service mode).
 *
 * Docs: https://developers.zalo.me/docs/sdk/java-sdk/tai-lieu/official-account-api-v3
 */
import { logger } from '../middleware/logger';
import { enterpriseConfigRepository } from '../repositories/enterpriseConfigRepository';
const ZALO_OA_API = 'https://openapi.zalo.me/v3.0/oa/message/cs';
export interface ZaloSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  /** Network/5xx/parse failure: provider may have accepted the message. */
  ambiguous?: boolean;
}
/**
 * Send a text message to a Zalo user via OA API.
 * @param accessToken - OA Access Token (from Zalo Developers Console)
 * @param userId      - Zalo user ID (from webhook sender.id)
 * @param text        - Message content (max 2000 chars per message)
 */
export async function sendZaloTextMessage(
  accessToken: string,
  userId: string,
  text: string,
  deliveryKey?: string,
): Promise<ZaloSendResult> {
  try {
    const body = {
      recipient: { user_id: userId },
      message: { text: text.slice(0, 2000) },
    };
    const response = await fetch(ZALO_OA_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            access_token: accessToken,
          },
          body: JSON.stringify(body),
        });
    if (!response.ok) {
      const err: any = new Error(`HTTP ${response.status}`);
      err.status = response.status;
      throw err;
    }
    const json: any = await response.json();
    if (json.error !== 0) {
      logger.warn(`[Zalo] Send failed: error=${json.error} message=${json.message}`);
      return { success: false, error: `Zalo API error ${json.error}: ${json.message}` };
    }
    logger.info(`[Zalo] Message sent to ${userId}, msgId=${json.data?.message_id}, deliveryKey=${deliveryKey || 'none'}`);
    return { success: true, messageId: json.data?.message_id };
  } catch (err: any) {
    logger.error('[Zalo] Network error sending message:', err);
    const status = Number(err?.status);
    return {
      success: false,
      ambiguous: !status || status >= 500,
      error: err.message,
    };
  }
}

/**
 * Send a Zalo OA media-template image message. Zalo fetches the public HTTPS
 * image URL; the URL is never placed in the customer-facing text.
 */
export async function sendZaloImageMessage(
  accessToken: string,
  userId: string,
  imageUrl: string,
  text?: string,
  deliveryKey?: string,
): Promise<ZaloSendResult> {
  try {
    const body = {
      recipient: { user_id: userId },
      message: {
        ...(text ? { text: text.slice(0, 2000) } : {}),
        attachment: {
          type: 'template',
          payload: {
            template_type: 'media',
            elements: [{ media_type: 'image', url: imageUrl }],
          },
        },
      },
    };
    const response = await fetch(ZALO_OA_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        access_token: accessToken,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const err: any = new Error(`HTTP ${response.status}`);
      err.status = response.status;
      throw err;
    }
    const json: any = await response.json();
    if (json.error !== 0) {
      logger.warn(`[Zalo] Image send failed: error=${json.error} message=${json.message}`);
      return { success: false, error: `Zalo API error ${json.error}: ${json.message}` };
    }
    logger.info(`[Zalo] Image sent to ${userId}, msgId=${json.data?.message_id}, deliveryKey=${deliveryKey || 'none'}`);
    return { success: true, messageId: json.data?.message_id };
  } catch (err: any) {
    const status = Number(err?.status);
    logger.error('[Zalo] Network error sending image:', err);
    return {
      success: false,
      ambiguous: !status || status >= 500,
      error: err.message,
    };
  }
}
/**
 * Get the OA Access Token for a tenant from enterprise config.
 * Returns null if Zalo is not connected or token is missing.
 */
export async function getZaloAccessToken(tenantId: string): Promise<string | null> {
  try {
    const config = await enterpriseConfigRepository.getConfig(tenantId);
    const token = config?.zalo?.accessToken;
    return token || null;
  } catch {
    return null;
  }
}