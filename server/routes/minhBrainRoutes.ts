import { Router, Request, Response } from 'express';
import {
  AGENT_ORCHESTRATION_REGISTRY,
  isCompoundRoutingEnabled,
  validateAgentOrchestrationRegistry,
} from '../ai/agentOrchestrationRegistry';
import { getMinhBrainHealth } from '../ai/minhHealth';
import { getMinhBrainSchedulerSnapshot } from '../services/minhBrainScheduler';
import { listMinhOpportunities } from '../services/minhOpportunityDetectors';

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
      const [health, opportunities] = await Promise.all([
        getMinhBrainHealth(String(user.tenantId)),
        listMinhOpportunities(String(user.tenantId), Number(req.query.limit) || 100),
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
      });
    }
  });

  return router;
}