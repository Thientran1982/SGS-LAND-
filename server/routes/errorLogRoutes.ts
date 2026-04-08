import { Router, Request, Response } from 'express';
import { ErrorLogRepository } from '../repositories/errorLogRepository';
import { Pool } from 'pg';

const ADMIN_ROLES = new Set(['ADMIN', 'TEAM_LEAD']);
const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID || 'default';

export function createErrorLogRoutes(authenticateToken: any, pool: Pool) {
  const router = Router();
  const repo = new ErrorLogRepository(pool);

  // POST /api/error-logs — frontend reports an error (auth optional)
  router.post('/', async (req: Request, res: Response) => {
    try {
      const body = req.body ?? {};
      const user = (req as any).user;

      const tenantId = user?.tenantId ?? DEFAULT_TENANT_ID;

      const type = ['frontend', 'backend', 'unhandled_promise', 'chunk_load'].includes(body.type)
        ? body.type
        : 'frontend';
      const severity = ['error', 'warning', 'critical'].includes(body.severity)
        ? body.severity
        : 'error';

      if (!body.message || typeof body.message !== 'string') {
        return res.status(400).json({ error: 'message is required' });
      }

      await repo.insert({
        tenantId,
        type,
        severity,
        message: body.message,
        stack: body.stack,
        component: body.component,
        path: body.path ?? req.headers.referer,
        userId: user?.id ?? body.userId,
        userAgent: req.headers['user-agent'],
        metadata: typeof body.metadata === 'object' ? body.metadata : {},
      });

      return res.status(201).json({ ok: true });
    } catch {
      return res.status(500).json({ error: 'Lỗi ghi error log' });
    }
  });

  // GET /api/error-logs — admin only
  router.get('/', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!ADMIN_ROLES.has(user.role)) {
        return res.status(403).json({ error: 'Không có quyền truy cập' });
      }

      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 50;
      const type = req.query.type as string | undefined;
      const severity = req.query.severity as string | undefined;
      const resolvedParam = req.query.resolved as string | undefined;
      const resolved =
        resolvedParam === 'true' ? true : resolvedParam === 'false' ? false : undefined;

      const result = await repo.list(user.tenantId, { page, pageSize, type, severity, resolved });
      return res.json(result);
    } catch {
      return res.status(500).json({ error: 'Lỗi truy vấn error logs' });
    }
  });

  // GET /api/error-logs/stats — admin only
  router.get('/stats', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!ADMIN_ROLES.has(user.role)) {
        return res.status(403).json({ error: 'Không có quyền truy cập' });
      }
      const stats = await repo.getStats(user.tenantId);
      return res.json(stats);
    } catch {
      return res.status(500).json({ error: 'Lỗi lấy thống kê' });
    }
  });

  // PATCH /api/error-logs/:id/resolve — admin only
  router.patch('/:id/resolve', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!ADMIN_ROLES.has(user.role)) {
        return res.status(403).json({ error: 'Không có quyền truy cập' });
      }
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'ID không hợp lệ' });

      const ok = await repo.resolve(user.tenantId, id, user.id);
      return res.json({ ok });
    } catch {
      return res.status(500).json({ error: 'Lỗi cập nhật' });
    }
  });

  // POST /api/error-logs/resolve-all — admin only
  router.post('/resolve-all', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!ADMIN_ROLES.has(user.role)) {
        return res.status(403).json({ error: 'Không có quyền truy cập' });
      }
      const count = await repo.bulkResolve(user.tenantId, user.id);
      return res.json({ count });
    } catch {
      return res.status(500).json({ error: 'Lỗi cập nhật hàng loạt' });
    }
  });

  // DELETE /api/error-logs/resolved — admin only, delete resolved logs
  router.delete('/resolved', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!ADMIN_ROLES.has(user.role)) {
        return res.status(403).json({ error: 'Không có quyền truy cập' });
      }
      const count = await repo.deleteResolved(user.tenantId);
      return res.json({ count });
    } catch {
      return res.status(500).json({ error: 'Lỗi xóa logs' });
    }
  });

  return router;
}

// Exported singleton so errorHandler can call it without circular deps
let _errorLogRepo: ErrorLogRepository | null = null;

export function initErrorLogRepo(pool: Pool) {
  _errorLogRepo = new ErrorLogRepository(pool);
}

export async function logBackendError(opts: {
  tenantId?: string;
  message: string;
  stack?: string;
  path?: string;
  severity?: 'error' | 'warning' | 'critical';
  metadata?: Record<string, any>;
}) {
  if (!_errorLogRepo) return;
  try {
    await _errorLogRepo.insert({
      tenantId: opts.tenantId ?? DEFAULT_TENANT_ID,
      type: 'backend',
      severity: opts.severity ?? 'error',
      message: opts.message,
      stack: opts.stack,
      path: opts.path,
      metadata: opts.metadata ?? {},
    });
  } catch {
    // Silently ignore
  }
}
