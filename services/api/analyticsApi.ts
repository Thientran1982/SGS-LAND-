import { api } from './apiClient';

export const analyticsApi = {
  getSummary: (timeRange?: string): Promise<any> =>
    api.get('/api/analytics/summary', timeRange ? { timeRange } : undefined),

  getAuditLogs: (page = 1, pageSize = 50, filters?: Record<string, any>): Promise<any> =>
    api.get('/api/analytics/audit-logs', { page, pageSize, ...filters }),

  getBiMarts: (timeRange?: string): Promise<any> =>
    api.get('/api/analytics/bi-marts', timeRange ? { timeRange } : undefined),

  createCampaignCost: (data: { campaignName: string; source: string; cost: number; period: string }): Promise<any> =>
    api.post('/api/analytics/campaign-costs', data),

  updateCampaignCost: (id: string, cost: number): Promise<any> =>
    api.put(`/api/analytics/campaign-costs/${id}`, { cost }),
};
