import { Router, Request, Response } from 'express';
import { agentOperatingRepository } from '../repositories/agentOperatingRepository';
import { processAgentEvents } from '../services/agentOperatorDaemon';

const STAFF_ROLES = ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD'];

export function createAgentOperatingRoutes(authenticateToken: any): Router {
  const router = Router();
  const requireStaff = (req: Request, res: Response): any => {
    const user = (req as any).user;
    if (!STAFF_ROLES.includes(user?.role)) {
      res.status(403).json({ error: 'Chỉ quản lý mới có quyền vận hành Agent.' });
      return null;
    }
    return user;
  };

  router.get('/cockpit', authenticateToken, async (req, res) => {
    const user = requireStaff(req, res); if (!user) return;
    try { res.json(await agentOperatingRepository.cockpitSummary(user.tenantId)); }
    catch (error: any) {
      console.error('[AgentOperating] cockpit summary failed:', error?.message || error);
      res.status(500).json({ error: 'Không thể tải Admin Cockpit.' });
    }
  });

  router.get('/questions', authenticateToken, async (req, res) => {
    const user = requireStaff(req, res); if (!user) return;
    try { res.json(await agentOperatingRepository.listHumanQuestions(user.tenantId, String(req.query.status || 'OPEN'))); }
    catch { res.status(500).json({ error: 'Không thể tải hàng đợi hỏi nhân viên.' }); }
  });

  router.post('/questions', authenticateToken, async (req, res) => {
    const user = requireStaff(req, res); if (!user) return;
    const { agentKey, question } = req.body || {};
    if (!agentKey || !question) return res.status(400).json({ error: 'agentKey và question là bắt buộc.' });
    try {
      res.status(201).json(await agentOperatingRepository.createHumanQuestion(user.tenantId, req.body));
    } catch { res.status(500).json({ error: 'Không thể tạo câu hỏi cho nhân viên.' }); }
  });

  router.post('/questions/:id/answer', authenticateToken, async (req, res) => {
    const user = requireStaff(req, res); if (!user) return;
    if (!String(req.body?.answer || '').trim()) return res.status(400).json({ error: 'answer là bắt buộc.' });
    try {
      const row = await agentOperatingRepository.answerHumanQuestion(user.tenantId, req.params.id, String(req.body.answer), user.id, req.body.approveMemory === true);
      if (!row) return res.status(404).json({ error: 'Câu hỏi không tồn tại hoặc đã được xử lý.' });
      res.json(row);
    } catch { res.status(500).json({ error: 'Không thể ghi câu trả lời.' }); }
  });

  router.get('/kpi/weekly', authenticateToken, async (req, res) => {
    const user = requireStaff(req, res); if (!user) return;
    try { res.json(await agentOperatingRepository.listWeeklyKpi(user.tenantId, req.query.startDate ? String(req.query.startDate) : undefined)); }
    catch { res.status(500).json({ error: 'Không thể tải KPI tuần.' }); }
  });
  router.post('/kpi/weekly', authenticateToken, async (req, res) => {
    const user = requireStaff(req, res); if (!user) return;
    const { agentKey, periodStart, periodEnd } = req.body || {};
    if (!agentKey || !periodStart || !periodEnd) return res.status(400).json({ error: 'agentKey, periodStart và periodEnd là bắt buộc.' });
    try { res.status(201).json(await agentOperatingRepository.upsertWeeklyKpi(user.tenantId, req.body)); }
    catch { res.status(500).json({ error: 'Không thể lưu KPI tuần.' }); }
  });
  router.get('/shift-reports', authenticateToken, async (req, res) => {
    const user = requireStaff(req, res); if (!user) return;
    try { res.json(await agentOperatingRepository.listShiftReports(user.tenantId, Number(req.query.limit) || 14)); }
    catch { res.status(500).json({ error: 'Không thể tải báo cáo ca.' }); }
  });
  router.post('/shift-reports/generate', authenticateToken, async (req, res) => {
    const user = requireStaff(req, res); if (!user) return;
    const reportDate = String(req.body?.reportDate || new Date().toISOString().slice(0, 10));
    try { res.status(201).json(await agentOperatingRepository.generateDailyShiftReport(user.tenantId, reportDate, String(req.body?.shift || 'ALL_DAY'))); }
    catch { res.status(500).json({ error: 'Không thể tạo báo cáo ca.' }); }
  });
  router.post('/shift-reports/:id/review', authenticateToken, async (req, res) => {
    const user = requireStaff(req, res); if (!user) return;
    try {
      const row = await agentOperatingRepository.reviewShiftReport(user.tenantId, req.params.id, user.id);
      if (!row) return res.status(404).json({ error: 'Báo cáo ca không tồn tại.' });
      res.json(row);
    } catch { res.status(500).json({ error: 'Không thể duyệt báo cáo ca.' }); }
  });
  router.post('/role-cards/:agentKey/approval', authenticateToken, async (req, res) => {
    const user = requireStaff(req, res); if (!user) return;
    try { res.json(await agentOperatingRepository.approveRoleCard(user.tenantId, req.params.agentKey, req.body?.approved === true, user.id, String(req.body?.reason || ''))); }
    catch { res.status(500).json({ error: 'Không thể cập nhật duyệt role card.' }); }
  });

  router.get('/events', authenticateToken, async (req, res) => {
    const user = requireStaff(req, res); if (!user) return;
    const allowed = <T extends string>(value: unknown, values: T[], fallback: T): T => values.includes(String(value) as T) ? String(value) as T : fallback;
    try {
      res.json(await agentOperatingRepository.listEvents(user.tenantId, {
        limit: Number(req.query.limit) || 100,
        urgency: allowed<'ALL' | 'HIGH' | 'NORMAL' | 'LOW'>(req.query.urgency, ['ALL', 'HIGH', 'NORMAL', 'LOW'], 'ALL'),
        lease: allowed<'ALL' | 'ACTIVE' | 'EXPIRED' | 'NONE'>(req.query.lease, ['ALL', 'ACTIVE', 'EXPIRED', 'NONE'], 'ALL'),
        deadLetter: allowed<'ALL' | 'YES' | 'NO'>(req.query.deadLetter, ['ALL', 'YES', 'NO'], 'ALL'),
      }));
    }
    catch { res.status(500).json({ error: 'Không thể tải event bus.' }); }
  });

  router.post('/events/:id/replay', authenticateToken, async (req, res) => {
    const user = requireStaff(req, res); if (!user) return;
    const reason = String(req.body?.reason || '').trim();
    if (reason.length < 5) return res.status(400).json({ error: 'Cần nêu lý do replay (ít nhất 5 ký tự).' });
    try {
      const row = await agentOperatingRepository.replayEvent(user.tenantId, req.params.id, reason, user.id);
      if (!row) return res.status(409).json({ error: 'Event không còn ở trạng thái lỗi/dead-letter hoặc không tồn tại.' });
      res.json(row);
    } catch { res.status(500).json({ error: 'Không thể replay event.' }); }
  });

  router.post('/events', authenticateToken, async (req, res) => {
    const user = requireStaff(req, res); if (!user) return;
    const { eventId, eventType, idempotencyKey, actor } = req.body || {};
    if (!eventId || !eventType || !idempotencyKey || !['SYSTEM', 'STAFF', 'BUYER', 'AGENT'].includes(actor)) {
      return res.status(400).json({ error: 'eventId, eventType, idempotencyKey và actor hợp lệ là bắt buộc.' });
    }
    try { res.status(201).json(await agentOperatingRepository.enqueueEvent(user.tenantId, req.body)); }
    catch { res.status(500).json({ error: 'Không thể đưa event vào hàng đợi.' }); }
  });

  router.post('/events/process', authenticateToken, async (req, res) => {
    const user = requireStaff(req, res); if (!user) return;
    try { res.json(await processAgentEvents(user.tenantId, Number(req.body?.limit) || 25)); }
    catch { res.status(500).json({ error: 'Không thể xử lý event queue.' }); }
  });
  return router;
}