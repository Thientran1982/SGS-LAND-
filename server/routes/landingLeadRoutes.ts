/**
 * Public lead capture route for static landing pages (e.g. /landing/vinhomes-hoc-mon/).
 * - No auth required (public form)
 * - Sends two transactional emails via Brevo:
 *   1) Internal notification → SGS Land hotline inbox
 *   2) Auto-reply confirmation → end-user (if email provided)
 * - Hotline & contact phone: 0971132378
 */

import { Router, Request, Response } from 'express';
import { brevoSendEmail, isBrevoConfigured } from '../services/brevoService';
import { logger } from '../middleware/logger';

const HOTLINE = '0971132378';
const HOTLINE_DISPLAY = '0971 132 378';
const INTERNAL_INBOX = process.env.LANDING_LEAD_INBOX || 'sgsland.vn@gmail.com';

interface LandingLeadPayload {
  name?: string;
  phone?: string;
  email?: string;
  type?: string;
  purpose?: string;
  project?: string;
  source?: string;
  pageUrl?: string;
  utm?: Record<string, string>;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isValidVNPhone(p: string): boolean {
  return /^(0|\+84)\d{9,10}$/.test(p.replace(/\s+/g, ''));
}

export function createLandingLeadRoutes(): Router {
  const router = Router();

  router.post('/', async (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as LandingLeadPayload;
      const name = (body.name || '').trim();
      const phoneRaw = (body.phone || '').trim();
      const phone = phoneRaw.replace(/\s+/g, '');
      const email = (body.email || '').trim();
      const type = (body.type || '').trim();
      const purpose = (body.purpose || '').trim();
      const project = (body.project || 'Vinhomes Hóc Môn').trim();
      const source = (body.source || 'landing-page').trim();
      const pageUrl = (body.pageUrl || '').trim();

      if (!name || !phone) {
        return res.status(400).json({
          ok: false,
          error: 'Vui lòng nhập đầy đủ Họ tên và Số điện thoại.',
        });
      }
      if (!isValidVNPhone(phone)) {
        return res.status(400).json({
          ok: false,
          error: 'Số điện thoại chưa đúng định dạng Việt Nam.',
        });
      }

      const receivedAt = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

      // ── 1) Internal notification email ───────────────────────────────────
      const internalHtml = `
        <div style="font-family:Inter,Arial,sans-serif;max-width:640px;margin:auto;color:#0E1F18">
          <div style="background:linear-gradient(135deg,#003822,#004D2C);color:#fff;padding:24px 28px;border-radius:12px 12px 0 0">
            <h2 style="margin:0;color:#C9A84C;font-size:20px">🔔 Lead mới từ Landing ${escapeHtml(project)}</h2>
            <p style="margin:6px 0 0;font-size:13px;opacity:.85">Tiếp nhận lúc ${escapeHtml(receivedAt)} (GMT+7)</p>
          </div>
          <div style="background:#fff;border:1px solid #E5E7EB;border-top:none;padding:24px 28px;border-radius:0 0 12px 12px">
            <table style="width:100%;border-collapse:collapse;font-size:14px">
              <tr><td style="padding:8px 0;color:#6B7280;width:140px">Họ và tên</td><td style="padding:8px 0;font-weight:600">${escapeHtml(name)}</td></tr>
              <tr><td style="padding:8px 0;color:#6B7280">Số điện thoại</td><td style="padding:8px 0;font-weight:600"><a href="tel:${escapeHtml(phone)}" style="color:#004D2C">${escapeHtml(phone)}</a></td></tr>
              <tr><td style="padding:8px 0;color:#6B7280">Email</td><td style="padding:8px 0">${email ? `<a href="mailto:${escapeHtml(email)}" style="color:#004D2C">${escapeHtml(email)}</a>` : '<i style="color:#9CA3AF">— không cung cấp —</i>'}</td></tr>
              <tr><td style="padding:8px 0;color:#6B7280">Loại hình</td><td style="padding:8px 0">${escapeHtml(type) || '<i style="color:#9CA3AF">—</i>'}</td></tr>
              <tr><td style="padding:8px 0;color:#6B7280">Mục đích</td><td style="padding:8px 0">${escapeHtml(purpose) || '<i style="color:#9CA3AF">—</i>'}</td></tr>
              <tr><td style="padding:8px 0;color:#6B7280">Dự án</td><td style="padding:8px 0;font-weight:600">${escapeHtml(project)}</td></tr>
              <tr><td style="padding:8px 0;color:#6B7280">Nguồn</td><td style="padding:8px 0">${escapeHtml(source)}</td></tr>
              ${pageUrl ? `<tr><td style="padding:8px 0;color:#6B7280">Trang</td><td style="padding:8px 0;font-size:12px"><a href="${escapeHtml(pageUrl)}" style="color:#004D2C">${escapeHtml(pageUrl)}</a></td></tr>` : ''}
            </table>
            <div style="margin-top:20px;padding:14px 16px;background:#FFF8E1;border-left:4px solid #C9A84C;border-radius:6px;font-size:13px;color:#5C4A0F">
              ⏱ Yêu cầu: liên hệ khách hàng trong vòng <b>30 phút</b> để giữ tỷ lệ chuyển đổi.
            </div>
          </div>
        </div>
      `.trim();

      const internalText =
        `Lead mới từ Landing ${project}\n` +
        `Thời gian: ${receivedAt}\n\n` +
        `Họ tên: ${name}\n` +
        `Điện thoại: ${phone}\n` +
        `Email: ${email || '(không cung cấp)'}\n` +
        `Loại hình: ${type || '-'}\n` +
        `Mục đích: ${purpose || '-'}\n` +
        `Dự án: ${project}\n` +
        `Nguồn: ${source}\n` +
        (pageUrl ? `Trang: ${pageUrl}\n` : '');

      // ── 2) Auto-reply to end-user (if email provided) ────────────────────
      const userHtml = `
        <div style="font-family:Inter,Arial,sans-serif;max-width:640px;margin:auto;color:#0E1F18">
          <div style="background:linear-gradient(135deg,#003822,#004D2C);color:#fff;padding:28px;border-radius:12px 12px 0 0;text-align:center">
            <h2 style="margin:0;color:#C9A84C;font-size:22px">Cảm ơn ${escapeHtml(name)}!</h2>
            <p style="margin:8px 0 0;opacity:.9">SGS Land đã nhận thông tin đăng ký của bạn về dự án</p>
            <p style="margin:6px 0 0;color:#C9A84C;font-size:18px;font-weight:700">${escapeHtml(project)}</p>
          </div>
          <div style="background:#fff;border:1px solid #E5E7EB;border-top:none;padding:28px;border-radius:0 0 12px 12px">
            <p style="margin:0 0 14px;font-size:15px;line-height:1.6">
              Chuyên viên tư vấn của <b>SGS Land</b> sẽ liên hệ với bạn qua số
              <a href="tel:${escapeHtml(phone)}" style="color:#004D2C;font-weight:600">${escapeHtml(phone)}</a>
              trong vòng <b>30 phút</b> để gửi:
            </p>
            <ul style="margin:0 0 18px;padding-left:20px;font-size:14px;line-height:1.8;color:#374151">
              <li>Bảng giá &amp; chính sách bán hàng mới nhất</li>
              <li>Mặt bằng phân khu &amp; quỹ căn ưu tiên</li>
              <li>Tiến độ pháp lý, lịch mở bán &amp; điều kiện vay ngân hàng</li>
            </ul>
            <div style="background:#F3F8F4;border:1px solid #C9A84C;border-radius:10px;padding:18px;text-align:center;margin:18px 0">
              <p style="margin:0;font-size:13px;color:#6B7280;text-transform:uppercase;letter-spacing:.06em">Hotline tư vấn 24/7</p>
              <a href="tel:${HOTLINE}" style="display:inline-block;margin-top:6px;color:#004D2C;font-size:22px;font-weight:700;text-decoration:none">📞 ${HOTLINE_DISPLAY}</a>
            </div>
            <p style="margin:18px 0 0;font-size:13px;color:#6B7280;line-height:1.6">
              Nếu bạn cần hỗ trợ ngay, vui lòng gọi hotline ở trên hoặc trả lời email này.
              <br/>Trân trọng,<br/><b style="color:#004D2C">Đội ngũ SGS Land</b>
            </p>
          </div>
          <p style="text-align:center;font-size:11px;color:#9CA3AF;margin:14px 0 0">
            © ${new Date().getFullYear()} SGS Land — Nền tảng bất động sản AI Việt Nam
          </p>
        </div>
      `.trim();

      const userText =
        `Cảm ơn ${name}!\n\n` +
        `SGS Land đã nhận thông tin đăng ký của bạn về dự án ${project}.\n` +
        `Chuyên viên tư vấn sẽ liên hệ qua số ${phone} trong vòng 30 phút.\n\n` +
        `Hotline 24/7: ${HOTLINE_DISPLAY}\n\n` +
        `Trân trọng,\nĐội ngũ SGS Land`;

      if (!isBrevoConfigured()) {
        logger.warn('[LandingLead] BREVO_API_KEY not set — lead saved to log only.');
        logger.info(`[LandingLead] ${JSON.stringify({ name, phone, email, type, purpose, project, source })}`);
        return res.json({
          ok: true,
          message: 'Đã nhận thông tin. Chúng tôi sẽ liên hệ trong vòng 30 phút.',
          emailSent: false,
        });
      }

      // Fire internal notification (await to surface failures)
      const internalResult = await brevoSendEmail({
        to: INTERNAL_INBOX,
        subject: `[Lead Landing] ${project} — ${name} (${phone})`,
        html: internalHtml,
        text: internalText,
        replyTo: email ? { email, name } : undefined,
        tags: ['landing-lead', 'vinhomes-hoc-mon'],
      });

      if (!internalResult.success) {
        logger.error(`[LandingLead] Internal email failed: ${internalResult.error}`);
      }

      // Auto-reply to end-user (best-effort, do not fail request if this fails)
      let userEmailSent = false;
      if (email) {
        const userResult = await brevoSendEmail({
          to: { email, name } as any,
          subject: `Cảm ơn ${name} — SGS Land sẽ liên hệ về ${project} trong 30 phút`,
          html: userHtml,
          text: userText,
          tags: ['landing-lead-autoreply'],
        });
        userEmailSent = userResult.success;
        if (!userResult.success) {
          logger.warn(`[LandingLead] Auto-reply email failed for ${email}: ${userResult.error}`);
        }
      }

      logger.info(`[LandingLead] Captured: ${name} / ${phone} / ${email || '-'} / ${project}`);

      return res.json({
        ok: true,
        message: 'Đã nhận thông tin. Chuyên viên SGS Land sẽ liên hệ trong vòng 30 phút.',
        emailSent: internalResult.success,
        autoReplySent: userEmailSent,
      });
    } catch (err: any) {
      logger.error(`[LandingLead] Unexpected error: ${err?.message || err}`);
      return res.status(500).json({
        ok: false,
        error: 'Có lỗi xảy ra khi gửi thông tin. Vui lòng gọi hotline 0971 132 378.',
      });
    }
  });

  return router;
}
