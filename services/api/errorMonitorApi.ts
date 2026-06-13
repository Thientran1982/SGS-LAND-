import { api } from './apiClient';

export const errorMonitorApi = {
  getLogs: (params?: Record<string, any>) =>
    api.get('/api/error-logs', params),
  
  getStats: () =>
    api.get('/api/error-logs/stats'),
  
  resolveLog: (id: string) =>
    api.patch(`/api/error-logs/${id}/resolve`, {}),
  
  resolveAll: () =>
    api.post('/api/error-logs/resolve-all', {}),
  
  clearResolved: () =>
    api.delete('/api/error-logs/resolved'),
};
