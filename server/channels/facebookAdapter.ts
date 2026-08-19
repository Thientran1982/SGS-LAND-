import type { ChannelAdapter, SendResult } from './types';

export const facebookAdapter: ChannelAdapter = {
  channel: 'FACEBOOK',
  async sendOutbound(tenantId: string, lead: any, content: string): Promise<SendResult> {
    const fbId: string | undefined = lead?.socialIds?.facebook;
    if (!fbId) {
      return { success: false, error: 'Lead khong co Facebook socialId' };
    }
    const { sendFacebookTextMessage, getFacebookDefaultPage } = await import('../services/facebookService');
    const page = await getFacebookDefaultPage(tenantId);
    if (!page?.accessToken) {
      return { success: false, error: 'Khong tim thay Facebook Page Access Token cho tenant' };
    }
    return sendFacebookTextMessage(page.accessToken, fbId, content);
  },
};
