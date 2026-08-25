import { Router, Request, Response } from 'express';
import { agentOperatingRepository } from '../repositories/agentOperatingRepository';
import { processAgentEvents } from '../services/agentOperatorDaemon';
import { companyBrainRepository } from '../repositories/companyBrainRepository';

const STAFF_ROLES = ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD'];
const BRAIN_DOCUMENT_TYPES = ['brand_voice', 'developer', 'project', 'legal_disclaimer', 'broker', 'faq', 'competitor_note'];
const BRAIN_VERIFICATION_STATUSES = ['verified', 'unverified', 'needs_review', 'stale'];

function validateBrainDocument(body: any) {
  const documentType = String(body?.documentType || '');
  const documentKey = String(body?.documentKey || '').trim();
  const source = String(body?.source || '').trim();
  const content = body?.content;
  const verificationStatus = String(body?.verificationStatus || 'unverified');
  if (!BRAIN_DOCUMENT_TYPES.includes(documentType)) return 'documentType không hợp lệ.';
  if (!documentKey || documentKey.length > 160) return 'documentKey là bắt buộc và tối đa 160 ký tự.';
  if (!source || source.length > 240) return 'source là bắt buộc và tối đa 240 ký tự.';
  if (body?.sourceUrl !== undefined && body.sourceUrl !== null && String(body.sourceUrl).length > 2000) return 'sourceUrl tối đa 2000 ký tự.';
  if (!content || typeof content !== 'object' || Array.isArray(content)) return 'content phải là một object JSON.';
  if (!BRAIN_VERIFICATION_STATUSES.includes(verificationStatus)) return 'verificationStatus không hợp lệ.';
  if (verificationStatus === 'verified' && (!source || Object.keys(content).length === 0)) {
    return 'Tài liệu đã xác minh phải có nguồn và nội dung.';
  }
  return null;
}

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

  router.get('/marketing-growth', authenticateToken, async (req, res) => {
    const user = requireStaff(req, res); if (!user) return;
    try {
      const [brain, capabilities] = await Promise.all([
        companyBrainRepository.list(user.tenantId),
        companyBrainRepository.listCapabilityStatus(user.tenantId),
      ]);
      res.json({ brain, capabilities });
    } catch (error: any) {
      console.error('[AgentOperating] marketing growth status failed:', error?.message || error);
      res.status(500).json({ error: 'Không thể tải Company Brain và Marketing/Growth.' });
    }
  });

  router.post('/marketing-growth/brain', authenticateToken, async (req, res) => {
    const user = requireStaff(req, res); if (!user) return;
    const validationError = validateBrainDocument(req.body);
    if (validationError) return res.status(400).json({ error: validationError });
    try {
      const body = req.body;
      const row = await companyBrainRepository.upsert(user.tenantId, {
        documentType: body.documentType,
        documentKey: String(body.documentKey).trim(),
        content: body.content,
        source: String(body.source).trim(),
        sourceUrl: body.sourceUrl ? String(body.sourceUrl).trim() : null,
        verificationStatus: body.verificationStatus || 'unverified',
      }, user.id);
      res.status(201).json(row);
    } catch (error: any) {
      console.error('[AgentOperating] brain create failed:', error?.message || error);
      res.status(500).json({ error: 'Không thể tạo tài liệu Company Brain.' });
    }
  });

  router.put('/marketing-growth/brain/:id', authenticateToken, async (req, res) => {
    const user = requireStaff(req, res); if (!user) return;
    const validationError = validateBrainDocument(req.body);
    if (validationError) return res.status(400).json({ error: validationError });
    try {
      const body = req.body;
      const row = await companyBrainRepository.update(user.tenantId, String(req.params.id), {
        documentType: body.documentType,
        documentKey: String(body.documentKey).trim(),
        content: body.content,
        source: String(body.source).trim(),
        sourceUrl: body.sourceUrl ? String(body.sourceUrl).trim() : null,
        verificationStatus: body.verificationStatus || 'unverified',
      }, user.id);
      if (!row) return res.status(404).json({ error: 'Tài liệu Company Brain không tồn tại.' });
      res.json(row);
    } catch (error: any) {
      console.error('[AgentOperating] brain update failed:', error?.message || error);
      res.status(500).json({ error: 'Không thể cập nhật tài liệu Company Brain.' });
    }
  });

  router.patch('/marketing-growth/capabilities/:key', authenticateToken, async (req, res) => {
    const user = requireStaff(req, res); if (!user) return;
    const rollout = req.body?.rollout;
    const active = req.body?.active;
    if (rollout !== undefined && !['SHADOW', 'CANARY_25', 'CANARY_50', 'LIVE'].includes(rollout)) {
      return res.status(400).json({ error: 'rollout không hợp lệ.' });
    }
    if (active !== undefined && typeof active !== 'boolean') {
      return res.status(400).json({ error: 'active phải là boolean.' });
    }
    try {
      const row = await companyBrainRepository.updateCapabilityStatus(
        user.tenantId, String(req.params.key), { rollout, active },
      );
      if (!row) return res.status(404).json({ error: 'Capability không tồn tại trong tenant.' });
      res.json(row);
    } catch (error: any) {
      console.error('[AgentOperating] capability update failed:', error?.message || error);
      res.status(500).json({ error: 'Không thể cập nhật rollout capability.' });
    }
  });

  router.patch('/marketing-growth/brain/:id/verification', authenticateToken, async (req, res) => {
    const user = requireStaff(req, res); if (!user) return;
    const status = req.body?.verificationStatus;
    if (!['verified', 'unverified', 'needs_review', 'stale'].includes(status)) {
      return res.status(400).json({ error: 'verificationStatus không hợp lệ.' });
    }
    try {
      const row = await companyBrainRepository.updateVerificationStatus(user.tenantId, String(req.params.id), status, user.id);
      if (!row) return res.status(404).json({ error: 'Tài liệu Company Brain không tồn tại.' });
      res.json(row);
    } catch (error: any) {
      console.error('[AgentOperating] brain verification update failed:', error?.message || error);
      res.status(500).json({ error: 'Không thể cập nhật trạng thái xác minh.' });
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