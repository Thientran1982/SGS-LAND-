/**
 * conversationRoutes.ts (Task #55) — buyer + agent messaging REST.
 *
 * Buyer surface (Bearer JWT, `aud: 'buyer'`):
 *   GET  /api/buyer/conversations
 *   POST /api/buyer/conversations            { listingId } → get-or-create
 *   GET  /api/buyer/conversations/:id/messages?before=…
 *   POST /api/buyer/conversations/:id/messages   { body }
 *   POST /api/buyer/conversations/:id/read
 *
 * Agent surface (cookie JWT — same `authenticateToken` as the rest of the
 * web CRM):
 *   GET  /api/conversations
 *   GET  /api/conversations/:id/messages?before=…
 *   POST /api/conversations/:id/messages         { body }
 *   POST /api/conversations/:id/read
 *
 * Realtime fan-out: every message append emits to the room
 *   `conv:<conversationId>`
 * which both buyers (joined via Bearer-auth socket) and agents (joined via
 * cookie-auth socket) subscribe to.
 *
 * Push fan-out: when an AGENT writes, we enqueue an Expo push to every one
 * of the buyer's logged-in devices via `messagePushService`. Buyers writing
 * never push the agent (agents are on the web CRM).
 */

import { Router, Request, Response } from 'express';
import { Server as IOServer } from 'socket.io';
import { logger } from '../middleware/logger';
import { authenticateBuyer } from '../middleware/buyerAuth';
import { conversationRepository } from '../repositories/conversationRepository';
import { pushMessageToBuyer } from '../services/messagePushService';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BODY = 4000;

function parseLimit(raw: unknown): number {
  const n = parseInt(String(raw || '50'), 10);
  if (!Number.isFinite(n) || n <= 0) return 50;
  return Math.min(100, n);
}

export function createConversationRoutes(jwtSecret: string, io: IOServer): Router {
  const router = Router();
  const requireAuth = authenticateBuyer(jwtSecret);

  // ── List my conversations ─────────────────────────────────────────────────
  router.get('/api/buyer/conversations', requireAuth, async (req: Request, res: Response) => {
    try {
      const buyerId = (req as any).buyerUser.id as string;
      const list = await conversationRepository.listForBuyer(buyerId, 50);
      return res.json({ conversations: list });
    } catch (err: any) {
      logger.error('[buyer/conversations GET] ' + (err?.message || err));
      return res.status(500).json({ error: 'Internal error' });
    }
  });

  // ── Get-or-create from a listing ──────────────────────────────────────────
  router.post('/api/buyer/conversations', requireAuth, async (req: Request, res: Response) => {
    try {
      const buyerId = (req as any).buyerUser.id as string;
      const { listingId } = (req.body as any) || {};
      if (typeof listingId !== 'string' || !UUID_RE.test(listingId)) {
        return res.status(400).json({ error: 'listingId không hợp lệ' });
      }
      const routing = await conversationRepository.findListingRouting(listingId);
      if (!routing) {
        return res.status(404).json({ error: 'Không tìm thấy bất động sản' });
      }
      const conv = await conversationRepository.getOrCreateForListing({
        buyerUserId: buyerId,
        listingId: routing.listingId,
        tenantId: routing.tenantId,
        agentUserId: routing.agentUserId,
      });
      return res.json({ conversation: conv });
    } catch (err: any) {
      logger.error('[buyer/conversations POST] ' + (err?.message || err));
      return res.status(500).json({ error: 'Internal error' });
    }
  });

  // ── List messages in a conversation (buyer) ───────────────────────────────
  router.get('/api/buyer/conversations/:id/messages', requireAuth, async (req: Request, res: Response) => {
    try {
      const buyerId = (req as any).buyerUser.id as string;
      const id = String(req.params.id || '').trim();
      if (!UUID_RE.test(id)) return res.status(400).json({ error: 'id không hợp lệ' });
      const conv = await conversationRepository.findById(id);
      if (!conv || conv.buyerUserId !== buyerId) {
        return res.status(404).json({ error: 'Không tìm thấy hội thoại' });
      }
      const before = typeof req.query.before === 'string' ? req.query.before : undefined;
      const limit = parseLimit(req.query.limit);
      const messages = await conversationRepository.listMessages(id, { before, limit });
      const nextCursor = messages.length === limit ? messages[messages.length - 1].createdAt : null;
      return res.json({ messages, nextCursor });
    } catch (err: any) {
      logger.error('[buyer/conversations/messages GET] ' + (err?.message || err));
      return res.status(500).json({ error: 'Internal error' });
    }
  });

  // ── Buyer sends a message ─────────────────────────────────────────────────
  router.post('/api/buyer/conversations/:id/messages', requireAuth, async (req: Request, res: Response) => {
    try {
      const buyerId = (req as any).buyerUser.id as string;
      const id = String(req.params.id || '').trim();
      if (!UUID_RE.test(id)) return res.status(400).json({ error: 'id không hợp lệ' });
      const conv = await conversationRepository.findById(id);
      if (!conv || conv.buyerUserId !== buyerId) {
        return res.status(404).json({ error: 'Không tìm thấy hội thoại' });
      }
      const rawBody = (req.body as any)?.body;
      const body = typeof rawBody === 'string' ? rawBody.trim() : '';
      if (!body) return res.status(400).json({ error: 'Nội dung không được để trống' });
      if (body.length > MAX_BODY) {
        return res.status(400).json({ error: `Nội dung quá dài (tối đa ${MAX_BODY} ký tự)` });
      }
      const result = await conversationRepository.appendMessage({
        conversationId: id,
        senderKind: 'BUYER',
        senderUserId: buyerId,
        body,
      });
      io.to(`conv:${id}`).emit('conversation:message', {
        conversationId: id,
        message: result.message,
        conversation: result.conversation,
      });
      if (conv.agentUserId) {
        io.to(`user:${conv.agentUserId}`).emit('conversation:updated', {
          conversation: result.conversation,
        });
      }
      return res.json({ message: result.message, conversation: result.conversation });
    } catch (err: any) {
      logger.error('[buyer/conversations/messages POST] ' + (err?.message || err));
      return res.status(500).json({ error: 'Internal error' });
    }
  });

  // ── Buyer mark read ───────────────────────────────────────────────────────
  router.post('/api/buyer/conversations/:id/read', requireAuth, async (req: Request, res: Response) => {
    try {
      const buyerId = (req as any).buyerUser.id as string;
      const id = String(req.params.id || '').trim();
      if (!UUID_RE.test(id)) return res.status(400).json({ error: 'id không hợp lệ' });
      const conv = await conversationRepository.findById(id);
      if (!conv || conv.buyerUserId !== buyerId) {
        return res.status(404).json({ error: 'Không tìm thấy hội thoại' });
      }
      const updated = await conversationRepository.markRead({ conversationId: id, side: 'BUYER' });
      io.to(`conv:${id}`).emit('conversation:read', {
        conversationId: id,
        side: 'BUYER',
        conversation: updated,
      });
      return res.json({ conversation: updated });
    } catch (err: any) {
      logger.error('[buyer/conversations/read POST] ' + (err?.message || err));
      return res.status(500).json({ error: 'Internal error' });
    }
  });

  return router;
}

/**
 * Agent-side messaging routes — mounted at the root and protected by the
 * cookie-based `authenticateToken` middleware shared with the rest of the
 * CRM. Ownership is enforced per-request: the conversation must be owned by
 * the agent user (or be unassigned within their tenant).
 */
export function createAgentConversationRoutes(authenticateToken: any, io: IOServer): Router {
  const router = Router();

  function isOwner(conv: { agentUserId: string | null; tenantId: string }, user: any): boolean {
    if (!user) return false;
    // Direct assignment wins.
    if (conv.agentUserId && conv.agentUserId === user.id) return true;
    // Tenant-scoped access for unassigned threads (e.g. tenant admin handling
    // overflow). Cross-tenant access is never allowed.
    if (conv.tenantId && user.tenantId && conv.tenantId === user.tenantId) {
      // Admin-ish roles can pick up any thread in their tenant.
      const ROLES_ALLOWED = new Set([
        'SUPER_ADMIN',
        'TENANT_ADMIN',
        'PARTNER_ADMIN',
        'PARTNER_AGENT',
        'AGENT',
        'STAFF',
      ]);
      if (ROLES_ALLOWED.has(user.role)) return true;
    }
    return false;
  }

  // ── List conversations the agent owns ────────────────────────────────────
  router.get('/api/conversations', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });
      const list = await conversationRepository.listForAgent(user.id, 100);
      return res.json({ conversations: list });
    } catch (err: any) {
      logger.error('[agent/conversations GET] ' + (err?.message || err));
      return res.status(500).json({ error: 'Internal error' });
    }
  });

  // ── List messages ─────────────────────────────────────────────────────────
  router.get('/api/conversations/:id/messages', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const id = String(req.params.id || '').trim();
      if (!UUID_RE.test(id)) return res.status(400).json({ error: 'id không hợp lệ' });
      const conv = await conversationRepository.findById(id);
      if (!conv || !isOwner(conv, user)) {
        return res.status(404).json({ error: 'Không tìm thấy hội thoại' });
      }
      const before = typeof req.query.before === 'string' ? req.query.before : undefined;
      const limit = parseLimit(req.query.limit);
      const messages = await conversationRepository.listMessages(id, { before, limit });
      const nextCursor = messages.length === limit ? messages[messages.length - 1].createdAt : null;
      return res.json({ messages, nextCursor });
    } catch (err: any) {
      logger.error('[agent/conversations/messages GET] ' + (err?.message || err));
      return res.status(500).json({ error: 'Internal error' });
    }
  });

  // ── Agent sends a message ─────────────────────────────────────────────────
  router.post('/api/conversations/:id/messages', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const id = String(req.params.id || '').trim();
      if (!UUID_RE.test(id)) return res.status(400).json({ error: 'id không hợp lệ' });
      const conv = await conversationRepository.findById(id);
      if (!conv || !isOwner(conv, user)) {
        return res.status(404).json({ error: 'Không tìm thấy hội thoại' });
      }
      const rawBody = (req.body as any)?.body;
      const body = typeof rawBody === 'string' ? rawBody.trim() : '';
      if (!body) return res.status(400).json({ error: 'Nội dung không được để trống' });
      if (body.length > MAX_BODY) {
        return res.status(400).json({ error: `Nội dung quá dài (tối đa ${MAX_BODY} ký tự)` });
      }
      const result = await conversationRepository.appendMessage({
        conversationId: id,
        senderKind: 'AGENT',
        senderUserId: user.id,
        body,
      });
      io.to(`conv:${id}`).emit('conversation:message', {
        conversationId: id,
        message: result.message,
        conversation: result.conversation,
      });
      // Notify buyer's per-user inbox channel for live unread counters.
      if (conv.buyerUserId) {
        io.to(`buyer:${conv.buyerUserId}`).emit('conversation:updated', {
          conversation: result.conversation,
        });
      }
      // Push to all of the buyer's logged-in mobile devices. Best-effort —
      // never blocks or fails the response (handled inside the service).
      void pushMessageToBuyer({
        buyerUserId: conv.buyerUserId,
        conversationId: id,
        body,
        agentName: typeof user.name === 'string' ? user.name : null,
      });
      return res.json({ message: result.message, conversation: result.conversation });
    } catch (err: any) {
      logger.error('[agent/conversations/messages POST] ' + (err?.message || err));
      return res.status(500).json({ error: 'Internal error' });
    }
  });

  // ── Agent mark read ───────────────────────────────────────────────────────
  router.post('/api/conversations/:id/read', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const id = String(req.params.id || '').trim();
      if (!UUID_RE.test(id)) return res.status(400).json({ error: 'id không hợp lệ' });
      const conv = await conversationRepository.findById(id);
      if (!conv || !isOwner(conv, user)) {
        return res.status(404).json({ error: 'Không tìm thấy hội thoại' });
      }
      const updated = await conversationRepository.markRead({ conversationId: id, side: 'AGENT' });
      io.to(`conv:${id}`).emit('conversation:read', {
        conversationId: id,
        side: 'AGENT',
        conversation: updated,
      });
      return res.json({ conversation: updated });
    } catch (err: any) {
      logger.error('[agent/conversations/read POST] ' + (err?.message || err));
      return res.status(500).json({ error: 'Internal error' });
    }
  });

  return router;
}
