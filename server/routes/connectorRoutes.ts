import { Router, Request, Response } from 'express';
import { connectorRepository, syncJobRepository } from '../repositories/connectorRepository';

export function createConnectorRoutes(authenticateToken: any) {
  const router = Router();

  // ── GET /api/connectors ──────────────────────────────────────────────────
  router.get('/', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { tenantId } = (req as any).user;
      const connectors = await connectorRepository.listByTenant(tenantId);
      res.json(connectors);
    } catch (err) {
      console.error('GET connectors error:', err);
      res.status(500).json({ error: 'Failed to fetch connectors' });
    }
  });

  // ── POST /api/connectors ─────────────────────────────────────────────────
  router.post('/', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { tenantId, role } = (req as any).user;
      if (role !== 'ADMIN' && role !== 'TEAM_LEAD') {
        return res.status(403).json({ error: 'Only admins can create connectors' });
      }
      const { type, name, config } = req.body;
      if (!type || !name) {
        return res.status(400).json({ error: 'type and name are required' });
      }
      const connector = await connectorRepository.create(tenantId, { type, name, config: config ?? {} });
      res.status(201).json(connector);
    } catch (err) {
      console.error('POST connector error:', err);
      res.status(500).json({ error: 'Failed to create connector' });
    }
  });

  // ── PUT /api/connectors/:id ──────────────────────────────────────────────
  router.put('/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { tenantId, role } = (req as any).user;
      if (role !== 'ADMIN' && role !== 'TEAM_LEAD') {
        return res.status(403).json({ error: 'Only admins can update connectors' });
      }
      const updated = await connectorRepository.update(tenantId, req.params.id, req.body);
      if (!updated) return res.status(404).json({ error: 'Connector not found' });
      res.json(updated);
    } catch (err) {
      console.error('PUT connector error:', err);
      res.status(500).json({ error: 'Failed to update connector' });
    }
  });

  // ── DELETE /api/connectors/:id ───────────────────────────────────────────
  router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { tenantId, role } = (req as any).user;
      if (role !== 'ADMIN' && role !== 'TEAM_LEAD') {
        return res.status(403).json({ error: 'Only admins can delete connectors' });
      }
      const deleted = await connectorRepository.delete(tenantId, req.params.id);
      if (!deleted) return res.status(404).json({ error: 'Connector not found' });
      res.json({ message: 'Connector deleted' });
    } catch (err) {
      console.error('DELETE connector error:', err);
      res.status(500).json({ error: 'Failed to delete connector' });
    }
  });

  // ── POST /api/connectors/:id/sync ────────────────────────────────────────
  router.post('/:id/sync', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { tenantId } = (req as any).user;
      const connector = await connectorRepository.findById(tenantId, req.params.id);
      if (!connector) return res.status(404).json({ error: 'Connector not found' });

      const job = await syncJobRepository.create(tenantId, {
        connectorId: connector.id,
        status: 'QUEUED',
      });
      res.status(201).json(job);

      // Run sync asynchronously (fire-and-forget with DB status updates)
      setImmediate(async () => {
        try {
          await syncJobRepository.update(tenantId, job.id, { status: 'RUNNING' });
          // Simulate processing: 50-200 records
          const records = Math.floor(Math.random() * 150) + 50;
          await new Promise(r => setTimeout(r, 800 + Math.random() * 1200));
          await syncJobRepository.update(tenantId, job.id, {
            status: 'COMPLETED',
            recordsProcessed: records,
            finishedAt: new Date().toISOString(),
          });
          await connectorRepository.update(tenantId, connector.id, {
            lastSyncAt: new Date().toISOString(),
            lastSyncStatus: 'COMPLETED',
          });
        } catch (e: any) {
          await syncJobRepository.update(tenantId, job.id, {
            status: 'FAILED',
            finishedAt: new Date().toISOString(),
            errors: [e.message || 'Sync failed'],
          }).catch(() => {});
          await connectorRepository.update(tenantId, connector.id, {
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
      const { tenantId } = (req as any).user;
      const limit = Number(req.query.limit) || 50;
      const jobs = await syncJobRepository.listByTenant(tenantId, limit);
      res.json(jobs);
    } catch (err) {
      console.error('GET sync jobs error:', err);
      res.status(500).json({ error: 'Failed to fetch sync jobs' });
    }
  });

  // ── GET /api/connectors/jobs/:jobId ─────────────────────────────────────
  router.get('/jobs/:jobId', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { tenantId } = (req as any).user;
      const job = await syncJobRepository.findById(tenantId, req.params.jobId);
      if (!job) return res.status(404).json({ error: 'Job not found' });
      res.json(job);
    } catch (err) {
      console.error('GET sync job error:', err);
      res.status(500).json({ error: 'Failed to fetch sync job' });
    }
  });

  return router;
}
