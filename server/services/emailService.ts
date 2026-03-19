import nodemailer from 'nodemailer';
import { enterpriseConfigRepository } from '../repositories/enterpriseConfigRepository';
import { DEFAULT_TENANT_ID } from '../constants';

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
  messageId?: string;
  error?: string;
}

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

async function sendEmail(tenantId: string, options: EmailOptions): Promise<EmailResult> {
  const smtp = await getSmtpConfig(tenantId);

  if (!smtp.enabled || !smtp.host || !smtp.user) {
    console.log(`[EmailService] SMTP not configured for tenant ${tenantId}. Email queued but not sent.`);
    console.log(`  To: ${options.to}`);
    console.log(`  Subject: ${options.subject}`);
    return { success: true, messageId: `console-${Date.now()}` };
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

    console.log(`[EmailService] Email sent successfully: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error(`[EmailService] Failed to send email:`, error.message);
    return { success: false, error: error.message };
  }
}

async function testSmtpConnection(tenantId: string): Promise<EmailResult> {
  const smtp = await getSmtpConfig(tenantId);

  if (!smtp.enabled || !smtp.host || !smtp.user) {
    return { success: false, error: 'SMTP is not configured or disabled' };
  }

  try {
    const transporter = createTransporter(smtp);
    await transporter.verify();
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function sendPasswordResetEmail(tenantId: string, to: string, resetUrl: string, userName?: string): Promise<EmailResult> {
  const name = userName || to.split('@')[0];
  return sendEmail(tenantId, {
    to,
    subject: 'SGS LAND - Yêu cầu đặt lại mật khẩu',
    html: `
      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="color: #4F46E5; font-size: 24px; font-weight: 700; margin: 0;">SGS LAND</h1>
          <p style="color: #64748B; font-size: 14px; margin-top: 4px;">Enterprise Real Estate Platform</p>
        </div>
        <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 16px; padding: 32px;">
          <h2 style="color: #0F172A; font-size: 18px; font-weight: 600; margin: 0 0 16px;">Xin chào ${name},</h2>
          <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
            Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản SGS LAND. Nhấn nút bên dưới để tiếp tục:
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${resetUrl}" style="display: inline-block; padding: 14px 32px; background: #4F46E5; color: #FFFFFF; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 14px;">
              Đặt lại mật khẩu
            </a>
          </div>
          <p style="color: #94A3B8; font-size: 12px; line-height: 1.6; margin: 0;">
            Link này sẽ hết hạn sau 1 giờ. Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.
          </p>
        </div>
        <p style="color: #CBD5E1; font-size: 11px; text-align: center; margin-top: 24px;">
          &copy; ${new Date().getFullYear()} SGS LAND. All rights reserved.
        </p>
      </div>
    `,
    text: `Xin chào ${name},\n\nBạn đã yêu cầu đặt lại mật khẩu. Truy cập link sau: ${resetUrl}\n\nLink này hết hạn sau 1 giờ.`,
  });
}

async function sendWelcomeEmail(tenantId: string, to: string, userName: string): Promise<EmailResult> {
  return sendEmail(tenantId, {
    to,
    subject: 'Chào mừng đến với SGS LAND!',
    html: `
      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="color: #4F46E5; font-size: 24px; font-weight: 700; margin: 0;">SGS LAND</h1>
        </div>
        <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 16px; padding: 32px;">
          <h2 style="color: #0F172A; font-size: 18px; font-weight: 600; margin: 0 0 16px;">Chào mừng ${userName}!</h2>
          <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
            Tài khoản của bạn đã được tạo thành công trên SGS LAND Enterprise Platform.
          </p>
          <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0;">
            Bạn có thể đăng nhập ngay để bắt đầu quản lý bất động sản, leads và hợp đồng.
          </p>
        </div>
      </div>
    `,
    text: `Chào mừng ${userName}!\n\nTài khoản SGS LAND của bạn đã sẵn sàng.`,
  });
}

async function sendSequenceEmail(tenantId: string, to: string, subject: string, content: string): Promise<EmailResult> {
  const safeContent = escapeHtml(content);
  const plainText = content.replace(/<[^>]*>/g, '');
  return sendEmail(tenantId, {
    to,
    subject,
    html: `
      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 16px; padding: 32px; white-space: pre-wrap;">
          ${safeContent}
        </div>
        <p style="color: #CBD5E1; font-size: 11px; text-align: center; margin-top: 24px;">
          Sent via SGS LAND Automation
        </p>
      </div>
    `,
    text: plainText,
  });
}

export const emailService = {
  sendEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendSequenceEmail,
  testSmtpConnection,
  getSmtpConfig,
};
