import { api } from './apiClient';

export const inboxApi = {
  getThreads: (): Promise<any[]> =>
    api.get('/api/inbox/threads'),

  markAsRead: (leadId: string): Promise<any> =>
    api.put(`/api/inbox/threads/${leadId}/read`),

  deleteConversation: (leadId: string): Promise<any> =>
    api.delete(`/api/inbox/threads/${leadId}`),

  getStats: (since?: string): Promise<any> =>
    api.get('/api/inbox/stats', since ? { since } : undefined),
};
