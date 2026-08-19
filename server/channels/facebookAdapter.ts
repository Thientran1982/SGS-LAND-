import type { ChannelAdapter, SendResult, OutboundDeliveryContext } from './types';

export const facebookAdapter: ChannelAdapter = {
  channel: 'FACEBOOK',
  async sendOutbound(tenantId: string, lead: any, content: string, context?: OutboundDeliveryContext): Promise<SendResult> {
    const fbId: string | undefined = lead?.socialIds?.facebook;
    if (!fbId) {
      return { success: false, error: 'Lead khong co Facebook socialId' };
    }
    const { sendFacebookTextMessage, getFacebookDefaultPage } = await import('../services/facebookService');
    const page = await getFacebookDefaultPage(tenantId);
    if (!page?.accessToken) {
      return { success: false, error: 'Khong tim thay Facebook Page Access Token cho tenant' };
    }
    const result = await sendFacebookTextMessage(page.accessToken, fbId, content, context?.deliveryKey);
    return { ...result, deliveryGuarantee: 'provider_unverified' };
  },
};
