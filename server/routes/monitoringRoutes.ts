import { Router, RequestHandler } from 'express';
import { agentMemoryService } from '../services/agentMemoryService';
import {
  getOutreachAuditExportFailureSummary,
  normalizeOutreachAuditExportFailureWindow,
} from '../services/outreachAuditExportTelemetry';

const ADMIN_ROLES = new Set(['ADMIN', 'SUPER_ADMIN', 'TEAM_LEAD']);
const OPERATOR_ROLES = new Set([...ADMIN_ROLES, 'MANAGER']);

export function createMonitoringRoutes(authenticateToken: RequestHandler): Router {
  const router = Router();
  router.get('/agent-signals', authenticateToken, async (req, res) => {
    const user = (req as any).user;
    if (!ADMIN_ROLES.has(user?.role)) return res.status(403).json({ error: 'Admin only' });
    const rawHours = Number(req.query.windowHours);
    const windowHours = Number.isFinite(rawHours) ? rawHours : 24;
    try {
      res.json(await agentMemoryService.getSignalHealth(user.tenantId, { windowHours }));
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Không thể kiểm tra sức khỏe tín hiệu học máy' });
    }
  });

  router.get('/outreach-audit-export-failures', authenticateToken, async (req, res) => {
    const user = (req as any).user;
    if (!OPERATOR_ROLES.has(user?.role)) return res.status(403).json({ error: 'Admin only' });
    try {
      const windowHours = normalizeOutreachAuditExportFailureWindow(req.query.windowHours);
      res.json(await getOutreachAuditExportFailureSummary(user.tenantId, windowHours));
    } catch {
      res.status(500).json({ error: 'Không thể kiểm tra gián đoạn export lịch sử đối soát' });
    }
  });

  return router;
}