import { Router, Request, Response } from 'express';
import { connectorRepository, syncJobRepository } from '../repositories/connectorRepository';
import { auditRepository } from '../repositories/auditRepository';

const CONNECTOR_TYPES = new Set([
  'GOOGLE_SHEETS',
  'HUBSPOT',
  'ZOHO_CRM',
  'WEBHOOK_EXPORT',
  'SALESFORCE',
  'FACEBOOK_PAGE',
  'ZALO_OA',
  'INSTAGRAM',
  'TIKTOK',
  'LINKEDIN_PAGE',
]);
const NON_SYNCABLE_CONNECTOR_TYPES = new Set(['FACEBOOK_PAGE', 'ZALO_OA', 'INSTAGRAM', 'TIKTOK', 'LINKEDIN_PAGE']);
const CONNECTOR_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD', 'MANAGER', 'SALES', 'MARKETING']);
const SENSITIVE_CONFIG_KEY = /(api.?key|access.?token|refresh.?token|client.?secret|private.?key|authorization|password|secret|credential)/i;

function publicConnector(connector: any): any {
  if (!connector || typeof connector !== 'object') return connector;
  const redactConfig = (value: unknown, key?: string): unknown => {
    if (key && SENSITIVE_CONFIG_KEY.test(key) && value) return '[REDACTED]';
    if (Array.isArray(value)) return value.map(item => redactConfig(item));
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([childKey, childValue]) => [
          childKey,
          redactConfig(childValue, childKey),
        ]),
      );
    }
    return value;
  };
  const config = redactConfig(connector.config);
  return { ...connector, config };
}

function validateConnectorInput(type: unknown, config: unknown): string | null {
  if (typeof type !== 'string' || !CONNECTOR_TYPES.has(type)) return 'Loại connector không được hỗ trợ';
  if (!config || typeof config !== 'object' || Array.isArray(config)) return 'Cấu hình connector không hợp lệ';
  const values = config as Record<string, unknown>;
  const requiredKeys: Record<string, string[]> = {
    GOOGLE_SHEETS: ['spreadsheetId'],
    WEBHOOK_EXPORT: ['targetUrl'],
    HUBSPOT: ['apiKey'],
    ZOHO_CRM: ['apiKey'],
    SALESFORCE: ['apiKey'],
    FACEBOOK_PAGE: ['pageId', 'accessToken'],
    ZALO_OA: ['appId', 'oaId', 'accessToken'],
    INSTAGRAM: ['businessAccountId', 'accessToken'],
    TIKTOK: ['accountId', 'accessToken'],
    LINKEDIN_PAGE: ['organizationId', 'accessToken'],
  };
  for (const requiredKey of requiredKeys[type] || []) {
    if (typeof values[requiredKey] !== 'string' || !values[requiredKey].trim()) {
      return `Thiếu cấu hình bắt buộc: ${requiredKey}`;
    }
  }
  if (type === 'WEBHOOK_EXPORT') {
    try {
      const url = new URL(String(values.targetUrl));
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('protocol');
    } catch {
      return 'Webhook URL phải là HTTP(S) hợp lệ';
    }
  }
  return null;
}

export function createConnectorRoutes(authenticateToken: any) {
  const router = Router();

  // ── GET /api/connectors ──────────────────────────────────────────────────
  router.get('/', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { tenantId, id: userId } = (req as any).user;
      const connectors = await connectorRepository.listByUser(tenantId, userId);
      res.json(connectors.map(publicConnector));
    } catch (err) {
      console.error('GET connectors error:', err);
      res.status(500).json({ error: 'Failed to fetch connectors' });
    }
  });

  // ── GET /api/connectors/orphaned ─────────────────────────────────────────
  // Orphaned credentials are visible only to tenant administrators. They are
  // never included in the regular user-scoped connector list.
  router.get('/orphaned', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { tenantId, role } = (req as any).user;
      if (!['SUPER_ADMIN', 'ADMIN'].includes(role)) {
        return res.status(403).json({ error: 'Only tenant admins can view unassigned connectors' });
      }
      const connectors = await connectorRepository.listOrphaned(tenantId);
      res.json(connectors.map(publicConnector));
    } catch (err) {
      console.error('GET orphaned connectors error:', err);
      res.status(500).json({ error: 'Failed to fetch unassigned connectors' });
    }
  });

  // ── POST /api/connectors ─────────────────────────────────────────────────
  router.post('/', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { tenantId, id: userId, role } = (req as any).user;
      if (!CONNECTOR_ROLES.has(role)) {
        return res.status(403).json({ error: 'User is not allowed to create connectors' });
      }
      const { type, name, config } = req.body;
      if (!type || !name) {
        return res.status(400).json({ error: 'type and name are required' });
      }
      const validationError = validateConnectorInput(type, config ?? {});
      if (validationError) return res.status(400).json({ error: validationError });
      const connector = await connectorRepository.create(tenantId, userId, { type, name, config: config ?? {} });
      res.status(201).json(publicConnector(connector));
    } catch (err) {
      console.error('POST connector error:', err);
      res.status(500).json({ error: 'Failed to create connector' });
    }
  });

  // ── POST /api/connectors/:id/reassign-owner ──────────────────────────────
  router.post('/:id/reassign-owner', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { tenantId, id: actorId, role } = (req as any).user;
      if (!['SUPER_ADMIN', 'ADMIN'].includes(role)) {
        return res.status(403).json({ error: 'Only tenant admins can reassign connector owners' });
      }

      const ownerUserId = typeof req.body?.ownerUserId === 'string'
        ? req.body.ownerUserId.trim()
        : '';
      if (!ownerUserId) {
        return res.status(400).json({ error: 'ownerUserId is required' });
      }

      const reassigned = await connectorRepository.reassignOwner(
        tenantId,
        req.params.id as string,
        ownerUserId,
      );
      if (reassigned) {
        await auditRepository.log(tenantId, {
          actorId,
          action: 'CONNECTOR_OWNER_REASSIGNED',
          entityType: 'CONNECTOR',
          entityId: req.params.id as string,
          details: `Reassigned orphaned connector owner to active user ${ownerUserId}`,
          ipAddress: req.ip,
        });
        return res.json(publicConnector(reassigned));
      }

      const connector = await connectorRepository.findById(tenantId, req.params.id as string);
      if (!connector) return res.status(404).json({ error: 'Connector not found' });
      if (connector.ownerUserId) {
        return res.status(409).json({ error: 'Connector already has an owner' });
      }
      return res.status(400).json({ error: 'Target user must be active and belong to this tenant' });
    } catch (err) {
      console.error('POST connector owner reassignment error:', err);
      res.status(500).json({ error: 'Failed to reassign connector owner' });
    }
  });

  // ── PUT /api/connectors/:id ──────────────────────────────────────────────
  router.put('/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { tenantId, id: userId, role } = (req as any).user;
      if (!CONNECTOR_ROLES.has(role)) {
        return res.status(403).json({ error: 'User is not allowed to update connectors' });
      }
      const existing = await connectorRepository.findByUser(tenantId, userId, req.params.id as string);
      if (!existing) return res.status(404).json({ error: 'Connector not found' });
      if (req.body?.type && !CONNECTOR_TYPES.has(String(req.body.type))) {
        return res.status(400).json({ error: 'Loại connector không được hỗ trợ' });
      }
      if (req.body?.config !== undefined) {
        const validationError = validateConnectorInput(req.body.type || existing.type, req.body.config);
        if (validationError) return res.status(400).json({ error: validationError });
      }
      if (req.body?.status && !['ACTIVE', 'PAUSED', 'ERROR'].includes(String(req.body.status))) {
        return res.status(400).json({ error: 'Trạng thái connector không hợp lệ' });
      }
      const updated = await connectorRepository.update(tenantId, userId, req.params.id as string, req.body);
      res.json(publicConnector(updated));
    } catch (err) {
      console.error('PUT connector error:', err);
      res.status(500).json({ error: 'Failed to update connector' });
    }
  });

  // ── DELETE /api/connectors/:id ───────────────────────────────────────────
  router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { tenantId, id: userId, role } = (req as any).user;
      if (!CONNECTOR_ROLES.has(role)) {
        return res.status(403).json({ error: 'User is not allowed to delete connectors' });
      }
      const deleted = await connectorRepository.delete(tenantId, userId, req.params.id as string);
      if (!deleted) return res.status(404).json({ error: 'Connector not found' });
      res.json({ message: 'Connector deleted' });
    } catch (err) {
      console.error('DELETE connector error:', err);
      res.status(500).json({ error: 'Failed to delete connector' });
    }
  });

  // ── POST /api/connectors/:id/check ───────────────────────────────────────
  router.post('/:id/check', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { tenantId, id: userId, role } = (req as any).user;
      if (!CONNECTOR_ROLES.has(role)) {
        return res.status(403).json({ error: 'User is not allowed to check connectors' });
      }
      const connector = await connectorRepository.findByUser(tenantId, userId, req.params.id as string);
      if (!connector) return res.status(404).json({ error: 'Connector not found' });
      if (NON_SYNCABLE_CONNECTOR_TYPES.has(connector.type)) {
        return res.status(409).json({
          error: 'Loại kết nối này dùng để xác thực tài khoản API, chưa có sync adapter hoạt động.',
          code: 'CONNECTOR_SYNC_NOT_SUPPORTED',
        });
      }
      const validationError = validateConnectorInput(connector.type, connector.config);
      const checks = [
        { key: 'owner_scope', status: 'PASS', detail: 'Connector thuộc user đang đăng nhập trong tenant hiện tại.' },
        { key: 'required_config', status: validationError ? 'FAIL' : 'PASS', detail: validationError || 'Đủ trường cấu hình bắt buộc.' },
      ];
      return res.json({
        ok: !validationError,
        depth: 'CONFIGURATION',
        providerVerified: false,
        status: validationError ? 'INVALID_CONFIGURATION' : 'CONFIGURED',
        checks,
        message: validationError
          || 'Đã kiểm tra sâu cấu hình. Connector legacy chưa có provider adapter live nên không giả nhận là đã kết nối.',
      });
    } catch (err) {
      console.error('POST connector check error:', err);
      return res.status(500).json({ error: 'Failed to check connector' });
    }
  });

  // ── POST /api/connectors/:id/sync ────────────────────────────────────────
  router.post('/:id/sync', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { tenantId, id: userId } = (req as any).user;
      const connector = await connectorRepository.findByUser(tenantId, userId, req.params.id as string);
      if (!connector) return res.status(404).json({ error: 'Connector not found' });

      const job = await syncJobRepository.create(tenantId, userId, {
        connectorId: connector.id,
        status: 'QUEUED',
      });
      res.status(201).json(job);

      // Run sync asynchronously (fire-and-forget with DB status updates)
      setImmediate(async () => {
        try {
          await syncJobRepository.update(tenantId, userId, job.id, { status: 'RUNNING' });
          // Simulate processing: 50-200 records
          const records = Math.floor(Math.random() * 150) + 50;
          await new Promise(r => setTimeout(r, 800 + Math.random() * 1200));
          await syncJobRepository.update(tenantId, userId, job.id, {
            status: 'COMPLETED',
            recordsProcessed: records,
            finishedAt: new Date().toISOString(),
          });
          await connectorRepository.update(tenantId, userId, connector.id, {
            lastSyncAt: new Date().toISOString(),
            lastSyncStatus: 'COMPLETED',
          });
        } catch (e: any) {
          await syncJobRepository.update(tenantId, userId, job.id, {
            status: 'FAILED',
            finishedAt: new Date().toISOString(),
            errors: [e.message || 'Sync failed'],
          }).catch(() => {});
          await connectorRepository.update(tenantId, userId, connector.id, {
            lastSyncAt: new Date().toISOString(),
            lastSyncStatus: 'FAILED',
          }).catch(() => {});
        }
      });
    } catch (err) {
      console.error('POST sync error:', err);
      res.status(500).json({ error: 'Failed to start sync' });
    }
  });

  // ── GET /api/connectors/jobs ─────────────────────────────────────────────
  router.get('/jobs', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { tenantId, id: userId } = (req as any).user;
      const limit = Number(req.query.limit) || 50;
      const jobs = await syncJobRepository.listByUser(tenantId, userId, limit);
      res.json(jobs);
    } catch (err) {
      console.error('GET sync jobs error:', err);
      res.status(500).json({ error: 'Failed to fetch sync jobs' });
    }
  });

  // ── GET /api/connectors/jobs/:jobId ─────────────────────────────────────
  router.get('/jobs/:jobId', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { tenantId, id: userId } = (req as any).user;
      const job = await syncJobRepository.findByUser(tenantId, userId, req.params.jobId as string);
      if (!job) return res.status(404).json({ error: 'Job not found' });
      res.json(job);
    } catch (err) {
      console.error('GET sync job error:', err);
      res.status(500).json({ error: 'Failed to fetch sync job' });
    }
  });

  return router;
}
