import { Router, Request, Response } from 'express';
import { projectRepository } from '../repositories/projectRepository';

const PARTNER_ROLES = ['PARTNER_ADMIN', 'PARTNER_AGENT'];
const ADMIN_ROLES = ['ADMIN'];

export function createProjectRoutes(authenticateToken: any) {
  const router = Router();

  // GET /api/projects — list projects
  // Developer: sees own projects; Partner: sees accessible projects
  router.get('/', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;

      if (PARTNER_ROLES.includes(user.role)) {
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

      if (PARTNER_ROLES.includes(user.role)) {
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

  // PUT /api/projects/:id — update project (ADMIN only)
  router.put('/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!ADMIN_ROLES.includes(user.role)) return res.status(403).json({ error: 'Không có quyền thực hiện' });

      const id = req.params.id as string;
      const { name, code, description, location, totalUnits, status, openDate, handoverDate, metadata } = req.body;

      if (totalUnits != null && (isNaN(Number(totalUnits)) || Number(totalUnits) < 0)) {
        return res.status(400).json({ error: 'Số căn phải là số không âm' });
      }

      const updated = await projectRepository.update(user.tenantId, id, {
        name: name?.trim(),
        code: code?.trim(),
        description: description?.trim(),
        location: location?.trim(),
        totalUnits: totalUnits != null ? Number(totalUnits) : undefined,
        status,
        openDate,
        handoverDate,
        metadata,
      });
      if (!updated) return res.status(404).json({ error: 'Không tìm thấy dự án' });
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

      const deleted = await projectRepository.delete(user.tenantId, req.params.id as string);
      if (!deleted) return res.status(404).json({ error: 'Không tìm thấy dự án' });
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
      if (!ADMIN_ROLES.includes(user.role)) return res.status(403).json({ error: 'Forbidden' });
      const accesses = await projectRepository.getListingAccess(req.params.listingId as string);
      res.json(accesses);
    } catch (error) {
      console.error('Error fetching listing access:', error);
      res.status(500).json({ error: 'Failed to fetch listing access' });
    }
  });

  // POST /api/projects/listings/:listingId/access — grant listing access (ADMIN only)
  router.post('/listings/:listingId/access', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!ADMIN_ROLES.includes(user.role)) return res.status(403).json({ error: 'Forbidden' });

      const { partnerTenantId, expiresAt, note } = req.body;
      if (!partnerTenantId) return res.status(400).json({ error: 'partnerTenantId is required' });

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
      const msg = error?.message?.includes('not found') ? error.message : 'Failed to grant listing access';
      res.status(error?.message?.includes('not found') ? 404 : 500).json({ error: msg });
    }
  });

  // DELETE /api/projects/listings/:listingId/access/:partnerTenantId — revoke listing access (ADMIN only)
  router.delete('/listings/:listingId/access/:partnerTenantId', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!ADMIN_ROLES.includes(user.role)) return res.status(403).json({ error: 'Forbidden' });

      const revoked = await projectRepository.revokeListingAccess(
        req.params.listingId as string,
        req.params.partnerTenantId as string
      );
      if (!revoked) return res.status(404).json({ error: 'Listing access record not found' });
      res.json({ success: true });
    } catch (error) {
      console.error('Error revoking listing access:', error);
      res.status(500).json({ error: 'Failed to revoke listing access' });
    }
  });

  return router;
}
