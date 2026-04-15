import nodemailer from 'nodemailer';
import { enterpriseConfigRepository } from '../repositories/enterpriseConfigRepository';
import { DEFAULT_TENANT_ID } from '../constants';
import { isBrevoConfigured, brevoSendEmail } from './brevoService';
import { logger } from '../middleware/logger';

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
}

interface EmailResult {
  success: boolean;
  status: 'sent' | 'queued_no_smtp' | 'failed';
  messageId?: string;
  error?: string;
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

async function sendEmail(tenantId: string, options: EmailOptions): Promise<EmailResult> {
  if (isBrevoConfigured()) {
    const result = await brevoSendEmail({
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
    if (result.success) {
      return { success: true, status: 'sent', messageId: result.messageId };
    }
    console.warn(`[EmailService] Brevo failed (${result.error}), attempting SMTP fallback.`);
  }

  const smtp = await getSmtpConfig(tenantId);

  if (!smtp.enabled || !smtp.host || !smtp.user) {
    logger.warn(`[EmailService] No email provider configured for tenant ${tenantId}. Email queued (not sent). To: ${options.to}, Subject: ${options.subject}`);
    return { success: true, status: 'queued_no_smtp', messageId: `queued-${Date.now()}` };
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
    return { success: true, status: 'sent', messageId: info.messageId };
  } catch (error: any) {
    console.error(`[EmailService] SMTP send failed:`, error.message);
    return { success: false, status: 'failed', error: error.message };
  }
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
  testSmtpConnection,
  getSmtpConfig,
};
