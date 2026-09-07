import { Router, Request, Response } from 'express';
import {
  consolidateMemoryForAllTenants,
  consolidateTenantMemory,
  runLearningCyclesForAllTenants,
  runLearningCycleForTenant,
} from '../services/learningCycleRunner';

function configuredSecret(): string {
  return process.env.LEARNING_CYCLE_CRON_SECRET
    || process.env.RLHF_CRON_SECRET
    || process.env.JWT_SECRET?.slice(0, 32)
    || '';
}

function isAuthorized(req: Request): boolean {
  const provided = req.headers['x-internal-secret'] || req.body?.secret;
  return Boolean(provided && provided === configuredSecret());
}

export function createLearningCycleRoutes(): Router {
  const router = Router();

  router.post('/learning-cycle', async (req: Request, res: Response) => {
    if (!isAuthorized(req)) return res.status(401).json({ error: 'Không có quyền truy cập' });
    try {
      const tenantId = req.body?.tenantId;
      const result = tenantId && tenantId !== 'all'
        ? await runLearningCycleForTenant(String(tenantId), String(req.body?.cycleKey || `manual-${Date.now()}`), String(req.body?.traceId || 'internal-learning-cycle'))
        : await runLearningCyclesForAllTenants(String(req.body?.cycleKey || `manual-${Date.now()}`), String(req.body?.traceId || 'internal-learning-cycle'));
      return res.json({ ok: true, result });
    } catch (error: any) {
      return res.status(500).json({ error: 'Learning cycle failed', detail: error?.message || String(error) });
    }
  });

  router.post('/memory-consolidation', async (req: Request, res: Response) => {
    if (!isAuthorized(req)) return res.status(401).json({ error: 'Không có quyền truy cập' });
    try {
      const tenantId = req.body?.tenantId;
      const result = tenantId && tenantId !== 'all'
        ? await consolidateTenantMemory(String(tenantId))
        : await consolidateMemoryForAllTenants();
      return res.json({ ok: true, result });
    } catch (error: any) {
      return res.status(500).json({ error: 'Memory consolidation failed', detail: error?.message || String(error) });
    }
  });

  return router;
}