import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { processSocialPublicationTick } from '../services/socialPublishingWorker';

export function createSocialPublishingCronRouter(pool: Pool, cronSecret: string): Router {
  const router = Router();
  router.post('/api/internal/social-publishing-cron', async (req: Request, res: Response) => {
    const provided = (req.headers['x-internal-secret'] as string | undefined) || req.body?.secret;
    if (!cronSecret || !provided || provided !== cronSecret) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    try {
      return res.json({ ok: true, ...(await processSocialPublicationTick(pool)) });
    } catch {
      return res.status(500).json({ error: 'Internal error' });
    }
  });
  return router;
}