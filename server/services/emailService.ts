import nodemailer from 'nodemailer';
import { enterpriseConfigRepository } from '../repositories/enterpriseConfigRepository';
import { DEFAULT_TENANT_ID } from '../constants';
import { isBrevoConfigured, brevoSendEmail } from './brevoService';

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

function emailBase(content: string, footerNote?: string): string {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>SGS LAND</title>
</head>
<body style="margin:0;padding:0;background-color:#F1F5F9;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F1F5F9;min-height:100vh;">
    <tr>
      <td align="center" style="padding:40px 16px;">

        <!-- Wrapper -->
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td>
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:linear-gradient(135deg,#1E293B 0%,#334155 100%);border-radius:16px 16px 0 0;padding:28px 40px;text-align:center;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center">
                          <table cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td style="background:#4F46E5;border-radius:10px;padding:8px 14px;display:inline-block;">
                                <span style="color:#FFFFFF;font-size:15px;font-weight:700;letter-spacing:2px;font-family:Arial,sans-serif;">SGS</span>
                                <span style="color:#A5B4FC;font-size:15px;font-weight:700;letter-spacing:2px;font-family:Arial,sans-serif;"> LAND</span>
                              </td>
                            </tr>
                          </table>
                          <br>
                          <span style="color:#94A3B8;font-size:12px;letter-spacing:1px;text-transform:uppercase;font-family:Arial,sans-serif;">Enterprise Real Estate Platform</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body card -->
          <tr>
            <td style="background:#FFFFFF;border-left:1px solid #E2E8F0;border-right:1px solid #E2E8F0;padding:40px 40px 32px;">
              ${content}
            </td>
          </tr>

          <!-- Footer bar -->
          <tr>
            <td style="background:#F8FAFC;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 16px 16px;padding:20px 40px;">
              ${footerNote ? `<p style="color:#64748B;font-size:12px;line-height:1.6;margin:0 0 12px;text-align:center;">${footerNote}</p>` : ''}
              <p style="color:#94A3B8;font-size:11px;margin:0;text-align:center;line-height:1.8;">
                &copy; ${year} SGS LAND &mdash; Enterprise Real Estate Platform<br>
                <a href="https://sgsland.vn" style="color:#4F46E5;text-decoration:none;">sgsland.vn</a>
                &nbsp;&bull;&nbsp;
                <a href="mailto:support@sgsland.vn" style="color:#4F46E5;text-decoration:none;">support@sgsland.vn</a>
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
  return `<table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
    <tr>
      <td align="center" style="border-radius:10px;background:#4F46E5;">
        <a href="${href}"
           style="display:inline-block;padding:14px 36px;color:#FFFFFF;font-size:15px;font-weight:700;text-decoration:none;font-family:Arial,sans-serif;letter-spacing:0.3px;border-radius:10px;background:#4F46E5;">
          ${label}
        </a>
      </td>
    </tr>
  </table>`;
}

function divider(): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
    <tr><td style="border-top:1px solid #E2E8F0;height:1px;"></td></tr>
  </table>`;
}

function infoBox(label: string, value: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;margin:20px 0;">
    <tr>
      <td style="padding:14px 18px;">
        <p style="color:#64748B;font-size:11px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;margin:0 0 4px;font-family:Arial,sans-serif;">${label}</p>
        <p style="color:#4F46E5;font-size:12px;word-break:break-all;margin:0;font-family:'Courier New',monospace;">${value}</p>
      </td>
    </tr>
  </table>`;
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
    auth: {
      user: smtp.user,
      pass: smtp.password,
    },
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
    console.log(`[EmailService] No email provider configured for tenant ${tenantId}. Email queued (not sent).`);
    console.log(`  To: ${options.to}`);
    console.log(`  Subject: ${options.subject}`);
    return { success: true, status: 'queued_no_smtp', messageId: `console-${Date.now()}` };
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
    console.log(`[EmailService] Email sent via SMTP: ${info.messageId}`);
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
    <!-- Icon -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
      <tr>
        <td align="center">
          <table cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="background:#EEF2FF;border-radius:50%;width:64px;height:64px;text-align:center;vertical-align:middle;">
                <span style="font-size:30px;line-height:64px;">&#9993;</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Title -->
    <h1 style="color:#0F172A;font-size:22px;font-weight:700;margin:0 0 8px;text-align:center;font-family:Arial,sans-serif;">Xác Minh Địa Chỉ Email</h1>
    <p style="color:#64748B;font-size:13px;text-align:center;margin:0 0 28px;font-family:Arial,sans-serif;">Một bước nữa để hoàn tất đăng ký</p>

    ${divider()}

    <!-- Body -->
    <p style="color:#334155;font-size:15px;line-height:1.7;margin:0 0 8px;font-family:Arial,sans-serif;">
      Xin chào <strong>${safeName}</strong>,
    </p>
    <p style="color:#475569;font-size:14px;line-height:1.7;margin:0 0 28px;font-family:Arial,sans-serif;">
      Cảm ơn bạn đã đăng ký tài khoản trên <strong>SGS LAND</strong>. Để kích hoạt tài khoản và bắt đầu sử dụng, vui lòng xác minh địa chỉ email của bạn bằng cách nhấn nút bên dưới.
    </p>

    <!-- CTA -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
      <tr><td align="center">${primaryButton(safeUrl, '&#10003;&nbsp; Xác Minh Email Ngay')}</td></tr>
    </table>

    <!-- Link fallback -->
    ${infoBox('Hoặc dán link này vào trình duyệt', safeUrl)}

    <!-- Warning -->
    <p style="color:#94A3B8;font-size:12px;line-height:1.6;margin:0;text-align:center;font-family:Arial,sans-serif;">
      Link xác minh có hiệu lực trong <strong>24 giờ</strong>.<br>
      Nếu bạn không thực hiện đăng ký này, vui lòng bỏ qua email.
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
    <!-- Icon -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
      <tr>
        <td align="center">
          <table cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="background:#FEF3C7;border-radius:50%;width:64px;height:64px;text-align:center;vertical-align:middle;">
                <span style="font-size:30px;line-height:64px;">&#128274;</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Title -->
    <h1 style="color:#0F172A;font-size:22px;font-weight:700;margin:0 0 8px;text-align:center;font-family:Arial,sans-serif;">Đặt Lại Mật Khẩu</h1>
    <p style="color:#64748B;font-size:13px;text-align:center;margin:0 0 28px;font-family:Arial,sans-serif;">Yêu cầu khôi phục mật khẩu tài khoản</p>

    ${divider()}

    <!-- Body -->
    <p style="color:#334155;font-size:15px;line-height:1.7;margin:0 0 8px;font-family:Arial,sans-serif;">
      Xin chào <strong>${name}</strong>,
    </p>
    <p style="color:#475569;font-size:14px;line-height:1.7;margin:0 0 28px;font-family:Arial,sans-serif;">
      Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản SGS LAND của bạn. Nhấn nút bên dưới để tạo mật khẩu mới.
    </p>

    <!-- CTA -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
      <tr><td align="center">${primaryButton(safeUrl, '&#128274;&nbsp; Đặt Lại Mật Khẩu')}</td></tr>
    </table>

    <!-- Link fallback -->
    ${infoBox('Hoặc dán link này vào trình duyệt', safeUrl)}

    ${divider()}

    <!-- Security notice -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:10px;">
      <tr>
        <td style="padding:14px 18px;">
          <p style="color:#92400E;font-size:12px;font-weight:700;margin:0 0 4px;font-family:Arial,sans-serif;">&#9888; Lưu ý bảo mật</p>
          <p style="color:#78350F;font-size:12px;line-height:1.6;margin:0;font-family:Arial,sans-serif;">
            Link này có hiệu lực trong <strong>1 giờ</strong>. Nếu bạn không yêu cầu đặt lại mật khẩu, tài khoản của bạn vẫn an toàn — hãy bỏ qua email này.
          </p>
        </td>
      </tr>
    </table>
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

  const content = `
    <!-- Icon -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
      <tr>
        <td align="center">
          <table cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="background:#ECFDF5;border-radius:50%;width:64px;height:64px;text-align:center;vertical-align:middle;">
                <span style="font-size:30px;line-height:64px;">&#127881;</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Title -->
    <h1 style="color:#0F172A;font-size:22px;font-weight:700;margin:0 0 8px;text-align:center;font-family:Arial,sans-serif;">Chào Mừng Đến Với SGS LAND!</h1>
    <p style="color:#64748B;font-size:13px;text-align:center;margin:0 0 28px;font-family:Arial,sans-serif;">Tài khoản của bạn đã sẵn sàng</p>

    ${divider()}

    <p style="color:#334155;font-size:15px;line-height:1.7;margin:0 0 8px;font-family:Arial,sans-serif;">
      Xin chào <strong>${safeName}</strong>,
    </p>
    <p style="color:#475569;font-size:14px;line-height:1.7;margin:0 0 24px;font-family:Arial,sans-serif;">
      Tài khoản SGS LAND của bạn đã được kích hoạt thành công. Bây giờ bạn có thể sử dụng đầy đủ tính năng của nền tảng quản lý bất động sản chuyên nghiệp.
    </p>

    <!-- Feature list -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
      <tr>
        <td style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:20px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding:6px 0;">
                <span style="color:#4F46E5;font-size:14px;font-family:Arial,sans-serif;">&#10004;&nbsp;</span>
                <span style="color:#334155;font-size:13px;font-family:Arial,sans-serif;">Quản lý danh sách bất động sản</span>
              </td>
            </tr>
            <tr>
              <td style="padding:6px 0;">
                <span style="color:#4F46E5;font-size:14px;font-family:Arial,sans-serif;">&#10004;&nbsp;</span>
                <span style="color:#334155;font-size:13px;font-family:Arial,sans-serif;">Theo dõi và chăm sóc khách hàng tiềm năng (Leads)</span>
              </td>
            </tr>
            <tr>
              <td style="padding:6px 0;">
                <span style="color:#4F46E5;font-size:14px;font-family:Arial,sans-serif;">&#10004;&nbsp;</span>
                <span style="color:#334155;font-size:13px;font-family:Arial,sans-serif;">Quản lý hợp đồng và báo cáo doanh thu</span>
              </td>
            </tr>
            <tr>
              <td style="padding:6px 0;">
                <span style="color:#4F46E5;font-size:14px;font-family:Arial,sans-serif;">&#10004;&nbsp;</span>
                <span style="color:#334155;font-size:13px;font-family:Arial,sans-serif;">AI hỗ trợ định giá và tư vấn khách hàng</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- CTA -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
      <tr><td align="center">${primaryButton('https://sgsland.vn', '&#9654;&nbsp; Bắt Đầu Ngay')}</td></tr>
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
  const safeRole = escapeHtml(role);
  const safeUrl  = escapeHtml(loginUrl);

  const roleLabels: Record<string, string> = {
    admin: 'Quản trị viên',
    manager: 'Quản lý',
    agent: 'Môi giới',
    staff: 'Nhân viên',
  };
  const roleDisplay = roleLabels[safeRole.toLowerCase()] || safeRole;

  const content = `
    <!-- Icon -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
      <tr>
        <td align="center">
          <table cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="background:#EEF2FF;border-radius:50%;width:64px;height:64px;text-align:center;vertical-align:middle;">
                <span style="font-size:30px;line-height:64px;">&#128100;</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Title -->
    <h1 style="color:#0F172A;font-size:22px;font-weight:700;margin:0 0 8px;text-align:center;font-family:Arial,sans-serif;">Bạn Được Mời Tham Gia SGS LAND</h1>
    <p style="color:#64748B;font-size:13px;text-align:center;margin:0 0 28px;font-family:Arial,sans-serif;">Lời mời tham gia nền tảng</p>

    ${divider()}

    <p style="color:#334155;font-size:15px;line-height:1.7;margin:0 0 8px;font-family:Arial,sans-serif;">
      Xin chào <strong>${safeUser}</strong>,
    </p>
    <p style="color:#475569;font-size:14px;line-height:1.7;margin:0 0 20px;font-family:Arial,sans-serif;">
      Bạn đã được mời tham gia <strong>SGS LAND Enterprise Platform</strong>. Nhấn nút bên dưới để thiết lập mật khẩu và bắt đầu làm việc.
    </p>

    <!-- Role badge -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
      <tr>
        <td style="background:#EEF2FF;border:1px solid #C7D2FE;border-radius:10px;padding:14px 18px;text-align:center;">
          <p style="color:#64748B;font-size:11px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;margin:0 0 4px;font-family:Arial,sans-serif;">Vai trò được phân công</p>
          <p style="color:#4F46E5;font-size:16px;font-weight:700;margin:0;font-family:Arial,sans-serif;">${roleDisplay}</p>
        </td>
      </tr>
    </table>

    <!-- CTA -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
      <tr><td align="center">${primaryButton(safeUrl, '&#128273;&nbsp; Kích Hoạt Tài Khoản')}</td></tr>
    </table>

    <!-- Link fallback -->
    ${infoBox('Hoặc dán link này vào trình duyệt', safeUrl)}

    <!-- Note -->
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
    <h2 style="color:#0F172A;font-size:18px;font-weight:700;margin:0 0 20px;font-family:Arial,sans-serif;">${escapeHtml(subject)}</h2>
    ${divider()}
    <div style="color:#475569;font-size:14px;line-height:1.8;font-family:Arial,sans-serif;white-space:pre-wrap;">${content}</div>
  `;

  return sendEmail(tenantId, {
    to,
    subject,
    html: emailBase(body, 'Email này được gửi tự động qua SGS LAND Automation.'),
    text: plainText,
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
  testSmtpConnection,
  getSmtpConfig,
};
