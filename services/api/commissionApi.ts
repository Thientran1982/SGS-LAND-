import { api } from './apiClient';

export type PolicyType = 'FLAT' | 'TIERED' | 'MILESTONE';
export type LedgerStatus = 'PENDING' | 'DUE' | 'PAID' | 'CANCELLED';

export interface FlatConfig { ratePct: number; }
export interface TierBand { minUnitsThisMonth: number; ratePct: number; }
export interface TieredConfig { tiers: TierBand[]; }
export interface MilestoneStep { key: string; label: string; pct: number; offsetDays: number; }
export interface MilestoneConfig { ratePct: number; milestones: MilestoneStep[]; }
export type PolicyConfig = FlatConfig | TieredConfig | MilestoneConfig;

export interface CommissionPolicy {
  id: string;
  tenantId: string;
  projectId: string;
  version: number;
  type: PolicyType;
  config: PolicyConfig;
  active_from: string;
  active_to: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface LedgerItem {
  id: string;
  tenant_id: string;
  project_id: string;
  listing_id: string;
  policy_id: string | null;
  policy_version: number | null;
  policy_type: PolicyType | null;
  sale_date: string;
  sales_user_id: string | null;
  partner_tenant_id: string | null;
  sale_price: string | number;
  gross_amount: string | number;
  rate_pct: string | number | null;
  milestones: Array<{ key: string; label: string; pct: number; amount: number; dueDate: string; status: 'PENDING' | 'PAID' }>;
  status: LedgerStatus;
  paid_at: string | null;
  paid_note: string | null;
  paid_by: string | null;
  listing_code?: string | null;
  listing_title?: string | null;
  project_name?: string | null;
  project_code?: string | null;
  sales_user_name?: string | null;
  partner_tenant_name?: string | null;
}

export interface LedgerListResponse {
  data: LedgerItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ProjectCommissionSummary {
  totalCount: number;
  pending: number;
  due: number;
  paid: number;
  grossPending: number;
  grossPaid: number;
  dueSoonCount: number;
  overdueCount: number;
  grossDueSoon: number;
  grossOverdue: number;
  leaderboard: {
    partners: Array<{ partner_tenant_id: string | null; partner_name: string | null; units: number; gross: string | number }>;
    sales:    Array<{ sales_user_id: string | null; sales_name: string | null; units: number; gross: string | number }>;
  };
}

export const commissionApi = {
  // Policies (admin)
  listPolicies: (projectId: string): Promise<{ data: CommissionPolicy[] }> =>
    api.get(`/api/projects/${projectId}/commission-policies`),

  createPolicy: (projectId: string, body: { type: PolicyType; config: PolicyConfig }): Promise<CommissionPolicy> =>
    api.post(`/api/projects/${projectId}/commission-policies`, body),

  closeActivePolicy: (projectId: string): Promise<{ closed: number }> =>
    api.post(`/api/projects/${projectId}/commission-policies/close`),

  getProjectSummary: (projectId: string): Promise<ProjectCommissionSummary> =>
    api.get(`/api/projects/${projectId}/commission-summary`),

  // Ledger
  list: (params: {
    page?: number; pageSize?: number;
    projectId?: string; partnerTenantId?: string; salesUserId?: string;
    status?: LedgerStatus; fromDate?: string; toDate?: string;
  } = {}): Promise<LedgerListResponse> =>
    api.get('/api/commissions', params as any),

  markPaid: (id: string, note?: string): Promise<LedgerItem> =>
    api.patch(`/api/commissions/${id}/mark-paid`, { note: note || null }),

  markPaidBulk: (ids: string[], note?: string): Promise<{ updated: number; requested: number; ids: string[] }> =>
    api.post(`/api/commissions/mark-paid-bulk`, { ids, note: note || null }),

  exportXlsxUrl: (params: Record<string, string | undefined> = {}): string => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
    const qs = q.toString();
    return `/api/commissions/export.xlsx${qs ? `?${qs}` : ''}`;
  },
};
