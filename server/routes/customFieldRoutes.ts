import { Router, Request, Response } from 'express';
import { customFieldRepository } from '../repositories/customFieldRepository';

const ENTITIES = ['listing', 'lead', 'project', 'contract'];
const FIELD_TYPES = ['text', 'number', 'date', 'select', 'boolean'];

function slugify(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || 'field';
}

export function createCustomFieldRoutes(authenticateToken: any) {
  const router = Router();

  router.get('/', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const entity = req.query.entity as string | undefined;
      const rows = await customFieldRepository.list(user.tenantId, entity);
      res.json(rows);
    } catch (error) {
      console.error('[custom-fields] list error:', error);
      res.status(500).json({ error: 'Failed to fetch custom fields' });
    }
  });

  router.post('/', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { label, entity, fieldType, required } = req.body || {};
      if (!label || typeof label !== 'string' || !label.trim()) {
        return res.status(400).json({ error: 'Tên trường là bắt buộc' });
      }
      if (!ENTITIES.includes(entity)) {
        return res.status(400).json({ error: 'Đối tượng không hợp lệ' });
      }
      if (!FIELD_TYPES.includes(fieldType)) {
        return res.status(400).json({ error: 'Kiểu dữ liệu không hợp lệ' });
      }
      const row = await customFieldRepository.create(user.tenantId, {
        label: label.trim(),
        fieldKey: slugify(label),
        entity,
        fieldType,
        required: Boolean(required),
      });
      res.status(201).json(row);
    } catch (error: any) {
      if (error?.code === '23505') {
        return res.status(409).json({ error: 'Trường này đã tồn tại cho đối tượng đã chọn' });
      }
      console.error('[custom-fields] create error:', error);
      res.status(500).json({ error: 'Failed to create custom field' });
    }
  });

  router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const ok = await customFieldRepository.deleteById(user.tenantId, String(req.params.id));
      if (!ok) return res.status(404).json({ error: 'Không tìm thấy trường' });
      res.json({ success: true });
    } catch (error) {
      console.error('[custom-fields] delete error:', error);
      res.status(500).json({ error: 'Failed to delete custom field' });
    }
  });

  return router;
}
