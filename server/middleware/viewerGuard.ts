/**
 * viewerGuard — Middleware bao ve backend khoi VIEWER ghi du lieu.
 *
 * Vai tro VIEWER chi duoc doc (GET / HEAD / OPTIONS).
 * Cac method ghi (POST, PUT, PATCH, DELETE) tu VIEWER se bi chan voi 403.
 *
 * Whitelist (VIEWER duoc phep ghi):
 *   - /api/auth/logout           — tu logout
 *   - /api/auth/change-password  — doi mat khau ban than
 *   - /api/activity/             — pageview tracking
 *   - /api/notifications/        — danh dau thong bao da doc
 *
 * Middleware nay phai duoc dat SAU authenticateToken de req.user da co.
 */

import type { Request, Response, NextFunction } from 'express';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const VIEWER_WRITE_WHITELIST: string[] = [
  '/api/auth/logout',
  '/api/auth/change-password',
  '/api/activity/',
  '/api/notifications/',
];

export function viewerGuard(req: Request, res: Response, next: NextFunction): void {
  if (!WRITE_METHODS.has(req.method)) {
    next();
    return;
  }

  const user = (req as any).user;

  if (!user || user.role !== 'VIEWER') {
    next();
    return;
  }

  const isAllowed = VIEWER_WRITE_WHITELIST.some((p) => req.path.startsWith(p));
  if (isAllowed) {
    next();
    return;
  }

  res.status(403).json({
    error: 'Tai khoan VIEWER chi co quyen doc. Lien he Admin de nang cap quyen.',
    code: 'VIEWER_WRITE_FORBIDDEN',
    role: 'VIEWER',
  });
}
