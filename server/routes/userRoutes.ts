import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { userRepository } from '../repositories/userRepository';
import { auditRepository } from '../repositories/auditRepository';
import { emailService } from '../services/emailService';

export function createUserRoutes(authenticateToken: any) {
  const router = Router();

  router.get('/', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'ADMIN' && user.role !== 'TEAM_LEAD') {
        return res.status(403).json({ error: 'Bạn không có quyền thực hiện thao tác này' });
      }

      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize = Math.max(1, Math.min(parseInt(req.query.pageSize as string) || 50, 200));
      const filters: any = {};
      if (req.query.role) filters.role = req.query.role;
      if (req.query.status) filters.status = req.query.status;
      if (req.query.search) filters.search = req.query.search;
      if (req.query.sortField) filters.sortField = req.query.sortField;
      if (req.query.sortOrder) filters.sortOrder = req.query.sortOrder;

      const result = await userRepository.listUsers(user.tenantId, { page, pageSize }, filters);
      result.data = result.data.map((u: any) => userRepository.toPublicUser(u));
      res.json(result);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ error: 'Không thể tải danh sách người dùng' });
    }
  });

  router.get('/me', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const dbUser = await userRepository.findByIdDirect(user.id, user.tenantId);
      if (!dbUser) return res.json({ user });
      res.json({ user: userRepository.toPublicUser(dbUser) });
    } catch (error) {
      res.json({ user: (req as any).user });
    }
  });

  router.get('/teams', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const teams = await userRepository.getTeams(user.tenantId);
      res.json(teams);
    } catch (error) {
      console.error('Error fetching teams:', error);
      res.status(500).json({ error: 'Không thể tải danh sách nhóm' });
    }
  });

  router.post('/', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Chỉ quản trị viên mới có thể tạo người dùng' });
      }

      const { name, email, password, role, phone, avatar } = req.body;
      if (!name || !email) {
        return res.status(400).json({ error: 'Tên và email là bắt buộc' });
      }

      const existing = await userRepository.findByEmail(user.tenantId, email);
      if (existing) {
        return res.status(409).json({ error: 'Người dùng với email này đã tồn tại' });
      }

      const newUser = await userRepository.create(user.tenantId, {
        name, email, password, role, phone, avatar,
      });

      await auditRepository.log(user.tenantId, {
        actorId: user.id,
        action: 'USER_CREATED',
        entityType: 'USER',
        entityId: newUser.id,
        details: `Created user ${email} with role ${newUser.role}`,
        ipAddress: req.ip,
      });

      res.status(201).json(userRepository.toPublicUser(newUser));
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(500).json({ error: 'Không thể tạo người dùng' });
    }
  });

  router.post('/invite', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Chỉ quản trị viên mới có thể mời người dùng' });
      }

      const { name, email, role, phone } = req.body;
      if (!name || !email) {
        return res.status(400).json({ error: 'Tên và email là bắt buộc' });
      }

      const existing = await userRepository.findByEmail(user.tenantId, email);
      if (existing) {
        return res.status(409).json({ error: 'Người dùng với email này đã tồn tại' });
      }

      const invited = await userRepository.invite(user.tenantId, { name, email, role, phone });

      await auditRepository.log(user.tenantId, {
        actorId: user.id,
        action: 'USER_INVITED',
        entityType: 'USER',
        entityId: invited.id,
        details: `Invited user ${email} with role ${invited.role}`,
        ipAddress: req.ip,
      });

      const loginUrl = `${process.env.APP_URL || 'https://app.sgsland.vn'}/auth/set-password?email=${encodeURIComponent(email)}`;
      emailService.sendInviteEmail(user.tenantId, email, name, invited.role, loginUrl).catch((err: any) => {
        console.error('[Invite] Failed to send invite email:', err.message);
      });

      res.status(201).json(userRepository.toPublicUser(invited));
    } catch (error) {
      console.error('Error inviting user:', error);
      res.status(500).json({ error: 'Không thể gửi lời mời người dùng' });
    }
  });

  router.put('/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.id !== String(req.params.id) && user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Bạn chỉ có thể cập nhật hồ sơ của chính mình hoặc phải là quản trị viên' });
      }

      // BUG FIX: Prevent privilege escalation — only ADMIN can change roles
      if (req.body.role !== undefined && user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Chỉ quản trị viên mới có thể thay đổi vai trò người dùng' });
      }
      // Validate role value is from allowed enum
      const VALID_ROLES = ['ADMIN', 'TEAM_LEAD', 'SALES', 'MARKETING', 'VIEWER', 'PARTNER_ADMIN', 'PARTNER_AGENT'];
      if (req.body.role !== undefined && !VALID_ROLES.includes(req.body.role)) {
        return res.status(400).json({ error: `Vai trò không hợp lệ. Các vai trò cho phép: ${VALID_ROLES.join(', ')}` });
      }

      const before = await userRepository.findByIdDirect(String(req.params.id), user.tenantId);
      const updated = await userRepository.update(user.tenantId, String(req.params.id), req.body);
      if (!updated) return res.status(404).json({ error: 'Không tìm thấy người dùng' });

      const changes: string[] = [];
      if (req.body.role && before?.role !== req.body.role) changes.push(`role: ${before?.role} → ${req.body.role}`);
      if (req.body.status && before?.status !== req.body.status) changes.push(`status: ${before?.status} → ${req.body.status}`);
      if (changes.length > 0) {
        await auditRepository.log(user.tenantId, {
          actorId: user.id,
          action: 'USER_UPDATED',
          entityType: 'USER',
          entityId: String(req.params.id),
          details: `Updated ${updated.email}: ${changes.join(', ')}`,
          ipAddress: req.ip,
        });
      }

      res.json(userRepository.toPublicUser(updated));
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ error: 'Không thể cập nhật người dùng' });
    }
  });

  router.post('/:id/resend-invite', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Chỉ quản trị viên mới có thể gửi lại lời mời' });
      }

      const target = await userRepository.findByIdDirect(String(req.params.id), user.tenantId);
      if (!target) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
      if (target.status !== 'PENDING') {
        return res.status(400).json({ error: 'Chỉ người dùng đang chờ kích hoạt mới có thể nhận lời mời lại' });
      }

      await auditRepository.log(user.tenantId, {
        actorId: user.id,
        action: 'USER_REINVITED',
        entityType: 'USER',
        entityId: String(req.params.id),
        details: `Re-invite sent to ${target.email}`,
        ipAddress: req.ip,
      });

      const loginUrl = `${process.env.APP_URL || 'https://app.sgsland.vn'}/auth/set-password?email=${encodeURIComponent(target.email || '')}`;
      emailService.sendInviteEmail(user.tenantId, target.email!, target.name || target.email!, target.role, loginUrl).catch((err: any) => {
        console.error('[Invite] Failed to resend invite email:', err.message);
      });

      res.json({ success: true, message: `Invite resent to ${target.email}` });
    } catch (error) {
      console.error('Error resending invite:', error);
      res.status(500).json({ error: 'Không thể gửi lại lời mời' });
    }
  });

  router.post('/:id/email', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.id !== String(req.params.id) && user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Chỉ có thể thay đổi email của chính mình hoặc phải là admin' });
      }

      const { currentPassword, newEmail } = req.body;
      if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
        return res.status(400).json({ error: 'Email không hợp lệ' });
      }

      const existingUser = await userRepository.findByIdDirect(String(req.params.id), user.tenantId);
      if (!existingUser) return res.status(404).json({ error: 'Người dùng không tồn tại' });

      if (newEmail.toLowerCase() === existingUser.email?.toLowerCase()) {
        return res.status(400).json({ error: 'Email mới phải khác email hiện tại' });
      }

      if (!currentPassword) {
        return res.status(400).json({ error: 'Vui lòng nhập mật khẩu để xác nhận' });
      }
      const verified = await userRepository.authenticate(user.tenantId, existingUser.email!, currentPassword);
      if (!verified) {
        return res.status(400).json({ error: 'Mật khẩu xác nhận không đúng' });
      }

      const duplicate = await userRepository.findByEmail(user.tenantId, newEmail);
      if (duplicate && duplicate.id !== String(req.params.id)) {
        return res.status(409).json({ error: 'Email này đã được sử dụng' });
      }

      const { withTenantContext } = await import('../db');
      await withTenantContext(user.tenantId, async (client) => {
        await client.query(
          `UPDATE users SET email = $1 WHERE id = $2 AND tenant_id = $3`,
          [newEmail.toLowerCase(), String(req.params.id), user.tenantId]
        );
      });

      const updated = await userRepository.findByIdDirect(String(req.params.id), user.tenantId);
      await auditRepository.log(user.tenantId, {
        actorId: user.id,
        action: 'UPDATE',
        entityType: 'USER',
        entityId: String(req.params.id),
        details: `Email changed to: ${newEmail}`,
        ipAddress: req.ip,
      });

      res.json(userRepository.toPublicUser(updated!));
    } catch (error) {
      console.error('Error changing email:', error);
      res.status(500).json({ error: 'Không thể thay đổi email' });
    }
  });

  router.post('/:id/password', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.id !== String(req.params.id) && user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Bạn chỉ có thể đổi mật khẩu của chính mình hoặc phải là quản trị viên' });
      }

      const { currentPassword, newPassword } = req.body;
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: 'Mật khẩu mới phải ít nhất 6 ký tự' });
      }

      if (currentPassword) {
        const existingUser = await userRepository.findByIdDirect(String(req.params.id), user.tenantId);
        if (existingUser) {
          const verified = await userRepository.authenticate(user.tenantId, existingUser.email!, currentPassword);
          if (!verified) {
            return res.status(400).json({ error: 'Mật khẩu hiện tại không đúng' });
          }
        }
      }

      await userRepository.updatePassword(user.tenantId, String(req.params.id), newPassword);
      res.json({ message: 'Đổi mật khẩu thành công' });
    } catch (error) {
      console.error('Error updating password:', error);
      res.status(500).json({ error: 'Không thể cập nhật mật khẩu' });
    }
  });

  router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Chỉ quản trị viên mới có thể xóa người dùng' });
      }

      if (user.id === String(req.params.id)) {
        return res.status(400).json({ error: 'Không thể xóa tài khoản của chính mình' });
      }

      const deleted = await userRepository.delete(user.tenantId, String(req.params.id));
      if (!deleted) return res.status(404).json({ error: 'Không tìm thấy người dùng' });

      await auditRepository.log(user.tenantId, {
        actorId: user.id,
        action: 'USER_DELETED',
        entityType: 'USER',
        entityId: String(req.params.id),
        details: `Deleted user ${String(req.params.id)}`,
        ipAddress: req.ip,
      });

      res.json({ message: 'Đã xóa người dùng' });
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ error: 'Không thể xóa người dùng' });
    }
  });

  return router;
}
