import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { userRepository } from '../repositories/userRepository';
import { auditRepository } from '../repositories/auditRepository';

export function createUserRoutes(authenticateToken: any) {
  const router = Router();

  router.get('/', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'ADMIN' && user.role !== 'TEAM_LEAD') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const page = parseInt(req.query.page as string) || 1;
      const pageSize = Math.min(parseInt(req.query.pageSize as string) || 50, 200);
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
      res.status(500).json({ error: 'Failed to fetch users' });
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
      res.status(500).json({ error: 'Failed to fetch teams' });
    }
  });

  router.post('/', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Only admins can create users' });
      }

      const { name, email, password, role, phone, avatar } = req.body;
      if (!name || !email) {
        return res.status(400).json({ error: 'Name and email are required' });
      }

      const existing = await userRepository.findByEmail(user.tenantId, email);
      if (existing) {
        return res.status(409).json({ error: 'User with this email already exists' });
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
      res.status(500).json({ error: 'Failed to create user' });
    }
  });

  router.post('/invite', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Only admins can invite users' });
      }

      const { name, email, role } = req.body;
      if (!name || !email) {
        return res.status(400).json({ error: 'Name and email are required' });
      }

      const existing = await userRepository.findByEmail(user.tenantId, email);
      if (existing) {
        return res.status(409).json({ error: 'User with this email already exists' });
      }

      const invited = await userRepository.invite(user.tenantId, { name, email, role });

      await auditRepository.log(user.tenantId, {
        actorId: user.id,
        action: 'USER_INVITED',
        entityType: 'USER',
        entityId: invited.id,
        details: `Invited user ${email} with role ${invited.role}`,
        ipAddress: req.ip,
      });

      res.status(201).json(userRepository.toPublicUser(invited));
    } catch (error) {
      console.error('Error inviting user:', error);
      res.status(500).json({ error: 'Failed to invite user' });
    }
  });

  router.put('/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.id !== req.params.id && user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Can only update own profile or must be admin' });
      }

      // BUG FIX: Prevent privilege escalation — only ADMIN can change roles
      if (req.body.role !== undefined && user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Only admins can change user roles' });
      }

      const before = await userRepository.findByIdDirect(req.params.id, user.tenantId);
      const updated = await userRepository.update(user.tenantId, req.params.id, req.body);
      if (!updated) return res.status(404).json({ error: 'User not found' });

      const changes: string[] = [];
      if (req.body.role && before?.role !== req.body.role) changes.push(`role: ${before?.role} → ${req.body.role}`);
      if (req.body.status && before?.status !== req.body.status) changes.push(`status: ${before?.status} → ${req.body.status}`);
      if (changes.length > 0) {
        await auditRepository.log(user.tenantId, {
          actorId: user.id,
          action: 'USER_UPDATED',
          entityType: 'USER',
          entityId: req.params.id,
          details: `Updated ${updated.email}: ${changes.join(', ')}`,
          ipAddress: req.ip,
        });
      }

      res.json(userRepository.toPublicUser(updated));
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ error: 'Failed to update user' });
    }
  });

  router.post('/:id/resend-invite', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Only admins can resend invites' });
      }

      const target = await userRepository.findByIdDirect(req.params.id, user.tenantId);
      if (!target) return res.status(404).json({ error: 'User not found' });
      if (target.status !== 'PENDING') {
        return res.status(400).json({ error: 'Only pending users can receive re-invites' });
      }

      await auditRepository.log(user.tenantId, {
        actorId: user.id,
        action: 'USER_REINVITED',
        entityType: 'USER',
        entityId: req.params.id,
        details: `Re-invite sent to ${target.email}`,
        ipAddress: req.ip,
      });

      res.json({ success: true, message: `Invite resent to ${target.email}` });
    } catch (error) {
      console.error('Error resending invite:', error);
      res.status(500).json({ error: 'Failed to resend invite' });
    }
  });

  router.post('/:id/email', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.id !== req.params.id && user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Chỉ có thể thay đổi email của chính mình hoặc phải là admin' });
      }

      const { currentPassword, newEmail } = req.body;
      if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
        return res.status(400).json({ error: 'Email không hợp lệ' });
      }

      const existingUser = await userRepository.findByIdDirect(req.params.id, user.tenantId);
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
      if (duplicate && duplicate.id !== req.params.id) {
        return res.status(409).json({ error: 'Email này đã được sử dụng' });
      }

      const { pool } = await import('../db');
      await pool.query(`UPDATE users SET email = $1 WHERE id = $2`, [newEmail.toLowerCase(), req.params.id]);

      const updated = await userRepository.findByIdDirect(req.params.id, user.tenantId);
      await auditRepository.log(user.tenantId, {
        actorId: user.id,
        action: 'UPDATE',
        entityType: 'USER',
        entityId: req.params.id,
        details: `Email changed to: ${newEmail}`,
        ipAddress: req.ip,
      });

      res.json(userRepository.toPublicUser(updated!));
    } catch (error) {
      console.error('Error changing email:', error);
      res.status(500).json({ error: 'Failed to change email' });
    }
  });

  router.post('/:id/password', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.id !== req.params.id && user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Can only change own password or must be admin' });
      }

      const { currentPassword, newPassword } = req.body;
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: 'Mật khẩu mới phải ít nhất 6 ký tự' });
      }

      if (currentPassword) {
        const existingUser = await userRepository.findByIdDirect(req.params.id, user.tenantId);
        if (existingUser) {
          const verified = await userRepository.authenticate(user.tenantId, existingUser.email!, currentPassword);
          if (!verified) {
            return res.status(400).json({ error: 'Mật khẩu hiện tại không đúng' });
          }
        }
      }

      await userRepository.updatePassword(user.tenantId, req.params.id, newPassword);
      res.json({ message: 'Đổi mật khẩu thành công' });
    } catch (error) {
      console.error('Error updating password:', error);
      res.status(500).json({ error: 'Failed to update password' });
    }
  });

  router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Only admins can delete users' });
      }

      if (user.id === req.params.id) {
        return res.status(400).json({ error: 'Cannot delete your own account' });
      }

      const deleted = await userRepository.delete(user.tenantId, req.params.id);
      if (!deleted) return res.status(404).json({ error: 'User not found' });

      await auditRepository.log(user.tenantId, {
        actorId: user.id,
        action: 'USER_DELETED',
        entityType: 'USER',
        entityId: req.params.id,
        details: `Deleted user ${req.params.id}`,
        ipAddress: req.ip,
      });

      res.json({ message: 'User deleted' });
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  });

  return router;
}
