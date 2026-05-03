/**
 * messagePushService.ts (Task #55)
 *
 * Sends an Expo push notification to every device tied to a buyer user when
 * an agent posts a new message in a conversation. Reuses the Task #53 push
 * pipeline (`sendExpoPushBatch` + `buyerPushRepository.invalidateToken` for
 * DeviceNotRegistered cleanup).
 *
 * Buyers don't push agents — the agent CRM lives on the web socket, so when
 * a buyer sends, the agent sees it via the live socket fan-out instead.
 */

import { logger } from '../middleware/logger';
import { buyerPushRepository } from '../repositories/buyerPushRepository';
import {
  isValidExpoPushToken,
  sendExpoPushBatch,
} from './pushNotificationService';

export interface MessagePushInput {
  buyerUserId: string;
  conversationId: string;
  body: string;
  agentName?: string | null;
}

export async function pushMessageToBuyer(input: MessagePushInput): Promise<void> {
  try {
    const devices = await buyerPushRepository.findActiveDevicesForBuyer(input.buyerUserId);
    const tokens = devices
      .map((d) => d.expoPushToken)
      .filter((t): t is string => !!t && isValidExpoPushToken(t));
    if (!tokens.length) return;

    const title = input.agentName
      ? `💬 ${input.agentName}`
      : '💬 Tin nhắn mới';
    const preview =
      input.body.length > 140 ? input.body.slice(0, 137) + '…' : input.body;

    const messages = tokens.map((to) => ({
      to,
      title,
      body: preview,
      sound: 'default' as const,
      priority: 'high' as const,
      channelId: 'messages',
      data: {
        type: 'message',
        conversationId: input.conversationId,
        url: `/messages/${input.conversationId}`,
      },
    }));

    // Expo caps batches at 100; we'll never have that many devices per
    // buyer in practice but loop defensively anyway.
    for (let i = 0; i < messages.length; i += 100) {
      const batch = messages.slice(i, i + 100);
      const tickets = await sendExpoPushBatch(batch);
      for (let j = 0; j < tickets.length; j++) {
        const t = tickets[j];
        if (t.status === 'error' && t.details?.error === 'DeviceNotRegistered') {
          await buyerPushRepository.invalidateToken(batch[j].to).catch(() => {});
        }
      }
    }
  } catch (err: any) {
    // Never let push failures break the message send path.
    logger.warn(`[message-push] enqueue failed: ${err?.message || err}`);
  }
}
