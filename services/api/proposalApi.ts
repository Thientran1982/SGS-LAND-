import { api, PaginatedResponse } from './apiClient';

export const proposalApi = {
  getProposals: (page = 1, pageSize = 20, filters?: Record<string, any>): Promise<PaginatedResponse<any>> =>
    api.get('/api/proposals', { page, pageSize, ...filters }),

  getProposalById: (id: string): Promise<any> =>
    api.get(`/api/proposals/${id}`),

  getPendingProposals: (): Promise<any[]> =>
    api.get('/api/proposals/pending'),

  getProposalByToken: (token: string): Promise<any> =>
    api.get(`/api/proposals/token/${token}`),

  createProposal: (data: Record<string, any>): Promise<any> =>
    api.post('/api/proposals', data),

  updateStatus: (id: string, status: string): Promise<any> =>
    api.put(`/api/proposals/${id}/status`, { status }),

  deleteProposal: (id: string): Promise<any> =>
    api.delete(`/api/proposals/${id}`),
};
