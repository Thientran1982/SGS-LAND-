/**
 * buyerPushRoutes.ts (Task #53)
 *
 * Public buyer-app endpoints for push notifications + saved searches:
 *   POST   /api/buyer/devices                — register/refresh device + token
 *   PATCH  /api/buyer/devices/:deviceId/preferences  — toggle push opt-in
 *   GET    /api/buyer/saved-searches?deviceId=…
 *   POST   /api/buyer/saved-searches
 *   PATCH  /api/buyer/saved-searches/:id
 *   DELETE /api/buyer/saved-searches/:id
 *
 * Plus an internal cron entry point:
 *   POST   /api/internal/buyer-push-cron     — header `x-internal-secret`
 *
 * No auth — buyer app is anonymous in this sprint, identified by a stable
 * device id from expo-device + AsyncStorage. Mutations always require the
 * `x-buyer-device-id` header to scope writes.
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { logger } from '../middleware/logger';
import { buyerPushRepository } from '../repositories/buyerPushRepository';
import {
  isValidExpoPushToken,
  tickBuyerPushNotifications,
} from '../services/pushNotificationService';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEVICE_ID_RE = /^[A-Za-z0-9._:\-]{8,128}$/;
const MAX_LABEL_LEN = 200;
const MAX_FILTER_KEYS = 32;

function getDeviceId(req: Request): string | null {
  const fromHeader = (req.headers['x-buyer-device-id'] as string | undefined)?.trim();
  const fromBody = typeof (req.body as any)?.deviceId === 'string' ? (req.body as any).deviceId.trim() : '';
  const fromQuery = typeof req.query.deviceId === 'string' ? (req.query.deviceId as string).trim() : '';
  const v = fromHeader || fromBody || fromQuery;
  if (!v || !DEVICE_ID_RE.test(v)) return null;
  return v;
}

/** Trim + sanitize a free-form filters object (depth-1 JSON) before persisting. */
function sanitizeFilters(input: any): Record<string, any> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const out: Record<string, any> = {};
  let count = 0;
  for (const [k, v] of Object.entries(input)) {
    if (count >= MAX_FILTER_KEYS) break;
    if (typeof k !== 'string' || k.length > 64) continue;
    if (v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      if (typeof v === 'string' && v.length > 200) continue;
      out[k] = v;
      count++;
    }
  }
  return out;
}

export function createBuyerPushRoutes(pool: Pool, cronSecret: string): Router {
  const router = Router();

  // ── Device registration ────────────────────────────────────────────────────

  router.post('/api/buyer/devices', async (req: Request, res: Response) => {
    try {
      const deviceId = getDeviceId(req);
      if (!deviceId) return res.status(400).json({ error: 'Invalid deviceId' });

      const { expoPushToken, platform, appVersion } = req.body || {};

      if (expoPushToken !== undefined && expoPushToken !== null && expoPushToken !== '') {
        if (typeof expoPushToken !== 'string' || !isValidExpoPushToken(expoPushToken)) {
          return res.status(400).json({ error: 'Invalid expoPushToken' });
        }
      }
      const platformVal =
        typeof platform === 'string' && /^(ios|android|web)$/i.test(platform)
          ? platform.toLowerCase()
          : null;
      const appVersionVal =
        typeof appVersion === 'string' && appVersion.length <= 32 ? appVersion : null;

      const device = await buyerPushRepository.upsertDevice({
        deviceId,
        expoPushToken: expoPushToken || null,
        platform: platformVal,
        appVersion: appVersionVal,
      });
      return res.json({ device });
    } catch (err: any) {
      logger.error('[buyer/devices POST] ' + (err?.message || err));
      return res.status(500).json({ error: 'Internal error' });
    }
  });

  router.patch('/api/buyer/devices/:deviceId/preferences', async (req: Request, res: Response) => {
    try {
      const pathDeviceId = String(req.params.deviceId || '').trim();
      if (!DEVICE_ID_RE.test(pathDeviceId)) return res.status(400).json({ error: 'Invalid deviceId' });

      // Mirror the rest of the buyer surface: require x-buyer-device-id and
      // verify it matches the path param so a stolen path can't be patched
      // from a different device session.
      const headerDeviceId = getDeviceId(req);
      if (!headerDeviceId || headerDeviceId !== pathDeviceId) {
        return res.status(403).json({ error: 'Device id mismatch' });
      }

      const { notificationsEnabled } = req.body || {};
      if (typeof notificationsEnabled !== 'boolean') {
        return res.status(400).json({ error: 'notificationsEnabled must be boolean' });
      }
      const device = await buyerPushRepository.setDevicePreference(pathDeviceId, notificationsEnabled);
      if (!device) return res.status(404).json({ error: 'Device not found' });
      return res.json({ device });
    } catch (err: any) {
      logger.error('[buyer/devices PATCH] ' + (err?.message || err));
      return res.status(500).json({ error: 'Internal error' });
    }
  });

  // ── Saved searches ─────────────────────────────────────────────────────────

  router.get('/api/buyer/saved-searches', async (req: Request, res: Response) => {
    try {
      const deviceId = getDeviceId(req);
      if (!deviceId) return res.status(400).json({ error: 'Invalid deviceId' });
      const searches = await buyerPushRepository.listSavedSearches(deviceId);
      return res.json({ searches });
    } catch (err: any) {
      logger.error('[buyer/saved-searches GET] ' + (err?.message || err));
      return res.status(500).json({ error: 'Internal error' });
    }
  });

  router.post('/api/buyer/saved-searches', async (req: Request, res: Response) => {
    try {
      const deviceId = getDeviceId(req);
      if (!deviceId) return res.status(400).json({ error: 'Invalid deviceId' });
      const { label, filters, notificationsEnabled } = req.body || {};
      if (typeof label !== 'string' || !label.trim() || label.length > MAX_LABEL_LEN) {
        return res.status(400).json({ error: 'label is required (max 200 chars)' });
      }
      // Make sure the device row exists so the saved search is "anchored"
      // (and so the cron can find a token to push to once the user opts in).
      await buyerPushRepository.upsertDevice({ deviceId });
      const search = await buyerPushRepository.createSavedSearch({
        deviceId,
        label: label.trim(),
        filters: sanitizeFilters(filters),
        notificationsEnabled: notificationsEnabled !== false,
      });
      return res.status(201).json({ search });
    } catch (err: any) {
      logger.error('[buyer/saved-searches POST] ' + (err?.message || err));
      return res.status(500).json({ error: 'Internal error' });
    }
  });

  router.patch('/api/buyer/saved-searches/:id', async (req: Request, res: Response) => {
    try {
      const deviceId = getDeviceId(req);
      if (!deviceId) return res.status(400).json({ error: 'Invalid deviceId' });
      const id = String(req.params.id || '').trim();
      if (!UUID_RE.test(id)) return res.status(400).json({ error: 'Invalid id' });
      const { label, filters, notificationsEnabled } = req.body || {};
      const patch: any = {};
      if (typeof label === 'string') {
        if (!label.trim() || label.length > MAX_LABEL_LEN) {
          return res.status(400).json({ error: 'label invalid' });
        }
        patch.label = label.trim();
      }
      if (filters !== undefined) patch.filters = sanitizeFilters(filters);
      if (typeof notificationsEnabled === 'boolean') patch.notificationsEnabled = notificationsEnabled;

      const search = await buyerPushRepository.updateSavedSearch(id, deviceId, patch);
      if (!search) return res.status(404).json({ error: 'Saved search not found' });
      return res.json({ search });
    } catch (err: any) {
      logger.error('[buyer/saved-searches PATCH] ' + (err?.message || err));
      return res.status(500).json({ error: 'Internal error' });
    }
  });

  router.delete('/api/buyer/saved-searches/:id', async (req: Request, res: Response) => {
    try {
      const deviceId = getDeviceId(req);
      if (!deviceId) return res.status(400).json({ error: 'Invalid deviceId' });
      const id = String(req.params.id || '').trim();
      if (!UUID_RE.test(id)) return res.status(400).json({ error: 'Invalid id' });
      const ok = await buyerPushRepository.deleteSavedSearch(id, deviceId);
      if (!ok) return res.status(404).json({ error: 'Saved search not found' });
      return res.json({ ok: true });
    } catch (err: any) {
      logger.error('[buyer/saved-searches DELETE] ' + (err?.message || err));
      return res.status(500).json({ error: 'Internal error' });
    }
  });

  // ── Cron entry (QStash / external scheduler) ───────────────────────────────

  router.post('/api/internal/buyer-push-cron', async (req: Request, res: Response) => {
    const provided =
      (req.headers['x-internal-secret'] as string | undefined) ||
      ((req.body as any)?.secret as string | undefined);
    if (!cronSecret || !provided || provided !== cronSecret) {
      logger.warn('[push] HTTP cron rejected — bad secret');
      return res.status(403).json({ error: 'Forbidden' });
    }
    try {
      const r = await tickBuyerPushNotifications(pool);
      logger.info(
        `[push] HTTP tick — searches=${r.searchesScanned} matches=${r.matchesFound} sent=${r.pushesSent} failed=${r.pushesFailed}`,
      );
      return res.json({ ok: true, ...r });
    } catch (err: any) {
      logger.error('[push] HTTP cron failed: ' + (err?.message || err));
      return res.status(500).json({ error: 'Internal error', detail: err?.message });
    }
  });

  return router;
}
