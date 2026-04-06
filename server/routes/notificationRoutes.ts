import { Router, Request, Response } from 'express';
import { notificationRepository } from '../repositories/notificationRepository';
import { validateUUIDParam } from '../middleware/validation';

const ADMIN_ROLES = ['ADMIN', 'TEAM_LEAD'];

export function createNotificationRoutes(authenticateToken: any) {
  const router = Router();

  router.get('/', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const isAdmin = ADMIN_ROLES.includes(user.role);

      const notifications = isAdmin
        ? await notificationRepository.findByTenant(user.tenantId, 60)
        : await notificationRepository.findByUser(user.tenantId, user.id, 40);

      const unreadCount = isAdmin
        ? await notificationRepository.countUnreadByTenant(user.tenantId)
        : await notificationRepository.countUnread(user.tenantId, user.id);

      res.json({ notifications, unreadCount });
    } catch (error) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({ error: 'Failed to fetch notifications' });
    }
  });

  router.get('/unread-count', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const isAdmin = ADMIN_ROLES.includes(user.role);
      const count = isAdmin
        ? await notificationRepository.countUnreadByTenant(user.tenantId)
        : await notificationRepository.countUnread(user.tenantId, user.id);
      res.json({ count });
    } catch (error) {
      console.error('Error fetching unread count:', error);
      res.status(500).json({ error: 'Failed to fetch unread count' });
    }
  });

  router.patch('/:id/read', authenticateToken, validateUUIDParam(), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const isAdmin = ADMIN_ROLES.includes(user.role);
      const notification = isAdmin
        ? await notificationRepository.markReadByTenant(user.tenantId, String(req.params.id))
        : await notificationRepository.markRead(user.tenantId, user.id, String(req.params.id));
      if (!notification) return res.status(404).json({ error: 'Notification not found' });
      res.json(notification);
    } catch (error) {
      console.error('Error marking notification as read:', error);
      res.status(500).json({ error: 'Failed to mark as read' });
    }
  });

  router.post('/read-all', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const isAdmin = ADMIN_ROLES.includes(user.role);
      if (isAdmin) {
        await notificationRepository.markAllReadByTenant(user.tenantId);
      } else {
        await notificationRepository.markAllRead(user.tenantId, user.id);
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      res.status(500).json({ error: 'Failed to mark all as read' });
    }
  });

  router.delete('/read-all', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const isAdmin = ADMIN_ROLES.includes(user.role);
      if (isAdmin) {
        await notificationRepository.deleteAllReadByTenant(user.tenantId);
      } else {
        await notificationRepository.deleteAllRead(user.tenantId, user.id);
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting read notifications:', error);
      res.status(500).json({ error: 'Failed to delete read notifications' });
    }
  });

  router.delete('/:id', authenticateToken, validateUUIDParam(), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const isAdmin = ADMIN_ROLES.includes(user.role);
      const deleted = isAdmin
        ? await notificationRepository.deleteOneByTenant(user.tenantId, String(req.params.id))
        : await notificationRepository.deleteOne(user.tenantId, user.id, String(req.params.id));
      if (!deleted) return res.status(404).json({ error: 'Notification not found' });
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting notification:', error);
      res.status(500).json({ error: 'Failed to delete notification' });
    }
  });

  return router;
}
