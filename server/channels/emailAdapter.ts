import type { ChannelAdapter, SendResult } from './types';

export const emailAdapter: ChannelAdapter = {
  channel: 'EMAIL',
  async sendOutbound(tenantId: string, lead: any, content: string): Promise<SendResult> {
    if (!lead?.email) {
      return { success: false, error: 'Lead khong co dia chi email' };
    }
    const { emailService } = await import('../services/emailService');
    const result = await emailService.sendSequenceEmail(
      tenantId,
      lead.email,
      'Phan hoi tu SGS LAND',
      content
    );
    return result;
  },
};
