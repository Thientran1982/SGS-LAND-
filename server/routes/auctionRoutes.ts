import { Router, Request, Response } from 'express';
import { auctionRepository } from '../repositories/auctionRepository';

const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD']);
const BID_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD', 'SALES', 'MARKETING']);

export function createAuctionRoutes(authenticateToken: any) {
  const router = Router();
  router.get('/', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      res.json(await auctionRepository.list(user.tenantId, {
        status: req.query.status as string,
        search: req.query.search as string,
      }));
    } catch (error) {
      console.error('[auction] list error:', error);
      res.status(500).json({ error: 'Không thể tải phiên đấu giá' });
    }
  });
  router.post('/', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!ADMIN_ROLES.has(user.role)) return res.status(403).json({ error: 'Không có quyền tạo phiên đấu giá' });
      const b = req.body || {};
      const startPrice = Number(b.startPrice);
      const stepPrice = Number(b.stepPrice);
      const startsAt = new Date(b.startsAt);
      const endsAt = new Date(b.endsAt);
      if (!b.listingId || !Number.isFinite(startPrice) || startPrice < 0 || !Number.isFinite(stepPrice) || stepPrice <= 0 ||
          isNaN(startsAt.getTime()) || isNaN(endsAt.getTime()) || endsAt <= startsAt) {
        return res.status(400).json({ error: 'Thông tin phiên đấu giá không hợp lệ' });
      }
      res.status(201).json(await auctionRepository.create(user.tenantId, {
        listingId: String(b.listingId), title: String(b.title || '').trim(),
        startPrice, stepPrice, startsAt, endsAt,
      }, user.id));
    } catch (error: any) {
      if (error.message === 'LISTING_NOT_FOUND') return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
      console.error('[auction] create error:', error);
      res.status(500).json({ error: 'Không thể tạo phiên đấu giá' });
    }
  });
  router.get('/:id/bids', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      res.json(await auctionRepository.bids(user.tenantId, String(req.params.id)));
    } catch {
      res.status(500).json({ error: 'Không thể tải lịch sử đặt giá' });
    }
  });
  router.patch('/:id/status', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!ADMIN_ROLES.has(user.role)) return res.status(403).json({ error: 'Không có quyền điều hành phiên đấu giá' });
      res.json(await auctionRepository.updateStatus(user.tenantId, String(req.params.id), String(req.body?.status || '').toUpperCase()));
    } catch (error: any) {
      if (error.message === 'INVALID_STATUS') return res.status(400).json({ error: 'Trạng thái không hợp lệ' });
      res.status(404).json({ error: 'Phiên không tồn tại hoặc đã kết thúc' });
    }
  });
  router.post('/:id/bids', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!BID_ROLES.has(user.role)) return res.status(403).json({ error: 'Tài khoản không được đặt giá' });
      const amount = Number(req.body?.amount);
      const key = String(req.body?.idempotencyKey || req.header('Idempotency-Key') || '').trim();
      if (!Number.isFinite(amount) || amount <= 0 || !key || key.length > 160) {
        return res.status(400).json({ error: 'Giá đặt hoặc mã yêu cầu không hợp lệ' });
      }
      res.status(201).json(await auctionRepository.placeBid(user.tenantId, String(req.params.id), user.id, amount, key));
    } catch (error: any) {
      const messages: Record<string, [number, string]> = {
        AUCTION_NOT_FOUND: [404, 'Không tìm thấy phiên đấu giá'],
        AUCTION_ENDED: [409, 'Phiên đấu giá đã kết thúc'],
        AUCTION_NOT_LIVE: [409, 'Phiên chưa mở hoặc đang tạm dừng'],
        BID_TOO_LOW: [409, `Giá đặt phải từ ${Number(error.minimum || 0).toLocaleString('vi-VN')} trở lên`],
      };
      const [status, message] = messages[error.message] || [500, 'Không thể ghi nhận lượt đặt giá'];
      res.status(status).json({ error: message });
    }
  });
  return router;
}