import { Router, Request, Response } from 'express';
import { projectRepository } from '../repositories/projectRepository';
import { projectPriceMatrixRepository } from '../repositories/projectPriceMatrixRepository';
import { evictPublicProjectCache } from '../services/publicProjectCache';
import { registerFloorPlanRoutes } from './projectFloorPlanRoutes';

const PARTNER_ROLES = ['PARTNER_ADMIN', 'PARTNER_AGENT'];
const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];

export function createProjectRoutes(authenticateToken: any) {
  const router = Router();

  // GET /api/projects — list projects
  // ADMIN: all tenant projects; PARTNER_ADMIN: all tenant projects (read-only); PARTNER_AGENT: accessible via project_access only
  router.get('/', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;

      if (user.role === 'PARTNER_AGENT') {
        const projects = await projectRepository.findAccessibleProjects(user.tenantId);
        return res.json({ data: projects, total: projects.length, page: 1, pageSize: projects.length });
      }

      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize = Math.max(1, Math.min(parseInt(req.query.pageSize as string) || 20, 200));
      const filters: any = {};
      if (req.query.status) filters.status = req.query.status;
      if (req.query.search) filters.search = req.query.search;

      const result = await projectRepository.findProjects(user.tenantId, { page, pageSize }, filters);
      res.json(result);
    } catch (error) {
      console.error('Error fetching projects:', error);
      res.status(500).json({ error: 'Không thể tải danh sách dự án' });
    }
  });

  // GET /api/projects/tenants — list all partner tenants for dropdown (ADMIN only)
  router.get('/tenants', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!ADMIN_ROLES.includes(user.role)) return res.status(403).json({ error: 'Không có quyền truy cập' });
      const tenants = await projectRepository.listTenants(user.tenantId);
      res.json(tenants);
    } catch (error) {
      console.error('Error fetching tenants:', error);
      res.status(500).json({ error: 'Không thể tải danh sách đối tác' });
    }
  });

  // GET /api/projects/:id — get project detail
  router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const id = req.params.id as string;

      if (user.role === 'PARTNER_AGENT') {
        const hasAccess = await projectRepository.checkPartnerAccess(user.tenantId, id);
        if (!hasAccess) return res.status(403).json({ error: 'Không có quyền truy cập dự án này' });
        const projects = await projectRepository.findAccessibleProjects(user.tenantId);
        const project = projects.find(p => p.id === id);
        return project ? res.json(project) : res.status(404).json({ error: 'Không tìm thấy dự án' });
      }

      const project = await projectRepository.findById(user.tenantId, id);
      if (!project) return res.status(404).json({ error: 'Không tìm thấy dự án' });
      res.json(project);
    } catch (error) {
      console.error('Error fetching project:', error);
      res.status(500).json({ error: 'Không thể tải thông tin dự án' });
    }
  });

  // POST /api/projects — create project (ADMIN only)
  router.post('/', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!ADMIN_ROLES.includes(user.role)) return res.status(403).json({ error: 'Không có quyền thực hiện' });

      const { name, code, description, location, totalUnits, status, openDate, handoverDate, metadata } = req.body;
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Tên dự án là bắt buộc' });
      }
      if (totalUnits != null && (isNaN(Number(totalUnits)) || Number(totalUnits) < 0)) {
        return res.status(400).json({ error: 'Số căn phải là số không âm' });
      }

      const project = await projectRepository.create(user.tenantId, {
        name: name.trim(),
        code: code?.trim(),
        description: description?.trim(),
        location: location?.trim(),
        totalUnits: totalUnits ? Number(totalUnits) : undefined,
        status,
        openDate,
        handoverDate,
        metadata,
      });
      res.status(201).json(project);
    } catch (error) {
      console.error('Error creating project:', error);
      res.status(500).json({ error: 'Không thể tạo dự án' });
    }
  });

  // PUT /api/projects/:id — update project.
  // ADMIN/SUPER_ADMIN: full update. TEAM_LEAD: chỉ được toggle metadata.public_microsite
  // (Task #25 — admin/teamlead của tenant chủ được bật mini-site công khai).
  router.put('/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const isAdmin = ADMIN_ROLES.includes(user.role);
      const isTeamLead = user.role === 'TEAM_LEAD';
      if (!isAdmin && !isTeamLead) return res.status(403).json({ error: 'Không có quyền thực hiện' });

      // TEAM_LEAD chỉ được phép thay đổi metadata.public_microsite — chặn các field khác
      // để tránh leak quyền sửa code/name/status cho tenant chủ.
      if (!isAdmin) {
        const allowedKeys = new Set(['metadata']);
        const sentKeys = Object.keys(req.body || {}).filter(k => req.body[k] !== undefined);
        const disallowed = sentKeys.filter(k => !allowedKeys.has(k));
        if (disallowed.length > 0) {
          return res.status(403).json({ error: `TEAM_LEAD chỉ được bật/tắt mini-site công khai (${disallowed.join(', ')} không được phép)` });
        }
        const before = await projectRepository.findById(user.tenantId, req.params.id as string);
        if (!before) return res.status(404).json({ error: 'Không tìm thấy dự án' });
        const oldMeta = (before as any).metadata || {};
        const newMeta = req.body.metadata || {};
        const allowedMetaKeys = new Set(['public_microsite']);
        // Merge: chỉ cho phép thay đổi key public_microsite, các key khác phải giữ nguyên
        const mergedMeta: Record<string, any> = { ...oldMeta };
        for (const k of Object.keys(newMeta)) {
          if (!allowedMetaKeys.has(k) && JSON.stringify(newMeta[k]) !== JSON.stringify(oldMeta[k])) {
            return res.status(403).json({ error: `TEAM_LEAD chỉ được bật/tắt mini-site công khai (metadata.${k} không được phép)` });
          }
          mergedMeta[k] = newMeta[k];
        }
        req.body.metadata = mergedMeta;
      }

      const id = req.params.id as string;
      const { name, code, description, location, totalUnits, status, openDate, handoverDate, metadata } = req.body;

      if (totalUnits != null && (isNaN(Number(totalUnits)) || Number(totalUnits) < 0)) {
        return res.status(400).json({ error: 'Số căn phải là số không âm' });
      }

      // Snapshot mã code trước khi update để evict cache cả mã cũ (khi rename)
      // — nếu không, trang public cũ vẫn hit cache TTL 5 phút sau khi đổi mã.
      const before = await projectRepository.findById(user.tenantId, id);
      const oldCode = before?.code ? String(before.code) : null;

      // Phân biệt rõ "không gửi field" (undefined → giữ nguyên DB) vs
      // "gửi null/empty" (xoá field). Cho phép user xoá totalUnits → null.
      const updated = await projectRepository.update(user.tenantId, id, {
        name: name?.trim(),
        code: code?.trim(),
        description: description?.trim(),
        location: location?.trim(),
        totalUnits: totalUnits === undefined ? undefined : (totalUnits === null || totalUnits === '' ? null : Number(totalUnits)) as any,
        status,
        openDate: openDate === '' ? null : openDate,
        handoverDate: handoverDate === '' ? null : handoverDate,
        metadata,
      });
      if (!updated) return res.status(404).json({ error: 'Không tìm thấy dự án' });

      // Invalidate public mini-site cache khi project được sửa (kể cả khi
      // metadata.public_microsite được toggle on/off — lần fetch tiếp theo
      // sẽ đọc lại và trả 404 nếu đã off). Evict cả mã cũ lẫn mã mới khi rename.
      if (oldCode) evictPublicProjectCache(oldCode);
      if (updated.code && updated.code !== oldCode) evictPublicProjectCache(String(updated.code));

      res.json(updated);
    } catch (error) {
      console.error('Error updating project:', error);
      res.status(500).json({ error: 'Không thể cập nhật dự án' });
    }
  });

  // DELETE /api/projects/:id — delete project (ADMIN only)
  router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!ADMIN_ROLES.includes(user.role)) return res.status(403).json({ error: 'Không có quyền thực hiện' });

      // Lookup code trước khi xoá để invalidate cache sau xoá
      const existing = await projectRepository.findById(user.tenantId, req.params.id as string);
      const deleted = await projectRepository.delete(user.tenantId, req.params.id as string);
      if (!deleted) return res.status(404).json({ error: 'Không tìm thấy dự án' });
      if (existing?.code) evictPublicProjectCache(String(existing.code));
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting project:', error);
      res.status(500).json({ error: 'Không thể xóa dự án' });
    }
  });

  // GET /api/projects/:id/access — list partner accesses (ADMIN only)
  router.get('/:id/access', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!ADMIN_ROLES.includes(user.role)) return res.status(403).json({ error: 'Không có quyền thực hiện' });

      const accesses = await projectRepository.getProjectAccess(user.tenantId, req.params.id as string);
      res.json(accesses);
    } catch (error) {
      console.error('Error fetching project access:', error);
      res.status(500).json({ error: 'Không thể tải danh sách quyền truy cập' });
    }
  });

  // POST /api/projects/:id/access — grant access to partner tenant (ADMIN only)
  router.post('/:id/access', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!ADMIN_ROLES.includes(user.role)) return res.status(403).json({ error: 'Không có quyền thực hiện' });

      const { partnerTenantId, expiresAt, note } = req.body;
      if (!partnerTenantId) return res.status(400).json({ error: 'Vui lòng chọn đối tác' });

      const access = await projectRepository.grantAccess(user.tenantId, {
        projectId: req.params.id as string,
        partnerTenantId,
        grantedBy: user.id,
        expiresAt,
        note,
      });
      res.status(201).json(access);
    } catch (error: any) {
      console.error('Error granting access:', error);
      const msg = error?.message?.includes('not found') ? 'Không tìm thấy dự án hoặc đối tác' : 'Không thể cấp quyền truy cập';
      res.status(error?.message?.includes('not found') ? 404 : 500).json({ error: msg });
    }
  });

  // DELETE /api/projects/:id/access/:partnerTenantId — revoke access (ADMIN only)
  router.delete('/:id/access/:partnerTenantId', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!ADMIN_ROLES.includes(user.role)) return res.status(403).json({ error: 'Không có quyền thực hiện' });

      const id = req.params.id as string;
      const partnerTenantId = req.params.partnerTenantId as string;
      const revoked = await projectRepository.revokeAccess(user.tenantId, id, partnerTenantId);
      if (!revoked) return res.status(404).json({ error: 'Không tìm thấy bản ghi quyền truy cập' });
      res.json({ success: true });
    } catch (error) {
      console.error('Error revoking access:', error);
      res.status(500).json({ error: 'Không thể thu hồi quyền truy cập' });
    }
  });

  // ── Listing-level access (per-listing partner view permission) ─────────────

  // GET /api/projects/listings/:listingId/access — list listing_access grants (ADMIN only)
  router.get('/listings/:listingId/access', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!ADMIN_ROLES.includes(user.role)) return res.status(403).json({ error: 'Không có quyền thực hiện' });
      const accesses = await projectRepository.getListingAccess(req.params.listingId as string);
      res.json(accesses);
    } catch (error) {
      console.error('Error fetching listing access:', error);
      res.status(500).json({ error: 'Không thể tải danh sách quyền truy cập sản phẩm' });
    }
  });

  // POST /api/projects/listings/:listingId/access — grant listing access (ADMIN only)
  router.post('/listings/:listingId/access', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!ADMIN_ROLES.includes(user.role)) return res.status(403).json({ error: 'Không có quyền thực hiện' });

      const { partnerTenantId, expiresAt, note } = req.body;
      if (!partnerTenantId) return res.status(400).json({ error: 'Vui lòng chọn đối tác' });

      const access = await projectRepository.grantListingAccess({
        listingId: req.params.listingId as string,
        partnerTenantId,
        grantedBy: user.id,
        expiresAt,
        note,
      });
      res.status(201).json(access);
    } catch (error: any) {
      console.error('Error granting listing access:', error);
      const msg = error?.message?.includes('not found') ? 'Không tìm thấy sản phẩm hoặc đối tác' : 'Không thể cấp quyền truy cập sản phẩm';
      res.status(error?.message?.includes('not found') ? 404 : 500).json({ error: msg });
    }
  });

  // DELETE /api/projects/listings/:listingId/access/:partnerTenantId — revoke listing access (ADMIN only)
  router.delete('/listings/:listingId/access/:partnerTenantId', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!ADMIN_ROLES.includes(user.role)) return res.status(403).json({ error: 'Không có quyền thực hiện' });

      const revoked = await projectRepository.revokeListingAccess(
        req.params.listingId as string,
        req.params.partnerTenantId as string
      );
      if (!revoked) return res.status(404).json({ error: 'Không tìm thấy bản ghi quyền truy cập sản phẩm' });
      res.json({ success: true });
    } catch (error) {
      console.error('Error revoking listing access:', error);
      res.status(500).json({ error: 'Không thể thu hồi quyền truy cập sản phẩm' });
    }
  });

  // ── Price Matrix (Bảng giá tầng/hướng/loại) ──────────────────────────────

  // GET /api/projects/:id/price-matrix
  router.get('/:id/price-matrix', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const projectId = req.params.id as string;
      const rows = await projectPriceMatrixRepository.findByProject(user.tenantId, projectId);
      res.json(rows);
    } catch (error) {
      console.error('Error fetching price matrix:', error);
      res.status(500).json({ error: 'Không thể tải bảng giá' });
    }
  });

  // POST /api/projects/:id/price-matrix
  router.post('/:id/price-matrix', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!ADMIN_ROLES.includes(user.role) && !['TEAM_LEAD'].includes(user.role))
        return res.status(403).json({ error: 'Không có quyền thực hiện' });
      const projectId = req.params.id as string;
      const row = await projectPriceMatrixRepository.upsertRow(user.tenantId, projectId, {
        ...req.body,
        updated_by: user.userId,
      });
      res.status(201).json(row);
    } catch (error: any) {
      console.error('Error creating price matrix row:', error);
      res.status(500).json({ error: 'Không thể thêm dòng bảng giá' });
    }
  });

  // PUT /api/projects/:id/price-matrix/:rowId
  router.put('/:id/price-matrix/:rowId', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!ADMIN_ROLES.includes(user.role) && !['TEAM_LEAD'].includes(user.role))
        return res.status(403).json({ error: 'Không có quyền thực hiện' });
      const updated = await projectPriceMatrixRepository.updateRow(
        user.tenantId, req.params.rowId as string, { ...req.body, updated_by: user.userId }
      );
      if (!updated) return res.status(404).json({ error: 'Không tìm thấy dòng bảng giá' });
      res.json(updated);
    } catch (error) {
      console.error('Error updating price matrix row:', error);
      res.status(500).json({ error: 'Không thể cập nhật dòng bảng giá' });
    }
  });

  // DELETE /api/projects/:id/price-matrix/:rowId
  router.delete('/:id/price-matrix/:rowId', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!ADMIN_ROLES.includes(user.role) && !['TEAM_LEAD'].includes(user.role))
        return res.status(403).json({ error: 'Không có quyền thực hiện' });
      const deleted = await projectPriceMatrixRepository.deleteRow(user.tenantId, req.params.rowId as string);
      if (!deleted) return res.status(404).json({ error: 'Không tìm thấy dòng bảng giá' });
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting price matrix row:', error);
      res.status(500).json({ error: 'Không thể xóa dòng bảng giá' });
    }
  });

  // GET /api/projects/:id/price-matrix/lookup?floor=&direction=&bedroomType=&tower=
  router.get('/:id/price-matrix/lookup', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const result = await projectPriceMatrixRepository.lookupPrice(user.tenantId, req.params.id as string, {
        floor:       Number(req.query.floor) || 1,
        direction:   req.query.direction as string,
        bedroomType: req.query.bedroomType as string,
        tower:       req.query.tower as string,
      });
      if (!result) return res.status(404).json({ error: 'Không có giá phù hợp' });
      res.json(result);
    } catch (error) {
      console.error('Error looking up price matrix:', error);
      res.status(500).json({ error: 'Không thể tra giá' });
    }
  });

  // ── Floor plans (Sa bàn tương tác) ─────────────────────────────────────────
  registerFloorPlanRoutes(router, authenticateToken);

  return router;
}
