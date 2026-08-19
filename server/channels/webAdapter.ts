import type { ChannelAdapter, SendResult } from './types';

/**
 * Kenh WEB (widget chat tren website) khong co "day" outbound rieng: noi dung AI
 * duoc tra ve truc tiep trong HTTP response cua POST /api/public/ai/livechat
 * (xem server/routes/interactionRoutes.ts). Vi vay sendOutbound o day la no-op,
 * chi de dam bao WebAdapter tuong thich voi ChannelAdapter interface chung --
 * khong co hanh vi nao thay doi so voi truoc.
 */
export const webAdapter: ChannelAdapter = {
  channel: 'WEB',
  async sendOutbound(): Promise<SendResult> {
    return { success: true, deliveryGuarantee: 'local_only' };
  },
};
