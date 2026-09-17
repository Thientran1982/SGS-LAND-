import { Router, Request, Response } from 'express';
import { getDailyReport, listDailyReports, replayInterruptedDailyReports, runDailyReport } from '../services/dailyAdminReportService';
import { emailService } from '../services/emailService';

const ROLES = new Set(['ADMIN', 'SUPER_ADMIN']);
export function createDailyAdminReportRoutes(authenticateToken: any): Router {
  const router = Router();
  const admin = (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!ROLES.has(user?.role)) { res.status(403).json({ error: 'Chỉ ADMIN mới có quyền xem báo cáo.' }); return null; }
    return user;
  };
  router.post('/daily/run', authenticateToken, async (req, res) => {
    const user = admin(req,res); if (!user) return;
    const date = req.body?.report_date || req.body?.reportDate;
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error:'report_date không hợp lệ.' });
    const force = req.body?.force === true;
    try { res.json(await runDailyReport(date, force)); } catch { res.status(500).json({ error:'Không thể chạy báo cáo.' }); }
  });
  router.post('/daily/verify-delivery', authenticateToken, async (req, res) => {
    const user = admin(req, res); if (!user) return;
    const date = req.body?.report_date || req.body?.reportDate;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'report_date không hợp lệ.' });
    try {
      const report = await getDailyReport(user.tenantId, date);
      if (!report) return res.status(404).json({ error: 'Không tìm thấy báo cáo.' });
      const recipients = report.recipients || [];
      let savedDeliveries: any[] = [];
      try {
        const parsed = typeof report.error_detail === 'string'
          ? JSON.parse(report.error_detail)
          : report.error_detail;
        savedDeliveries = Array.isArray(parsed?.deliveries) ? parsed.deliveries : [];
      } catch {
        savedDeliveries = [];
      }
      const verification = await Promise.all(recipients.map((email: string, index: number) => {
        const saved = savedDeliveries.find(item => item?.email === email) || savedDeliveries[index] || {};
        const deliveryKey = saved.deliveryKey || `daily-report:${user.tenantId}:${date}:${email}`;
        return emailService.verifyDelivery(user.tenantId, deliveryKey).then((item: any) => ({
          email,
          role: saved.role || 'UNKNOWN',
          deliveryKey,
          deliveryStatus: item.status === 'delivered' ? 'sent' : item.status,
          verificationStatus: item.status,
          provider: item.provider,
          ...(item.error ? { error: item.error } : {}),
        }));
      }));
      const canRetry = verification.some(item => item.verificationStatus === 'not_received')
        && verification.every(item => item.verificationStatus === 'not_received' || item.verificationStatus === 'delivered');
      res.json({ reportDate: date, canRetry, verification, deliveryStatuses: verification });
    } catch {
      res.status(500).json({ error: 'Không thể xác minh trạng thái provider.' });
    }
  });
  router.post('/daily/replay-delivery', authenticateToken, async (req, res) => {
    const user = admin(req, res); if (!user) return;
    try {
      // The service deliberately scopes every candidate by its durable tenant
      // key; this endpoint only triggers the same bounded worker as the scheduler.
      res.json(await replayInterruptedDailyReports(user.tenantId));
    } catch {
      res.status(500).json({ error: 'Không thể replay delivery báo cáo.' });
    }
  });
  router.get('/daily', authenticateToken, async (req,res) => {
    const user=admin(req,res); if(!user) return;
    const date=String(req.query.date||''); if(!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({error:'date không hợp lệ.'});
    try { const report=await getDailyReport(user.tenantId,date); if(!report)return res.status(404).json({error:'Không tìm thấy báo cáo.'}); res.json(report); } catch { res.status(500).json({error:'Không thể tải báo cáo.'}); }
  });
  router.get('/daily/history', authenticateToken, async (req,res) => {
    const user=admin(req,res); if(!user) return;
    try { res.json(await listDailyReports(user.tenantId,Number(req.query.limit)||30)); } catch { res.status(500).json({error:'Không thể tải lịch sử báo cáo.'}); }
  });
  return router;
}