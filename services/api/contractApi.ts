import { api, PaginatedResponse } from './apiClient';

export const contractApi = {
  getContracts: (page = 1, pageSize = 20, filters?: Record<string, any>): Promise<PaginatedResponse<any>> =>
    api.get('/api/contracts', { page, pageSize, ...filters }),

  getContractById: (id: string): Promise<any> =>
    api.get(`/api/contracts/${id}`),

  createContract: (data: Record<string, any>): Promise<any> =>
    api.post('/api/contracts', data),

  updateContract: (id: string, data: Record<string, any>): Promise<any> =>
    api.put(`/api/contracts/${id}`, data),

  deleteContract: (id: string): Promise<void> =>
    api.delete(`/api/contracts/${id}`),
};
