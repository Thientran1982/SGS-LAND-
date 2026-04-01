import { api, PaginatedResponse } from './apiClient';

interface ContractStats {
  total: number;
  draftCount: number;
  pendingCount: number;
  signedCount: number;
  cancelledCount: number;
  signedValue: number;
  totalValue: number;
}

interface ContractListResponse extends PaginatedResponse<any> {
  stats: ContractStats;
}

export const contractApi = {
  getContracts: (page = 1, pageSize = 20, filters?: Record<string, any>): Promise<ContractListResponse> =>
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
