import type { ChannelAdapter, SendResult } from './types';

export const zaloAdapter: ChannelAdapter = {
  channel: 'ZALO',
  async sendOutbound(tenantId: string, lead: any, content: string): Promise<SendResult> {
    const zaloId: string | undefined = lead?.socialIds?.zalo;
    if (!zaloId) {
      return { success: false, error: 'Lead khong co Zalo socialId' };
    }
    const { sendZaloTextMessage, getZaloAccessToken } = await import('../services/zaloService');
    const token = await getZaloAccessToken(tenantId);
    if (!token) {
      return { success: false, error: 'Khong tim thay Zalo OA Access Token cho tenant' };
    }
    return sendZaloTextMessage(token, zaloId, content);
  },
};
