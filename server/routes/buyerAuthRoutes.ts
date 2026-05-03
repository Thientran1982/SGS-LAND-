/**
 * buyerAuthRoutes.ts (Task #52)
 *
 * Phone-based OTP login for the mobile buyer app. Issues a buyer-scoped JWT
 * (`aud: 'buyer'`) which the rest of the buyer surface (favorites, saved
 * searches, leads) verifies. Tokens last 30 days — re-login is one OTP.
 *
 *   POST /api/buyer/auth/request-otp   { phone }
 *   POST /api/buyer/auth/verify-otp    { phone, code }       → { token, user }
 *   GET  /api/buyer/auth/me                                  → { user }
 *   POST /api/buyer/auth/logout                              → { ok: true }
 *
 * Rate limits per phone (in addition to the route-level apiRateLimit by IP):
 *   - 1 OTP / 60 seconds
 *   - 5 OTPs / hour
 * Enforced inside `BuyerOtpService.assertCanIssue` so the limit survives
 * across instances by hitting the DB (unlike the in-memory rateLimit factory).
 */

import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../middleware/logger';
import { rateLimit } from '../middleware/rateLimiter';
import { buyerOtpService, normalizeVnPhone } from '../services/buyerOtpService';
import { buyerUserRepository } from '../repositories/buyerUserRepository';
import { authenticateBuyer } from '../middleware/buyerAuth';

const TOKEN_TTL = '30d';

export function signBuyerToken(secret: string, user: { id: string; phone: string }): string {
  return jwt.sign(
    { sub: user.id, phone: user.phone, aud: 'buyer' },
    secret,
    { expiresIn: TOKEN_TTL },
  );
}

export function createBuyerAuthRoutes(jwtSecret: string): Router {
  const router = Router();

  // Belt-and-braces IP rate limit on top of per-phone DB throttle so a single
  // host can't sweep many phones to enumerate accounts.
  const ipOtpLimit = rateLimit({
    name: 'buyer_otp_ip',
    windowMs: 60 * 60 * 1000,
    maxRequests: 30,
    keyFn: (req) => `botp_ip:${req.ip || 'anon'}`,
    message: 'Quá nhiều yêu cầu OTP từ thiết bị này. Vui lòng thử lại sau.',
  });

  router.post('/api/buyer/auth/request-otp', ipOtpLimit, async (req: Request, res: Response) => {
    try {
      const phoneRaw = String((req.body as any)?.phone || '').trim();
      const phone = normalizeVnPhone(phoneRaw);
      if (!phone) {
        return res.status(400).json({ error: 'Số điện thoại không hợp lệ' });
      }

      try {
        await buyerOtpService.assertCanIssue(phone);
      } catch (err: any) {
        const code = err?.code === 'OTP_TOO_SOON' ? 429 : err?.code === 'OTP_HOURLY_LIMIT' ? 429 : 400;
        return res.status(code).json({ error: err?.message || 'Vui lòng thử lại sau' });
      }

      const result = await buyerOtpService.issue(phone, req.ip || null);
      return res.json({
        ok: true,
        // Echo masked phone so the UI can display "đã gửi tới 0987***456".
        phone,
        ...(result.devCode ? { devCode: result.devCode } : {}),
      });
    } catch (err: any) {
      logger.error('[buyer/auth/request-otp] ' + (err?.message || err));
      return res.status(500).json({ error: 'Internal error' });
    }
  });

  router.post('/api/buyer/auth/verify-otp', async (req: Request, res: Response) => {
    try {
      const phoneRaw = String((req.body as any)?.phone || '').trim();
      const code = String((req.body as any)?.code || '').trim();
      const phone = normalizeVnPhone(phoneRaw);
      if (!phone) {
        return res.status(400).json({ error: 'Số điện thoại không hợp lệ' });
      }
      if (!code) {
        return res.status(400).json({ error: 'Vui lòng nhập mã OTP' });
      }
      const verify = await buyerOtpService.verify(phone, code);
      if (!verify.ok) {
        return res.status(400).json({ error: verify.error || 'OTP không đúng' });
      }
      const user = await buyerUserRepository.upsertByPhone(phone);
      const token = signBuyerToken(jwtSecret, { id: user.id, phone: user.phone });
      return res.json({
        token,
        user: {
          id: user.id,
          phone: user.phone,
          displayName: user.displayName,
        },
      });
    } catch (err: any) {
      logger.error('[buyer/auth/verify-otp] ' + (err?.message || err));
      return res.status(500).json({ error: 'Internal error' });
    }
  });

  router.get('/api/buyer/auth/me', authenticateBuyer(jwtSecret), async (req: Request, res: Response) => {
    try {
      const buyerId = (req as any).buyerUser?.id as string;
      const user = await buyerUserRepository.findById(buyerId);
      if (!user) return res.status(404).json({ error: 'Không tìm thấy tài khoản' });
      return res.json({
        user: {
          id: user.id,
          phone: user.phone,
          displayName: user.displayName,
          lastLoginAt: user.lastLoginAt,
        },
      });
    } catch (err: any) {
      logger.error('[buyer/auth/me] ' + (err?.message || err));
      return res.status(500).json({ error: 'Internal error' });
    }
  });

  router.patch('/api/buyer/auth/me', authenticateBuyer(jwtSecret), async (req: Request, res: Response) => {
    try {
      const buyerId = (req as any).buyerUser?.id as string;
      const { displayName } = (req.body as any) || {};
      const next = await buyerUserRepository.setDisplayName(
        buyerId,
        typeof displayName === 'string' ? displayName.trim() : null,
      );
      if (!next) return res.status(404).json({ error: 'Không tìm thấy tài khoản' });
      return res.json({
        user: { id: next.id, phone: next.phone, displayName: next.displayName },
      });
    } catch (err: any) {
      logger.error('[buyer/auth/me PATCH] ' + (err?.message || err));
      return res.status(500).json({ error: 'Internal error' });
    }
  });

  router.post('/api/buyer/auth/logout', (_req: Request, res: Response) => {
    // JWT is stateless — logout is purely a client-side discard. Endpoint
    // exists so the mobile app can confirm reachability before clearing the
    // token (and so audit / future revocation lists have a hook).
    return res.json({ ok: true });
  });

  return router;
}
