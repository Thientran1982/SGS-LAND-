import { Router, Request, Response } from 'express';
import { notificationRepository } from '../repositories/notificationRepository';
import { validateUUIDParam } from '../middleware/validation';

export function createNotificationRoutes(authenticateToken: any) {
  const router = Router();

  router.get('/', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const notifications = await notificationRepository.findByUser(user.tenantId, user.id, 40);
      const unreadCount = await notificationRepository.countUnread(user.tenantId, user.id);
      res.json({ notifications, unreadCount });
    } catch (error) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({ error: 'Failed to fetch notifications' });
    }
  });

  router.get('/unread-count', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const count = await notificationRepository.countUnread(user.tenantId, user.id);
      res.json({ count });
    } catch (error) {
      console.error('Error fetching unread count:', error);
      res.status(500).json({ error: 'Failed to fetch unread count' });
    }
  });

  router.patch('/:id/read', authenticateToken, validateUUIDParam(), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const notification = await notificationRepository.markRead(user.tenantId, user.id, req.params.id);
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
      await notificationRepository.markAllRead(user.tenantId, user.id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      res.status(500).json({ error: 'Failed to mark all as read' });
    }
  });

  return router;
}
