import { api, PaginatedResponse } from './apiClient';
export const leadApi = {
  getLeads: (page = 1, pageSize = 20, filters?: Record<string, any>): Promise<PaginatedResponse<any>> =>
    api.get('/api/leads', { page, pageSize, ...filters }),
  getLeadsCursor: (pageSize = 20, cursor: string | undefined, filters?: Record<string, any>): Promise<any> =>
    // 'FIRST' is a sentinel for the first page: apiClient strips empty strings so we
    // use a non-empty value; the server's base64-JSON decode will fail gracefully and
    // treat any undecodable cursor as page 1.
    api.get('/api/leads', { cursor: cursor ?? 'FIRST', pageSize, ...filters }),
  getLeadById: (id: string): Promise<any> =>
    api.get(`/api/leads/${id}`),
  createLead: (data: Record<string, any>): Promise<any> =>
    api.post('/api/leads', data),
  updateLead: (id: string, data: Record<string, any>): Promise<any> =>
    api.put(`/api/leads/${id}`, data),
  updateMarketingConsent: (id: string, consent: boolean, source = 'crm'): Promise<any> =>
    api.patch(`/api/leads/${id}/marketing-consent`, { consent, source }),
  mergeLead: (id: string, data: Record<string, any>): Promise<any> =>
    api.patch(`/api/leads/${id}/merge`, data),
  deleteLead: (id: string): Promise<any> =>
    api.delete(`/api/leads/${id}`),
  getInteractions: (leadId: string): Promise<any[]> =>
    api.get(`/api/leads/${leadId}/interactions`),
  sendInteraction: (leadId: string, data: { content: string; channel?: string; type?: string; metadata?: any }): Promise<any> =>
    api.post(`/api/leads/${leadId}/interactions`, data),
};