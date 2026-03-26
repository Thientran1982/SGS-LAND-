import { api, PaginatedResponse } from './apiClient';

export const userApi = {
  getUsers: (page = 1, pageSize = 50, filters?: Record<string, any>): Promise<PaginatedResponse<any>> =>
    api.get('/api/users', { page, pageSize, ...filters }),

  getMembers: (pageSize = 50, search?: string): Promise<{ data: any[]; total: number }> =>
    api.get('/api/users/members', { pageSize, ...(search ? { search } : {}) }),

  getMe: (): Promise<{ user: any }> =>
    api.get('/api/users/me'),

  getTeams: (): Promise<any[]> =>
    api.get('/api/users/teams'),

  updateUser: (id: string, data: Record<string, any>): Promise<any> =>
    api.put(`/api/users/${id}`, data),

  changePassword: (id: string, currentPassword: string, newPassword: string): Promise<any> =>
    api.post(`/api/users/${id}/password`, { currentPassword, newPassword }),

  changeEmail: (id: string, currentPassword: string, newEmail: string): Promise<any> =>
    api.post(`/api/users/${id}/email`, { currentPassword, newEmail }),

  createUser: (data: Record<string, any>): Promise<any> =>
    api.post('/api/users', data),

  deleteUser: (id: string): Promise<any> =>
    api.delete(`/api/users/${id}`),

  inviteUser: (data: Record<string, any>): Promise<any> =>
    api.post('/api/users/invite', data),

  resendInvite: (userId: string): Promise<any> =>
    api.post(`/api/users/${userId}/resend-invite`, {}),
};
