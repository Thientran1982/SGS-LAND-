import { validateUUIDParam } from '../middleware/validation';
import { Router, Request, Response } from 'express';
import { routingRuleRepository, validateRuleInput } from '../repositories/routingRuleRepository';

const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD'];

export function createRoutingRuleRoutes(authenticateToken: any) {
  const router = Router();

  router.get('/', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const rules = await routingRuleRepository.findAllRules(user.tenantId);
      res.json(rules);
    } catch (error) {
      console.error('Error fetching routing rules:', error);
      res.status(500).json({ error: 'Không tải được luật phân bổ' });
    }
  });

  // Dry run with the exact matching used on lead creation.
  router.post('/simulate', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const b = req.body || {};
      const result = await routingRuleRepository.simulate(user.tenantId, {
        source: b.source ? String(b.source) : undefined,
        address: b.region ? String(b.region) : undefined,
        preferences: { budget: Number(b.budget) || 0 },
        tags: Array.isArray(b.tags) ? b.tags.map(String) : [],
      });
      res.json(result);
    } catch (error) {
      console.error('Error simulating routing rules:', error);
      res.status(500).json({ error: 'Không chạy được mô phỏng' });
    }
  });

  router.post('/', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!WRITE_ROLES.includes(user.role)) {
        return res.status(403).json({ error: 'Chỉ quản trị viên và trưởng nhóm được tạo luật phân bổ' });
      }
      const invalid = validateRuleInput(req.body || {});
      if (invalid) return res.status(400).json({ error: invalid });
      const { name, conditions, action, priority, isActive, enabled } = req.body;
      const rule = await routingRuleRepository.create(user.tenantId, {
        name, conditions, action, priority, isActive: isActive ?? enabled,
      });
      res.status(201).json(rule);
    } catch (error) {
      console.error('Error creating routing rule:', error);
      res.status(500).json({ error: 'Không lưu được luật phân bổ' });
    }
  });

  router.put('/:id', authenticateToken, validateUUIDParam(), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!WRITE_ROLES.includes(user.role)) {
        return res.status(403).json({ error: 'Chỉ quản trị viên và trưởng nhóm được sửa luật phân bổ' });
      }
      const invalid = validateRuleInput(req.body || {}, true);
      if (invalid) return res.status(400).json({ error: invalid });
      // Whitelist fields: the client may echo back id/tenantId/createdAt.
      const { name, conditions, action, priority, isActive, enabled } = req.body || {};
      const rule = await routingRuleRepository.update(user.tenantId, req.params.id as string, {
        name, conditions, action, priority, isActive: isActive ?? enabled,
      });
      if (!rule) return res.status(404).json({ error: 'Không tìm thấy luật phân bổ' });
      res.json(rule);
    } catch (error) {
      console.error('Error updating routing rule:', error);
      res.status(500).json({ error: 'Không lưu được luật phân bổ' });
    }
  });

  router.delete('/:id', authenticateToken, validateUUIDParam(), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!WRITE_ROLES.includes(user.role)) {
        return res.status(403).json({ error: 'Chỉ quản trị viên và trưởng nhóm được xóa luật phân bổ' });
      }
      const deleted = await routingRuleRepository.deleteById(user.tenantId, req.params.id as string);
      if (!deleted) return res.status(404).json({ error: 'Không tìm thấy luật phân bổ' });
      res.json({ message: 'Đã xóa luật phân bổ' });
    } catch (error) {
      console.error('Error deleting routing rule:', error);
      res.status(500).json({ error: 'Không xóa được luật phân bổ' });
    }
  });

  return router;
}
