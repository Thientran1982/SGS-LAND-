import { Router, Request, Response } from 'express';
import { getLeadEmailSendStats } from '../services/emailMetricsService';
import { logger } from '../middleware/logger';

/**
 * Admin endpoint expose tỉ lệ gửi email lead N ngày gần nhất theo từng CĐT.
 * Dùng cho trang Admin/Health (SystemStatus). Vì payload chứa dữ liệu
 * cross-tenant (tên CĐT, lý do bounce) nên chỉ SUPER_ADMIN được truy cập.
 *
 * Query params:
 *   days=N                (1..30, default 7)
 *   includeAutoreply=true (mặc định false → chỉ tính LEAD_NOTIFY/LANDING_LEAD)
 */
export function createEmailMetricsRoutes(authenticateToken: any): Router {
  const router = Router();

  router.get('/lead-send-rate', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      // Báo cáo này chứa dữ liệu cross-tenant (tenant_id, tên, lý do bounce)
      // → chỉ SUPER_ADMIN (platform ops) được xem. ADMIN cấp tenant không
      // được phép xem dữ liệu của các CĐT khác.
      if (user?.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Chỉ SUPER_ADMIN có quyền xem báo cáo này' });
      }
      const days = Math.max(1, Math.min(30, Number(req.query.days) || 7));
      const includeAutoreply = String(req.query.includeAutoreply || '').toLowerCase() === 'true';
      const report = await getLeadEmailSendStats(days, includeAutoreply);
      res.setHeader('Cache-Control', 'no-store');
      res.json(report);
    } catch (err: any) {
      logger.error(`[emailMetrics] lead-send-rate failed: ${err?.message || err}`);
      res.status(500).json({ error: 'Không tải được báo cáo email' });
    }
  });

  return router;
}
