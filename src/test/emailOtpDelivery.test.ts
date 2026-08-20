import { beforeEach, describe, expect, it, vi } from 'vitest';

const withRlsBypass = vi.fn();
const brevoSendEmail = vi.fn();

vi.mock('../../server/db', () => ({ withRlsBypass }));
vi.mock('../../server/services/brevoService', () => ({
  isBrevoConfigured: () => true,
  brevoSendEmail,
}));
vi.mock('../../server/repositories/enterpriseConfigRepository', () => ({
  enterpriseConfigRepository: { getConfig: vi.fn() },
}));
vi.mock('../../server/middleware/logger', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

function prepareDatabaseMock() {
  const queries: Array<{ sql: string; params?: unknown[] }> = [];
  const client = {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      queries.push({ sql, params });
      if (sql.includes('INSERT INTO email_delivery_claims')) return { rowCount: 1, rows: [] };
      return { rowCount: 0, rows: [] };
    }),
  };
  withRlsBypass.mockImplementation(async (fn: (dbClient: any) => unknown) => fn(client));
  return { client, queries };
}

describe('email OTP delivery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    brevoSendEmail.mockResolvedValue({ success: true, messageId: 'brevo-otp-1' });
  });

  it('sends the Vietnamese OTP template with the code in text and HTML', async () => {
    prepareDatabaseMock();
    const { emailService } = await import('../../server/services/emailService');

    const result = await emailService.sendEmailOtp(
      '00000000-0000-0000-0000-000000000001',
      'User@Example.com',
      'Nguyễn Văn A',
      '042681',
      'vn',
    );

    expect(result).toMatchObject({ success: true, status: 'sent', messageId: 'brevo-otp-1' });
    expect(brevoSendEmail).toHaveBeenCalledTimes(1);
    const message = brevoSendEmail.mock.calls[0][0];
    expect(message.to).toBe('User@Example.com');
    expect(message.subject).toContain('Mã xác minh email');
    expect(message.template).toBeUndefined();
    expect(message.text).toContain('042681');
    expect(message.html).toContain('042681');
    expect(message.html).toContain('5 phút');
    expect(message.html).not.toContain('/verify-email/');
    expect(message.html).not.toContain('Xác Minh Email Ngay');
    expect(message.headers['X-SGS-Land-Delivery-Key']).not.toContain('042681');
    expect(message.headers['X-SGS-Land-Delivery-Key']).toMatch(/^email-otp:user@example\.com:[a-f0-9]{64}$/);
  });

  it('sends the English subject and copy without exposing the OTP in delivery headers', async () => {
    prepareDatabaseMock();
    const { emailService } = await import('../../server/services/emailService');

    await emailService.sendEmailOtp(
      '00000000-0000-0000-0000-000000000001',
      'user@example.com',
      'Alex',
      '918204',
      'en',
    );

    const message = brevoSendEmail.mock.calls[0][0];
    expect(message.subject).toBe('SGS LAND – Your email verification code');
    expect(message.text).toContain('Your SGS LAND verification code is: 918204');
    expect(message.html).toContain('Verify your email address');
    expect(message.html).toContain('5 minutes');
    expect(message.headers['Message-ID']).not.toContain('918204');
    expect(message.headers['X-SGS-Land-Delivery-Key']).not.toContain('918204');
  });
});