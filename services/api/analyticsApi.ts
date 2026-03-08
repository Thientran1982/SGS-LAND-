import { api } from './apiClient';

export const analyticsApi = {
  getSummary: (timeRange?: string): Promise<any> =>
    api.get('/api/analytics/summary', timeRange ? { timeRange } : undefined),

  getAuditLogs: (page = 1, pageSize = 50, filters?: Record<string, any>): Promise<any> =>
    api.get('/api/analytics/audit-logs', { page, pageSize, ...filters }),
};
