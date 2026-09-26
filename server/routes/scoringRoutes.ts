import { Router, Request, Response } from 'express';
import { scoringConfigRepository, DEFAULT_WEIGHTS, DEFAULT_THRESHOLDS } from '../repositories/scoringConfigRepository';
import { invalidateScoringConfig, rescoreTenantLeads } from '../services/leadScoringService';

export function createScoringRoutes(authenticateToken: any) {
  const router = Router();

  router.get('/config', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const config = await scoringConfigRepository.getByTenant(user.tenantId);
      if (!config) {
        return res.json({
          weights: DEFAULT_WEIGHTS,
          thresholds: DEFAULT_THRESHOLDS,
          version: 1,
        });
      }
      res.json({
        ...config,
        version: config.version ?? 1,
      });
    } catch (error) {
      console.error('Error fetching scoring config:', error);
      res.status(500).json({ error: 'Không tải được cấu hình điểm số' });
    }
  });

  router.put('/config', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD'].includes(user.role)) {
        return res.status(403).json({ error: 'Chỉ quản trị viên và trưởng nhóm được sửa cấu hình điểm số' });
      }
      const { weights, thresholds } = req.body;
      if (!weights || typeof weights !== 'object' || Array.isArray(weights)) {
        return res.status(400).json({ error: 'Thiếu trọng số chấm điểm' });
      }
      const values = Object.values(weights).map(Number);
      if (values.some(v => !Number.isFinite(v) || v < 0 || v > 100) || values.reduce((x, y) => x + y, 0) <= 0) {
        return res.status(400).json({ error: 'Trọng số phải từ 0 đến 100 và tổng lớn hơn 0' });
      }
      if (thresholds !== undefined) {
        const th = thresholds || {};
        const [A, B, C, D] = ['A', 'B', 'C', 'D'].map(k => Number(th[k]));
        if (![A, B, C, D].every(Number.isFinite) || !(A <= 100 && A > B && B > C && C > D && D >= 0)) {
          return res.status(400).json({ error: 'Ngưỡng hạng phải giảm dần từ A đến D trong khoảng 0–100' });
        }
      }
      const result = await scoringConfigRepository.upsert(user.tenantId, {
        weights,
        thresholds: thresholds ?? DEFAULT_THRESHOLDS,
      });
      invalidateScoringConfig(user.tenantId);
      res.json({
        ...result,
        version: result.version ?? 1,
      });
    } catch (error) {
      console.error('Error updating scoring config:', error);
      res.status(500).json({ error: 'Không lưu được cấu hình điểm số' });
    }
  });

  // Re-score every lead of the tenant with the saved configuration.
  router.post('/rescore', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD'].includes(user.role)) {
        return res.status(403).json({ error: 'Chỉ quản trị viên và trưởng nhóm được chấm lại điểm lead' });
      }
      const result = await rescoreTenantLeads(user.tenantId, req.body?.lang === 'en' ? 'en' : 'vn');
      res.json(result);
    } catch (error) {
      console.error('Error re-scoring leads:', error);
      res.status(500).json({ error: 'Không chấm lại được điểm lead' });
    }
  });

  return router;
}
