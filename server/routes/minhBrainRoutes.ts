import { Router, Request, Response } from 'express';
import {
  AGENT_ORCHESTRATION_REGISTRY,
  isCompoundRoutingEnabled,
  validateAgentOrchestrationRegistry,
} from '../ai/agentOrchestrationRegistry';
import { getMinhBrainHealth } from '../ai/minhHealth';
import { getMinhBrainSchedulerSnapshot } from '../services/minhBrainScheduler';
import { listMinhOpportunities } from '../services/minhOpportunityDetectors';
import {
  getMinhProactiveBudgetStatus,
  getMinhProactiveRollout,
  listMinhDecisionQueue,
  suggestMinhOpportunity,
} from '../services/minhDecisionQueueService';
import {
  getMinhDecisionLearning,
  getMinhDecisionLearningSnapshot,
  getMinhDecisionLearningTrend,
  listMinhLearningExports,
  normalizeMinhLearningWindow,
  recordMinhLearningExport,
} from '../services/minhDecisionLearningService';

const STAFF_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD']);

function requestedLearningWindow(value: unknown): number {
  if (Array.isArray(value)) return normalizeMinhLearningWindow(value[0]);
  return normalizeMinhLearningWindow(value);
}

export function createMinhBrainRoutes(authenticateToken: any): Router {
  const router = Router();

  router.get('/learning/trends', authenticateToken, async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!STAFF_ROLES.has(user?.role)) {
      return res.status(403).json({ error: 'Chỉ quản lý mới có quyền xem xu hướng learning của Minh.' });
    }

    const learningWindowDays = requestedLearningWindow(req.query.days);
    try {
      const trend = await getMinhDecisionLearningTrend(String(user.tenantId), learningWindowDays);
      return res.json({
        generatedAt: new Date().toISOString(),
        degraded: false,
        trend,
      });
    } catch {
      return res.json({
        generatedAt: new Date().toISOString(),
        degraded: true,
        warning: 'Xu hướng learning của Minh tạm thời chưa tải được.',
        trend: null,
      });
    }
  });

  router.get('/learning/trends/export', authenticateToken, async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!STAFF_ROLES.has(user?.role)) {
      return res.status(403).json({ error: 'Chỉ quản lý mới có quyền xuất snapshot learning của Minh.' });
    }

    const learningWindowDays = requestedLearningWindow(req.query.days);
    try {
      const snapshot = await getMinhDecisionLearningSnapshot(String(user.tenantId), learningWindowDays);
      await recordMinhLearningExport(
        String(user.tenantId),
        String(user.id),
        snapshot.windowDays,
        'SUCCESS',
      );
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="minh-learning-${snapshot.windowDays}d.json"`,
      );
      return res.json(snapshot);
    } catch {
      try {
        await recordMinhLearningExport(
          String(user.tenantId),
          String(user.id),
          learningWindowDays,
          'FAILED',
        );
      } catch {
        // Preserve the export failure response if the history ledger is unavailable.
      }
      return res.status(503).json({
        degraded: true,
        warning: 'Snapshot learning của Minh tạm thời chưa thể tạo.',
        snapshot: null,
      });
    }
  });

  router.get('/learning/trends/exports', authenticateToken, async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!STAFF_ROLES.has(user?.role)) {
      return res.status(403).json({ error: 'Chỉ quản lý mới có quyền xem lịch sử snapshot learning của Minh.' });
    }

    try {
      const history = await listMinhLearningExports(String(user.tenantId), {
        limit: req.query.limit,
        offset: req.query.offset,
      });
      return res.json(history);
    } catch {
      return res.status(503).json({
        degraded: true,
        warning: 'Lịch sử snapshot learning của Minh tạm thời chưa tải được.',
        exports: [],
        limit: 20,
        offset: 0,
        hasMore: false,
        nextOffset: null,
      });
    }
  });

  router.get('/overview', authenticateToken, async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!STAFF_ROLES.has(user?.role)) {
      return res.status(403).json({ error: 'Chỉ quản lý mới có quyền xem Minh Brain overview.' });
    }

    const registryErrors = validateAgentOrchestrationRegistry();
    const scheduler = getMinhBrainSchedulerSnapshot();
    const learningWindowDays = requestedLearningWindow(req.query.days);
    try {
      const [health, opportunities, decisionQueue, proactiveBudget, proactiveRollout, learning] = await Promise.all([
        getMinhBrainHealth(String(user.tenantId)),
        listMinhOpportunities(String(user.tenantId), Number(req.query.limit) || 100),
        listMinhDecisionQueue(String(user.tenantId), Number(req.query.limit) || 50),
        getMinhProactiveBudgetStatus(String(user.tenantId)),
        getMinhProactiveRollout(String(user.tenantId)),
        getMinhDecisionLearning(String(user.tenantId), learningWindowDays),
      ]);
      return res.json({
        generatedAt: new Date().toISOString(),
        degraded: false,
        scheduler,
        routing: {
          compoundEnabled: isCompoundRoutingEnabled(),
          registryCount: AGENT_ORCHESTRATION_REGISTRY.length,
          registryErrors,
          manifestCount: AGENT_ORCHESTRATION_REGISTRY.filter(item => item.manifest).length,
        },
        health,
        opportunities,
        decisionQueue,
        proactiveBudget,
        proactiveRollout,
        learning,
      });
    } catch {
      return res.json({
        generatedAt: new Date().toISOString(),
        degraded: true,
        warning: 'Dữ liệu Minh Brain tạm thời chưa tải được.',
        scheduler,
        routing: {
          compoundEnabled: isCompoundRoutingEnabled(),
          registryCount: AGENT_ORCHESTRATION_REGISTRY.length,
          registryErrors,
          manifestCount: AGENT_ORCHESTRATION_REGISTRY.filter(item => item.manifest).length,
        },
        health: null,
        opportunities: [],
        decisionQueue: [],
        proactiveBudget: null,
        proactiveRollout: null,
        learning: null,
      });
    }
  });

  router.post('/opportunities/:signalId/suggest', authenticateToken, async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!STAFF_ROLES.has(user?.role)) {
      return res.status(403).json({ error: 'Chỉ quản lý mới có quyền tạo đề xuất Minh.' });
    }
    try {
      const request = await suggestMinhOpportunity(
        String(user.tenantId),
        String(req.params.signalId),
        String(user.id || ''),
      );
      return res.status(201).json(request);
    } catch (error: any) {
      const code = String(error?.code || '');
      const status = code === 'MINH_OPPORTUNITY_NOT_FOUND' ? 404
        : code === 'MINH_PROACTIVE_BUDGET_EXCEEDED' ? 429
          : code === 'MINH_OPPORTUNITY_ACTION_UNSUPPORTED' ? 422 : 500;
      return res.status(status).json({ error: code || 'MINH_PROACTIVE_SUGGEST_FAILED' });
    }
  });

  return router;
}