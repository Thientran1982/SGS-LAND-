/**
 * buyerRoutes.ts (Task #52)
 *
 * Logged-in buyer endpoints. All routes require a buyer-scoped JWT
 * (`Authorization: Bearer <token>` issued by /api/buyer/auth/verify-otp).
 *
 *   GET    /api/buyer/favorites
 *   POST   /api/buyer/favorites           { listingId } | { listingIds: [] }
 *   DELETE /api/buyer/favorites/:listingId
 *   GET    /api/buyer/leads               (cross-tenant, looked up by phone)
 *   GET    /api/buyer/searches
 *   POST   /api/buyer/searches            { label, filters, notificationsEnabled? }
 *   PATCH  /api/buyer/searches/:id
 *   DELETE /api/buyer/searches/:id
 *
 * Saved searches piggy-back on `buyer_saved_searches` (Task #53). When the
 * user is logged in, rows get stamped with `buyer_user_id` so they sync
 * across devices; the legacy device-id keyed read path is unaffected.
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { logger } from '../middleware/logger';
import { authenticateBuyer } from '../middleware/buyerAuth';
import { buyerUserRepository } from '../repositories/buyerUserRepository';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_LABEL_LEN = 200;
const MAX_FILTER_KEYS = 32;
const MAX_BULK_FAVORITES = 200;

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

export function createBuyerRoutes(pool: Pool, jwtSecret: string): Router {
  const router = Router();
  const requireAuth = authenticateBuyer(jwtSecret);

  // ── Favorites ──────────────────────────────────────────────────────────────

  router.get('/api/buyer/favorites', requireAuth, async (req: Request, res: Response) => {
    try {
      const buyerId = (req as any).buyerUser.id as string;
      const favs = await buyerUserRepository.listFavorites(buyerId);
      res.json({
        favorites: favs.map((f) => ({
          listingId: f.listingId,
          createdAt: f.createdAt,
        })),
      });
    } catch (err: any) {
      logger.error('[buyer/favorites GET] ' + (err?.message || err));
      res.status(500).json({ error: 'Internal error' });
    }
  });

  router.post('/api/buyer/favorites', requireAuth, async (req: Request, res: Response) => {
    try {
      const buyerId = (req as any).buyerUser.id as string;
      const body = (req.body as any) || {};
      const ids: string[] = Array.isArray(body.listingIds)
        ? body.listingIds
        : body.listingId
          ? [body.listingId]
          : [];
      const valid = Array.from(
        new Set(ids.filter((x) => typeof x === 'string' && UUID_RE.test(x))),
      ).slice(0, MAX_BULK_FAVORITES);
      if (!valid.length) {
        return res.status(400).json({ error: 'listingId(s) không hợp lệ' });
      }
      await buyerUserRepository.addFavoritesBulk(buyerId, valid);
      const favs = await buyerUserRepository.listFavorites(buyerId);
      return res.json({
        ok: true,
        added: valid.length,
        favorites: favs.map((f) => ({ listingId: f.listingId, createdAt: f.createdAt })),
      });
    } catch (err: any) {
      logger.error('[buyer/favorites POST] ' + (err?.message || err));
      res.status(500).json({ error: 'Internal error' });
    }
  });

  router.delete('/api/buyer/favorites/:listingId', requireAuth, async (req: Request, res: Response) => {
    try {
      const buyerId = (req as any).buyerUser.id as string;
      const listingId = String(req.params.listingId || '').trim();
      if (!UUID_RE.test(listingId)) {
        return res.status(400).json({ error: 'listingId không hợp lệ' });
      }
      const removed = await buyerUserRepository.removeFavorite(buyerId, listingId);
      return res.json({ ok: true, removed });
    } catch (err: any) {
      logger.error('[buyer/favorites DELETE] ' + (err?.message || err));
      res.status(500).json({ error: 'Internal error' });
    }
  });

  // ── My leads (cross-tenant) ───────────────────────────────────────────────

  router.get('/api/buyer/leads', requireAuth, async (req: Request, res: Response) => {
    try {
      const phone = (req as any).buyerUser.phone as string;
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));
      const leads = await buyerUserRepository.listLeadsByPhone(phone, limit);
      res.json({ leads });
    } catch (err: any) {
      logger.error('[buyer/leads GET] ' + (err?.message || err));
      res.status(500).json({ error: 'Internal error' });
    }
  });

  // ── Saved searches (per-user) ─────────────────────────────────────────────

  router.get('/api/buyer/searches', requireAuth, async (req: Request, res: Response) => {
    try {
      const buyerId = (req as any).buyerUser.id as string;
      const r = await pool.query(
        `SELECT id, label, filters, notifications_enabled, last_notified_at, created_at, updated_at
           FROM buyer_saved_searches
          WHERE buyer_user_id = $1
          ORDER BY created_at DESC
          LIMIT 100`,
        [buyerId],
      );
      res.json({
        searches: r.rows.map((row: any) => ({
          id: row.id,
          label: row.label,
          filters: row.filters,
          notificationsEnabled: row.notifications_enabled,
          lastNotifiedAt: row.last_notified_at,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })),
      });
    } catch (err: any) {
      logger.error('[buyer/searches GET] ' + (err?.message || err));
      res.status(500).json({ error: 'Internal error' });
    }
  });

  router.post('/api/buyer/searches', requireAuth, async (req: Request, res: Response) => {
    try {
      const buyerId = (req as any).buyerUser.id as string;
      const { label, filters, notificationsEnabled, deviceId } = (req.body as any) || {};
      if (typeof label !== 'string' || !label.trim() || label.length > MAX_LABEL_LEN) {
        return res.status(400).json({ error: 'label bắt buộc (tối đa 200 ký tự)' });
      }
      // device_id is NOT NULL on the legacy table — fall back to a stable per-user
      // synthetic id when the client doesn't send one. Using "buyer:<uuid>" keeps
      // the value within the existing CHECK regex (alnum + . _ : -).
      const deviceKey =
        typeof deviceId === 'string' && /^[A-Za-z0-9._:\-]{8,128}$/.test(deviceId)
          ? deviceId
          : `buyer:${buyerId}`;
      const r = await pool.query(
        `INSERT INTO buyer_saved_searches
           (device_id, buyer_user_id, label, filters, notifications_enabled)
         VALUES ($1, $2, $3, $4::jsonb, $5)
         RETURNING id, label, filters, notifications_enabled, last_notified_at, created_at, updated_at`,
        [
          deviceKey,
          buyerId,
          label.trim(),
          JSON.stringify(sanitizeFilters(filters)),
          notificationsEnabled !== false,
        ],
      );
      const row = r.rows[0];
      res.status(201).json({
        search: {
          id: row.id,
          label: row.label,
          filters: row.filters,
          notificationsEnabled: row.notifications_enabled,
          lastNotifiedAt: row.last_notified_at,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        },
      });
    } catch (err: any) {
      logger.error('[buyer/searches POST] ' + (err?.message || err));
      res.status(500).json({ error: 'Internal error' });
    }
  });

  router.patch('/api/buyer/searches/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const buyerId = (req as any).buyerUser.id as string;
      const id = String(req.params.id || '').trim();
      if (!UUID_RE.test(id)) return res.status(400).json({ error: 'id không hợp lệ' });
      const { label, filters, notificationsEnabled } = (req.body as any) || {};

      const sets: string[] = ['updated_at = NOW()'];
      const vals: any[] = [];
      let i = 1;
      if (typeof label === 'string') {
        if (!label.trim() || label.length > MAX_LABEL_LEN) {
          return res.status(400).json({ error: 'label không hợp lệ' });
        }
        sets.push(`label = $${i++}`);
        vals.push(label.trim());
      }
      if (filters !== undefined) {
        sets.push(`filters = $${i++}::jsonb`);
        vals.push(JSON.stringify(sanitizeFilters(filters)));
      }
      if (typeof notificationsEnabled === 'boolean') {
        sets.push(`notifications_enabled = $${i++}`);
        vals.push(notificationsEnabled);
      }
      vals.push(id, buyerId);
      const r = await pool.query(
        `UPDATE buyer_saved_searches
            SET ${sets.join(', ')}
          WHERE id = $${i++} AND buyer_user_id = $${i}
        RETURNING id, label, filters, notifications_enabled, last_notified_at, created_at, updated_at`,
        vals,
      );
      const row = r.rows[0];
      if (!row) return res.status(404).json({ error: 'Không tìm thấy tìm kiếm' });
      res.json({
        search: {
          id: row.id,
          label: row.label,
          filters: row.filters,
          notificationsEnabled: row.notifications_enabled,
          lastNotifiedAt: row.last_notified_at,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        },
      });
    } catch (err: any) {
      logger.error('[buyer/searches PATCH] ' + (err?.message || err));
      res.status(500).json({ error: 'Internal error' });
    }
  });

  router.delete('/api/buyer/searches/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const buyerId = (req as any).buyerUser.id as string;
      const id = String(req.params.id || '').trim();
      if (!UUID_RE.test(id)) return res.status(400).json({ error: 'id không hợp lệ' });
      const r = await pool.query(
        `DELETE FROM buyer_saved_searches WHERE id = $1 AND buyer_user_id = $2`,
        [id, buyerId],
      );
      if (!r.rowCount) return res.status(404).json({ error: 'Không tìm thấy tìm kiếm' });
      res.json({ ok: true });
    } catch (err: any) {
      logger.error('[buyer/searches DELETE] ' + (err?.message || err));
      res.status(500).json({ error: 'Internal error' });
    }
  });

  return router;
}
