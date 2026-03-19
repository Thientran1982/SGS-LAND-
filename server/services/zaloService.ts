/**
 * Zalo OA Messaging Service
 *
 * Wraps the Zalo OpenAPI v2.0 to send messages from an Official Account
 * back to users who have sent a message first (customer-service mode).
 *
 * Docs: https://developers.zalo.me/docs/official-account/nhan-tin-voi-nguoi-dung/gui-tin-nhan-van-ban
 */

import { logger } from '../middleware/logger';
import { enterpriseConfigRepository } from '../repositories/enterpriseConfigRepository';

const ZALO_OA_API = 'https://openapi.zalo.me/v2.0/oa/message/cs';

export interface ZaloSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send a text message to a Zalo user via OA API.
 * @param accessToken - OA Access Token (from Zalo Developers Console)
 * @param userId      - Zalo user ID (from webhook sender.id)
 * @param text        - Message content (max 2000 chars)
 */
export async function sendZaloTextMessage(
  accessToken: string,
  userId: string,
  text: string
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

    const json: any = await response.json();

    if (json.error !== 0) {
      logger.warn(`[Zalo] Send failed: error=${json.error} message=${json.message}`);
      return { success: false, error: `Zalo API error ${json.error}: ${json.message}` };
    }

    logger.info(`[Zalo] Message sent to ${userId}, msgId=${json.data?.message_id}`);
    return { success: true, messageId: json.data?.message_id };
  } catch (err: any) {
    logger.error('[Zalo] Network error sending message:', err);
    return { success: false, error: err.message };
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
