import { Router, Request, Response, RequestHandler } from 'express';
import { agentMemoryService, MemoryKind } from '../services/agentMemoryService';

const ADMIN_ROLES = new Set(['ADMIN', 'SUPER_ADMIN', 'TEAM_LEAD']);
const SIGNAL_TYPES = new Set(['match_feedback', 'match_chosen', 'price_estimate_edit_distance', 'support_csat', 'lead_clarification_answer']);

function canAccessNamespace(user: any, namespace: string): boolean {
  if (ADMIN_ROLES.has(user?.role)) return true;
  return /^(customer|agent):[^:]+$/.test(namespace) && namespace.endsWith(`:${user?.id}`);
}

function requireNamespace(req: Request, res: Response): string | null {
  const namespace = String(req.body?.namespace || req.query.namespace || '');
  if (!namespace) {
    res.status(400).json({ error: 'namespace is required' });
    return null;
  }
  if (!canAccessNamespace((req as any).user, namespace)) {
    res.status(403).json({ error: 'Không có quyền truy cập namespace này' });
    return null;
  }
  return namespace;
}
function requireAdmin(req: Request, res: Response): any | null {
  const user = (req as any).user;
  if (!ADMIN_ROLES.has(user?.role)) { res.status(403).json({ error: 'Chỉ quản trị viên mới được thao tác memory' }); return null; }
  return user;
}

export function createAgentMemoryRoutes(authenticateToken: RequestHandler): Router {
  const router = Router();

  router.get('/memory/admin', authenticateToken, async (req, res) => {
    const user = requireAdmin(req, res); if (!user) return;
    try {
      res.json(await agentMemoryService.listAdminMemory(user.tenantId, {
        namespace: req.query.namespace as string, kind: req.query.kind as string, importance: req.query.importance as string,
      }));
    } catch (error: any) { res.status(400).json({ error: error?.message || 'Không thể tải memory quản trị' }); }
  });

  router.get('/memory', authenticateToken, async (req, res) => {
    try {
      const namespace = requireNamespace(req, res);
      if (!namespace) return;
      res.json(await agentMemoryService.recall((req as any).user.tenantId, namespace, String(req.query.query || ''), Number(req.query.k) || 8));
    } catch (error: any) {
      res.status(400).json({ error: error?.message || 'Không thể đọc memory' });
    }
  });

  router.post('/memory', authenticateToken, async (req, res) => {
    try {
      const user = (req as any).user;
      const namespace = String(req.body?.namespace || '');
      if (!namespace || !ADMIN_ROLES.has(user?.role)) return res.status(403).json({ error: 'Chỉ quản trị viên mới được sửa memory' });
      const row = await agentMemoryService.remember(user.tenantId, namespace, String(req.body?.key || ''), req.body?.value, req.body?.kind as MemoryKind || 'fact', req.body?.importance, req.body?.ttlDays);
      res.status(201).json(row);
    } catch (error: any) {
      res.status(400).json({ error: error?.message || 'Không thể ghi memory' });
    }
  });

  router.put('/memory/:id', authenticateToken, async (req, res) => {
    const user = requireAdmin(req, res); if (!user) return;
    try {
      const row = await agentMemoryService.updateMemory(user.tenantId, String(req.params.id), req.body || {});
      if (!row) return res.status(404).json({ error: 'Memory không tồn tại' });
      res.json(row);
    } catch (error: any) { res.status(400).json({ error: error?.message || 'Không thể cập nhật memory' }); }
  });

  router.delete('/memory/:id', authenticateToken, async (req, res) => {
    const user = requireAdmin(req, res); if (!user) return;
    try { res.json({ deleted: await agentMemoryService.forgetById(user.tenantId, String(req.params.id)) }); }
    catch (error: any) { res.status(400).json({ error: error?.message || 'Không thể xóa memory' }); }
  });

  router.delete('/memory', authenticateToken, async (req, res) => {
    try {
      const namespace = requireNamespace(req, res);
      if (!namespace) return;
      const count = await agentMemoryService.forget((req as any).user.tenantId, namespace, req.body?.key || req.query.key as string | undefined);
      res.json({ deleted: count });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || 'Không thể xóa memory' });
    }
  });

  router.post('/signals', authenticateToken, async (req, res) => {
    try {
      const user = (req as any).user;
      const { signalType, subjectType, subjectId } = req.body || {};
      if (!signalType || !subjectType || !subjectId) return res.status(400).json({ error: 'signalType, subjectType và subjectId là bắt buộc' });
      if (!SIGNAL_TYPES.has(signalType)) return res.status(400).json({ error: 'signalType không hợp lệ' });
      if (signalType === 'price_estimate_edit_distance') {
        const payload = req.body.payload || {};
        const signal = await agentMemoryService.recordPriceEstimateEditDistance(user.tenantId, {
          subjectType, subjectId, estimatedPrice: payload.estimatedPrice,
          actualPrice: payload.actualPrice, actorId: user.id, source: 'staff_verified',
        });
        if (!signal) return res.status(400).json({ error: 'estimatedPrice và actualPrice phải là số dương hợp lệ' });
        return res.status(201).json(signal);
      }
      res.status(201).json(await agentMemoryService.recordSignal(user.tenantId, {
        signalType, subjectType, subjectId, actorId: user.id, payload: req.body.payload,
        dedupeKey: req.body.dedupeKey,
        provenance: 'staff',
      }));
    } catch (error: any) {
      res.status(400).json({ error: error?.message || 'Không thể ghi tín hiệu' });
    }
  });

  router.get('/signals', authenticateToken, async (req, res) => {
    try {
      res.json(await agentMemoryService.listSignals((req as any).user.tenantId, req.query.signalType as string | undefined));
    } catch (error: any) {
      res.status(400).json({ error: error?.message || 'Không thể đọc tín hiệu' });
    }
  });

  router.post('/reflection/run', authenticateToken, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!ADMIN_ROLES.has(user?.role)) return res.status(403).json({ error: 'Admin only' });
      const signals = await agentMemoryService.listSignals(user.tenantId, undefined);
      let written = 0;
      for (const signal of signals.slice(0, 100)) {
        const payload = typeof signal.payload === 'string' ? JSON.parse(signal.payload) : signal.payload;
        if (signal.signal_type === 'match_feedback' && payload?.reason) {
          await agentMemoryService.remember(user.tenantId, `customer:${signal.actor_id}`, `feedback:${signal.subject_id}`, `Không phù hợp vì: ${payload.reason}`, 'episodic', 0.55);
          written++;
        }
      }
      res.json({ signalsRead: signals.length, memoriesWritten: written });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || 'Không thể chạy reflection' });
    }
  });

  router.get('/weights', authenticateToken, async (req, res) => {
    const user = requireAdmin(req, res); if (!user) return;
    res.json({ live: await agentMemoryService.getWeights(user.tenantId), versions: await agentMemoryService.listWeights(user.tenantId) });
  });

  router.post('/weights/fit', authenticateToken, async (req, res) => {
    const user = (req as any).user;
    if (!ADMIN_ROLES.has(user?.role)) return res.status(403).json({ error: 'Admin only' });
    res.status(201).json(await agentMemoryService.fitWeights(user.tenantId, user.id));
  });

  router.post('/weights/:id/promote', authenticateToken, async (req, res) => {
    const user = (req as any).user;
    if (!ADMIN_ROLES.has(user?.role)) return res.status(403).json({ error: 'Admin only' });
    try {
      const row = await agentMemoryService.promoteWeights(user.tenantId, req.params.id as string, req.body?.goldenSetPassed === true, user.id, req.body?.metrics || {});
      if (!row) return res.status(404).json({ error: 'Draft weights not found' });
      res.json(row);
    } catch (error: any) {
      res.status(400).json({ error: error?.message || 'Không thể promote weights' });
    }
  });

  return router;
}