import { api } from './apiClient';

export const valuationApi = {
  getQuota: () =>
    api.get('/api/valuation/quota'),
  
  getTeaser: (params: Record<string, any>) =>
    api.get(`/api/valuation/teaser?${new URLSearchParams(params as any).toString()}`),
  
  appraise: (data: Record<string, any>) =>
    api.post('/api/valuation/appraise', data),
  
  getHistory: () =>
    api.get('/api/valuation/history'),
  
  getReport: (id: string) =>
    api.get(`/api/valuation/report/${id}`),
};
