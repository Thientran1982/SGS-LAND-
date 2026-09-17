/**
 * chatRoomsRoutes.ts — P2 #10: Multi-agent rooms.
 * Phong chat nhom moi gioi + khach: CRUD phong, thanh vien, tin nhan.
 * Realtime: socket event 'room_message' phat qua broadcastIo.
 */
import { Router, type Request, type Response } from 'express';
import { pool } from '../db';
import { logger } from '../middleware/logger';
import { apiRateLimit } from '../middleware/rateLimiter';

export const chatRoomsRouter = Router();

export const chatRoomSocketName = (roomId: string): string => `chat-room:${roomId}`;
export const chatRoomMembershipRevokedEvent = 'chat_room_membership_revoked' as const;

type ChatRoomSocketLike = {
  data?: {
    authUser?: {
      id?: unknown;
      tenantId?: unknown;
    } | null;
  };
  join: (room: string) => void | Promise<void>;
};

type ChatRoomAuthUser = {
  id?: unknown;
  tenantId?: unknown;
} | null | undefined;

type ChatRoomRemoteSocketLike = {
  data?: {
    authUser?: ChatRoomAuthUser;
  };
  leave: (room: string) => void | Promise<void>;
  emit: (event: string, message: unknown) => void;
};

type ChatRoomIoLike = {
  in: (room: string) => {
    fetchSockets: () => Promise<ChatRoomRemoteSocketLike[]>;
  };
  serverSideEmit?: (event: string, payload: unknown) => boolean | void | Promise<void>;
};

export type ChatRoomMembershipRevocation = {
  tenantId: string;
  roomId: string;
  userId: string;
};

function authenticatedTenant(req: Request, res: Response): string | null {
  const tenantId = String((req as any).user?.tenantId || '').trim();
  if (!tenantId) {
    res.status(403).json({ error: 'Khong xac dinh duoc tenant cua nguoi dung' });
    return null;
  }
  return tenantId;
}

export async function findChatRoomForMember(
  tenantId: string,
  slug: string,
  userId: string,
  openOnly = false,
): Promise<string | null> {
  const openClause = openOnly ? " AND r.is_open = TRUE" : "";
  const room = await pool.query(
    "SELECT r.id FROM chat_rooms r JOIN chat_room_members m ON m.room_id = r.id AND m.user_id = $3 WHERE r.tenant_id = $1 AND r.slug = $2" + openClause,
    [tenantId, slug, userId],
  );
  return room.rowCount ? String(room.rows[0].id) : null;
}

/**
 * Authorize a Socket.IO chat-room join from the authenticated socket identity.
 * The socket never receives a slug-only room name: the database-resolved room
 * id keeps identical slugs in different tenants on separate realtime channels.
 */
export async function joinChatRoomSocket(
  socket: ChatRoomSocketLike,
  slug: unknown,
): Promise<boolean> {
  const user = socket.data?.authUser;
  const tenantId = String(user?.tenantId || '').trim();
  const userId = String(user?.id || '').trim();
  const roomSlug = typeof slug === 'string' ? slug.trim() : '';
  if (
    !tenantId
    || !userId
    || !/^[a-z0-9-]{3,64}$/.test(roomSlug)
  ) {
    return false;
  }

  const roomId = await findChatRoomForMember(tenantId, roomSlug, userId);
  if (!roomId) return false;
  await socket.join(chatRoomSocketName(roomId));
  return true;
}

async function isCurrentChatRoomMember(
  roomId: string,
  user: ChatRoomAuthUser,
): Promise<boolean> {
  const tenantId = String(user?.tenantId || '').trim();
  const userId = String(user?.id || '').trim();
  if (!tenantId || !userId) return false;

  const membership = await pool.query(
    "SELECT 1 FROM chat_rooms r JOIN chat_room_members m ON m.room_id = r.id AND m.user_id = $2 WHERE r.id = $1 AND r.tenant_id = $3 LIMIT 1",
    [roomId, userId, tenantId],
  );
  return (membership.rowCount ?? 0) > 0;
}

/**
 * Emit only to sockets whose membership is still current.
 *
 * A Socket.IO room is only a transport subscription; deleting a membership
 * row does not automatically remove an already-connected socket. Re-check
 * the tenant and membership immediately before every room broadcast, leaving
 * stale sockets behind so later messages cannot reach them either.
 */
export async function broadcastChatRoomMessage(
  io: ChatRoomIoLike,
  roomId: string,
  message: unknown,
): Promise<void> {
  const roomName = chatRoomSocketName(roomId);
  let sockets: ChatRoomRemoteSocketLike[];
  try {
    sockets = await io.in(roomName).fetchSockets();
  } catch (err: any) {
    logger.warn(`[Rooms] realtime broadcast skipped: ${err?.message || err}`);
    return;
  }

  for (const socket of sockets) {
    let allowed = false;
    try {
      allowed = await isCurrentChatRoomMember(roomId, socket.data?.authUser);
    } catch (err: any) {
      logger.warn(`[Rooms] realtime membership check failed: ${err?.message || err}`);
    }
    if (!allowed) {
      try {
        await socket.leave(roomName);
      } catch (err: any) {
        logger.warn(`[Rooms] stale socket leave failed: ${err?.message || err}`);
      }
      continue;
    }
    socket.emit('room_message', message);
  }
}

function isChatRoomMembershipRevocation(value: unknown): value is ChatRoomMembershipRevocation {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Record<string, unknown>;
  return [payload.tenantId, payload.roomId, payload.userId]
    .every(item => typeof item === 'string' && item.trim().length > 0);
}

/**
 * Remove sockets for a member after the membership row has been deleted.
 *
 * The Socket.IO adapter may return sockets from other backend processes. A
 * missing socket is expected when a client disconnected during revocation.
 * Neither that case nor an adapter/leave failure should undo the database
 * deletion; the next broadcast still performs the authoritative membership
 * check.
 */
export async function disconnectRevokedChatRoomSockets(
  io: ChatRoomIoLike,
  payload: unknown,
): Promise<void> {
  if (!isChatRoomMembershipRevocation(payload)) return;
  const roomName = chatRoomSocketName(payload.roomId);

  let sockets: ChatRoomRemoteSocketLike[] = [];
  try {
    sockets = await io.in(roomName).fetchSockets();
  } catch (err: any) {
    logger.warn(`[Rooms] membership revocation socket lookup skipped: ${err?.message || err}`);
    return;
  }

  for (const socket of sockets) {
    const user = socket.data?.authUser;
    const tenantId = String(user?.tenantId || '').trim();
    const userId = String(user?.id || '').trim();
    if (tenantId !== payload.tenantId || userId !== payload.userId) continue;

    try {
      await socket.leave(roomName);
    } catch (err: any) {
      logger.warn(`[Rooms] revoked socket leave failed: ${err?.message || err}`);
    }
  }
}

// GET / — danh sach phong cua tenant (+ so thanh vien, tin nhan cuoi)
chatRoomsRouter.get('/', apiRateLimit, async (req: Request, res: Response) => {
  try {
    const tenantId = authenticatedTenant(req, res);
    if (!tenantId) return;
    const r = await pool.query(
      "SELECT r.id, r.name, r.slug, r.topic, r.is_open, r.max_members, r.last_activity_at, r.created_at," +
      " (SELECT COUNT(*)::int FROM chat_room_members m WHERE m.room_id = r.id) AS member_count," +
      " (SELECT COUNT(*)::int FROM chat_room_messages g WHERE g.room_id = r.id) AS message_count" +
      " FROM chat_rooms r WHERE r.tenant_id = $1 ORDER BY r.last_activity_at DESC",
      [tenantId],
    );
    res.json({ rooms: r.rows });
  } catch (err: any) {
    logger.warn('[Rooms] list failed: ' + (err?.message || err));
    res.status(500).json({ error: 'Khong tai duoc danh sach phong' });
  }
});

// POST / — tao phong (nguoi tao tu dong la HOST)
chatRoomsRouter.post('/', apiRateLimit, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const tenantId = authenticatedTenant(req, res);
    if (!tenantId) return;
    if (!user?.id) return res.status(401).json({ error: 'Can dang nhap' });
    const { name, slug, topic, max_members } = req.body || {};
    if (!name || !slug) return res.status(400).json({ error: 'name va slug la bat buoc' });
    if (!/^[a-z0-9-]{3,64}$/.test(String(slug))) {
      return res.status(400).json({ error: 'slug chi gom a-z 0-9 va dau gach (3-64)' });
    }
    const r = await pool.query(
      "INSERT INTO chat_rooms (tenant_id, name, slug, topic, created_by, max_members) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, name, slug, is_open, created_at",
      [tenantId, name, slug, topic || null, user?.id || null, Math.min(50, Math.max(2, Number(max_members) || 20))],
    );
    const room = r.rows[0];
    if (user?.id) {
      await pool.query(
        "INSERT INTO chat_room_members (room_id, user_id, role) VALUES ($1,$2,'HOST') ON CONFLICT DO NOTHING",
        [room.id, user.id],
      );
    }
    res.status(201).json({ room });
  } catch (err: any) {
    if (/duplicate key|unique constraint/i.test(err?.message || '')) {
      return res.status(409).json({ error: 'Slug phong da ton tai' });
    }
    logger.warn('[Rooms] create failed: ' + (err?.message || err));
    res.status(500).json({ error: 'Tao phong that bai' });
  }
});

// GET /:slug/messages — 100 tin nhan gan nhat cua phong
chatRoomsRouter.get('/:slug/messages', apiRateLimit, async (req: Request, res: Response) => {
  try {
    const tenantId = authenticatedTenant(req, res);
    if (!tenantId) return;
    const userId = String((req as any).user?.id || '').trim();
    if (!userId) return res.status(401).json({ error: 'Can dang nhap' });
    const roomId = await findChatRoomForMember(tenantId, String(req.params.slug), userId, true);
    if (!roomId) return res.status(404).json({ error: 'Phong khong ton tai' });
    const msgs = await pool.query(
      "SELECT id, sender_name, kind, content, created_at FROM chat_room_messages WHERE room_id = $1 ORDER BY created_at DESC LIMIT 100",
      [roomId],
    );
    res.json({ messages: msgs.rows.reverse() });
  } catch (err: any) {
    logger.warn('[Rooms] messages failed: ' + (err?.message || err));
    res.status(500).json({ error: 'Khong tai duoc tin nhan' });
  }
});

// POST /:slug/messages — gui tin (phat socket room_message neu co broadcastIo)
chatRoomsRouter.post('/:slug/messages', apiRateLimit, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const tenantId = authenticatedTenant(req, res);
    if (!tenantId) return;
    const userId = String(user?.id || '').trim();
    if (!userId) return res.status(401).json({ error: 'Can dang nhap' });
    const content = String((req.body || {}).content || '').trim();
    const kind = (req.body || {}).kind === 'AGENT' ? 'AGENT' : 'TEXT';
    if (!content) return res.status(400).json({ error: 'content la bat buoc' });
    const roomId = await findChatRoomForMember(tenantId, String(req.params.slug), userId);
    if (!roomId) return res.status(404).json({ error: 'Phong khong ton tai hoac da dong' });
    const ins = await pool.query(
      "INSERT INTO chat_room_messages (room_id, sender_id, sender_name, kind, content) VALUES ($1,$2,$3,$4,$5) RETURNING id, sender_name, kind, content, created_at",
      [roomId, user?.id || null, user?.name || 'Khach', kind, content.slice(0, 4000)],
    );
    await pool.query("UPDATE chat_rooms SET last_activity_at = NOW() WHERE id = $1", [roomId]);
    const io = (globalThis as any).__broadcastIo;
    if (io) await broadcastChatRoomMessage(io, roomId, ins.rows[0]);
    res.status(201).json({ message: ins.rows[0] });
  } catch (err: any) {
    logger.warn('[Rooms] send failed: ' + (err?.message || err));
    res.status(500).json({ error: 'Gui tin that bai' });
  }
});

// POST /:slug/join — vao phong
chatRoomsRouter.post('/:slug/join', apiRateLimit, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const tenantId = authenticatedTenant(req, res);
    if (!tenantId) return;
    const room = await pool.query(
      "SELECT id, max_members FROM chat_rooms WHERE tenant_id = $1 AND slug = $2 AND is_open = TRUE",
      [tenantId, req.params.slug],
    );
    if (room.rowCount === 0) return res.status(404).json({ error: 'Phong khong ton tai hoac da dong' });
    if (!user?.id) return res.status(401).json({ error: 'Can dang nhap' });
    const cnt = await pool.query("SELECT COUNT(*)::int AS n FROM chat_room_members WHERE room_id = $1", [room.rows[0].id]);
    if ((cnt.rows[0].n) >= (room.rows[0].max_members || 20)) {
      return res.status(423).json({ error: 'Phong da du thanh vien' });
    }
    await pool.query(
      "INSERT INTO chat_room_members (room_id, user_id, role) VALUES ($1,$2,'MEMBER') ON CONFLICT DO NOTHING",
      [room.rows[0].id, user.id],
    );
    res.json({ joined: req.params.slug });
  } catch (err: any) {
    logger.warn('[Rooms] join failed: ' + (err?.message || err));
    res.status(500).json({ error: 'Vao phong that bai' });
  }
});

// DELETE /:slug/members/:userId — thu hoi thanh vien (HOST hoac ADMIN)
chatRoomsRouter.delete('/:slug/members/:userId', apiRateLimit, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const tenantId = authenticatedTenant(req, res);
    if (!tenantId) return;
    const actorId = String(user?.id || '').trim();
    const memberId = String(req.params.userId || '').trim();
    if (!actorId) return res.status(401).json({ error: 'Can dang nhap' });
    if (!memberId) return res.status(400).json({ error: 'userId la bat buoc' });

    const isTenantAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
    const revoked = await pool.query(
      "DELETE FROM chat_room_members m USING chat_rooms r " +
      "WHERE r.id = m.room_id AND r.tenant_id = $1 AND r.slug = $2 " +
      "AND m.user_id = $4 AND m.role = 'MEMBER' " +
      "AND (r.created_by = $3 OR $5 = TRUE) " +
      "RETURNING r.id AS room_id, m.user_id",
      [tenantId, req.params.slug, actorId, memberId, isTenantAdmin],
    );
    if (revoked.rowCount === 0) {
      return res.status(404).json({ error: 'Phong khong ton tai, thanh vien khong ton tai hoac ban khong co quyen' });
    }

    const payload: ChatRoomMembershipRevocation = {
      tenantId,
      roomId: String(revoked.rows[0].room_id),
      userId: String(revoked.rows[0].user_id),
    };
    const io = (globalThis as any).__broadcastIo as ChatRoomIoLike | undefined;
    if (io) {
      // Handle this process immediately. Other Socket.IO processes receive the
      // same non-sensitive signal through serverSideEmit.
      await disconnectRevokedChatRoomSockets(io, payload);
      try {
        await io.serverSideEmit?.(chatRoomMembershipRevokedEvent, payload);
      } catch (err: any) {
        logger.warn(`[Rooms] membership revocation signal skipped: ${err?.message || err}`);
      }
    }

    res.json({ revoked: payload.userId });
  } catch (err: any) {
    logger.warn('[Rooms] member revoke failed: ' + (err?.message || err));
    res.status(500).json({ error: 'Thu hoi thanh vien that bai' });
  }
});

// DELETE /:slug — dong/xoa phong (chi HOST)
chatRoomsRouter.delete('/:slug', apiRateLimit, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const tenantId = authenticatedTenant(req, res);
    if (!tenantId) return;
    const r = await pool.query(
      "DELETE FROM chat_rooms WHERE tenant_id = $1 AND slug = $2 AND created_by = $3 RETURNING slug",
      [tenantId, req.params.slug, user?.id],
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'Phong khong ton tai hoac ban khong phai chu phong' });
    res.json({ deleted: r.rows[0].slug });
  } catch (err: any) {
    logger.warn('[Rooms] delete failed: ' + (err?.message || err));
    res.status(500).json({ error: 'Xoa phong that bai' });
  }
});
