import { Router, Request, Response } from 'express';
import { unitRepository } from '../repositories/unitRepository';

const STATUSES = ['available', 'reserved', 'sold'];
const UNIT_WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD'];

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
      if (!UNIT_WRITE_ROLES.includes(user.role)) {
        return res.status(403).json({ error: 'Không có quyền tạo căn' });
      }
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
        projectId: b.projectId == null ? null : String(b.projectId),
      });
      res.status(201).json(row);
    } catch (error: any) {
      if (error?.code === 'PROJECT_TENANT_MISMATCH' || error?.code === '23503') {
        return res.status(400).json({ error: 'Dự án không thuộc tenant hiện tại' });
      }
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
      if (!UNIT_WRITE_ROLES.includes(user.role)) {
        return res.status(403).json({ error: 'Không có quyền sửa căn' });
      }
      const b = req.body || {};
      if (b.status && !STATUSES.includes(b.status)) {
        return res.status(400).json({ error: 'Trạng thái không hợp lệ' });
      }
      const row = await unitRepository.update(user.tenantId, String(req.params.id), {
        ...b,
        ...(b.projectId !== undefined && { projectId: b.projectId == null ? null : String(b.projectId) }),
      });
      if (!row) return res.status(404).json({ error: 'Không tìm thấy căn' });
      res.json(row);
    } catch (error: any) {
      if (error?.code === 'PROJECT_TENANT_MISMATCH' || error?.code === '23503') {
        return res.status(400).json({ error: 'Dự án không thuộc tenant hiện tại' });
      }
      console.error('[units] update error:', error);
      res.status(500).json({ error: 'Failed to update unit' });
    }
  });

  router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!UNIT_WRITE_ROLES.includes(user.role)) {
        return res.status(403).json({ error: 'Không có quyền xóa căn' });
      }
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
