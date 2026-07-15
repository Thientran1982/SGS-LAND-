/**
 * Express router for the market-listings pipeline.
 * Mounted in server.ts as: app.use('/api/market', createMarketRoutes(authenticateToken))
 *
 * Endpoints:
 *   POST /webhook/:region      QStash webhook (signature-verified) -> ingest region
 *   POST /ingest               Manual ingest of listings in the request body (admin)
 *   POST /trigger/:region      Publish a one-off QStash job for a region (admin)
 *   POST /schedule             (Re)create staggered QStash schedules (admin)
 *   POST /sweep/:region        Mark stale listings inactive for a region (admin)
 *   GET  /regions              List configured regions
 *
 * The :region webhook uses express.raw so we can verify the QStash signature
 * against the exact raw body before parsing.
 */
import express, { type Request, type Response, type RequestHandler, Router } from 'express';
import { REGION_CODES, isRegionCode } from './config/regions';
import { verifyQstashSignature, publishRegionJob, scheduleAllRegions } from './scheduler/qstash';
import { collectPending } from './ingest/feedProvider';
import { ingestBatch } from './ingest/ingestService';
import { markStaleInactive } from './db/marketListingsRepo';
import { runMarketMigrations } from './db/migrate';
import type { RawListingInput } from './ingest/types';

export function createMarketRoutes(authenticateToken: RequestHandler): Router {
  const router = express.Router();

  // ---- QStash webhook: one path segment per region. Raw body for signature. --
  router.post(
    '/webhook/:region',
    express.raw({ type: '*/*', limit: '1mb' }),
    async (req: Request, res: Response) => {
      const region = String(req.params.region);
      if (!isRegionCode(region)) {
        return res.status(404).json({ error: 'unknown region' });
      }

      const rawBody = req.body instanceof Buffer ? req.body.toString('utf8') : '';
      const signature =
        (req.header('upstash-signature') || req.header('Upstash-Signature')) ?? undefined;
      const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

      const valid = await verifyQstashSignature(signature, rawBody, fullUrl);
      if (!valid) {
        console.warn(`[market] rejected unsigned/invalid webhook for ${region}`);
        return res.status(401).json({ error: 'invalid signature' });
      }

      try {
        const pending = await collectPending(region);
        const summary = await ingestBatch(pending);
        // Mark listings not seen in this sync as stale (older than ~1h).
        const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const deactivated = await markStaleInactive(region, cutoff);
        console.log(`[market] webhook ${region}:`, summary, { deactivated });
        return res.json({ ok: true, region, summary, deactivated });
      } catch (err) {
        console.error(`[market] webhook ${region} failed:`, err);
        return res.status(500).json({ error: 'ingest failed' });
      }
    },
  );

  // ---- Everything below requires an authenticated (admin) user. -------------
  router.use(authenticateToken);

  router.get('/regions', (_req, res) => {
    res.json({ regions: REGION_CODES });
  });

  // Manual direct ingest — body: { items: RawListingInput[] }
  router.post('/ingest', express.json({ limit: '5mb' }), async (req, res) => {
    const items = (req.body?.items ?? []) as RawListingInput[];
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'body.items must be a non-empty array' });
    }
    try {
      const summary = await ingestBatch(items);
      res.json({ ok: true, summary });
    } catch (err) {
      console.error('[market] manual ingest failed:', err);
      res.status(500).json({ error: 'ingest failed' });
    }
  });

  // Manually publish a one-off QStash job for one region (test end-to-end).
  router.post('/trigger/:region', express.json(), async (req, res) => {
    const region = String(req.params.region);
    if (!isRegionCode(region)) return res.status(404).json({ error: 'unknown region' });
    const delay = Number(req.body?.delaySeconds ?? 0) || 0;
    try {
      const messageId = await publishRegionJob(region, delay);
      res.json({ ok: true, region, messageId });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // (Re)create all staggered schedules.
  router.post('/schedule', async (_req, res) => {
    try {
      const scheduled = await scheduleAllRegions();
      res.json({ ok: true, scheduled });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Sweep: mark stale listings inactive for a region.
  router.post('/sweep/:region', express.json(), async (req, res) => {
    const region = String(req.params.region);
    if (!isRegionCode(region)) return res.status(404).json({ error: 'unknown region' });
    const hours = Number(req.body?.staleHours ?? 24) || 24;
    const cutoff = new Date(Date.now() - hours * 3600_000).toISOString();
    try {
      const deactivated = await markStaleInactive(region, cutoff);
      res.json({ ok: true, region, deactivated });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Run migrations on demand (admin).
  router.post('/migrate', async (_req, res) => {
    try {
      const applied = await runMarketMigrations();
      res.json({ ok: true, applied });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  return router;
}
