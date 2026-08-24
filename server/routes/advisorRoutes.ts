/**
 * advisorRoutes.ts
 * API cho AI Property Advisor.
 * POST /api/advisor/recommend - nhan nhu cau nguoi dung, tra ve goi y du an.
 */
import { Router, Request, Response, RequestHandler } from 'express';
import { Pool } from 'pg';
import { logger } from '../middleware/logger';
import {
  generateAdvice,
  AdvisorInput,
  AdvisorPurpose,
  AdvisorRisk,
  AdvisorCashflow,
} from '../services/propertyAdvisorService';
import { agentMemoryService } from '../services/agentMemoryService';

const PURPOSES: AdvisorPurpose[] = ['o', 'dau_tu', 'cho_thue'];
const RISKS: AdvisorRisk[] = ['thap', 'trung_binh', 'cao'];
const CASHFLOWS: AdvisorCashflow[] = ['khong_quan_trong', 'on_dinh', 'toi_da'];

export function createAdvisorRoutes(
  pool: Pool,
  authenticateToken: RequestHandler,
  aiRateLimit?: RequestHandler,
): Router {
  const router = Router();
  const mw: RequestHandler[] = aiRateLimit
    ? [authenticateToken, aiRateLimit]
    : [authenticateToken];

  router.post('/recommend', ...mw, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const tenantId = user?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ ok: false, error: 'Khong xac dinh duoc tenant.' });
      }

      const b = req.body || {};
      const purpose: AdvisorPurpose = PURPOSES.includes(b.purpose) ? b.purpose : 'dau_tu';
      const risk: AdvisorRisk = RISKS.includes(b.risk) ? b.risk : 'trung_binh';
      const cashflow: AdvisorCashflow | undefined = CASHFLOWS.includes(b.cashflow)
        ? b.cashflow
        : undefined;

      const toNum = (x: any): number | undefined => {
        const n = Number(x);
        return Number.isFinite(n) && n > 0 ? n : undefined;
      };

      const input: AdvisorInput = {
        budgetMin: toNum(b.budgetMin),
        budgetMax: toNum(b.budgetMax),
        area: typeof b.area === 'string' ? b.area.slice(0, 200) : undefined,
        purpose,
        risk,
        cashflow,
        notes: typeof b.notes === 'string' ? b.notes.slice(0, 500) : undefined,
      };

      if (input.budgetMin && input.budgetMax && input.budgetMin > input.budgetMax) {
        return res.status(400).json({ ok: false, error: 'Ngan sach toi thieu khong duoc lon hon toi da.' });
      }

      const advice = await generateAdvice(pool, tenantId, input);
      return res.json({ ok: true, ...advice });
    } catch (err: any) {
      logger.error(`[AdvisorRoutes] ${err?.message || err}`);
      return res.status(500).json({
        ok: false,
        error: err?.message || 'AI tu van gap su co, vui long thu lai sau.',
      });
    }
  });

  // Called by the client only after a user explicitly chooses a recommendation.
  // The recommendation id is checked against the tenant's catalog before learning.
  router.post('/recommend/choice', ...mw, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const projectId = String(req.body?.projectId || '');
      if (!projectId) return res.status(400).json({ ok: false, error: 'projectId là bắt buộc' });
      const result = await pool.query(
        `SELECT id FROM projects WHERE id=$1 AND tenant_id=$2 AND status='ACTIVE' LIMIT 1`,
        [projectId, user.tenantId],
      );
      if (!result.rows[0]) return res.status(404).json({ ok: false, error: 'Dự án không tồn tại' });
      const signal = await agentMemoryService.recordSignal(user.tenantId, {
        signalType: 'match_chosen', actorId: user.id, subjectType: 'project', subjectId: projectId,
        dedupeKey: `match_chosen:advisor:${projectId}:${user.id}`,
        provenance: 'buyer',
        payload: {
          action: String(req.body?.action || 'choose_project').slice(0, 50),
          factors: req.body?.factors && typeof req.body.factors === 'object' ? req.body.factors : {},
          source: 'property_advisor',
        },
      });
      return res.status(201).json({ ok: true, signal });
    } catch (err: any) {
      logger.error(`[AdvisorRoutes] choice signal failed: ${err?.message || err}`);
      return res.status(500).json({ ok: false, error: 'Không ghi nhận được lựa chọn' });
    }
  });

  return router;
}
