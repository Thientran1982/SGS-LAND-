import type { Request, Response, NextFunction } from 'express';
import { DEFAULT_TENANT_ID } from '../constants';

/** Allow the request only when req.user.role is one of `roles`. Mount after authenticateToken. */
export function requireRole(...roles: string[]) {
  const allowed = new Set(roles);
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user || !allowed.has(String(user.role))) {
      return res.status(403).json({ error: 'Không có quyền truy cập' });
    }
    next();
  };
}

/** Platform operator only: SUPER_ADMIN of the host tenant (not a vendor workspace admin). */
export function requirePlatformAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user || user.role !== 'SUPER_ADMIN' || user.tenantId !== DEFAULT_TENANT_ID) {
    return res.status(403).json({ error: 'Super admin only' });
  }
  next();
}
