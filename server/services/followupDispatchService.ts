/**
 * followupDispatchService.ts
 *
 * Multi-channel dispatch for the D+1/3/5/7 follow-up agent (see
 * followupCronRoutes.ts and followupSequenceRepository.ts).
 *
 * Cascade: Zalo OA → SMS → Email.
 *   - Zalo requires the lead's Zalo user id AND a connected OA access token
 *     for the tenant (customer-service window only sends to users who
 *     messaged the OA first).
 *   - SMS has no configured provider in this codebase yet (see
 *     buyerOtpService.ts) — the channel is treated as unavailable and the
 *     cascade falls through to email instead of silently pretending to send.
 *   - Email is the last resort and only requires a lead email address.
 *
 * When none of the channels can be attempted (no Zalo id/token and no
 * email), the caller marks the send SKIPPED rather than FAILED — this is
 * not a delivery failure, there is simply no way to reach the lead yet.
 */

import { Pool } from 'pg';
import { logger } from '../middleware/logger';
import { sendZaloTextMessage, getZaloAccessToken } from './zaloService';
import { emailService } from './emailService';

export interface FollowUpLeadInfo {
  leadName?: string | null;
  leadPhone?: string | null;
  leadEmail?: string | null;
  leadZaloId?: string | null;
}

export interface DispatchFollowUpResult {
  success: boolean;
  channel?: 'ZALO' | 'SMS' | 'EMAIL';
  message?: string;
  error?: string;
}

// Static Vietnamese copy for each scheduled touchpoint. Kept deterministic
// (no LLM call) so the hourly cron stays cheap and predictable.
const FOLLOW_UP_COPY: Record<1 | 3 | 5 | 7, (name: string) => string> = {
  1: (name) =>
    `Xin chào ${name || 'anh/chị'}! Em từ SGS LAND xin hỏi thăm: anh/chị đã xem đủ thông tin dự án chưa ạ? Em luôn sẵn sàng tư vấn thêm nếu cần.`,
  3: (name) =>
    `Chào ${name || 'anh/chị'}! SGS LAND hỏi thăm sau 3 ngày ạ. Hiện bên em có thêm vài lựa chọn phù hợp, anh/chị có muốn em gửi thông tin không ạ?`,
  5: (name) =>
    `Chào ${name || 'anh/chị'}! Đã 5 ngày rồi, SGS LAND vẫn ở đây nếu anh/chị cần thêm thông tin hoặc muốn xếp lịch xem thực tế ạ.`,
  7: (name) =>
    `Xin chào ${name || 'anh/chị'}! Đã một tuần — SGS LAND luôn sẵn sàng đồng hành cùng anh/chị trên hành trình tìm bất động sản phù hợp. Anh/chị cần hỗ trợ gì thêm không ạ?`,
};

export async function dispatchFollowUp(
  pool: Pool,
  tenantId: string,
  sendId: string,
  day: 1 | 3 | 5 | 7,
  lead: FollowUpLeadInfo,
): Promise<DispatchFollowUpResult> {
  const name = lead.leadName || '';
  const message = FOLLOW_UP_COPY[day](name);

  // 1) Zalo OA — only viable if the lead has a Zalo id and the tenant has a
  // connected OA access token (customer-service window).
  if (lead.leadZaloId) {
    try {
      const accessToken = await getZaloAccessToken(tenantId);
      if (accessToken) {
        const result = await sendZaloTextMessage(
          accessToken,
          lead.leadZaloId,
          message,
          `followup:${sendId}`,
        );
        if (result.success) {
          return { success: true, channel: 'ZALO', message };
        }
        logger.warn(
          `[FollowUpDispatch] Zalo failed for send ${sendId}: ${result.error || 'unknown error'}`,
        );
        // Ambiguous (network/5xx) failures do not fall through — a resend
        // could double-message a lead the provider may have already reached.
        if (result.ambiguous) {
          return { success: false, error: result.error || 'zalo_ambiguous' };
        }
      }
    } catch (err: any) {
      logger.warn(`[FollowUpDispatch] Zalo dispatch error for send ${sendId}: ${err.message}`);
    }
  }

  // 2) SMS — no provider is wired up yet in this codebase; do not fabricate
  // a "sent" result. Skip straight to email instead of pretending to send.

  // 3) Email — last resort, only needs an address.
  if (lead.leadEmail) {
    try {
      const result = await emailService.sendEmail(tenantId, {
        to: lead.leadEmail,
        subject: `SGS LAND — ${name ? `Xin chào ${name}` : 'Hỏi thăm về nhu cầu bất động sản'}`,
        text: message,
        html: emailService.emailBase(`<p>${message}</p>`),
        template: 'followup_sequence',
        deliveryKey: `followup:${sendId}`,
      });
      if (result.success) {
        return { success: true, channel: 'EMAIL', message };
      }
      return { success: false, error: result.error || 'email_failed' };
    } catch (err: any) {
      logger.warn(`[FollowUpDispatch] Email dispatch error for send ${sendId}: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  // No channel could be attempted at all.
  return { success: false, error: 'no_reachable_channel' };
}
