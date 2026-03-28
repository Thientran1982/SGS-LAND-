import { api } from './apiClient';

export interface AppNotification {
  id: string;
  userId?: string;
  userName?: string;
  type: string;
  title: string;
  body?: string;
  metadata?: Record<string, any>;
  readAt: string | null;
  createdAt: string;
}

export const notificationApi = {
  getAll: (): Promise<{ notifications: AppNotification[]; unreadCount: number }> =>
    api.get('/api/notifications'),

  getUnreadCount: (): Promise<{ count: number }> =>
    api.get('/api/notifications/unread-count'),

  markRead: (id: string): Promise<AppNotification> =>
    api.patch(`/api/notifications/${id}/read`, {}),

  markAllRead: (): Promise<{ success: boolean }> =>
    api.post('/api/notifications/read-all', {}),
};
