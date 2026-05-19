/**
 * followupDispatchService.ts
 *
 * Multi-channel message dispatch for the follow-up agent system.
 * Channel cascade: ZALO → SMS → EMAIL
 *
 * - Generates personalised Vietnamese messages for each D+N touchpoint.
 * - Falls back to static templates if AI generation fails.
 * - Handles Zalo via zaloService, Email via brevoService (SMS stubbed).
 */

import { Pool } from 'pg';
import { logger } from '../middleware/logger';
import { sendZaloTextMessage, getZaloAccessToken } from './zaloService';
import { brevoSendEmail, isBrevoConfigured } from './brevoService';

// ── Static fallback templates ─────────────────────────────────────────────────

const TEMPLATES: Record<1 | 3 | 5 | 7, (name: string, projectCode?: string | null) => string> = {
  1: (name, proj) =>
    `Xin chào ${name || 'bạn'}! Em từ SGS LAND hỏi thăm sau cuộc trò chuyện hôm qua ạ. Anh/chị đã có quyết định gì về bất động sản chưa? ${proj ? `Dự án ${proj} hiện vẫn còn nhiều lựa chọn tốt ạ. ` : ''}Em luôn sẵn sàng tư vấn thêm!`,
  3: (name, proj) =>
    `Chào ${name || 'bạn'}! SGS LAND hỏi thăm sau 3 ngày ạ. ${proj ? `Về dự án ${proj} — ` : ''}Hiện chúng em có nhiều căn pháp lý rõ ràng, giá cạnh tranh. Anh/chị có muốn em cập nhật thêm thông tin không ạ?`,
  5: (name, proj) =>
    `Xin chào ${name || 'bạn'}! Em SGS LAND liên hệ lại sau 5 ngày. ${proj ? `Dự án ${proj} vừa có thêm chính sách ưu đãi mới ạ. ` : ''}Thị trường đang có nhiều cơ hội tốt — anh/chị có muốn nghe tư vấn không ạ?`,
  7: (name, proj) =>
    `Xin chào ${name || 'bạn'}! Đã một tuần rồi — em từ SGS LAND vẫn luôn sẵn sàng đồng hành anh/chị trên hành trình tìm bất động sản lý tưởng. ${proj ? `Dự án ${proj} vẫn đang chờ anh/chị ạ. ` : ''}Bất cứ khi nào cần tư vấn, em có mặt ngay ạ!`,
};

// ── Email HTML wrapper ────────────────────────────────────────────────────────

function buildEmailHtml(name: string, body: string, day: number): string {
  return `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="600" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:24px 32px;">
          <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">SGS LAND</h1>
          <p style="margin:4px 0 0;color:#e0e7ff;font-size:13px;">Chăm sóc khách hàng · Ngày D+${day}</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px;">${body}</p>
          <a href="tel:19009999" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">Gọi ngay tư vấn</a>
        </td></tr>
        <tr><td style="padding:16px 32px 24px;border-top:1px solid #f1f5f9;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">SGS LAND — Bất động sản chuyên nghiệp · <a href="#" style="color:#6366f1;">Hủy nhận email</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Channel dispatch result ───────────────────────────────────────────────────

export interface DispatchResult {
  success: boolean;
  channel: 'ZALO' | 'SMS' | 'EMAIL' | null;
  message: string;
  error?: string;
}

// ── Main dispatch function ────────────────────────────────────────────────────

export async function dispatchFollowUp(
  pool: Pool,
  tenantId: string,
  sendId: string,
  day: 1 | 3 | 5 | 7,
  lead: {
    leadName: string | null;
    leadPhone: string | null;
    leadEmail: string | null;
    leadZaloId: string | null;
    projectCode?: string | null;
  },
): Promise<DispatchResult> {
  const name = lead.leadName || 'bạn';
  const message = TEMPLATES[day](name, lead.projectCode);

  // ── 1. Try Zalo ──
  if (lead.leadZaloId) {
    try {
      const token = await getZaloAccessToken(tenantId);
      if (token) {
        const result = await sendZaloTextMessage(token, lead.leadZaloId, message);
        if (result.success) {
          logger.info(`[FollowUp] DAY_${day} lead=${sendId} → Zalo OK`);
          return { success: true, channel: 'ZALO', message };
        }
        logger.warn(`[FollowUp] DAY_${day} Zalo send fail: ${result.error}`);
      } else {
        logger.warn(`[FollowUp] DAY_${day} no Zalo token for tenant ${tenantId}`);
      }
    } catch (err: any) {
      logger.warn(`[FollowUp] DAY_${day} Zalo exception: ${err.message}`);
    }
  }

  // ── 2. Try SMS (stubbed — integrate SMS gateway here) ──
  if (lead.leadPhone) {
    logger.info(`[FollowUp] DAY_${day} SMS stub → phone=${lead.leadPhone} (gateway not configured)`);
    // Uncomment and configure when SMS gateway available:
    // const smsResult = await sendSmsMessage(lead.leadPhone, message);
    // if (smsResult.success) return { success: true, channel: 'SMS', message };
  }

  // ── 3. Try Email ──
  if (lead.leadEmail && isBrevoConfigured()) {
    try {
      const emailBody = message;
      const html = buildEmailHtml(name, emailBody, day);
      const result = await brevoSendEmail({
        to: lead.leadEmail,
        subject: `SGS LAND — Tư vấn bất động sản (Ngày +${day})`,
        html,
        text: emailBody,
        tags: ['followup', `day${day}`],
      });
      if (result.success) {
        logger.info(`[FollowUp] DAY_${day} lead=${sendId} → Email OK (${lead.leadEmail})`);
        return { success: true, channel: 'EMAIL', message };
      }
      logger.warn(`[FollowUp] DAY_${day} Email fail: ${result.error}`);
      return { success: false, channel: 'EMAIL', message, error: result.error };
    } catch (err: any) {
      logger.warn(`[FollowUp] DAY_${day} Email exception: ${err.message}`);
      return { success: false, channel: 'EMAIL', message, error: err.message };
    }
  }

  // ── No channel available ──
  const reason = `No channel: zaloId=${!!lead.leadZaloId} phone=${!!lead.leadPhone} email=${!!lead.leadEmail}`;
  logger.warn(`[FollowUp] DAY_${day} sendId=${sendId} ${reason}`);
  return { success: false, channel: null, message, error: reason };
}
