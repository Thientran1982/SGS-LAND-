/**
 * Commission routes
 * - /api/projects/:id/commission-policies (CRUD admin tenant chủ)  [registered via projectRoutes]
 * - /api/commissions                       (list ledger, mark-paid, export)
 */

import { Router, Request, Response } from 'express';
import ExcelJS from 'exceljs';
import { commissionPolicyRepository, commissionLedgerRepository, type LedgerListFilters, type LedgerStatus, type PolicyType } from '../repositories/commissionRepository';
import { projectRepository } from '../repositories/projectRepository';
import { auditRepository } from '../repositories/auditRepository';
import { validatePolicyConfig } from '../services/commissionEngine';

const PARTNER_ROLES = ['PARTNER_ADMIN', 'PARTNER_AGENT'];
const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── Policy CRUD (mounted under /api/projects/:id) ──────────────────────────
export function registerCommissionPolicyRoutes(router: Router, authenticateToken: any) {
  // GET /api/projects/:id/commission-policies — list versions
  router.get('/:id/commission-policies', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const projectId = req.params.id as string;
      if (!UUID_RE.test(projectId)) return res.status(400).json({ error: 'project id không hợp lệ' });
      // Partners không xem policy (nội bộ tenant chủ)
      if (PARTNER_ROLES.includes(user.role)) return res.status(403).json({ error: 'Không có quyền xem chính sách hoa hồng' });
      // Đảm bảo project thuộc tenant
      const proj = await projectRepository.findById(user.tenantId, projectId);
      if (!proj) return res.status(404).json({ error: 'Không tìm thấy dự án' });
      const list = await commissionPolicyRepository.listByProject(user.tenantId, projectId);
      res.json({ data: list });
    } catch (e) {
      console.error('[commission policies] list error:', e);
      res.status(500).json({ error: 'Không thể tải chính sách hoa hồng' });
    }
  });

  // POST /api/projects/:id/commission-policies — tạo policy ACTIVE mới (đóng cũ)
  router.post('/:id/commission-policies', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!ADMIN_ROLES.includes(user.role)) return res.status(403).json({ error: 'Chỉ ADMIN tạo chính sách' });
      const projectId = req.params.id as string;
      if (!UUID_RE.test(projectId)) return res.status(400).json({ error: 'project id không hợp lệ' });
      const proj = await projectRepository.findById(user.tenantId, projectId);
      if (!proj) return res.status(404).json({ error: 'Không tìm thấy dự án' });

      const type = String(req.body?.type || '').toUpperCase() as PolicyType;
      const config = req.body?.config;
      if (!['FLAT', 'TIERED', 'MILESTONE'].includes(type)) {
        return res.status(400).json({ error: 'type phải là FLAT/TIERED/MILESTONE' });
      }
      const err = validatePolicyConfig(type, config);
      if (err) return res.status(400).json({ error: err });

      const created = await commissionPolicyRepository.createActive(user.tenantId, {
        projectId, type, config, createdBy: user.id,
      });

      await auditRepository.log(user.tenantId, {
        actorId: user.id,
        action: 'CREATE',
        entityType: 'COMMISSION_POLICY',
        entityId: created.id,
        details: `Tạo chính sách hoa hồng v${created.version} (${type}) cho dự án ${proj.code || proj.name}`,
        ipAddress: req.ip,
      });

      res.status(201).json(created);
    } catch (e: any) {
      console.error('[commission policies] create error:', e);
      res.status(500).json({ error: e?.message || 'Không thể tạo chính sách hoa hồng' });
    }
  });

  // POST /api/projects/:id/commission-policies/close — đóng policy ACTIVE
  router.post('/:id/commission-policies/close', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!ADMIN_ROLES.includes(user.role)) return res.status(403).json({ error: 'Chỉ ADMIN' });
      const projectId = req.params.id as string;
      if (!UUID_RE.test(projectId)) return res.status(400).json({ error: 'project id không hợp lệ' });
      const proj = await projectRepository.findById(user.tenantId, projectId);
      if (!proj) return res.status(404).json({ error: 'Không tìm thấy dự án' });
      const n = await commissionPolicyRepository.closeActive(user.tenantId, projectId);
      await auditRepository.log(user.tenantId, {
        actorId: user.id,
        action: 'UPDATE',
        entityType: 'COMMISSION_POLICY',
        entityId: projectId,
        details: `Đóng chính sách hoa hồng ACTIVE (${n} dòng) cho dự án ${proj.code || proj.name}`,
        ipAddress: req.ip,
      });
      res.json({ closed: n });
    } catch (e) {
      console.error('[commission policies] close error:', e);
      res.status(500).json({ error: 'Không thể đóng chính sách' });
    }
  });

  // GET /api/projects/:id/commission-summary — aggregate cho project tab
  router.get('/:id/commission-summary', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const projectId = req.params.id as string;
      if (!UUID_RE.test(projectId)) return res.status(400).json({ error: 'project id không hợp lệ' });
      // Partners không xem tổng hợp toàn dự án
      if (PARTNER_ROLES.includes(user.role)) return res.status(403).json({ error: 'Không có quyền' });
      const proj = await projectRepository.findById(user.tenantId, projectId);
      if (!proj) return res.status(404).json({ error: 'Không tìm thấy dự án' });
      const [agg, lb] = await Promise.all([
        commissionLedgerRepository.aggregateByProject(user.tenantId, projectId),
        commissionLedgerRepository.leaderboardThisMonth(user.tenantId, projectId, new Date().toISOString(), 5),
      ]);
      res.json({ ...agg, leaderboard: lb });
    } catch (e) {
      console.error('[commission summary] error:', e);
      res.status(500).json({ error: 'Không thể tải tổng hợp hoa hồng' });
    }
  });
}

// ─── Ledger routes (mounted at /api/commissions) ────────────────────────────
export function createCommissionRoutes(authenticateToken: any) {
  const router = Router();

  // GET /api/commissions
  router.get('/', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
      const pageSize = Math.max(1, Math.min(parseInt(String(req.query.pageSize || '20'), 10) || 20, 200));
      const filters: LedgerListFilters = {};
      if (req.query.projectId)       filters.projectId = String(req.query.projectId);
      if (req.query.partnerTenantId) filters.partnerTenantId = String(req.query.partnerTenantId);
      if (req.query.salesUserId)     filters.salesUserId = String(req.query.salesUserId);
      if (req.query.status)          filters.status = String(req.query.status).toUpperCase() as LedgerStatus;
      if (req.query.fromDate)        filters.fromDate = String(req.query.fromDate);
      if (req.query.toDate)          filters.toDate = String(req.query.toDate);

      const partnerScope = PARTNER_ROLES.includes(user.role) ? user.tenantId : null;
      const result = await commissionLedgerRepository.list(user.tenantId, { page, pageSize }, filters, partnerScope);
      res.json({ ...result, totalPages: Math.ceil(result.total / pageSize) });
    } catch (e) {
      console.error('[commissions] list error:', e);
      res.status(500).json({ error: 'Không thể tải hoa hồng' });
    }
  });

  // GET /api/commissions/export.xlsx
  router.get('/export.xlsx', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const filters: LedgerListFilters = {};
      if (req.query.projectId)       filters.projectId = String(req.query.projectId);
      if (req.query.partnerTenantId) filters.partnerTenantId = String(req.query.partnerTenantId);
      if (req.query.salesUserId)     filters.salesUserId = String(req.query.salesUserId);
      if (req.query.status)          filters.status = String(req.query.status).toUpperCase() as LedgerStatus;
      if (req.query.fromDate)        filters.fromDate = String(req.query.fromDate);
      if (req.query.toDate)          filters.toDate = String(req.query.toDate);

      const partnerScope = PARTNER_ROLES.includes(user.role) ? user.tenantId : null;

      // Chunk export — cap 5000 dòng tránh OOM
      const result = await commissionLedgerRepository.list(
        user.tenantId, { page: 1, pageSize: 5000 }, filters, partnerScope,
      );

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Hoa hồng');
      ws.addRow([
        'Mã SP', 'Tên SP', 'Dự án', 'Đại lý', 'Sales',
        'Ngày bán', 'Giá bán (VND)', '% HH', 'Hoa hồng (VND)', 'Trạng thái', 'Ngày trả', 'Ghi chú',
      ]);
      for (const r of result.data) {
        ws.addRow([
          r.listing_code || '',
          r.listing_title || '',
          r.project_name || '',
          r.partner_tenant_name || '(nội bộ)',
          r.sales_user_name || '',
          r.sale_date ? new Date(r.sale_date).toISOString().slice(0, 10) : '',
          Number(r.sale_price || 0),
          Number(r.rate_pct || 0),
          Number(r.gross_amount || 0),
          r.status,
          r.paid_at ? new Date(r.paid_at).toISOString().slice(0, 10) : '',
          r.paid_note || '',
        ]);
      }
      [16, 28, 22, 22, 18, 12, 18, 8, 18, 12, 12, 28].forEach((w, i) => { ws.getColumn(i + 1).width = w; });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="HoaHong_${new Date().toISOString().slice(0,10)}.xlsx"`);
      const buf = await wb.xlsx.writeBuffer();
      res.end(Buffer.from(buf));
    } catch (e) {
      console.error('[commissions] export error:', e);
      res.status(500).json({ error: 'Không thể xuất Excel' });
    }
  });

  // PATCH /api/commissions/:id/mark-paid
  router.patch('/:id/mark-paid', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const id = req.params.id as string;
      if (!UUID_RE.test(id)) return res.status(400).json({ error: 'id không hợp lệ' });
      // Chỉ ADMIN tenant chủ được mark-paid
      if (!ADMIN_ROLES.includes(user.role) && user.role !== 'TEAM_LEAD') {
        return res.status(403).json({ error: 'Không có quyền đánh dấu đã trả' });
      }
      const existing = await commissionLedgerRepository.findById(user.tenantId, id);
      if (!existing) return res.status(404).json({ error: 'Không tìm thấy bút toán' });
      if (existing.status === 'PAID') return res.json(existing);

      const note = typeof req.body?.note === 'string' ? String(req.body.note).slice(0, 500) : null;
      const updated = await commissionLedgerRepository.markPaid(user.tenantId, id, { paidNote: note, paidBy: user.id });
      if (!updated) return res.status(404).json({ error: 'Không thể cập nhật' });

      await auditRepository.log(user.tenantId, {
        actorId: user.id,
        action: 'UPDATE',
        entityType: 'COMMISSION_LEDGER',
        entityId: id,
        details: `Đánh dấu đã trả ${Number(updated.gross_amount).toLocaleString('vi-VN')} VND${note ? ` — ${note}` : ''}`,
        ipAddress: req.ip,
      });

      res.json(updated);
    } catch (e) {
      console.error('[commissions] mark-paid error:', e);
      res.status(500).json({ error: 'Không thể đánh dấu đã trả' });
    }
  });

  // POST /api/commissions/mark-paid-bulk { ids: string[], note?: string }
  router.post('/mark-paid-bulk', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!ADMIN_ROLES.includes(user.role) && user.role !== 'TEAM_LEAD') {
        return res.status(403).json({ error: 'Không có quyền đánh dấu đã trả' });
      }
      const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((x: any) => typeof x === 'string' && UUID_RE.test(x)) : [];
      if (ids.length === 0) return res.status(400).json({ error: 'ids rỗng hoặc không hợp lệ' });
      if (ids.length > 500) return res.status(400).json({ error: 'Tối đa 500 bút toán mỗi lần' });
      const note = typeof req.body?.note === 'string' ? String(req.body.note).slice(0, 500) : null;

      const updated = await commissionLedgerRepository.markManyPaid(user.tenantId, ids, { paidNote: note, paidBy: user.id });

      // Ghi audit log gộp 1 dòng để khỏi spam audit
      await auditRepository.log(user.tenantId, {
        actorId: user.id,
        action: 'UPDATE',
        entityType: 'COMMISSION_LEDGER',
        entityId: updated.map(r => r.id).join(',').slice(0, 250) || 'BULK',
        details: `Đánh dấu đã trả ${updated.length}/${ids.length} bút toán${note ? ` — ${note}` : ''}`,
        ipAddress: req.ip,
      });

      res.json({ updated: updated.length, requested: ids.length, ids: updated.map(r => r.id) });
    } catch (e) {
      console.error('[commissions] mark-paid-bulk error:', e);
      res.status(500).json({ error: 'Không thể đánh dấu đã trả hàng loạt' });
    }
  });

  return router;
}
