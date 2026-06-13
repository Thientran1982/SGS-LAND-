import { api } from './apiClient';

export const sequenceApi = {
  getAll: () =>
    api.get('/api/sequences'),
  
  getById: (id: string) =>
    api.get(`/api/sequences/${id}`),
  
  create: (data: Record<string, any>) =>
    api.post('/api/sequences', data),
  
  update: (id: string, data: Record<string, any>) =>
    api.put(`/api/sequences/${id}`, data),
  
  delete: (id: string) =>
    api.delete(`/api/sequences/${id}`),
  
  start: (id: string) =>
    api.post(`/api/sequences/${id}/start`, {}),
  
  pause: (id: string) =>
    api.post(`/api/sequences/${id}/pause`, {}),
};
