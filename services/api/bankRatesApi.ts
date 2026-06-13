import { api } from './apiClient';

export const bankRatesApi = {
  getPublicRates: () =>
    api.get('/api/public/bank-rates'),
  
  getRates: () =>
    api.get('/api/bank-rates'),
  
  updateRate: (id: string, data: Record<string, any>) =>
    api.put(`/api/bank-rates/${id}`, data),
  
  deleteRate: (id: string) =>
    api.delete(`/api/bank-rates/${id}`),
  
  createRate: (data: Record<string, any>) =>
    api.post('/api/bank-rates', data),
};
