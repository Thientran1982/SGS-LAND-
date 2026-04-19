/**
 * backupRoutes.ts
 *
 * - POST /api/internal/backup-cron        — Cron endpoint (QStash daily)
 * - GET  /api/admin/backups               — List backups (admin only)
 * - GET  /api/admin/backups/:filename     — Download backup file (admin only)
 * - POST /api/admin/backups/run           — Trigger ad-hoc backup (admin only)
 */

import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { createReadStream, promises as fs } from 'fs';
import { logger } from '../middleware/logger';
import { runBackup, listBackups, getBackupFilePath } from '../services/backupService';

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user || !['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
    return res.status(403).json({ error: 'Admin only' });
  }
  next();
}

export function createBackupRouter(cronSecret: string, authenticateToken: RequestHandler): Router {
  const router = Router();

  // ── Cron endpoint (QStash) ────────────────────────────────────────────────
  router.post('/api/internal/backup-cron', async (req: Request, res: Response) => {
    const provided =
      (req.headers['x-internal-secret'] as string | undefined) ||
      (req.body?.secret as string | undefined);

    if (!provided || provided !== cronSecret) {
      logger.warn('[BackupCron] Từ chối — sai secret');
      return res.status(403).json({ error: 'Forbidden' });
    }

    logger.info('[BackupCron] Bắt đầu backup theo lịch');
    const result = await runBackup();
    return res.status(result.ok ? 200 : 500).json(result);
  });

  // ── Admin: List backups ───────────────────────────────────────────────────
  router.get('/api/admin/backups', authenticateToken, requireAdmin, async (_req: Request, res: Response) => {
    const backups = await listBackups();
    res.json({
      backups,
      count: backups.length,
      totalSizeBytes: backups.reduce((s, b) => s + b.sizeBytes, 0),
    });
  });

  // ── Admin: Download backup file ───────────────────────────────────────────
  router.get('/api/admin/backups/:filename', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
    const filename = String(req.params.filename || '');
    const filepath = getBackupFilePath(filename);
    if (!filepath) return res.status(400).json({ error: 'Invalid filename' });

    try {
      const stat = await fs.stat(filepath);
      res.setHeader('Content-Type', 'application/gzip');
      res.setHeader('Content-Length', stat.size.toString());
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      createReadStream(filepath).pipe(res);
    } catch {
      res.status(404).json({ error: 'Not found' });
    }
  });

  // ── Admin: Trigger backup manually ────────────────────────────────────────
  router.post('/api/admin/backups/run', authenticateToken, requireAdmin, async (_req: Request, res: Response) => {
    logger.info('[BackupCron] Trigger thủ công bởi admin');
    const result = await runBackup();
    res.status(result.ok ? 200 : 500).json(result);
  });

  return router;
}
