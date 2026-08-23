/**
 * Email OTP verification routes - wires the existing emailOtpService +
 * emailService.sendEmailOtp into HTTP endpoints for registration/login flows.
 *
 * POST /api/auth/email-otp/request { email, locale? }
 *   -> { ok, delivered, queued, expiresAt }  (queued = SMTP chua cau hinh)
 * POST /api/auth/email-otp/verify { email, code }
 *   -> { ok, verified } - dong thoi cap nhat users.email_verified = TRUE
 *
 * Gioi han: service tu quan 3 ma/15 phut theo email; route them rate-limit theo IP.
 */
import { Router, Request, Response } from 'express';
import { rateLimit } from '../middleware/rateLimiter';
import { withRlsBypass } from '../db';
import { issueEmailOtp, verifyEmailOtp } from '../services/emailOtpService';
import { emailService } from '../services/emailService';
import { userRepository } from '../repositories/userRepository';
import { DEFAULT_TENANT_ID } from '../constants';
import { logger } from '../middleware/logger';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const ipLimit = rateLimit({
  name: 'email_otp_ip',
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Qua nhieu yeu cau tu thiet bi nay. Vui long thu lai sau.' },
});

export function createEmailOtpRoutes(): Router {
  const router = Router();

  router.post('/request', ipLimit, async (req: Request, res: Response) => {
    try {
      const email = String(req.body?.email ?? '').trim().toLowerCase();
      const locale = req.body?.locale === 'en' ? ('en' as const) : ('vn' as const);
      if (!EMAIL_RE.test(email)) {
        return res.status(400).json({ error: 'Dia chi email khong hop le.' });
      }
      const user = await userRepository.findByEmail(DEFAULT_TENANT_ID, email);
      if (!user) {
        return res.status(404).json({ error: 'Khong tim thay tai khoan voi email nay.' });
      }
      const issue = await issueEmailOtp({ tenantId: DEFAULT_TENANT_ID, userId: user.id, email, locale });
      if (!issue.ok) {
        if (issue.reason === 'RATE_LIMITED') {
          return res.status(429).json({
            error: 'Ban da yeu cau qua nhieu ma. Vui long thu lai sau it phut.',
            retryAfterSeconds: issue.retryAfterSeconds,
          });
        }
        return res.status(500).json({ error: 'Khong tao duoc ma xac minh.' });
      }
      const userName = String((user as Record<string, unknown>).name ?? '');
      const result = await emailService.sendEmailOtp(DEFAULT_TENANT_ID, email, userName, issue.code, locale);
      const status = String((result as Record<string, unknown>)?.status ?? '');
      const delivered = status === 'sent';
      if (!delivered) {
        logger.warn(`[email-otp] Mail chua gui duoc cho ${email} (status=${status}) - kiem tra cau hinh SMTP.`);
      }
      return res.json({ ok: true, delivered, queued: !delivered, expiresAt: issue.expiresAt });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('email-otp request error: ' + msg);
      return res.status(500).json({ error: 'Loi he thong. Vui long thu lai.' });
    }
  });

  router.post('/verify', ipLimit, async (req: Request, res: Response) => {
    try {
      const email = String(req.body?.email ?? '').trim().toLowerCase();
      const code = String(req.body?.code ?? '').trim();
      if (!EMAIL_RE.test(email) || !/^\d{6}$/.test(code)) {
        return res.status(400).json({ error: 'Email hoac ma khong hop le.' });
      }
      const outcome = await verifyEmailOtp({ email, code });
      if (!outcome.ok) {
        const map: Record<string, [number, string]> = {
          NOT_FOUND: [404, 'Chua co ma nao duoc gui cho email nay. Vui long yeu cau ma moi.'],
          EXPIRED: [400, 'Ma da het han. Vui long yeu cau ma moi.'],
          TOO_MANY_ATTEMPTS: [429, 'Ban da nhap sai qua nhieu lan. Vui long yeu cau ma moi.'],
          INVALID: [400, 'Ma khong dung.'],
        };
        const [status, message] = map[outcome.reason] ?? [400, 'Ma khong dung.'];
        return res.status(status).json({ error: message, attemptsRemaining: outcome.attemptsRemaining });
      }
      await withRlsBypass(async (client) => {
        await client.query('UPDATE users SET email_verified = TRUE WHERE id = $1', [outcome.userId]);
      });
      return res.json({ ok: true, verified: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('email-otp verify error: ' + msg);
      return res.status(500).json({ error: 'Loi he thong. Vui long thu lai.' });
    }
  });

  return router;
}
