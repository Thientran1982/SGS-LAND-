import type { ChannelAdapter, SendResult, OutboundDeliveryContext } from './types';

export const zaloAdapter: ChannelAdapter = {
  channel: 'ZALO',
  async sendOutbound(tenantId: string, lead: any, content: string, context?: OutboundDeliveryContext): Promise<SendResult> {
    const zaloId: string | undefined = lead?.socialIds?.zalo;
    if (!zaloId) {
      return { success: false, error: 'Lead khong co Zalo socialId' };
    }
    const { getZaloAccessToken } = await import('../services/zaloService');
    const token = await getZaloAccessToken(tenantId);
    if (!token) {
      return { success: false, error: 'Khong tim thay Zalo OA Access Token cho tenant' };
    }
    if (context?.productShare) {
      const { sendProductViaZalo } = await import('../services/productShareService');
      const result = await sendProductViaZalo({
        accessToken: token,
        userId: zaloId,
        product: context.productShare.product,
        imageUrls: context.productShare.imageUrls,
        deliveryKey: context.deliveryKey,
        language: context.productShare.language,
      });
      return {
        success: result.success,
        messageId: result.messageIds[0],
        error: result.error,
        ambiguous: result.ambiguous,
        deliveryGuarantee: 'provider_unverified',
      };
    }
    const { sendZaloTextMessage } = await import('../services/zaloService');
    const result = await sendZaloTextMessage(token, zaloId, content, context?.deliveryKey);
    return { ...result, deliveryGuarantee: 'provider_unverified' };
  },
};
