import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { enterpriseConfigRepository } from '../repositories/enterpriseConfigRepository';
import { DEFAULT_TENANT_ID } from '../constants';
import { isBrevoConfigured, brevoSendEmail } from './brevoService';
import { logger } from '../middleware/logger';
import { withRlsBypass } from '../db';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

interface SmtpConfig {
  enabled: boolean;
  host: string;
  port: number;
  secure?: boolean;
  user: string;
  password: string;
  from?: string;
  fromName?: string;
  fromAddress?: string;
}

interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  /** Tên template để phân loại trong email_log (vd: 'verification', 'campaign'). */
  template?: string;
  /**
   * Khoá dedupe: nếu cùng (tenant_id, dedupe_key) đã được gửi thành công trong
   * `dedupeWindowMinutes` gần nhất → bỏ qua (trả về status='deduped').
   * Mặc định: tự sinh từ {to + subject + template}.
   */
  dedupeKey?: string;
  /** Cửa sổ dedupe (phút). Mặc định 10 phút. Đặt 0 để tắt dedupe. */
  dedupeWindowMinutes?: number;
  /**
   * Bỏ qua kiểm tra quota — dùng cho email tối quan trọng (xác minh tài khoản,
   * đặt lại mật khẩu, biên lai thanh toán) phải gửi bằng mọi giá.
   */
  skipQuota?: boolean;
  /** Brevo tags (vd: ['campaign:abc', 'variant:A']) — chuyển thẳng xuống provider. */
  tags?: string[];
}

type EmailStatus =
  | 'sent'
  | 'queued_no_smtp'
  | 'failed'
  | 'deduped'
  | 'quota_exceeded';

interface EmailResult {
  success: boolean;
  status: EmailStatus;
  messageId?: string;
  error?: string;
}

// ── Quota & dedupe helpers ────────────────────────────────────────────────────

// Hạn mức email/30 ngày theo gói cước (per tenant). Có thể override qua env.
const PLAN_EMAIL_QUOTA: Record<string, number> = {
  TRIAL: 100,
  INDIVIDUAL: 500,
  TEAM: 2000,
  ENTERPRISE: 20000,
};
const DEFAULT_PLAN_QUOTA = 500;

function makeDedupeKey(tenantId: string, opts: EmailOptions): string {
  if (opts.dedupeKey) return opts.dedupeKey;
  const raw = `${tenantId}|${opts.to.toLowerCase().trim()}|${opts.template || ''}|${opts.subject}`;
  return crypto.createHash('sha1').update(raw).digest('hex');
}

/**
 * Lấy quota email/30 ngày của tenant theo gói cước hiện tại trong subscriptions.
 * Nếu tenant chưa có subscription, dùng mức TRIAL.
 */
async function getMonthlyEmailQuota(tenantId: string): Promise<number> {
  try {
    return await withRlsBypass(async (client) => {
      const r = await client.query(
        `SELECT plan_id FROM subscriptions
          WHERE tenant_id = $1::uuid
          ORDER BY created_at DESC
          LIMIT 1`,
        [tenantId],
      );
      const planId = (r.rows[0]?.plan_id || 'TRIAL').toString().toUpperCase();
      return PLAN_EMAIL_QUOTA[planId] ?? DEFAULT_PLAN_QUOTA;
    });
  } catch (err: any) {
    logger.warn(
      `[EmailService] getMonthlyEmailQuota failed for tenant ${tenantId}, dùng default ${DEFAULT_PLAN_QUOTA}: ${err.message}`,
    );
    return DEFAULT_PLAN_QUOTA;
  }
}

async function findRecentDedupe(
  tenantId: string,
  dedupeKey: string,
  windowMinutes: number,
): Promise<boolean> {
  try {
    return await withRlsBypass(async (client) => {
      const r = await client.query(
        `SELECT 1 FROM email_log
          WHERE tenant_id = $1::uuid
            AND dedupe_key = $2
            AND status IN ('sent','queued_no_smtp')
            AND sent_at > NOW() - ($3 || ' minutes')::interval
          LIMIT 1`,
        [tenantId, dedupeKey, String(windowMinutes)],
      );
      return (r.rowCount ?? 0) > 0;
    });
  } catch (err: any) {
    logger.warn(`[EmailService] dedupe lookup failed: ${err.message}`);
    return false; // fail-open: thà gửi lặp còn hơn nuốt mất email quan trọng
  }
}

async function countSentLast30Days(tenantId: string): Promise<number> {
  try {
    return await withRlsBypass(async (client) => {
      const r = await client.query(
        `SELECT COUNT(*)::int AS n FROM email_log
          WHERE tenant_id = $1::uuid
            AND status IN ('sent','queued_no_smtp')
            AND sent_at > NOW() - INTERVAL '30 days'`,
        [tenantId],
      );
      return Number(r.rows[0]?.n || 0);
    });
  } catch {
    return 0;
  }
}

async function logEmail(args: {
  tenantId: string;
  recipient: string;
  subject: string;
  template?: string;
  dedupeKey: string;
  status: EmailStatus;
  provider?: string;
  messageId?: string;
  error?: string;
}): Promise<void> {
  try {
    await withRlsBypass(async (client) => {
      await client.query(
        `INSERT INTO email_log
           (tenant_id, recipient, subject, template, dedupe_key, status, provider, message_id, error)
         VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          args.tenantId,
          args.recipient,
          args.subject,
          args.template || null,
          args.dedupeKey,
          args.status,
          args.provider || null,
          args.messageId || null,
          args.error || null,
        ],
      );
    });
  } catch (err: any) {
    logger.warn(`[EmailService] logEmail failed (non-fatal): ${err.message}`);
  }
}

// ── Shared email base layout ──────────────────────────────────────────────────
// Table-based layout + @media queries for full mobile responsiveness.
// Tested compatible with: Gmail (web/app), Apple Mail, Outlook 2016+, iOS Mail, Samsung Mail.

function emailBase(content: string, footerNote?: string): string {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="vi">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>SGS LAND</title>
  <style type="text/css">
    /* Reset */
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    /* Mobile */
    @media only screen and (max-width: 620px) {
      .email-wrapper  { padding: 16px 8px !important; }
      .email-container{ width: 100% !important; max-width: 100% !important; }
      .email-header   { padding: 20px 20px !important; }
      .email-body     { padding: 24px 20px 20px !important; }
      .email-footer   { padding: 16px 20px !important; }
      .btn-full       { width: 100% !important; }
      .btn-link       { display: block !important; padding: 14px 20px !important; text-align: center !important; }
      h1.email-title  { font-size: 19px !important; }
      p.email-lead    { font-size: 14px !important; }
      .hide-mobile    { display: none !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#F1F5F9;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F1F5F9">
  <tr>
    <td align="center" valign="top" class="email-wrapper" style="padding:40px 16px;">

      <table class="email-container" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

        <!-- HEADER -->
        <tr>
          <td class="email-header" bgcolor="#1E293B" style="padding:24px 40px;text-align:center;border-radius:12px 12px 0 0;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="padding-bottom:8px;">
                  <table cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td bgcolor="#4F46E5" style="padding:7px 16px;border-radius:8px;">
                        <span style="color:#FFFFFF;font-size:16px;font-weight:bold;letter-spacing:3px;font-family:Arial,sans-serif;">SGS</span>
                        <span style="color:#A5B4FC;font-size:16px;font-weight:bold;letter-spacing:3px;font-family:Arial,sans-serif;">&nbsp;LAND</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td align="center">
                  <span style="color:#94A3B8;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;font-family:Arial,sans-serif;">Nền tảng Bất Động Sản Chuyên Nghiệp</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- BODY -->
        <tr>
          <td class="email-body" bgcolor="#FFFFFF" style="padding:32px 40px 24px;border-left:1px solid #E2E8F0;border-right:1px solid #E2E8F0;">
            ${content}
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td class="email-footer" bgcolor="#F8FAFC" style="padding:18px 40px;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 12px 12px;text-align:center;">
            ${footerNote ? `<p style="color:#64748B;font-size:12px;line-height:1.6;margin:0 0 10px;font-family:Arial,sans-serif;">${footerNote}</p>` : ''}
            <p style="color:#94A3B8;font-size:11px;margin:0;line-height:1.8;font-family:Arial,sans-serif;">
              &copy; ${year} SGS LAND &mdash; 122-124 B2, Sala, Thủ Đức, TP.HCM<br />
              <a href="https://sgsland.vn" style="color:#4F46E5;text-decoration:none;font-family:Arial,sans-serif;">sgsland.vn</a>
              &nbsp;&bull;&nbsp;
              <a href="mailto:info@sgsland.vn" style="color:#4F46E5;text-decoration:none;font-family:Arial,sans-serif;">info@sgsland.vn</a>
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function primaryButton(href: string, label: string): string {
  return `<table class="btn-full" cellpadding="0" cellspacing="0" border="0" align="center" style="min-width:200px;">
  <tr>
    <td bgcolor="#4F46E5" style="border-radius:8px;padding:0;text-align:center;">
      <a href="${href}" class="btn-link" style="display:inline-block;padding:14px 36px;color:#FFFFFF;font-size:15px;font-weight:bold;text-decoration:none;font-family:Arial,sans-serif;letter-spacing:0.3px;border-radius:8px;">${label}</a>
    </td>
  </tr>
</table>`;
}

function divider(): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td style="border-top:1px solid #E2E8F0;font-size:0;line-height:0;height:1px;">&nbsp;</td></tr>
</table>
<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="height:20px;font-size:0;line-height:0;">&nbsp;</td></tr></table>`;
}

function linkBox(url: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td bgcolor="#F8FAFC" style="padding:14px 18px;border:1px solid #E2E8F0;border-radius:8px;">
      <p style="color:#64748B;font-size:11px;font-weight:bold;letter-spacing:0.8px;text-transform:uppercase;margin:0 0 6px;font-family:Arial,sans-serif;">Hoặc dán link này vào trình duyệt:</p>
      <p style="color:#4F46E5;font-size:11px;word-break:break-all;margin:0;font-family:'Courier New',monospace;line-height:1.5;">${url}</p>
    </td>
  </tr>
</table>`;
}

function warningBox(title: string, body: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td bgcolor="#FFF7ED" style="padding:14px 18px;border:1px solid #FED7AA;border-radius:8px;">
      <p style="color:#92400E;font-size:12px;font-weight:bold;margin:0 0 4px;font-family:Arial,sans-serif;">${title}</p>
      <p style="color:#78350F;font-size:12px;line-height:1.7;margin:0;font-family:Arial,sans-serif;">${body}</p>
    </td>
  </tr>
</table>`;
}

function iconCircle(bgColor: string, emoji: string): string {
  return `<table cellpadding="0" cellspacing="0" border="0" align="center">
  <tr>
    <td width="64" height="64" bgcolor="${bgColor}" align="center" valign="middle" style="border-radius:32px;width:64px;height:64px;text-align:center;font-size:28px;font-family:Arial,sans-serif;">
      ${emoji}
    </td>
  </tr>
</table>`;
}

function spacer(h: number): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="height:${h}px;font-size:0;line-height:0;">&nbsp;</td></tr></table>`;
}

// ── SMTP helpers ──────────────────────────────────────────────────────────────

async function getSmtpConfig(tenantId: string): Promise<SmtpConfig> {
  try {
    const config = await enterpriseConfigRepository.getConfig(tenantId);
    return config.email || { enabled: false, host: '', port: 587, user: '', password: '' };
  } catch {
    return { enabled: false, host: '', port: 587, user: '', password: '' };
  }
}

function createTransporter(smtp: SmtpConfig): nodemailer.Transporter {
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure !== undefined ? smtp.secure : smtp.port === 465,
    auth: { user: smtp.user, pass: smtp.password },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

function buildFromAddress(smtp: SmtpConfig): string {
  if (smtp.from) return smtp.from;
  if (smtp.fromAddress) {
    return smtp.fromName ? `${smtp.fromName} <${smtp.fromAddress}>` : smtp.fromAddress;
  }
  return `SGS LAND <${smtp.user}>`;
}

// ── Core sendEmail ────────────────────────────────────────────────────────────

/**
 * Lớp gửi thực sự — gọi Brevo (ưu tiên) rồi fallback SMTP.
 * KHÔNG kiểm tra quota / dedupe — đó là việc của `sendEmail` ở wrapper bên ngoài.
 */
async function deliverEmail(
  tenantId: string,
  options: EmailOptions,
): Promise<{ result: EmailResult; provider: string }> {
  if (isBrevoConfigured()) {
    const result = await brevoSendEmail({
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      tags: options.tags,
    });
    if (result.success) {
      return {
        result: { success: true, status: 'sent', messageId: result.messageId },
        provider: 'brevo',
      };
    }
    console.warn(`[EmailService] Brevo failed (${result.error}), attempting SMTP fallback.`);
  }

  const smtp = await getSmtpConfig(tenantId);

  if (!smtp.enabled || !smtp.host || !smtp.user) {
    logger.warn(
      `[EmailService] No email provider configured for tenant ${tenantId}. Email queued (not sent). To: ${options.to}, Subject: ${options.subject}`,
    );
    return {
      result: { success: true, status: 'queued_no_smtp', messageId: `queued-${Date.now()}` },
      provider: 'none',
    };
  }

  try {
    const transporter = createTransporter(smtp);
    const fromAddress = buildFromAddress(smtp);
    const info = await transporter.sendMail({
      from: fromAddress,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
    logger.info(`[EmailService] Email sent via SMTP: ${info.messageId}`);
    return {
      result: { success: true, status: 'sent', messageId: info.messageId },
      provider: 'smtp',
    };
  } catch (error: any) {
    console.error(`[EmailService] SMTP send failed:`, error.message);
    return {
      result: { success: false, status: 'failed', error: error.message },
      provider: 'smtp',
    };
  }
}

/**
 * Entry point chính cho mọi email gửi đi:
 *   1) Dedupe — bỏ qua nếu cùng (tenant, dedupeKey) đã được gửi trong cửa sổ X phút.
 *   2) Quota — chặn nếu tenant đã vượt hạn mức 30 ngày của gói cước
 *      (trừ khi caller đặt `skipQuota: true` cho email tối quan trọng).
 *   3) Gọi `deliverEmail` (Brevo → fallback SMTP).
 *   4) Ghi `email_log` để phục vụ audit, dedupe lần sau, và đếm quota.
 */
async function sendEmail(tenantId: string, options: EmailOptions): Promise<EmailResult> {
  const dedupeKey = makeDedupeKey(tenantId, options);
  const dedupeWindow = options.dedupeWindowMinutes ?? 10;

  // 1) Dedupe
  if (dedupeWindow > 0) {
    const isDup = await findRecentDedupe(tenantId, dedupeKey, dedupeWindow);
    if (isDup) {
      logger.info(
        `[EmailService] Dedupe hit — bỏ qua gửi lại "${options.subject}" cho ${options.to} (tenant=${tenantId})`,
      );
      await logEmail({
        tenantId,
        recipient: options.to,
        subject: options.subject,
        template: options.template,
        dedupeKey,
        status: 'deduped',
      });
      return { success: true, status: 'deduped' };
    }
  }

  // 2) Quota
  if (!options.skipQuota) {
    const [quota, sent] = await Promise.all([
      getMonthlyEmailQuota(tenantId),
      countSentLast30Days(tenantId),
    ]);
    if (sent >= quota) {
      logger.warn(
        `[EmailService] Quota vượt — tenant ${tenantId} đã gửi ${sent}/${quota} email trong 30 ngày. Bỏ qua "${options.subject}" cho ${options.to}.`,
      );
      await logEmail({
        tenantId,
        recipient: options.to,
        subject: options.subject,
        template: options.template,
        dedupeKey,
        status: 'quota_exceeded',
        error: `Quota ${sent}/${quota} per 30 days`,
      });
      return {
        success: false,
        status: 'quota_exceeded',
        error: `Email quota exceeded (${sent}/${quota} in last 30 days)`,
      };
    }
  }

  // 3) Gửi
  const { result, provider } = await deliverEmail(tenantId, options);

  // 4) Log
  await logEmail({
    tenantId,
    recipient: options.to,
    subject: options.subject,
    template: options.template,
    dedupeKey,
    status: result.status,
    provider,
    messageId: result.messageId,
    error: result.error,
  });

  return result;
}

async function testSmtpConnection(tenantId: string): Promise<EmailResult> {
  const smtp = await getSmtpConfig(tenantId);
  if (!smtp.enabled || !smtp.host || !smtp.user) {
    return { success: false, status: 'failed', error: 'SMTP is not configured or disabled' };
  }
  try {
    const transporter = createTransporter(smtp);
    await transporter.verify();
    return { success: true, status: 'sent' };
  } catch (error: any) {
    return { success: false, status: 'failed', error: error.message };
  }
}

// ── Email templates ───────────────────────────────────────────────────────────

async function sendVerificationEmail(tenantId: string, to: string, userName: string, verifyUrl: string): Promise<EmailResult> {
  const safeName = escapeHtml(userName);
  const safeUrl  = escapeHtml(verifyUrl);

  const content = `
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center">${iconCircle('#EEF2FF', '&#9993;')}</td></tr>
    </table>
    ${spacer(20)}
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center"><h1 class="email-title" style="color:#0F172A;font-size:22px;font-weight:bold;margin:0;font-family:Arial,sans-serif;">Xác Minh Địa Chỉ Email</h1></td></tr>
      <tr><td align="center" style="padding-top:6px;"><span style="color:#64748B;font-size:13px;font-family:Arial,sans-serif;">Một bước nữa để hoàn tất đăng ký</span></td></tr>
    </table>
    ${spacer(24)}
    ${divider()}
    <p style="color:#334155;font-size:15px;line-height:1.7;margin:0 0 8px;font-family:Arial,sans-serif;">Xin chào <strong>${safeName}</strong>,</p>
    <p style="color:#475569;font-size:14px;line-height:1.7;margin:0 0 28px;font-family:Arial,sans-serif;">
      Cảm ơn bạn đã đăng ký tài khoản trên <strong>SGS LAND</strong>. Để kích hoạt tài khoản và bắt đầu sử dụng, vui lòng xác minh địa chỉ email của bạn.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center">${primaryButton(safeUrl, 'Xác Minh Email Ngay')}</td></tr>
    </table>
    ${spacer(24)}
    ${linkBox(safeUrl)}
    ${spacer(20)}
    <p style="color:#94A3B8;font-size:12px;line-height:1.6;margin:0;text-align:center;font-family:Arial,sans-serif;">
      Link xác minh có hiệu lực trong <strong>24 giờ</strong>.<br />Nếu bạn không thực hiện đăng ký này, vui lòng bỏ qua email.
    </p>
  `;

  return sendEmail(tenantId, {
    to,
    subject: 'SGS LAND – Xác minh địa chỉ email của bạn',
    html: emailBase(content, 'Email này được gửi tự động, vui lòng không trả lời.'),
    text: `Xin chào ${userName},\n\nXác minh email của bạn tại:\n${verifyUrl}\n\nLink hết hạn sau 24 giờ.\n\n— SGS LAND`,
    template: 'verification',
    skipQuota: true,
    // Mỗi link verify khác nhau → ép dedupe theo URL để cho phép resend hợp lệ
    dedupeKey: `verification:${to.toLowerCase()}:${verifyUrl}`,
  });
}

async function sendPasswordResetEmail(tenantId: string, to: string, resetUrl: string, userName?: string): Promise<EmailResult> {
  const name    = escapeHtml(userName || to.split('@')[0]);
  const safeUrl = escapeHtml(resetUrl);

  const content = `
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center">${iconCircle('#FEF3C7', '&#128274;')}</td></tr>
    </table>
    ${spacer(20)}
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center"><h1 class="email-title" style="color:#0F172A;font-size:22px;font-weight:bold;margin:0;font-family:Arial,sans-serif;">Đặt Lại Mật Khẩu</h1></td></tr>
      <tr><td align="center" style="padding-top:6px;"><span style="color:#64748B;font-size:13px;font-family:Arial,sans-serif;">Yêu cầu khôi phục mật khẩu tài khoản</span></td></tr>
    </table>
    ${spacer(24)}
    ${divider()}
    <p style="color:#334155;font-size:15px;line-height:1.7;margin:0 0 8px;font-family:Arial,sans-serif;">Xin chào <strong>${name}</strong>,</p>
    <p style="color:#475569;font-size:14px;line-height:1.7;margin:0 0 28px;font-family:Arial,sans-serif;">
      Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản SGS LAND của bạn. Nhấn nút bên dưới để tạo mật khẩu mới.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center">${primaryButton(safeUrl, 'Đặt Lại Mật Khẩu')}</td></tr>
    </table>
    ${spacer(24)}
    ${linkBox(safeUrl)}
    ${spacer(20)}
    ${divider()}
    ${warningBox('&#9888; Lưu ý bảo mật', 'Link này có hiệu lực trong <strong>1 giờ</strong>. Nếu bạn không yêu cầu đặt lại mật khẩu, tài khoản của bạn vẫn an toàn — hãy bỏ qua email này.')}
  `;

  return sendEmail(tenantId, {
    to,
    subject: 'SGS LAND – Yêu cầu đặt lại mật khẩu',
    html: emailBase(content, 'Email này được gửi tự động, vui lòng không trả lời.'),
    text: `Xin chào ${userName || to.split('@')[0]},\n\nĐặt lại mật khẩu tại:\n${resetUrl}\n\nLink hết hạn sau 1 giờ. Nếu không phải bạn yêu cầu, bỏ qua email này.\n\n— SGS LAND`,
    template: 'password_reset',
    skipQuota: true,
    dedupeKey: `password_reset:${to.toLowerCase()}:${resetUrl}`,
  });
}

async function sendWelcomeEmail(tenantId: string, to: string, userName: string): Promise<EmailResult> {
  const safeName = escapeHtml(userName);

  const featureRow = (text: string) =>
    `<tr><td style="padding:5px 0;color:#334155;font-size:13px;font-family:Arial,sans-serif;">
      <span style="color:#4F46E5;font-weight:bold;">&#10004;</span>&nbsp;&nbsp;${text}
    </td></tr>`;

  const content = `
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center">${iconCircle('#ECFDF5', '&#127881;')}</td></tr>
    </table>
    ${spacer(20)}
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center"><h1 class="email-title" style="color:#0F172A;font-size:22px;font-weight:bold;margin:0;font-family:Arial,sans-serif;">Chào Mừng Đến Với SGS LAND!</h1></td></tr>
      <tr><td align="center" style="padding-top:6px;"><span style="color:#64748B;font-size:13px;font-family:Arial,sans-serif;">Tài khoản của bạn đã sẵn sàng</span></td></tr>
    </table>
    ${spacer(24)}
    ${divider()}
    <p style="color:#334155;font-size:15px;line-height:1.7;margin:0 0 8px;font-family:Arial,sans-serif;">Xin chào <strong>${safeName}</strong>,</p>
    <p style="color:#475569;font-size:14px;line-height:1.7;margin:0 0 20px;font-family:Arial,sans-serif;">
      Tài khoản SGS LAND của bạn đã được kích hoạt thành công. Bây giờ bạn có thể truy cập đầy đủ tính năng của nền tảng quản lý bất động sản chuyên nghiệp.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F8FAFC" style="border:1px solid #E2E8F0;border-radius:8px;">
      <tr><td style="padding:16px 20px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          ${featureRow('Quản lý danh sách bất động sản')}
          ${featureRow('Theo dõi và chăm sóc khách hàng tiềm năng (Leads)')}
          ${featureRow('Quản lý hợp đồng và báo cáo doanh thu')}
          ${featureRow('AI hỗ trợ định giá và tư vấn khách hàng')}
        </table>
      </td></tr>
    </table>
    ${spacer(28)}
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center">${primaryButton('https://sgsland.vn', 'Bắt Đầu Ngay')}</td></tr>
    </table>
  `;

  return sendEmail(tenantId, {
    to,
    subject: 'SGS LAND – Chào mừng! Tài khoản của bạn đã sẵn sàng',
    html: emailBase(content, 'Cần hỗ trợ? Liên hệ support@sgsland.vn'),
    text: `Chào mừng ${userName}!\n\nTài khoản SGS LAND của bạn đã được kích hoạt thành công.\n\nĐăng nhập tại: https://sgsland.vn\n\n— SGS LAND`,
  });
}

async function sendInviteEmail(tenantId: string, to: string, userName: string, role: string, loginUrl: string): Promise<EmailResult> {
  const safeUser = escapeHtml(userName);
  const safeUrl  = escapeHtml(loginUrl);

  const roleLabels: Record<string, string> = {
    admin: 'Quản trị viên',
    manager: 'Quản lý',
    agent: 'Môi giới',
    staff: 'Nhân viên',
  };
  const roleDisplay = roleLabels[role.toLowerCase()] || escapeHtml(role);

  const content = `
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center">${iconCircle('#EEF2FF', '&#128100;')}</td></tr>
    </table>
    ${spacer(20)}
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center"><h1 class="email-title" style="color:#0F172A;font-size:22px;font-weight:bold;margin:0;font-family:Arial,sans-serif;">Bạn Được Mời Tham Gia SGS LAND</h1></td></tr>
      <tr><td align="center" style="padding-top:6px;"><span style="color:#64748B;font-size:13px;font-family:Arial,sans-serif;">Lời mời tham gia nền tảng</span></td></tr>
    </table>
    ${spacer(24)}
    ${divider()}
    <p style="color:#334155;font-size:15px;line-height:1.7;margin:0 0 8px;font-family:Arial,sans-serif;">Xin chào <strong>${safeUser}</strong>,</p>
    <p style="color:#475569;font-size:14px;line-height:1.7;margin:0 0 20px;font-family:Arial,sans-serif;">
      Bạn đã được mời tham gia <strong>SGS LAND Enterprise Platform</strong>. Nhấn nút bên dưới để thiết lập mật khẩu và bắt đầu làm việc.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#EEF2FF" style="border:1px solid #C7D2FE;border-radius:8px;">
      <tr>
        <td style="padding:14px 20px;text-align:center;">
          <p style="color:#64748B;font-size:11px;font-weight:bold;letter-spacing:0.8px;text-transform:uppercase;margin:0 0 4px;font-family:Arial,sans-serif;">Vai trò được phân công</p>
          <p style="color:#4F46E5;font-size:16px;font-weight:bold;margin:0;font-family:Arial,sans-serif;">${roleDisplay}</p>
        </td>
      </tr>
    </table>
    ${spacer(28)}
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center">${primaryButton(safeUrl, 'Kích Hoạt Tài Khoản')}</td></tr>
    </table>
    ${spacer(24)}
    ${linkBox(safeUrl)}
    ${spacer(20)}
    <p style="color:#94A3B8;font-size:12px;line-height:1.6;margin:0;text-align:center;font-family:Arial,sans-serif;">
      Nếu bạn không mong đợi lời mời này, vui lòng bỏ qua email.
    </p>
  `;

  return sendEmail(tenantId, {
    to,
    subject: `SGS LAND – Bạn được mời với vai trò ${roleDisplay}`,
    html: emailBase(content, 'Email này được gửi tự động, vui lòng không trả lời.'),
    text: `Xin chào ${userName}!\n\nBạn được mời tham gia SGS LAND với vai trò ${roleDisplay}.\n\nKích hoạt tài khoản tại:\n${loginUrl}\n\n— SGS LAND`,
    template: 'invite',
    skipQuota: true,
    dedupeKey: `invite:${to.toLowerCase()}:${loginUrl}`,
  });
}

async function sendSequenceEmail(tenantId: string, to: string, subject: string, content: string): Promise<EmailResult> {
  const plainText = content.replace(/<[^>]*>/g, '').trim();

  const body = `
    <h2 style="color:#0F172A;font-size:18px;font-weight:bold;margin:0 0 20px;font-family:Arial,sans-serif;">${escapeHtml(subject)}</h2>
    ${divider()}
    <div style="color:#475569;font-size:14px;line-height:1.8;font-family:Arial,sans-serif;">${content}</div>
  `;

  return sendEmail(tenantId, {
    to,
    subject,
    html: emailBase(body, 'Email này được gửi tự động qua SGS LAND Automation.'),
    text: plainText,
  });
}

// ── Contact form — internal notification (to info@sgsland.vn) ─────────────────

async function sendContactNotification(
  name: string,
  email: string,
  subjectLabel: string,
  message: string,
): Promise<EmailResult> {
  const safeName    = escapeHtml(name);
  const safeEmail   = escapeHtml(email);
  const safeSubject = escapeHtml(subjectLabel);
  const safeMsg     = escapeHtml(message).replace(/\n/g, '<br>');

  const content = `
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center">${iconCircle('#EEF2FF', '&#9993;')}</td></tr>
    </table>
    ${spacer(20)}
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center"><h1 class="email-title" style="color:#0F172A;font-size:22px;font-weight:bold;margin:0;font-family:Arial,sans-serif;">Tin Nhắn Mới Từ Trang Liên Hệ</h1></td></tr>
      <tr><td align="center" style="padding-top:6px;"><span style="color:#64748B;font-size:13px;font-family:Arial,sans-serif;">Khách hàng vừa gửi yêu cầu qua sgsland.vn/lien-he</span></td></tr>
    </table>
    ${spacer(24)}
    ${divider()}
    <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F8FAFC" style="border:1px solid #E2E8F0;border-radius:8px;">
      <tr><td style="padding:16px 20px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="100" style="padding:6px 0;color:#64748B;font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;font-family:Arial,sans-serif;vertical-align:top;">Họ tên</td>
            <td style="padding:6px 0;color:#0F172A;font-size:14px;font-weight:bold;font-family:Arial,sans-serif;">${safeName}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748B;font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;font-family:Arial,sans-serif;vertical-align:top;">Email</td>
            <td style="padding:6px 0;font-family:Arial,sans-serif;"><a href="mailto:${safeEmail}" style="color:#4F46E5;text-decoration:none;font-size:14px;">${safeEmail}</a></td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748B;font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;font-family:Arial,sans-serif;vertical-align:top;">Chủ đề</td>
            <td style="padding:6px 0;font-family:Arial,sans-serif;">
              <span style="display:inline-block;background:#EEF2FF;color:#4F46E5;font-size:12px;font-weight:bold;padding:3px 10px;border-radius:20px;font-family:Arial,sans-serif;">${safeSubject}</span>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
    ${spacer(16)}
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td bgcolor="#F0FDF4" style="padding:16px 20px;border:1px solid #BBF7D0;border-radius:8px;border-left:4px solid #22C55E;">
          <p style="color:#64748B;font-size:11px;font-weight:bold;letter-spacing:0.8px;text-transform:uppercase;margin:0 0 8px;font-family:Arial,sans-serif;">Nội dung tin nhắn</p>
          <p style="color:#1E293B;font-size:14px;line-height:1.7;margin:0;font-family:Arial,sans-serif;">${safeMsg}</p>
        </td>
      </tr>
    </table>
    ${spacer(24)}
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center">${primaryButton(`mailto:${safeEmail}`, 'Phản Hồi Khách Hàng Ngay')}</td></tr>
    </table>
  `;

  return sendEmail(DEFAULT_TENANT_ID, {
    to: 'info@sgsland.vn',
    subject: `[Liên Hệ] ${safeSubject} — ${safeName}`,
    html: emailBase(content, 'Email này được gửi tự động từ form liên hệ tại sgsland.vn'),
    text: `Tin nhắn mới từ ${name} <${email}>\nChủ đề: ${subjectLabel}\n\n${message}`,
  });
}

// ── Contact form — auto-reply to customer ─────────────────────────────────────

const SUBJECT_GUIDANCE: Record<string, { label: string; icon: string; iconBg: string; guidance: string; cta?: { url: string; label: string } }> = {
  support: {
    label: 'Tư vấn Thiết kế & Xây dựng',
    icon:  '&#127775;',
    iconBg: '#EEF2FF',
    guidance: `
      <p style="color:#475569;font-size:14px;line-height:1.7;margin:0 0 12px;font-family:Arial,sans-serif;">
        Chuyên viên tư vấn thiết kế của chúng tôi sẽ liên hệ lại với bạn trong vòng <strong>2–4 giờ làm việc</strong>.
      </p>
      <p style="color:#64748B;font-size:13px;font-weight:bold;margin:0 0 8px;font-family:Arial,sans-serif;">Quá trình tư vấn bao gồm:</p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="padding:4px 0;color:#475569;font-size:13px;font-family:Arial,sans-serif;"><span style="color:#4F46E5;font-weight:bold;">1.</span>&nbsp; Trao đổi yêu cầu & phong cách thiết kế mong muốn</td></tr>
        <tr><td style="padding:4px 0;color:#475569;font-size:13px;font-family:Arial,sans-serif;"><span style="color:#4F46E5;font-weight:bold;">2.</span>&nbsp; Khảo sát mặt bằng & lên phương án thiết kế sơ bộ</td></tr>
        <tr><td style="padding:4px 0;color:#475569;font-size:13px;font-family:Arial,sans-serif;"><span style="color:#4F46E5;font-weight:bold;">3.</span>&nbsp; Báo giá chi tiết & ký hợp đồng tư vấn/thi công</td></tr>
        <tr><td style="padding:4px 0;color:#475569;font-size:13px;font-family:Arial,sans-serif;"><span style="color:#4F46E5;font-weight:bold;">4.</span>&nbsp; Theo dõi tiến độ & bàn giao công trình</td></tr>
      </table>`,
    cta: { url: 'https://sgsland.vn/#/marketplace', label: 'Xem Tin Rao Bất Động Sản' },
  },
  sales: {
    label: 'Tư vấn Mua/Bán Bất Động Sản',
    icon:  '&#127968;',
    iconBg: '#ECFDF5',
    guidance: `
      <p style="color:#475569;font-size:14px;line-height:1.7;margin:0 0 12px;font-family:Arial,sans-serif;">
        Môi giới chuyên nghiệp SGS Land sẽ liên hệ với bạn trong vòng <strong>1–2 giờ</strong> để tìm hiểu nhu cầu và đề xuất các bất động sản phù hợp.
      </p>
      <p style="color:#64748B;font-size:13px;font-weight:bold;margin:0 0 8px;font-family:Arial,sans-serif;">Quy trình tư vấn mua/bán:</p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="padding:4px 0;color:#475569;font-size:13px;font-family:Arial,sans-serif;"><span style="color:#10B981;font-weight:bold;">1.</span>&nbsp; Xác định nhu cầu & ngân sách của bạn</td></tr>
        <tr><td style="padding:4px 0;color:#475569;font-size:13px;font-family:Arial,sans-serif;"><span style="color:#10B981;font-weight:bold;">2.</span>&nbsp; Sàng lọc & giới thiệu bất động sản phù hợp</td></tr>
        <tr><td style="padding:4px 0;color:#475569;font-size:13px;font-family:Arial,sans-serif;"><span style="color:#10B981;font-weight:bold;">3.</span>&nbsp; Đi thực địa & đánh giá pháp lý dự án</td></tr>
        <tr><td style="padding:4px 0;color:#475569;font-size:13px;font-family:Arial,sans-serif;"><span style="color:#10B981;font-weight:bold;">4.</span>&nbsp; Hỗ trợ đàm phán giá & hoàn thiện hợp đồng</td></tr>
      </table>`,
    cta: { url: 'https://sgsland.vn/#/marketplace', label: 'Xem Tin Rao Mới Nhất' },
  },
  partnership: {
    label: 'Hợp tác Kinh doanh',
    icon:  '&#129309;',
    iconBg: '#FFF7ED',
    guidance: `
      <p style="color:#475569;font-size:14px;line-height:1.7;margin:0 0 12px;font-family:Arial,sans-serif;">
        Ban lãnh đạo SGS Land sẽ xem xét đề xuất của bạn và phản hồi trong vòng <strong>1–2 ngày làm việc</strong>.
      </p>
      <p style="color:#64748B;font-size:13px;font-weight:bold;margin:0 0 8px;font-family:Arial,sans-serif;">Hình thức hợp tác chúng tôi quan tâm:</p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="padding:4px 0;color:#475569;font-size:13px;font-family:Arial,sans-serif;"><span style="color:#F59E0B;font-weight:bold;">&#9670;</span>&nbsp; Hợp tác phân phối & môi giới bất động sản</td></tr>
        <tr><td style="padding:4px 0;color:#475569;font-size:13px;font-family:Arial,sans-serif;"><span style="color:#F59E0B;font-weight:bold;">&#9670;</span>&nbsp; Liên doanh phát triển dự án</td></tr>
        <tr><td style="padding:4px 0;color:#475569;font-size:13px;font-family:Arial,sans-serif;"><span style="color:#F59E0B;font-weight:bold;">&#9670;</span>&nbsp; Cung cấp dịch vụ cho hệ sinh thái bất động sản</td></tr>
        <tr><td style="padding:4px 0;color:#475569;font-size:13px;font-family:Arial,sans-serif;"><span style="color:#F59E0B;font-weight:bold;">&#9670;</span>&nbsp; Đối tác công nghệ & truyền thông</td></tr>
      </table>`,
    cta: { url: 'https://sgsland.vn/#/contact', label: 'Liên Hệ Hợp Tác Ngay' },
  },
  other: {
    label: 'Yêu cầu khác',
    icon:  '&#128172;',
    iconBg: '#F0F9FF',
    guidance: `
      <p style="color:#475569;font-size:14px;line-height:1.7;margin:0;font-family:Arial,sans-serif;">
        Đội ngũ SGS Land sẽ xem xét yêu cầu của bạn và phản hồi trong vòng <strong>24 giờ làm việc</strong>.
        Nếu cần hỗ trợ gấp, bạn có thể gọi hotline <strong>0971 132 378</strong> (24/7).
      </p>`,
    cta: { url: 'https://sgsland.vn/#/contact', label: 'Xem Thêm Thông Tin Liên Hệ' },
  },
};

async function sendContactAutoReply(
  to: string,
  name: string,
  subjectKey: string,
  message: string,
): Promise<EmailResult> {
  const safeName  = escapeHtml(name);
  const safeMsg   = escapeHtml(message.length > 400 ? message.slice(0, 400) + '...' : message).replace(/\n/g, '<br>');
  const info      = SUBJECT_GUIDANCE[subjectKey] || SUBJECT_GUIDANCE['other'];

  const content = `
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center">${iconCircle(info.iconBg, info.icon)}</td></tr>
    </table>
    ${spacer(20)}
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center"><h1 class="email-title" style="color:#0F172A;font-size:22px;font-weight:bold;margin:0;font-family:Arial,sans-serif;">Chúng Tôi Đã Nhận Được Tin Nhắn!</h1></td></tr>
      <tr><td align="center" style="padding-top:6px;">
        <span style="display:inline-block;background:#EEF2FF;color:#4F46E5;font-size:12px;font-weight:bold;padding:4px 12px;border-radius:20px;font-family:Arial,sans-serif;">${escapeHtml(info.label)}</span>
      </td></tr>
    </table>
    ${spacer(24)}
    ${divider()}
    <p style="color:#334155;font-size:15px;line-height:1.7;margin:0 0 8px;font-family:Arial,sans-serif;">Xin chào <strong>${safeName}</strong>,</p>
    <p style="color:#475569;font-size:14px;line-height:1.7;margin:0 0 20px;font-family:Arial,sans-serif;">
      Cảm ơn bạn đã liên hệ với <strong>SGS Land</strong>. Chúng tôi đã nhận được yêu cầu của bạn và sẽ phản hồi sớm nhất có thể.
    </p>

    <!-- Subject-specific guidance -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F8FAFC" style="border:1px solid #E2E8F0;border-radius:8px;margin-bottom:0;">
      <tr><td style="padding:18px 20px;">
        <p style="color:#0F172A;font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:0.8px;margin:0 0 12px;font-family:Arial,sans-serif;">Điều gì sẽ xảy ra tiếp theo?</p>
        ${info.guidance}
      </td></tr>
    </table>
    ${spacer(16)}

    <!-- Submitted message echo -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td bgcolor="#F0F4FF" style="padding:14px 18px;border:1px solid #C7D2FE;border-radius:8px;border-left:4px solid #4F46E5;">
          <p style="color:#64748B;font-size:11px;font-weight:bold;letter-spacing:0.8px;text-transform:uppercase;margin:0 0 8px;font-family:Arial,sans-serif;">Nội dung bạn đã gửi</p>
          <p style="color:#334155;font-size:13px;line-height:1.7;margin:0;font-family:Arial,sans-serif;">${safeMsg}</p>
        </td>
      </tr>
    </table>
    ${spacer(28)}

    ${info.cta ? `
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center">${primaryButton(info.cta.url, info.cta.label)}</td></tr>
    </table>
    ${spacer(20)}
    ` : ''}

    <p style="color:#94A3B8;font-size:12px;line-height:1.6;margin:0;text-align:center;font-family:Arial,sans-serif;">
      Cần hỗ trợ ngay? Gọi hotline <strong style="color:#0F172A;">0971 132 378</strong> (24/7)<br />
      hoặc email <a href="mailto:info@sgsland.vn" style="color:#4F46E5;text-decoration:none;">info@sgsland.vn</a>
    </p>
  `;

  return sendEmail(DEFAULT_TENANT_ID, {
    to,
    subject: `SGS Land – Xác nhận nhận yêu cầu: ${info.label}`,
    html: emailBase(content, 'Email này được gửi tự động sau khi bạn điền form liên hệ tại sgsland.vn'),
    text: `Xin chào ${name},\n\nCảm ơn bạn đã liên hệ với SGS Land về: ${info.label}.\n\nChúng tôi đã nhận được yêu cầu và sẽ phản hồi sớm nhất.\n\nHotline: 0971 132 378 (24/7)\nEmail: info@sgsland.vn\nWebsite: https://sgsland.vn\n\n— SGS LAND`,
  });
}

// ── Email tự động theo hành vi người dùng ──────────────────────────────────────

/**
 * NUDGE_A — Gửi cho user đăng ký ≥ 3 ngày nhưng chưa đăng tin nào.
 * Khuyến khích đăng tin bất động sản đầu tiên.
 */
async function sendNudgeA(tenantId: string, to: string, userName: string): Promise<EmailResult> {
  const safeName = escapeHtml(userName || 'bạn');
  const listingUrl = 'https://sgsland.vn/#/dang-tin';

  const content = `
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center">${iconCircle('#EEF2FF', '&#127968;')}</td></tr>
    </table>
    ${spacer(20)}
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center">
        <h1 class="email-title" style="color:#0F172A;font-size:22px;font-weight:bold;margin:0;font-family:Arial,sans-serif;">
          Đăng Tin BĐS Đầu Tiên Của Bạn — Miễn Phí!
        </h1>
      </td></tr>
      <tr><td align="center" style="padding-top:8px;">
        <span style="color:#64748B;font-size:14px;font-family:Arial,sans-serif;">
          Xin chào <strong>${safeName}</strong>, bạn vẫn chưa đăng tin bất động sản nào trên SGS LAND.
        </span>
      </td></tr>
    </table>
    ${spacer(24)}
    ${divider()}
    <p style="color:#475569;font-size:14px;line-height:1.8;margin:0 0 16px;font-family:Arial,sans-serif;">
      Thị trường BĐS tại TP.HCM, Hà Nội và các tỉnh đang có hàng nghìn người mua đang tìm kiếm mỗi ngày.
      Đăng tin ngay hôm nay để tiếp cận đúng khách hàng tiềm năng:
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F8FAFC" style="border:1px solid #E2E8F0;border-radius:8px;margin-bottom:20px;">
      <tr><td style="padding:16px 20px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="28" valign="top" style="font-size:16px;padding-right:10px;font-family:Arial,sans-serif;">&#10003;</td>
            <td style="color:#374151;font-size:13px;line-height:1.7;font-family:Arial,sans-serif;padding-bottom:8px;">
              <strong>Miễn phí 100%</strong> — Không mất phí đăng tin
            </td>
          </tr>
          <tr>
            <td width="28" valign="top" style="font-size:16px;padding-right:10px;font-family:Arial,sans-serif;">&#10003;</td>
            <td style="color:#374151;font-size:13px;line-height:1.7;font-family:Arial,sans-serif;padding-bottom:8px;">
              <strong>Hỗ trợ AI</strong> — Mô tả tự động, gợi ý giá thị trường
            </td>
          </tr>
          <tr>
            <td width="28" valign="top" style="font-size:16px;padding-right:10px;font-family:Arial,sans-serif;">&#10003;</td>
            <td style="color:#374151;font-size:13px;line-height:1.7;font-family:Arial,sans-serif;">
              <strong>Tiếp cận ngay</strong> — Tin hiển thị trên SGS LAND ngay sau khi đăng
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
    ${spacer(8)}
    ${primaryButton(listingUrl, 'Đăng Tin Ngay — Miễn Phí')}
    ${spacer(20)}
    <p style="color:#94A3B8;font-size:12px;text-align:center;margin:0;font-family:Arial,sans-serif;">
      Chỉ mất 5 phút để hoàn thành tin đăng đầu tiên của bạn.
    </p>
  `;

  return sendEmail(tenantId, {
    to,
    subject: 'SGS LAND – Đăng tin BĐS đầu tiên của bạn — Hoàn toàn miễn phí',
    html: emailBase(content, 'Email này được gửi tự động vì bạn chưa đăng tin bất động sản nào trên SGS LAND.'),
    text: `Xin chào ${userName},\n\nBạn chưa đăng tin bất động sản nào trên SGS LAND. Hãy đăng tin đầu tiên hoàn toàn miễn phí tại:\n${listingUrl}\n\nChỉ mất 5 phút!\n\n— SGS LAND`,
  });
}

/**
 * NUDGE_B — Gửi cho user có đúng 1 listing, tạo ≥ 7 ngày, không còn hoạt động.
 * Nhắc nhở cập nhật tin và đăng thêm.
 */
async function sendNudgeB(tenantId: string, to: string, userName: string): Promise<EmailResult> {
  const safeName = escapeHtml(userName || 'bạn');
  const dashboardUrl = 'https://sgsland.vn/#/tin-dang';
  const listingUrl   = 'https://sgsland.vn/#/dang-tin';

  const content = `
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center">${iconCircle('#FFF7ED', '&#128204;')}</td></tr>
    </table>
    ${spacer(20)}
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center">
        <h1 class="email-title" style="color:#0F172A;font-size:22px;font-weight:bold;margin:0;font-family:Arial,sans-serif;">
          Tin BĐS Của Bạn Cần Được Cập Nhật?
        </h1>
      </td></tr>
      <tr><td align="center" style="padding-top:8px;">
        <span style="color:#64748B;font-size:14px;font-family:Arial,sans-serif;">
          Xin chào <strong>${safeName}</strong>, đã một thời gian kể từ khi bạn đăng tin đầu tiên trên SGS LAND.
        </span>
      </td></tr>
    </table>
    ${spacer(24)}
    ${divider()}
    <p style="color:#475569;font-size:14px;line-height:1.8;margin:0 0 16px;font-family:Arial,sans-serif;">
      Tin đăng đã cũ sẽ ít được hiển thị hơn. Để tăng lượt xem và thu hút khách mua/thuê:
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FFF7ED" style="border:1px solid #FED7AA;border-radius:8px;margin-bottom:20px;">
      <tr><td style="padding:16px 20px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="28" valign="top" style="font-size:16px;padding-right:10px;font-family:Arial,sans-serif;">&#9889;</td>
            <td style="color:#374151;font-size:13px;line-height:1.7;font-family:Arial,sans-serif;padding-bottom:8px;">
              <strong>Cập nhật giá</strong> — Điều chỉnh theo xu hướng thị trường hiện tại
            </td>
          </tr>
          <tr>
            <td width="28" valign="top" style="font-size:16px;padding-right:10px;font-family:Arial,sans-serif;">&#9889;</td>
            <td style="color:#374151;font-size:13px;line-height:1.7;font-family:Arial,sans-serif;padding-bottom:8px;">
              <strong>Thêm ảnh thực tế</strong> — Tin có nhiều ảnh được xem nhiều hơn 3 lần
            </td>
          </tr>
          <tr>
            <td width="28" valign="top" style="font-size:16px;padding-right:10px;font-family:Arial,sans-serif;">&#9889;</td>
            <td style="color:#374151;font-size:13px;line-height:1.7;font-family:Arial,sans-serif;">
              <strong>Đăng thêm tin mới</strong> — Nhiều tin = nhiều cơ hội thành giao dịch
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
    ${spacer(4)}
    ${primaryButton(dashboardUrl, 'Cập Nhật Tin Của Tôi')}
    ${spacer(12)}
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center">
        <a href="${listingUrl}" style="color:#4F46E5;font-size:13px;text-decoration:underline;font-family:Arial,sans-serif;">
          Hoặc đăng thêm tin mới miễn phí &rarr;
        </a>
      </td></tr>
    </table>
    ${spacer(20)}
  `;

  return sendEmail(tenantId, {
    to,
    subject: 'SGS LAND – Tin BĐS của bạn cần được cập nhật để tiếp cận nhiều khách hơn',
    html: emailBase(content, 'Email này được gửi tự động vì tin bất động sản của bạn đã lâu chưa cập nhật.'),
    text: `Xin chào ${userName},\n\nTin đăng của bạn đã lâu chưa cập nhật. Hãy cập nhật để tăng lượt xem:\n${dashboardUrl}\n\nHoặc đăng thêm tin mới:\n${listingUrl}\n\n— SGS LAND`,
  });
}

/**
 * NUDGE_C — Gửi cho user không đăng nhập ≥ 30 ngày.
 * Nhắc về thị trường sôi động, kêu gọi quay lại.
 */
async function sendNudgeC(tenantId: string, to: string, userName: string): Promise<EmailResult> {
  const safeName   = escapeHtml(userName || 'bạn');
  const loginUrl   = 'https://sgsland.vn/#/dang-nhap';
  const marketUrl  = 'https://sgsland.vn/#/tim-kiem';

  const content = `
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center">${iconCircle('#F0FDF4', '&#128200;')}</td></tr>
    </table>
    ${spacer(20)}
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center">
        <h1 class="email-title" style="color:#0F172A;font-size:22px;font-weight:bold;margin:0;font-family:Arial,sans-serif;">
          Thị Trường BĐS Đang Sôi Động — Đừng Bỏ Lỡ!
        </h1>
      </td></tr>
      <tr><td align="center" style="padding-top:8px;">
        <span style="color:#64748B;font-size:14px;font-family:Arial,sans-serif;">
          Xin chào <strong>${safeName}</strong>, đã lâu không thấy bạn trên SGS LAND.
        </span>
      </td></tr>
    </table>
    ${spacer(24)}
    ${divider()}
    <p style="color:#475569;font-size:14px;line-height:1.8;margin:0 0 16px;font-family:Arial,sans-serif;">
      Trong thời gian qua thị trường bất động sản Việt Nam có nhiều biến động đáng chú ý:
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F0FDF4" style="border:1px solid #BBF7D0;border-radius:8px;margin-bottom:20px;">
      <tr><td style="padding:16px 20px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="28" valign="top" style="font-size:16px;padding-right:10px;font-family:Arial,sans-serif;">&#128205;</td>
            <td style="color:#374151;font-size:13px;line-height:1.7;font-family:Arial,sans-serif;padding-bottom:8px;">
              <strong>TP.HCM</strong> — Phân khúc căn hộ trung cấp giao dịch tăng mạnh quý này
            </td>
          </tr>
          <tr>
            <td width="28" valign="top" style="font-size:16px;padding-right:10px;font-family:Arial,sans-serif;">&#128205;</td>
            <td style="color:#374151;font-size:13px;line-height:1.7;font-family:Arial,sans-serif;padding-bottom:8px;">
              <strong>Hà Nội</strong> — Đất nền ven đô thu hút nhà đầu tư dài hạn
            </td>
          </tr>
          <tr>
            <td width="28" valign="top" style="font-size:16px;padding-right:10px;font-family:Arial,sans-serif;">&#128205;</td>
            <td style="color:#374151;font-size:13px;line-height:1.7;font-family:Arial,sans-serif;">
              <strong>Lãi suất</strong> — Các ngân hàng đang có gói vay ưu đãi từ 6%/năm
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
    ${spacer(4)}
    ${primaryButton(loginUrl, 'Đăng Nhập Xem Thị Trường')}
    ${spacer(12)}
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center">
        <a href="${marketUrl}" style="color:#4F46E5;font-size:13px;text-decoration:underline;font-family:Arial,sans-serif;">
          Xem tin BĐS mới nhất không cần đăng nhập &rarr;
        </a>
      </td></tr>
    </table>
    ${spacer(20)}
  `;

  return sendEmail(tenantId, {
    to,
    subject: 'SGS LAND – Thị trường BĐS đang sôi động, cơ hội đang chờ bạn',
    html: emailBase(content, 'Email này được gửi vì bạn là thành viên SGS LAND chưa đăng nhập gần đây.'),
    text: `Xin chào ${userName},\n\nThị trường BĐS Việt Nam đang có nhiều cơ hội hấp dẫn. Hãy quay lại SGS LAND:\n${loginUrl}\n\nHoặc xem tin không cần đăng nhập:\n${marketUrl}\n\n— SGS LAND`,
  });
}

/**
 * NUDGE_D — Gửi cho user có ≥ 2 listings, đăng ký ≥ 30 ngày, đăng nhập gần đây.
 * Khuyến khích nâng cấp lên gói Premium để đẩy tin và mở rộng kinh doanh.
 */
async function sendNudgeD(tenantId: string, to: string, userName: string): Promise<EmailResult> {
  const safeName  = escapeHtml(userName || 'bạn');
  const upgradeUrl = 'https://sgsland.vn/#/nang-cap';

  const content = `
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center">${iconCircle('#FFF7ED', '&#11088;')}</td></tr>
    </table>
    ${spacer(20)}
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center">
        <h1 class="email-title" style="color:#0F172A;font-size:22px;font-weight:bold;margin:0;font-family:Arial,sans-serif;">
          Nâng Cấp Lên Premium — Bán Nhanh Hơn, Kiếm Nhiều Hơn
        </h1>
      </td></tr>
      <tr><td align="center" style="padding-top:8px;">
        <span style="color:#64748B;font-size:14px;font-family:Arial,sans-serif;">
          Xin chào <strong>${safeName}</strong>, bạn đang là một trong những môi giới tích cực trên SGS LAND.
        </span>
      </td></tr>
    </table>
    ${spacer(24)}
    ${divider()}
    <p style="color:#475569;font-size:14px;line-height:1.8;margin:0 0 16px;font-family:Arial,sans-serif;">
      Với gói <strong>Premium</strong>, bạn sẽ được hưởng những lợi thế vượt trội so với tài khoản miễn phí:
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FFF7ED" style="border:1px solid #FED7AA;border-radius:8px;margin-bottom:20px;">
      <tr><td style="padding:16px 20px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="28" valign="top" style="font-size:16px;padding-right:10px;font-family:Arial,sans-serif;">&#127381;</td>
            <td style="color:#374151;font-size:13px;line-height:1.7;font-family:Arial,sans-serif;padding-bottom:8px;">
              <strong>Đẩy tin ưu tiên</strong> — Tin của bạn hiển thị top đầu kết quả tìm kiếm
            </td>
          </tr>
          <tr>
            <td width="28" valign="top" style="font-size:16px;padding-right:10px;font-family:Arial,sans-serif;">&#128202;</td>
            <td style="color:#374151;font-size:13px;line-height:1.7;font-family:Arial,sans-serif;padding-bottom:8px;">
              <strong>Phân tích nâng cao</strong> — Báo cáo lượt xem, tỷ lệ chuyển đổi và đề xuất giá AI
            </td>
          </tr>
          <tr>
            <td width="28" valign="top" style="font-size:16px;padding-right:10px;font-family:Arial,sans-serif;">&#129302;</td>
            <td style="color:#374151;font-size:13px;line-height:1.7;font-family:Arial,sans-serif;padding-bottom:8px;">
              <strong>AI CRM không giới hạn</strong> — Tự động chăm sóc khách hàng 24/7
            </td>
          </tr>
          <tr>
            <td width="28" valign="top" style="font-size:16px;padding-right:10px;font-family:Arial,sans-serif;">&#127775;</td>
            <td style="color:#374151;font-size:13px;line-height:1.7;font-family:Arial,sans-serif;">
              <strong>Huy hiệu "Môi giới Pro"</strong> — Tăng độ tin cậy với khách mua
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
    ${spacer(8)}
    ${primaryButton(upgradeUrl, 'Nâng Cấp Premium Ngay')}
    ${spacer(16)}
    <p style="color:#94A3B8;font-size:12px;text-align:center;margin:0;font-family:Arial,sans-serif;">
      Dùng thử 14 ngày miễn phí — Hủy bất cứ lúc nào.
    </p>
  `;

  return sendEmail(tenantId, {
    to,
    subject: 'SGS LAND – Nâng cấp Premium để đẩy tin & bán BĐS nhanh hơn',
    html: emailBase(content, 'Email này được gửi tự động dành cho môi giới tích cực trên SGS LAND.'),
    text: `Xin chào ${userName},\n\nBạn đang là một trong những môi giới tích cực trên SGS LAND. Hãy nâng cấp lên Premium để tận hưởng tin ưu tiên, AI CRM và phân tích nâng cao:\n${upgradeUrl}\n\nDùng thử 14 ngày miễn phí!\n\n— SGS LAND`,
  });
}

/**
 * NUDGE_E — Gửi cho user đăng ký ≥ 14 ngày, đang hoạt động nhưng chưa khám phá AI.
 * Giới thiệu tính năng AI: định giá, mô tả, chatbot tư vấn.
 */
async function sendNudgeE(tenantId: string, to: string, userName: string): Promise<EmailResult> {
  const safeName = escapeHtml(userName || 'bạn');
  const aiUrl    = 'https://sgsland.vn/#/ai-dinh-gia';
  const listUrl  = 'https://sgsland.vn/#/dang-tin';

  const content = `
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center">${iconCircle('#EFF6FF', '&#129302;')}</td></tr>
    </table>
    ${spacer(20)}
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center">
        <h1 class="email-title" style="color:#0F172A;font-size:22px;font-weight:bold;margin:0;font-family:Arial,sans-serif;">
          Bạn Đã Thử AI Bất Động Sản Của SGS LAND Chưa?
        </h1>
      </td></tr>
      <tr><td align="center" style="padding-top:8px;">
        <span style="color:#64748B;font-size:14px;font-family:Arial,sans-serif;">
          Xin chào <strong>${safeName}</strong>, chúng tôi muốn giới thiệu công cụ AI giúp bạn làm việc nhanh gấp đôi.
        </span>
      </td></tr>
    </table>
    ${spacer(24)}
    ${divider()}
    <p style="color:#475569;font-size:14px;line-height:1.8;margin:0 0 16px;font-family:Arial,sans-serif;">
      Nền tảng SGS LAND tích hợp AI chuyên biệt cho bất động sản Việt Nam:
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#EFF6FF" style="border:1px solid #BFDBFE;border-radius:8px;margin-bottom:20px;">
      <tr><td style="padding:16px 20px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="28" valign="top" style="font-size:16px;padding-right:10px;font-family:Arial,sans-serif;">&#128176;</td>
            <td style="color:#374151;font-size:13px;line-height:1.7;font-family:Arial,sans-serif;padding-bottom:8px;">
              <strong>AI Định Giá</strong> — Nhập địa chỉ, nhận ước tính giá thị trường ngay lập tức
            </td>
          </tr>
          <tr>
            <td width="28" valign="top" style="font-size:16px;padding-right:10px;font-family:Arial,sans-serif;">&#128221;</td>
            <td style="color:#374151;font-size:13px;line-height:1.7;font-family:Arial,sans-serif;padding-bottom:8px;">
              <strong>AI Mô Tả Tin Đăng</strong> — Nhập thông tin cơ bản, AI viết mô tả hấp dẫn và chuẩn SEO
            </td>
          </tr>
          <tr>
            <td width="28" valign="top" style="font-size:16px;padding-right:10px;font-family:Arial,sans-serif;">&#128172;</td>
            <td style="color:#374151;font-size:13px;line-height:1.7;font-family:Arial,sans-serif;padding-bottom:8px;">
              <strong>AI Chatbot 24/7</strong> — Trả lời tự động câu hỏi của khách mua khi bạn bận
            </td>
          </tr>
          <tr>
            <td width="28" valign="top" style="font-size:16px;padding-right:10px;font-family:Arial,sans-serif;">&#128269;</td>
            <td style="color:#374151;font-size:13px;line-height:1.7;font-family:Arial,sans-serif;">
              <strong>AI Phân Tích Thị Trường</strong> — Xu hướng giá, khu vực tiềm năng, báo cáo tức thì
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
    ${spacer(8)}
    ${primaryButton(aiUrl, 'Khám Phá AI Định Giá — Miễn Phí')}
    ${spacer(12)}
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center">
        <a href="${listUrl}" style="color:#4F46E5;font-size:13px;text-decoration:underline;font-family:Arial,sans-serif;">
          Hoặc đăng tin với AI mô tả tự động &rarr;
        </a>
      </td></tr>
    </table>
    ${spacer(20)}
  `;

  return sendEmail(tenantId, {
    to,
    subject: 'SGS LAND – AI định giá, mô tả & chatbot BĐS dành riêng cho bạn',
    html: emailBase(content, 'Email này được gửi để giới thiệu tính năng AI mới trên SGS LAND.'),
    text: `Xin chào ${userName},\n\nSGS LAND tích hợp AI chuyên biệt cho BĐS Việt Nam: định giá, mô tả tin đăng, chatbot 24/7 và phân tích thị trường. Khám phá ngay:\n${aiUrl}\n\n— SGS LAND`,
  });
}

/**
 * LEAD_NURTURE — Gửi cho lead từ landing page, sau 3 ngày chưa phản hồi.
 * Nhắc nhở và cung cấp thêm thông tin dự án, kêu gọi liên hệ tư vấn.
 */
async function sendLeadNurture(
  tenantId: string,
  to: string,
  leadName: string,
  projectName: string,
): Promise<EmailResult> {
  const safeName    = escapeHtml(leadName || 'Quý khách');
  const safeProject = escapeHtml(projectName || 'dự án');
  const hotline     = '0971132378';
  const hotlineDisp = '0971 132 378';
  const contactUrl  = `https://sgsland.vn/#/lien-he`;

  const content = `
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center">${iconCircle('#F0FDF4', '&#127968;')}</td></tr>
    </table>
    ${spacer(20)}
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center">
        <h1 class="email-title" style="color:#0F172A;font-size:22px;font-weight:bold;margin:0;font-family:Arial,sans-serif;">
          SGS Land Vẫn Sẵn Sàng Tư Vấn Cho Bạn
        </h1>
      </td></tr>
      <tr><td align="center" style="padding-top:8px;">
        <span style="color:#64748B;font-size:14px;font-family:Arial,sans-serif;">
          Xin chào <strong>${safeName}</strong>, cảm ơn bạn đã quan tâm đến <strong>${safeProject}</strong>.
        </span>
      </td></tr>
    </table>
    ${spacer(24)}
    ${divider()}
    <p style="color:#475569;font-size:14px;line-height:1.8;margin:0 0 16px;font-family:Arial,sans-serif;">
      Chúng tôi biết bạn đang cân nhắc nhiều lựa chọn. Để giúp bạn ra quyết định tốt nhất, đội ngũ tư vấn SGS Land có thể cung cấp:
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F0FDF4" style="border:1px solid #BBF7D0;border-radius:8px;margin-bottom:20px;">
      <tr><td style="padding:16px 20px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="28" valign="top" style="font-size:16px;padding-right:10px;font-family:Arial,sans-serif;">&#128209;</td>
            <td style="color:#374151;font-size:13px;line-height:1.7;font-family:Arial,sans-serif;padding-bottom:8px;">
              <strong>Bảng giá mới nhất</strong> từ chủ đầu tư ${safeProject}
            </td>
          </tr>
          <tr>
            <td width="28" valign="top" style="font-size:16px;padding-right:10px;font-family:Arial,sans-serif;">&#127963;</td>
            <td style="color:#374151;font-size:13px;line-height:1.7;font-family:Arial,sans-serif;padding-bottom:8px;">
              <strong>Mặt bằng phân khu</strong> và quỹ căn còn lại ưu tiên
            </td>
          </tr>
          <tr>
            <td width="28" valign="top" style="font-size:16px;padding-right:10px;font-family:Arial,sans-serif;">&#127981;</td>
            <td style="color:#374151;font-size:13px;line-height:1.7;font-family:Arial,sans-serif;padding-bottom:8px;">
              <strong>Chính sách vay ngân hàng</strong> ưu đãi, lãi suất từ 6%/năm
            </td>
          </tr>
          <tr>
            <td width="28" valign="top" style="font-size:16px;padding-right:10px;font-family:Arial,sans-serif;">&#128204;</td>
            <td style="color:#374151;font-size:13px;line-height:1.7;font-family:Arial,sans-serif;">
              <strong>Cập nhật tiến độ pháp lý</strong> và lịch mở bán chính thức
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
    ${spacer(8)}
    ${primaryButton(contactUrl, 'Đặt Lịch Tư Vấn Miễn Phí')}
    ${spacer(12)}
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center">
        <a href="tel:${hotline}" style="color:#4F46E5;font-size:14px;font-weight:bold;text-decoration:none;font-family:Arial,sans-serif;">
          &#128222; Gọi ngay: ${hotlineDisp} (24/7)
        </a>
      </td></tr>
    </table>
    ${spacer(20)}
    <p style="color:#94A3B8;font-size:12px;text-align:center;margin:0;font-family:Arial,sans-serif;">
      Tư vấn hoàn toàn miễn phí — Không ràng buộc.
    </p>
  `;

  return sendEmail(tenantId, {
    to,
    subject: `SGS Land – Thông tin ${safeProject} bạn đang quan tâm`,
    html: emailBase(content, 'Email này được gửi vì bạn đã đăng ký nhận thông tin dự án tại sgsland.vn.'),
    text: `Xin chào ${leadName},\n\nCảm ơn bạn đã quan tâm đến ${projectName}. Đội ngũ SGS Land sẵn sàng cung cấp bảng giá, mặt bằng và chính sách vay ưu đãi.\n\nĐặt lịch tư vấn: ${contactUrl}\nHoặc gọi: ${hotlineDisp} (24/7)\n\n— SGS LAND`,
  });
}

// ── Billing emails ────────────────────────────────────────────────────────────

type BillingLocale = 'vi' | 'en';

interface BillingReceiptArgs {
  planName: string;
  amount: number;
  currency: string;
  sessionId: string;
  paidAt: string | Date;
  billingUrl: string;
  locale?: BillingLocale;
}

const BILLING_I18N = {
  vi: {
    receipt: {
      subject: (plan: string) => `SGS LAND – Biên lai thanh toán gói ${plan}`,
      title: 'Thanh Toán Thành Công',
      lead: 'Cảm ơn bạn đã nâng cấp gói SGS LAND',
      body: 'Chúng tôi đã ghi nhận thanh toán của bạn. Dưới đây là thông tin biên lai để bạn lưu trữ.',
      labelPlan: 'Gói dịch vụ',
      labelAmount: 'Số tiền',
      labelDate: 'Ngày thanh toán',
      labelSession: 'Mã giao dịch',
      cta: 'Xem Lịch Sử Thanh Toán',
      footer: 'Cần xuất hóa đơn VAT hay có thắc mắc? Liên hệ',
      autoFooter: 'Email này được gửi tự động, vui lòng không trả lời.',
      textIntro: 'Cảm ơn bạn đã thanh toán cho SGS LAND.',
    },
    admin: {
      subject: (payer: string) => `SGS LAND – Có giao dịch mới từ ${payer}`,
      title: 'Có Giao Dịch Mới',
      lead: 'Workspace của bạn vừa nhận một thanh toán',
      body: (payerName: string, payerEmailLink: string, plan: string) =>
        `<strong>${payerName}</strong> (${payerEmailLink}) vừa thanh toán gói <strong>${plan}</strong> cho workspace của bạn.`,
      labelPayer: 'Người thanh toán',
      labelPlan: 'Gói dịch vụ',
      labelAmount: 'Số tiền',
      labelDate: 'Thời gian',
      labelSession: 'Mã giao dịch',
      cta: 'Vào Trang Billing',
      footerNote: 'Bạn nhận email này vì là quản trị viên của workspace.',
      textIntro: 'Có giao dịch mới trên workspace SGS LAND.',
      textPayer: 'Người thanh toán',
      textPlan: 'Gói',
      textAmount: 'Số tiền',
      textDate: 'Thời gian',
      textSession: 'Mã giao dịch',
      textCta: 'Vào trang Billing',
    },
  },
  en: {
    receipt: {
      subject: (plan: string) => `SGS LAND – Payment receipt for ${plan} plan`,
      title: 'Payment Successful',
      lead: 'Thank you for upgrading your SGS LAND plan',
      body: 'We have recorded your payment. Below are the receipt details for your records.',
      labelPlan: 'Plan',
      labelAmount: 'Amount',
      labelDate: 'Payment date',
      labelSession: 'Transaction ID',
      cta: 'View Billing History',
      footer: 'Need a VAT invoice or have questions? Contact',
      autoFooter: 'This email was sent automatically — please do not reply.',
      textIntro: 'Thank you for your payment to SGS LAND.',
    },
    admin: {
      subject: (payer: string) => `SGS LAND – New payment from ${payer}`,
      title: 'New Payment Received',
      lead: 'Your workspace just received a payment',
      body: (payerName: string, payerEmailLink: string, plan: string) =>
        `<strong>${payerName}</strong> (${payerEmailLink}) has just paid for the <strong>${plan}</strong> plan on your workspace.`,
      labelPayer: 'Paid by',
      labelPlan: 'Plan',
      labelAmount: 'Amount',
      labelDate: 'Time',
      labelSession: 'Transaction ID',
      cta: 'Open Billing Page',
      footerNote: 'You received this email because you are an admin of the workspace.',
      textIntro: 'A new payment was made on your SGS LAND workspace.',
      textPayer: 'Paid by',
      textPlan: 'Plan',
      textAmount: 'Amount',
      textDate: 'Time',
      textSession: 'Transaction ID',
      textCta: 'Open Billing',
    },
  },
} as const;

function pickBillingLocale(locale?: BillingLocale): BillingLocale {
  return locale === 'en' ? 'en' : 'vi';
}

function formatMoney(amount: number, currency: string): string {
  const safeCurrency = (currency || 'USD').toUpperCase();
  if (safeCurrency === 'USD') return `$${amount.toFixed(2)}`;
  if (safeCurrency === 'VND') {
    return `${Math.round(amount).toLocaleString('vi-VN')} ₫`;
  }
  return `${amount.toFixed(2)} ${safeCurrency}`;
}

function formatPaidAt(value: string | Date): string {
  try {
    const d = typeof value === 'string' ? new Date(value) : value;
    if (!isNaN(d.getTime())) {
      return d.toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' });
    }
  } catch {}
  return String(value);
}

async function sendBillingReceiptEmail(
  tenantId: string,
  to: string,
  args: BillingReceiptArgs,
): Promise<EmailResult> {
  const t = BILLING_I18N[pickBillingLocale(args.locale)].receipt;
  const safePlan = escapeHtml(args.planName);
  const safeAmount = escapeHtml(formatMoney(args.amount, args.currency));
  const safeDate = escapeHtml(formatPaidAt(args.paidAt));
  const safeSession = escapeHtml(args.sessionId);
  const safeUrl = escapeHtml(args.billingUrl);

  const detailRow = (label: string, value: string) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #E2E8F0;color:#64748B;font-size:13px;font-family:Arial,sans-serif;">${label}</td>
      <td align="right" style="padding:10px 0;border-bottom:1px solid #E2E8F0;color:#0F172A;font-size:13px;font-weight:bold;font-family:Arial,sans-serif;">${value}</td>
    </tr>`;

  const content = `
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center">${iconCircle('#ECFDF5', '&#10004;')}</td></tr>
    </table>
    ${spacer(20)}
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center"><h1 class="email-title" style="color:#0F172A;font-size:22px;font-weight:bold;margin:0;font-family:Arial,sans-serif;">${t.title}</h1></td></tr>
      <tr><td align="center" style="padding-top:6px;"><span style="color:#64748B;font-size:13px;font-family:Arial,sans-serif;">${t.lead}</span></td></tr>
    </table>
    ${spacer(24)}
    ${divider()}
    <p style="color:#475569;font-size:14px;line-height:1.7;margin:0 0 20px;font-family:Arial,sans-serif;">
      ${t.body}
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F8FAFC" style="border:1px solid #E2E8F0;border-radius:8px;">
      <tr><td style="padding:8px 20px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          ${detailRow(t.labelPlan, safePlan)}
          ${detailRow(t.labelAmount, safeAmount)}
          ${detailRow(t.labelDate, safeDate)}
          ${detailRow(t.labelSession, safeSession)}
        </table>
      </td></tr>
    </table>
    ${spacer(28)}
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center">${primaryButton(safeUrl, t.cta)}</td></tr>
    </table>
    ${spacer(20)}
    <p style="color:#94A3B8;font-size:12px;line-height:1.6;margin:0;text-align:center;font-family:Arial,sans-serif;">
      ${t.footer} <a href="mailto:billing@sgsland.vn" style="color:#4F46E5;text-decoration:none;">billing@sgsland.vn</a>.
    </p>
  `;

  return sendEmail(tenantId, {
    to,
    subject: t.subject(args.planName),
    html: emailBase(content, t.autoFooter),
    text: `${t.textIntro}\n\n${t.labelPlan}: ${args.planName}\n${t.labelAmount}: ${formatMoney(args.amount, args.currency)}\n${t.labelDate}: ${formatPaidAt(args.paidAt)}\n${t.labelSession}: ${args.sessionId}\n\n${t.cta}: ${args.billingUrl}\n\n— SGS LAND`,
    template: 'billing_receipt',
    skipQuota: true,
    dedupeKey: `billing_receipt:${args.sessionId}`,
  });
}

interface BillingAdminAlertArgs {
  payerEmail: string;
  payerName?: string | null;
  planName: string;
  amount: number;
  currency: string;
  sessionId: string;
  paidAt: string | Date;
  billingUrl: string;
  locale?: BillingLocale;
}

async function sendBillingAdminAlertEmail(
  tenantId: string,
  to: string,
  args: BillingAdminAlertArgs,
): Promise<EmailResult> {
  const t = BILLING_I18N[pickBillingLocale(args.locale)].admin;
  const safePayer = escapeHtml(args.payerEmail);
  const safePayerName = escapeHtml(args.payerName || args.payerEmail);
  const safePlan = escapeHtml(args.planName);
  const safeAmount = escapeHtml(formatMoney(args.amount, args.currency));
  const safeDate = escapeHtml(formatPaidAt(args.paidAt));
  const safeSession = escapeHtml(args.sessionId);
  const safeUrl = escapeHtml(args.billingUrl);
  const payerEmailLink = `<a href="mailto:${safePayer}" style="color:#4F46E5;text-decoration:none;">${safePayer}</a>`;

  const detailRow = (label: string, value: string) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #E2E8F0;color:#64748B;font-size:13px;font-family:Arial,sans-serif;">${label}</td>
      <td align="right" style="padding:10px 0;border-bottom:1px solid #E2E8F0;color:#0F172A;font-size:13px;font-weight:bold;font-family:Arial,sans-serif;">${value}</td>
    </tr>`;

  const content = `
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center">${iconCircle('#EEF2FF', '&#128176;')}</td></tr>
    </table>
    ${spacer(20)}
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center"><h1 class="email-title" style="color:#0F172A;font-size:22px;font-weight:bold;margin:0;font-family:Arial,sans-serif;">${t.title}</h1></td></tr>
      <tr><td align="center" style="padding-top:6px;"><span style="color:#64748B;font-size:13px;font-family:Arial,sans-serif;">${t.lead}</span></td></tr>
    </table>
    ${spacer(24)}
    ${divider()}
    <p style="color:#475569;font-size:14px;line-height:1.7;margin:0 0 20px;font-family:Arial,sans-serif;">
      ${t.body(safePayerName, payerEmailLink, safePlan)}
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F8FAFC" style="border:1px solid #E2E8F0;border-radius:8px;">
      <tr><td style="padding:8px 20px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          ${detailRow(t.labelPayer, safePayer)}
          ${detailRow(t.labelPlan, safePlan)}
          ${detailRow(t.labelAmount, safeAmount)}
          ${detailRow(t.labelDate, safeDate)}
          ${detailRow(t.labelSession, safeSession)}
        </table>
      </td></tr>
    </table>
    ${spacer(28)}
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center">${primaryButton(safeUrl, t.cta)}</td></tr>
    </table>
    ${spacer(24)}
    ${linkBox(safeUrl)}
  `;

  return sendEmail(tenantId, {
    to,
    subject: t.subject(args.payerEmail),
    html: emailBase(content, t.footerNote),
    text: `${t.textIntro}\n\n${t.textPayer}: ${args.payerName ? `${args.payerName} <${args.payerEmail}>` : args.payerEmail}\n${t.textPlan}: ${args.planName}\n${t.textAmount}: ${formatMoney(args.amount, args.currency)}\n${t.textDate}: ${formatPaidAt(args.paidAt)}\n${t.textSession}: ${args.sessionId}\n\n${t.textCta}: ${args.billingUrl}\n\n— SGS LAND`,
    template: 'billing_admin_alert',
    skipQuota: true,
    dedupeKey: `billing_admin_alert:${args.sessionId}:${to.toLowerCase()}`,
  });
}

async function sendVendorApprovedEmail(
  tenantId: string,
  to: string,
  userName: string,
  companyName: string,
  loginUrl: string
): Promise<EmailResult> {
  const safeName    = escapeHtml(userName);
  const safeCompany = escapeHtml(companyName);
  const safeUrl     = escapeHtml(loginUrl);

  const content = `
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center">${iconCircle('#ECFDF5', '&#10003;')}</td></tr>
    </table>
    ${spacer(20)}
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center"><h1 class="email-title" style="color:#0F172A;font-size:22px;font-weight:bold;margin:0;font-family:Arial,sans-serif;">Tài Khoản Đã Được Phê Duyệt!</h1></td></tr>
      <tr><td align="center" style="padding-top:6px;"><span style="color:#64748B;font-size:13px;font-family:Arial,sans-serif;">Workspace của bạn đã sẵn sàng</span></td></tr>
    </table>
    ${spacer(24)}
    ${divider()}
    <p style="color:#334155;font-size:15px;line-height:1.7;margin:0 0 8px;font-family:Arial,sans-serif;">Xin chào <strong>${safeName}</strong>,</p>
    <p style="color:#475569;font-size:14px;line-height:1.7;margin:0 0 20px;font-family:Arial,sans-serif;">
      Chúc mừng! Tài khoản workspace <strong>${safeCompany}</strong> của bạn trên <strong>SGS LAND</strong> đã được phê duyệt thành công.
      Bạn có thể đăng nhập và bắt đầu sử dụng toàn bộ tính năng ngay bây giờ.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F0FDF4" style="border:1px solid #BBF7D0;border-radius:8px;">
      <tr><td style="padding:16px 20px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="padding:4px 0;color:#166534;font-size:13px;font-family:Arial,sans-serif;"><span style="font-weight:bold;">&#10004;</span>&nbsp;&nbsp;Quản lý bất động sản và danh sách cho thuê/bán</td></tr>
          <tr><td style="padding:4px 0;color:#166534;font-size:13px;font-family:Arial,sans-serif;"><span style="font-weight:bold;">&#10004;</span>&nbsp;&nbsp;Hệ thống CRM theo dõi khách hàng tiềm năng</td></tr>
          <tr><td style="padding:4px 0;color:#166534;font-size:13px;font-family:Arial,sans-serif;"><span style="font-weight:bold;">&#10004;</span>&nbsp;&nbsp;AI hỗ trợ định giá và tư vấn tự động</td></tr>
          <tr><td style="padding:4px 0;color:#166534;font-size:13px;font-family:Arial,sans-serif;"><span style="font-weight:bold;">&#10004;</span>&nbsp;&nbsp;Báo cáo doanh thu và phân tích thị trường</td></tr>
        </table>
      </td></tr>
    </table>
    ${spacer(28)}
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center">${primaryButton(safeUrl, 'Đăng Nhập Ngay')}</td></tr>
    </table>
    ${spacer(16)}
    ${linkBox(safeUrl)}
  `;

  return sendEmail(tenantId, {
    to,
    subject: 'SGS LAND – Tài khoản của bạn đã được phê duyệt',
    html: emailBase(content, 'Cần hỗ trợ? Liên hệ support@sgsland.vn'),
    text: `Chào ${userName},\n\nTài khoản workspace ${companyName} đã được phê duyệt. Đăng nhập tại: ${loginUrl}\n\n— SGS LAND`,
    template: 'vendor_approved',
    skipQuota: true,
  });
}

async function sendVendorRejectedEmail(
  tenantId: string,
  to: string,
  userName: string,
  companyName: string,
  reason: string
): Promise<EmailResult> {
  const safeName    = escapeHtml(userName);
  const safeCompany = escapeHtml(companyName);
  const safeReason  = escapeHtml(reason);

  const content = `
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center">${iconCircle('#FFF1F2', '&#10007;')}</td></tr>
    </table>
    ${spacer(20)}
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center"><h1 class="email-title" style="color:#0F172A;font-size:22px;font-weight:bold;margin:0;font-family:Arial,sans-serif;">Đăng Ký Chưa Được Chấp Thuận</h1></td></tr>
      <tr><td align="center" style="padding-top:6px;"><span style="color:#64748B;font-size:13px;font-family:Arial,sans-serif;">Liên hệ với chúng tôi để được hỗ trợ</span></td></tr>
    </table>
    ${spacer(24)}
    ${divider()}
    <p style="color:#334155;font-size:15px;line-height:1.7;margin:0 0 8px;font-family:Arial,sans-serif;">Xin chào <strong>${safeName}</strong>,</p>
    <p style="color:#475569;font-size:14px;line-height:1.7;margin:0 0 20px;font-family:Arial,sans-serif;">
      Rất tiếc, đăng ký workspace <strong>${safeCompany}</strong> của bạn chưa được chấp thuận vào thời điểm này.
    </p>
    ${warningBox('Lý do từ chối:', safeReason)}
    ${spacer(20)}
    <p style="color:#475569;font-size:14px;line-height:1.7;margin:0;font-family:Arial,sans-serif;">
      Nếu bạn muốn khiếu nại hoặc cần thêm thông tin, vui lòng liên hệ với chúng tôi qua email 
      <a href="mailto:support@sgsland.vn" style="color:#4F46E5;">support@sgsland.vn</a>.
    </p>
  `;

  return sendEmail(tenantId, {
    to,
    subject: 'SGS LAND – Đăng ký workspace chưa được chấp thuận',
    html: emailBase(content, 'Câu hỏi? Liên hệ support@sgsland.vn'),
    text: `Chào ${userName},\n\nĐăng ký workspace ${companyName} chưa được chấp thuận.\n\nLý do: ${reason}\n\nLiên hệ: support@sgsland.vn\n\n— SGS LAND`,
    template: 'vendor_rejected',
    skipQuota: true,
  });
}

// ── Exports ───────────────────────────────────────────────────────────────────

export const emailService = {
  sendEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendWelcomeEmail,
  sendInviteEmail,
  sendSequenceEmail,
  sendContactNotification,
  sendContactAutoReply,
  sendNudgeA,
  sendNudgeB,
  sendNudgeC,
  sendNudgeD,
  sendNudgeE,
  sendLeadNurture,
  sendBillingReceiptEmail,
  sendBillingAdminAlertEmail,
  sendVendorApprovedEmail,
  sendVendorRejectedEmail,
  testSmtpConnection,
  getSmtpConfig,
};
