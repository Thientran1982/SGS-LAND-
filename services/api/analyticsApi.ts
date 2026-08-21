import { api } from './apiClient';
export const analyticsApi = {
  getSummary: (timeRange?: string): Promise<any> =>
    api.get('/api/analytics/summary', timeRange ? { timeRange } : undefined),
  getKpiTargets: (year?: number, month?: number): Promise<any[]> =>
    api.get('/api/analytics/kpi-targets', year && month ? { year, month } : undefined),
  updateKpiTargets: (data: { year: number; month: number; targets: Array<{ metric: string; monthlyTarget: number; quarterTarget: number }> }): Promise<any[]> =>
    api.put('/api/analytics/kpi-targets', data),
  getAuditLogs: (page = 1, pageSize = 50, filters?: Record<string, any>): Promise<any> =>
    api.get('/api/enterprise/audit-logs', { page, pageSize, ...filters }),
  getBiMarts: (timeRange?: string): Promise<any> =>
    api.get('/api/analytics/bi-marts', timeRange ? { timeRange } : undefined),
  createCampaignCost: (data: { campaignName: string; source: string; cost: number; period: string }): Promise<any> =>
    api.post('/api/analytics/campaign-costs', data),
  updateCampaignCost: (id: string, cost: number): Promise<any> =>
    api.put(`/api/analytics/campaign-costs/${id}`, { cost }),
  deleteCampaignCost: (id: string): Promise<any> =>
    api.delete(`/api/analytics/campaign-costs/${id}`),
  getVisitorStats: (days?: number): Promise<any> =>
    api.get('/api/analytics/visitors', days ? { days } : undefined),
  getVisitorFunnel: (days = 30, filters?: { projectCode?: string; source?: string }): Promise<any> =>
    api.get('/api/analytics/visitor-funnel', { days, ...filters }),
  getSystemMetrics: (): Promise<any> =>
    api.get('/api/system/metrics'),
};