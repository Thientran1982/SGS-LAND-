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

const DEFAULT_TENANT = process.env.DEFAULT_TENANT_ID || '00000000-0000-0000-0000-000000000001';

// GET / — danh sach phong cua tenant (+ so thanh vien, tin nhan cuoi)
chatRoomsRouter.get('/', apiRateLimit, async (req: Request, res: Response) => {
  try {
    const tenantId = String((req as any).user?.tenantId || DEFAULT_TENANT);
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
    const tenantId = String(user?.tenantId || DEFAULT_TENANT);
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
    const tenantId = String((req as any).user?.tenantId || DEFAULT_TENANT);
    const room = await pool.query(
      "SELECT id FROM chat_rooms WHERE tenant_id = $1 AND slug = $2",
      [tenantId, req.params.slug],
    );
    if (room.rowCount === 0) return res.status(404).json({ error: 'Phong khong ton tai' });
    const msgs = await pool.query(
      "SELECT id, sender_name, kind, content, created_at FROM chat_room_messages WHERE room_id = $1 ORDER BY created_at DESC LIMIT 100",
      [room.rows[0].id],
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
    const tenantId = String(user?.tenantId || DEFAULT_TENANT);
    const content = String((req.body || {}).content || '').trim();
    const kind = (req.body || {}).kind === 'AGENT' ? 'AGENT' : 'TEXT';
    if (!content) return res.status(400).json({ error: 'content la bat buoc' });
    const room = await pool.query(
      "SELECT id FROM chat_rooms WHERE tenant_id = $1 AND slug = $2 AND is_open = TRUE",
      [tenantId, req.params.slug],
    );
    if (room.rowCount === 0) return res.status(404).json({ error: 'Phong khong ton tai hoac da dong' });
    const ins = await pool.query(
      "INSERT INTO chat_room_messages (room_id, sender_id, sender_name, kind, content) VALUES ($1,$2,$3,$4,$5) RETURNING id, sender_name, kind, content, created_at",
      [room.rows[0].id, user?.id || null, user?.name || 'Khach', kind, content.slice(0, 4000)],
    );
    await pool.query("UPDATE chat_rooms SET last_activity_at = NOW() WHERE id = $1", [room.rows[0].id]);
    const io = (globalThis as any).__broadcastIo;
    if (io) io.to('room:' + req.params.slug).emit('room_message', ins.rows[0]);
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
    const tenantId = String(user?.tenantId || DEFAULT_TENANT);
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

// DELETE /:slug — dong/xoa phong (chi HOST)
chatRoomsRouter.delete('/:slug', apiRateLimit, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const tenantId = String(user?.tenantId || DEFAULT_TENANT);
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
