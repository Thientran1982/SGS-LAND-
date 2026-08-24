import { Router, Request, Response } from 'express';
import { getDailyReport, listDailyReports, runDailyReport } from '../services/dailyAdminReportService';

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
    if (force && req.body?.provider_verified !== true) {
      return res.status(400).json({
        error: 'Cần xác nhận đã kiểm tra trạng thái provider trước khi gửi thủ công.',
        instruction: 'Dùng delivery key trong báo cáo để kiểm tra provider; chỉ đặt provider_verified=true khi provider xác nhận chưa nhận thư.',
      });
    }
    try { res.json(await runDailyReport(date, force)); } catch { res.status(500).json({ error:'Không thể chạy báo cáo.' }); }
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