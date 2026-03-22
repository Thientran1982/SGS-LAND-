import { validateUUIDParam } from '../middleware/validation';
import { Router, Request, Response } from 'express';
import { contractRepository } from '../repositories/contractRepository';
import { auditRepository } from '../repositories/auditRepository';

export function createContractRoutes(authenticateToken: any) {
  const router = Router();

  const PARTNER_ROLES = ['PARTNER_ADMIN', 'PARTNER_AGENT'];

  router.get('/', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (PARTNER_ROLES.includes(user.role)) {
        return res.status(403).json({ error: 'Không có quyền truy cập' });
      }
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize = Math.max(1, Math.min(parseInt(req.query.pageSize as string) || 20, 200));

      const filters: any = {};
      if (req.query.status) filters.status = req.query.status;
      if (req.query.type) filters.type = req.query.type;
      if (req.query.leadId) filters.leadId = req.query.leadId;
      if (req.query.search) filters.search = req.query.search;

      const result = await contractRepository.findContracts(user.tenantId, { page, pageSize }, filters, user.id, user.role);
      res.json(result);
    } catch (error) {
      console.error('Error fetching contracts:', error);
      res.status(500).json({ error: 'Không thể tải danh sách hợp đồng' });
    }
  });

  router.get('/:id', authenticateToken, validateUUIDParam(), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const contract = await contractRepository.findById(user.tenantId, String(req.params.id));
      if (!contract) return res.status(404).json({ error: 'Không tìm thấy hợp đồng' });

      const RESTRICTED = ['SALES', 'MARKETING', 'VIEWER'];
      if (RESTRICTED.includes(user.role) && (contract as any).createdById !== user.id) {
        return res.status(403).json({ error: 'Bạn không có quyền truy cập hợp đồng này' });
      }

      res.json(contract);
    } catch (error) {
      console.error('Error fetching contract:', error);
      res.status(500).json({ error: 'Không thể tải thông tin hợp đồng' });
    }
  });

  router.post('/', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { type } = req.body;

      if (!type) {
        return res.status(400).json({ error: 'Thiếu thông tin bắt buộc: loại hợp đồng' });
      }

      const contract = await contractRepository.create(user.tenantId, {
        ...req.body,
        createdBy: user.name || user.email,
        createdById: user.id,
      });

      await auditRepository.log(user.tenantId, {
        actorId: user.id,
        action: 'CREATE',
        entityType: 'CONTRACT',
        entityId: contract.id,
        details: `Created ${type} contract`,
        ipAddress: req.ip,
      });

      res.status(201).json(contract);
    } catch (error) {
      console.error('Error creating contract:', error);
      res.status(500).json({ error: 'Không thể tạo hợp đồng. Vui lòng thử lại.' });
    }
  });

  // Các chuyển trạng thái hợp lệ theo enum ContractStatus thực tế
  const CONTRACT_VALID_TRANSITIONS: Record<string, string[]> = {
    DRAFT:             ['PENDING_SIGNATURE', 'SIGNED', 'CANCELLED'],
    PENDING_SIGNATURE: ['SIGNED', 'CANCELLED', 'DRAFT'],
    SIGNED:            ['CANCELLED'],
    CANCELLED:         ['DRAFT'],
  };

  router.put('/:id', authenticateToken, validateUUIDParam(), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const RESTRICTED = ['SALES', 'MARKETING', 'VIEWER'];

      // Fetch the contract for state machine and ownership checks
      const current = await contractRepository.findById(user.tenantId, String(req.params.id));
      if (!current) return res.status(404).json({ error: 'Không tìm thấy hợp đồng' });

      if (RESTRICTED.includes(user.role) && (current as any).createdById !== user.id) {
        return res.status(403).json({ error: 'Bạn chỉ có thể chỉnh sửa hợp đồng do mình tạo' });
      }

      // Validate status transitions only for ADMIN/MANAGER — CRM admins need flexibility
      const isAdmin = ['ADMIN', 'MANAGER'].includes(user.role);
      if (req.body.status && !isAdmin) {
        const currentStatus = ((current as any).status || 'DRAFT').toUpperCase();
        const newStatus = String(req.body.status).toUpperCase();
        const allowed = CONTRACT_VALID_TRANSITIONS[currentStatus] ?? [];
        if (currentStatus !== newStatus && !allowed.includes(newStatus)) {
          return res.status(422).json({
            error: `Không thể chuyển trạng thái: ${currentStatus} → ${newStatus}`,
            allowed,
          });
        }
      }

      // Auto-set signed_at when transitioning to SIGNED
      const updateData = { ...req.body };
      if (req.body.status === 'SIGNED' && !(current as any).signedAt) {
        updateData.signedAt = new Date().toISOString();
      }

      const contract = await contractRepository.update(user.tenantId, String(req.params.id), updateData);
      if (!contract) return res.status(404).json({ error: 'Không tìm thấy hợp đồng' });

      await auditRepository.log(user.tenantId, {
        actorId: user.id,
        action: 'UPDATE',
        entityType: 'CONTRACT',
        entityId: String(req.params.id),
        details: `Updated contract fields: ${Object.keys(req.body).join(', ')}`,
        ipAddress: req.ip,
      });

      res.json(contract);
    } catch (error) {
      console.error('Error updating contract:', error);
      res.status(500).json({ error: 'Không thể cập nhật hợp đồng. Vui lòng thử lại.' });
    }
  });

  router.delete('/:id', authenticateToken, validateUUIDParam(), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;

      const contract = await contractRepository.findById(user.tenantId, String(req.params.id));
      if (!contract) return res.status(404).json({ error: 'Không tìm thấy hợp đồng' });

      const isAdmin = ['ADMIN', 'MANAGER'].includes(user.role);
      const isOwner = (contract as any).createdById === user.id;
      if (!isAdmin && !isOwner) {
        return res.status(403).json({ error: 'Bạn chỉ có thể xóa hợp đồng do mình tạo' });
      }

      await contractRepository.deleteById(user.tenantId, String(req.params.id));

      await auditRepository.log(user.tenantId, {
        actorId: user.id,
        action: 'DELETE',
        entityType: 'CONTRACT',
        entityId: String(req.params.id),
        details: `Deleted contract`,
        ipAddress: req.ip,
      });

      res.status(204).send();
    } catch (error) {
      console.error('Error deleting contract:', error);
      res.status(500).json({ error: 'Không thể xóa hợp đồng. Vui lòng thử lại.' });
    }
  });

  return router;
}
