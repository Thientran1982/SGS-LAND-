/**
 * Public lead capture route for static landing pages (e.g. /landing/vinhomes-hoc-mon/).
 * - No auth required (public form)
 * - Saves lead to DB (leads table) with UTM + channel + chat transcript
 * - Sends two transactional emails via Brevo:
 *   1) Internal notification → SGS Land hotline inbox
 *   2) Auto-reply confirmation → end-user (if email provided)
 * - Hotline & contact phone: 0971132378
 */

import { Router, Request, Response } from 'express';
import { brevoSendEmail, isBrevoConfigured } from '../services/brevoService';
import { logger } from '../middleware/logger';
import { pool } from '../db';

const HOTLINE = '0971132378';
const HOTLINE_DISPLAY = '0971 132 378';
const INTERNAL_INBOX = process.env.LANDING_LEAD_INBOX || 'info@sgsland.vn';
const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

const PROJECT_DISPLAY_NAMES: Record<string, string> = {
  'aqua-city': 'Aqua City Novaland',
  'masteri-cosmo-central': 'Masteri Cosmo Central',
  'vinhomes-hoc-mon': 'Vinhomes Hóc Môn',
  'legacy-66': 'Legacy 66',
  'vinhomes-can-gio': 'Vinhomes Cần Giờ',
  'vinhomes-grand-park': 'Vinhomes Grand Park',
  'diamond-city': 'Diamond City',
};

interface LandingLeadPayload {
  name?: string;
  phone?: string;
  email?: string;
  type?: string;
  unit?: string;
  purpose?: string;
  project?: string;
  source?: string;
  pageUrl?: string;
  referrer?: string;
  channel?: 'form' | 'ai_chat';
  utm?: Record<string, string>;
  chatTranscript?: string;
  note?: string;
  interest?: string;
  budget?: string;
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

async function checkDuplicateLead(phone: string, projectSlug: string): Promise<boolean> {
  try {
    const result = await pool.query(
      `SELECT id FROM leads
       WHERE tenant_id = $1
         AND phone = $2
         AND metadata->>'project_slug' = $3
         AND created_at > NOW() - INTERVAL '24 hours'
       LIMIT 1`,
      [DEFAULT_TENANT_ID, phone, projectSlug]
    );
    return result.rows.length > 0;
  } catch {
    return false;
  }
}

async function saveLeadToDB(payload: {
  name: string;
  phone: string;
  email: string;
  source: string;
  project: string;
  projectSlug: string;
  pageUrl: string;
  referrer: string;
  channel: string;
  utm: Record<string, string>;
  chatTranscript: string;
  interest: string;
  budget: string;
  note: string;
}): Promise<string | null> {
  try {
    const tags = ['landing-page', payload.projectSlug];
    if (payload.channel === 'ai_chat') tags.push('ai-chat');
    if (payload.utm.utm_source) tags.push(`src:${payload.utm.utm_source}`);

    const metadata = {
      project: payload.project,
      project_slug: payload.projectSlug,
      page_url: payload.pageUrl,
      referrer: payload.referrer,
      channel: payload.channel,
      interest: payload.interest,
      budget: payload.budget,
      ...Object.fromEntries(
        Object.entries(payload.utm).filter(([, v]) => v)
      ),
    };

    const notes = [
      payload.note,
      payload.chatTranscript ? `[Chat transcript]\n${payload.chatTranscript}` : '',
    ].filter(Boolean).join('\n\n');

    const result = await pool.query(
      `INSERT INTO leads (tenant_id, name, phone, email, source, stage, notes, tags, metadata)
       VALUES ($1, $2, $3, $4, $5, 'NEW', $6, $7::jsonb, $8::jsonb)
       RETURNING id`,
      [
        DEFAULT_TENANT_ID,
        payload.name,
        payload.phone,
        payload.email || null,
        payload.source,
        notes || null,
        JSON.stringify(tags),
        JSON.stringify(metadata),
      ]
    );
    return result.rows[0]?.id ?? null;
  } catch (err: any) {
    logger.error(`[LandingLead] DB insert failed: ${err.message}`);
    return null;
  }
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
      const type = (body.type || body.unit || body.interest || '').trim();
      const purpose = (body.purpose || '').trim();
      const projectSlug = (body.project || '').trim().toLowerCase();
      const project = PROJECT_DISPLAY_NAMES[projectSlug] || projectSlug || 'Dự án SGS Land';
      const channel = (body.channel || 'form') as 'form' | 'ai_chat';
      const pageUrl = (body.pageUrl || '').trim();
      const referrer = (body.referrer || '').trim();
      const utm = body.utm && typeof body.utm === 'object' ? body.utm : {};
      const chatTranscript = (body.chatTranscript || '').slice(0, 5000);
      const note = (body.note || '').trim();
      const budget = (body.budget || '').trim();

      const source = (body.source || `landing-${projectSlug || 'page'}`).trim();

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

      const isDuplicate = await checkDuplicateLead(phone, projectSlug);
      if (isDuplicate) {
        logger.info(`[LandingLead] Duplicate suppressed: ${phone} / ${projectSlug}`);
        return res.json({
          ok: true,
          message: 'Cảm ơn anh/chị! Chúng tôi đã nhận thông tin và sẽ liên hệ trong vòng 30 phút.',
          duplicate: true,
        });
      }

      const leadId = await saveLeadToDB({
        name, phone, email, source, project, projectSlug,
        pageUrl, referrer, channel, utm, chatTranscript,
        interest: type, budget, note,
      });

      if (leadId) {
        logger.info(`[LandingLead] Saved to DB: ${leadId} — ${name} / ${phone} / ${project} / ch:${channel}`);
      }

      const receivedAt = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

      const utmRows = Object.entries(utm)
        .filter(([, v]) => v)
        .map(([k, v]) => `<tr><td style="padding:6px 0;color:#6B7280;width:140px">${escapeHtml(k)}</td><td style="padding:6px 0;font-size:13px">${escapeHtml(String(v))}</td></tr>`)
        .join('');

      const internalHtml = `
        <div style="font-family:Inter,Arial,sans-serif;max-width:640px;margin:auto;color:#0E1F18">
          <div style="background:linear-gradient(135deg,#003822,#004D2C);color:#fff;padding:24px 28px;border-radius:12px 12px 0 0">
            <h2 style="margin:0;color:#C9A84C;font-size:20px">🔔 Lead mới từ Landing ${escapeHtml(project)}</h2>
            <p style="margin:6px 0 0;font-size:13px;opacity:.85">Tiếp nhận lúc ${escapeHtml(receivedAt)} (GMT+7) — Kênh: <b>${channel === 'ai_chat' ? 'AI Chat' : 'Form đăng ký'}</b></p>
          </div>
          <div style="background:#fff;border:1px solid #E5E7EB;border-top:none;padding:24px 28px;border-radius:0 0 12px 12px">
            <table style="width:100%;border-collapse:collapse;font-size:14px">
              <tr><td style="padding:8px 0;color:#6B7280;width:140px">Họ và tên</td><td style="padding:8px 0;font-weight:600">${escapeHtml(name)}</td></tr>
              <tr><td style="padding:8px 0;color:#6B7280">Số điện thoại</td><td style="padding:8px 0;font-weight:600"><a href="tel:${escapeHtml(phone)}" style="color:#004D2C">${escapeHtml(phone)}</a></td></tr>
              <tr><td style="padding:8px 0;color:#6B7280">Email</td><td style="padding:8px 0">${email ? `<a href="mailto:${escapeHtml(email)}" style="color:#004D2C">${escapeHtml(email)}</a>` : '<i style="color:#9CA3AF">— không cung cấp —</i>'}</td></tr>
              <tr><td style="padding:8px 0;color:#6B7280">Loại hình</td><td style="padding:8px 0">${escapeHtml(type) || '<i style="color:#9CA3AF">—</i>'}</td></tr>
              <tr><td style="padding:8px 0;color:#6B7280">Ngân sách</td><td style="padding:8px 0">${escapeHtml(budget) || '<i style="color:#9CA3AF">—</i>'}</td></tr>
              <tr><td style="padding:8px 0;color:#6B7280">Dự án</td><td style="padding:8px 0;font-weight:600">${escapeHtml(project)}</td></tr>
              <tr><td style="padding:8px 0;color:#6B7280">Nguồn</td><td style="padding:8px 0">${escapeHtml(source)}</td></tr>
              <tr><td style="padding:8px 0;color:#6B7280">Kênh</td><td style="padding:8px 0">${channel === 'ai_chat' ? '🤖 AI Chat' : '📋 Form đăng ký'}</td></tr>
              ${pageUrl ? `<tr><td style="padding:6px 0;color:#6B7280">Trang</td><td style="padding:6px 0;font-size:12px"><a href="${escapeHtml(pageUrl)}" style="color:#004D2C">${escapeHtml(pageUrl)}</a></td></tr>` : ''}
              ${referrer ? `<tr><td style="padding:6px 0;color:#6B7280">Referrer</td><td style="padding:6px 0;font-size:12px">${escapeHtml(referrer)}</td></tr>` : ''}
              ${utmRows}
            </table>
            ${chatTranscript ? `
            <div style="margin-top:16px;padding:12px 16px;background:#F3F8F4;border-left:4px solid #004D2C;border-radius:6px;font-size:12px;color:#374151;white-space:pre-wrap;font-family:monospace;max-height:200px;overflow:auto">
              <b style="font-family:Inter,Arial,sans-serif;font-size:13px;color:#004D2C">📝 Nội dung chat:</b><br/><br/>${escapeHtml(chatTranscript.slice(0, 1500))}${chatTranscript.length > 1500 ? '...' : ''}
            </div>` : ''}
            <div style="margin-top:20px;padding:14px 16px;background:#FFF8E1;border-left:4px solid #C9A84C;border-radius:6px;font-size:13px;color:#5C4A0F">
              ⏱ Yêu cầu: liên hệ khách hàng trong vòng <b>30 phút</b> để giữ tỷ lệ chuyển đổi.
              ${leadId ? `<br/><span style="font-size:11px;color:#9CA3AF">Lead ID: ${leadId}</span>` : ''}
            </div>
          </div>
        </div>
      `.trim();

      const internalText =
        `Lead mới từ Landing ${project}\n` +
        `Thời gian: ${receivedAt}\nKênh: ${channel}\n\n` +
        `Họ tên: ${name}\nĐiện thoại: ${phone}\nEmail: ${email || '(không cung cấp)'}\n` +
        `Loại hình: ${type || '-'}\nNgân sách: ${budget || '-'}\n` +
        `Dự án: ${project}\nNguồn: ${source}\n` +
        (pageUrl ? `Trang: ${pageUrl}\n` : '') +
        (referrer ? `Referrer: ${referrer}\n` : '') +
        Object.entries(utm).filter(([,v])=>v).map(([k,v])=>`${k}: ${v}`).join('\n') +
        (chatTranscript ? `\n\n[Chat]\n${chatTranscript.slice(0,500)}` : '');

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
        `Hotline 24/7: ${HOTLINE_DISPLAY}\n\nTrân trọng,\nĐội ngũ SGS Land`;

      if (!isBrevoConfigured()) {
        logger.warn('[LandingLead] BREVO_API_KEY not set — lead saved to DB only.');
        return res.json({
          ok: true,
          message: 'Đã nhận thông tin. Chúng tôi sẽ liên hệ trong vòng 30 phút.',
          emailSent: false,
          leadId,
        });
      }

      const internalResult = await brevoSendEmail({
        to: INTERNAL_INBOX,
        subject: `[Lead ${channel === 'ai_chat' ? 'AI' : 'Form'}] ${project} — ${name} (${phone})`,
        html: internalHtml,
        text: internalText,
        replyTo: email ? { email, name } : undefined,
        tags: ['landing-lead', projectSlug],
      });

      if (!internalResult.success) {
        logger.error(`[LandingLead] Internal email failed: ${internalResult.error}`);
      }

      let userEmailSent = false;
      if (email) {
        const userResult = await brevoSendEmail({
          to: [{ email, name }],
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

      logger.info(`[LandingLead] Captured: ${name} / ${phone} / ${email || '-'} / ${project} / ch:${channel}`);

      return res.json({
        ok: true,
        message: 'Đã nhận thông tin. Chuyên viên SGS Land sẽ liên hệ trong vòng 30 phút.',
        emailSent: internalResult.success,
        autoReplySent: userEmailSent,
        leadId,
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
