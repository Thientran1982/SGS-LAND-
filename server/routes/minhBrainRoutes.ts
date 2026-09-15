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
  listMinhDecisionQueue,
  suggestMinhOpportunity,
} from '../services/minhDecisionQueueService';

const STAFF_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD']);

export function createMinhBrainRoutes(authenticateToken: any): Router {
  const router = Router();

  router.get('/overview', authenticateToken, async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!STAFF_ROLES.has(user?.role)) {
      return res.status(403).json({ error: 'Chỉ quản lý mới có quyền xem Minh Brain overview.' });
    }

    const registryErrors = validateAgentOrchestrationRegistry();
    const scheduler = getMinhBrainSchedulerSnapshot();
    try {
      const [health, opportunities, decisionQueue, proactiveBudget] = await Promise.all([
        getMinhBrainHealth(String(user.tenantId)),
        listMinhOpportunities(String(user.tenantId), Number(req.query.limit) || 100),
        listMinhDecisionQueue(String(user.tenantId), Number(req.query.limit) || 50),
        getMinhProactiveBudgetStatus(String(user.tenantId)),
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