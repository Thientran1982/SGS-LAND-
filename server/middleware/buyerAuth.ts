/**
 * Buyer JWT authentication middleware (Task #52).
 *
 * Validates the `Authorization: Bearer <token>` header and accepts only
 * tokens with `aud: 'buyer'` so admin/agent tokens (signed with the same
 * secret) cannot accidentally cross the buyer surface. Populates
 * `req.buyerUser = { id, phone }` on success.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface BuyerJwtPayload {
  sub: string;
  phone: string;
  aud: 'buyer';
  iat?: number;
  exp?: number;
}

export function authenticateBuyer(secret: string) {
  return function (req: Request, res: Response, next: NextFunction): void | Response {
    const header = req.headers.authorization;
    if (!header || !header.toLowerCase().startsWith('bearer ')) {
      return res.status(401).json({ error: 'Chưa đăng nhập' });
    }
    const token = header.slice(7).trim();
    if (!token) return res.status(401).json({ error: 'Chưa đăng nhập' });

    try {
      const decoded = jwt.verify(token, secret) as BuyerJwtPayload;
      if (!decoded || decoded.aud !== 'buyer' || !decoded.sub) {
        return res.status(401).json({ error: 'Token không hợp lệ' });
      }
      (req as any).buyerUser = { id: decoded.sub, phone: decoded.phone };
      return next();
    } catch (_err) {
      return res.status(401).json({ error: 'Phiên đăng nhập đã hết hạn' });
    }
  };
}
