import { Router, Request, Response } from 'express';
import { unitRepository } from '../repositories/unitRepository';

const STATUSES = ['available', 'reserved', 'sold'];

export function createUnitRoutes(authenticateToken: any) {
  const router = Router();

  router.get('/', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const rows = await unitRepository.list(user.tenantId, {
        tower: req.query.tower as string | undefined,
        status: req.query.status as string | undefined,
      });
      res.json(rows);
    } catch (error) {
      console.error('[units] list error:', error);
      res.status(500).json({ error: 'Failed to fetch units' });
    }
  });

  router.post('/', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const b = req.body || {};
      if (!b.code || !b.tower || !b.bedroom) {
        return res.status(400).json({ error: 'Mã căn, tòa và loại phòng là bắt buộc' });
      }
      if (b.status && !STATUSES.includes(b.status)) {
        return res.status(400).json({ error: 'Trạng thái không hợp lệ' });
      }
      const row = await unitRepository.create(user.tenantId, {
        code: String(b.code),
        tower: String(b.tower),
        floor: Number(b.floor) || 0,
        bedroom: String(b.bedroom),
        areaSqm: Number(b.areaSqm) || 0,
        priceSqm: Number(b.priceSqm) || 0,
        status: b.status,
        projectId: b.projectId ?? null,
      });
      res.status(201).json(row);
    } catch (error: any) {
      if (error?.code === '23505') {
        return res.status(409).json({ error: 'Mã căn đã tồn tại' });
      }
      console.error('[units] create error:', error);
      res.status(500).json({ error: 'Failed to create unit' });
    }
  });

  router.put('/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const b = req.body || {};
      if (b.status && !STATUSES.includes(b.status)) {
        return res.status(400).json({ error: 'Trạng thái không hợp lệ' });
      }
      const row = await unitRepository.update(user.tenantId, String(req.params.id), b);
      if (!row) return res.status(404).json({ error: 'Không tìm thấy căn' });
      res.json(row);
    } catch (error) {
      console.error('[units] update error:', error);
      res.status(500).json({ error: 'Failed to update unit' });
    }
  });

  router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const ok = await unitRepository.deleteById(user.tenantId, String(req.params.id));
      if (!ok) return res.status(404).json({ error: 'Không tìm thấy căn' });
      res.json({ success: true });
    } catch (error) {
      console.error('[units] delete error:', error);
      res.status(500).json({ error: 'Failed to delete unit' });
    }
  });

  return router;
}
