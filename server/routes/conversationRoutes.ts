/**
 * conversationRoutes.ts (Task #55) — buyer-side messaging REST.
 *
 *   GET  /api/buyer/conversations
 *   POST /api/buyer/conversations            { listingId } → get-or-create
 *   GET  /api/buyer/conversations/:id/messages?before=…
 *   POST /api/buyer/conversations/:id/messages   { body }
 *   POST /api/buyer/conversations/:id/read
 *
 * Realtime fan-out: every message append emits to the room
 *   `conv:<conversationId>`
 * which both buyers (joined via Bearer-auth socket) and agents (joined via
 * cookie-auth socket) subscribe to. Agent-side REST lives on the existing
 * web app and uses the same repository — buyers never write into agent
 * routes and vice versa.
 */

import { Router, Request, Response } from 'express';
import { Server as IOServer } from 'socket.io';
import { logger } from '../middleware/logger';
import { authenticateBuyer } from '../middleware/buyerAuth';
import { conversationRepository } from '../repositories/conversationRepository';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BODY = 4000;

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

  // ── List messages in a conversation ───────────────────────────────────────
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
      const limit = parseInt(String(req.query.limit || '50'), 10) || 50;
      const messages = await conversationRepository.listMessages(id, { before, limit });
      const nextCursor = messages.length === limit ? messages[messages.length - 1].createdAt : null;
      return res.json({ messages, nextCursor });
    } catch (err: any) {
      logger.error('[buyer/conversations/messages GET] ' + (err?.message || err));
      return res.status(500).json({ error: 'Internal error' });
    }
  });

  // ── Send a message ────────────────────────────────────────────────────────
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
      // Fan out to everyone in the conversation room (buyer's other devices
      // + the agent's web socket). Agent CRM listens to the same channel.
      io.to(`conv:${id}`).emit('conversation:message', {
        conversationId: id,
        message: result.message,
        conversation: result.conversation,
      });
      // Also notify the agent's per-user inbox channel so unread counts on
      // the agent's CRM list refresh without joining every conversation room.
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

  // ── Mark read ─────────────────────────────────────────────────────────────
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
