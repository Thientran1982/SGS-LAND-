import { Router, Request, Response } from 'express';
import { getDailyReport, listDailyReports, runDailyReport } from '../services/dailyAdminReportService';
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
      const verification = await Promise.all(recipients.map((email: string) =>
        emailService.verifyDelivery(user.tenantId, `daily-report:${user.tenantId}:${date}:${email}`),
      ));
      const canRetry = verification.length > 0 && verification.every((item: any) => item.status === 'not_received');
      res.json({ reportDate: date, canRetry, verification });
    } catch {
      res.status(500).json({ error: 'Không thể xác minh trạng thái provider.' });
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