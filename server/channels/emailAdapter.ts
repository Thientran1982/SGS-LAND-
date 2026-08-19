import type { ChannelAdapter, SendResult, OutboundDeliveryContext } from './types';

export const emailAdapter: ChannelAdapter = {
  channel: 'EMAIL',
  async sendOutbound(tenantId: string, lead: any, content: string, context?: OutboundDeliveryContext): Promise<SendResult> {
    if (!lead?.email) {
      return { success: false, error: 'Lead khong co dia chi email' };
    }
    const { emailService } = await import('../services/emailService');
    const result = await emailService.sendSequenceEmail(
      tenantId,
      lead.email,
      'Phan hoi tu SGS LAND',
      content,
      context?.deliveryKey,
    );
    return { ...result, deliveryGuarantee: 'provider_unverified' };
  },
};
