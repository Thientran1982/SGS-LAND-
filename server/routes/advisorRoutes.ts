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

  return router;
}
