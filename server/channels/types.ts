/**
 * ChannelAdapter -- kien truc chung cho moi kenh nhan tin (Zalo, Facebook, Web,
 * Email, TikTok...). Muc tieu: tach phan "gui tin nhan ra kenh cu the" ra khoi
 * logic dieu phoi chung (triggerAutoReply, Permission Broker sau nay...) de
 * khong con phai if/else theo tung kenh moi khi them kenh moi (vd TikTok).
 *
 * KHONG thay doi hanh vi hien tai: cac adapter hien tai chi la wrapper mong
 * quanh server/services/zaloService.ts, facebookService.ts, emailService.ts
 * da co san tu truoc.
 */

export type ChannelId = 'ZALO' | 'FACEBOOK' | 'WEB' | 'EMAIL' | 'TIKTOK';

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  deliveryGuarantee?: 'provider_idempotent' | 'provider_unverified' | 'local_only';
  /** Provider outcome is unknown; callers must not retry automatically. */
  ambiguous?: boolean;
}

export interface OutboundDeliveryContext {
  deliveryId: string;
  deliveryKey: string;
}

export interface ChannelAdapter {
  readonly channel: ChannelId;

  /**
   * Gui mot tin nhan van ban (thuong la AI auto-reply hoac nhan vien) ra kenh nay.
   * tenantId: tenant hien tai. lead: ban ghi lead (can co socialIds/email tuy kenh).
   * content: noi dung tin nhan da render san (plain text).
   *
   * Kenh khong co "day" outbound rieng (vd WEB -- tra loi dong bo qua HTTP
   * response cua /api/public/ai/livechat) tra ve { success: true } ngay,
   * khong goi API ngoai nao ca.
   */
  sendOutbound(
    tenantId: string,
    lead: any,
    content: string,
    context?: OutboundDeliveryContext,
  ): Promise<SendResult>;
}
