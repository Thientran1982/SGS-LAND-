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

const FB_GRAPH_API = 'https://graph.facebook.com/v19.0/me/messages';

export interface FacebookSendResult {
  success: boolean;
  messageId?: string;
  recipientId?: string;
  error?: string;
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
  text: string
): Promise<FacebookSendResult> {
  try {
    const body = {
      recipient: { id: recipientId },
      message: { text: text.slice(0, 2000) },
      messaging_type: 'RESPONSE',
    };

    const url = `${FB_GRAPH_API}?access_token=${encodeURIComponent(pageAccessToken)}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const json: any = await response.json();

    if (json.error) {
      logger.warn(`[Facebook] Send failed: code=${json.error.code} message=${json.error.message}`);
      return {
        success: false,
        error: `Facebook API error ${json.error.code}: ${json.error.message}`,
      };
    }

    logger.info(`[Facebook] Message sent to ${recipientId}, msgId=${json.message_id}`);
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
