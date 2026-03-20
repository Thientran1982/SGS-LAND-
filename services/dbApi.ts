import { leadApi } from './api/leadApi';
import { listingApi } from './api/listingApi';
import { proposalApi } from './api/proposalApi';
import { contractApi } from './api/contractApi';
import { inboxApi } from './api/inboxApi';
import { userApi } from './api/userApi';
import { analyticsApi } from './api/analyticsApi';
import { knowledgeApi } from './api/knowledgeApi';
import { api } from './api/apiClient';
import { PlanTier, Plan, UserRole, ThreadStatus } from '../types';
import { ROUTES } from '../config/routes';

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

export const PLANS: Record<PlanTier, Plan> = {
  [PlanTier.INDIVIDUAL]: {
    id: PlanTier.INDIVIDUAL,
    name: 'Individual',
    price: 0,
    features: [
      'CRM cơ bản (quản lý lead, listing)',
      '1 người dùng',
      'Tối đa 5 tin đăng',
      '100 email/tháng',
      '50 AI request/tháng',
    ],
    limits: { seats: 1, emailsPerMonth: 100, aiRequestsPerMonth: 50 }
  },
  [PlanTier.TEAM]: {
    id: PlanTier.TEAM,
    name: 'Team',
    price: 49,
    features: [
      'CRM nâng cao (đầy đủ tính năng)',
      'Tối đa 5 người dùng',
      'Tin đăng không giới hạn',
      'Phân công lead tự động (routing)',
      '2.000 email/tháng',
      '500 AI request/tháng',
    ],
    limits: { seats: 5, emailsPerMonth: 2000, aiRequestsPerMonth: 500 }
  },
  [PlanTier.ENTERPRISE]: {
    id: PlanTier.ENTERPRISE,
    name: 'Enterprise',
    price: 199,
    features: [
      'Toàn bộ tính năng (Full Suite)',
      'Người dùng không giới hạn',
      'Truy cập API & tích hợp',
      'AI Model tùy chỉnh theo doanh nghiệp',
      'Hỗ trợ ưu tiên 24/7',
      '100.000 email/tháng',
      '10.000 AI request/tháng',
    ],
    limits: { seats: 999, emailsPerMonth: 100000, aiRequestsPerMonth: 10000 }
  }
};

const CACHE_TTL = 30_000;

class SimpleCache {
  private store = new Map<string, { data: any; ts: number }>();

  get(key: string): any | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > CACHE_TTL) return null;
    return entry.data;
  }

  set(key: string, data: any) {
    this.store.set(key, { data, ts: Date.now() });
  }

  invalidate(prefix: string) {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }
}

const _cache = new SimpleCache();

class DatabaseApiClient {
  private currentTenantId: string = DEFAULT_TENANT_ID;
  private cachedCurrentUser: any = null;
  private currentUserPromise: Promise<any> | null = null;
  private _isLoggedOut: boolean = false;

  async getCurrentUser() {
    if (this._isLoggedOut) return null;
    if (this.cachedCurrentUser) return this.cachedCurrentUser;
    if (!this.currentUserPromise) {
      this.currentUserPromise = userApi.getMe()
        .then(result => {
          this.cachedCurrentUser = result.user;
          return result.user;
        })
        .catch((err) => {
          console.warn('[dbApi] getCurrentUser cache error:', err?.message || err);
          return null;
        })
        .finally(() => {
          this.currentUserPromise = null;
        });
    }
    return this.currentUserPromise;
  }

  clearUserCache() {
    this.cachedCurrentUser = null;
    this.currentUserPromise = null;
  }

  async getLeads(page = 1, pageSize = 20, filters?: any) {
    const params: any = {};
    if (filters?.stage && filters.stage !== 'ALL') params.stage = filters.stage;
    if (filters?.stages) params.stages = filters.stages.join(',');
    if (filters?.assignedTo) params.assignedTo = filters.assignedTo;
    if (filters?.source && filters.source !== 'ALL') params.source = filters.source;
    if (filters?.search) params.search = filters.search;
    if (filters?.slaBreached !== undefined) params.slaBreached = filters.slaBreached;
    if (filters?.sort) params.sort = filters.sort;
    if (filters?.order) params.order = filters.order;

    const cacheKey = `leads:${page}:${pageSize}:${JSON.stringify(params)}`;
    const cached = _cache.get(cacheKey);

    const fetchFresh = async () => {
      try {
        const result = await leadApi.getLeads(page, pageSize, params);
        const out = {
          data: result.data,
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
          totalPages: result.totalPages,
          stats: (result as any).stats,
        };
        _cache.set(cacheKey, out);
        return out;
      } catch (error) {
        console.error('getLeads error:', error);
        return { data: [], total: 0, page: 1, pageSize };
      }
    };

    if (cached) {
      fetchFresh();
      return cached;
    }
    return fetchFresh();
  }

  async getLeadById(id: string) {
    try {
      return await leadApi.getLeadById(id);
    } catch {
      return null;
    }
  }

  async createLead(data: any) {
    _cache.invalidate('leads:');
    return leadApi.createLead(data);
  }

  async createPublicLead(data: { name: string; phone: string; notes?: string; source?: string; stage?: string }) {
    return api.post<any>('/api/public/leads', data);
  }

  async updateLead(id: string, data: any) {
    _cache.invalidate('leads:');
    return leadApi.updateLead(id, data);
  }

  async deleteLead(id: string) {
    _cache.invalidate('leads:');
    return leadApi.deleteLead(id);
  }

  async getListings(page = 1, pageSize = 20, filters?: any) {
    const params: any = {};
    if (filters?.type && filters.type !== 'ALL') params.type = filters.type;
    if (filters?.status && filters.status !== 'ALL') params.status = filters.status;
    if (filters?.transaction && filters.transaction !== 'ALL') params.transaction = filters.transaction;
    if (filters?.search) params.search = filters.search;
    if (filters?.priceMin) params.priceMin = filters.priceMin;
    if (filters?.priceMax) params.priceMax = filters.priceMax;
    if (filters?.projectCode) params.projectCode = filters.projectCode;

    const cacheKey = `listings:${page}:${pageSize}:${JSON.stringify(params)}`;
    const cached = _cache.get(cacheKey);

    const fetchFresh = async () => {
      try {
        const result = await listingApi.getListings(page, pageSize, params);
        const out = {
          data: result.data,
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
          totalPages: (result as any).totalPages,
          stats: (result as any).stats,
        };
        _cache.set(cacheKey, out);
        return out;
      } catch (error) {
        console.error('getListings error:', error);
        return { data: [], total: 0, page: 1, pageSize };
      }
    };

    if (cached) {
      fetchFresh();
      return cached;
    }
    return fetchFresh();
  }

  async getListingById(id: string) {
    try {
      return await listingApi.getListingById(id);
    } catch {
      try {
        return await api.get<any>(`/api/public/listings/${id}`);
      } catch {
        return null;
      }
    }
  }

  async getPublicListings(page = 1, pageSize = 20, filters?: any) {
    try {
      const params: any = { page, pageSize };
      if (filters?.type && filters.type !== 'ALL') params.type = filters.type;
      if (filters?.transaction && filters.transaction !== 'ALL') params.transaction = filters.transaction;
      if (filters?.search) params.search = filters.search;
      if (filters?.priceMin) params.priceMin = filters.priceMin;
      if (filters?.priceMax) params.priceMax = filters.priceMax;
      const result = await api.get<any>('/api/public/listings', { params });
      return {
        data: result.data || [],
        total: result.total || 0,
        page: result.page || 1,
        pageSize: result.pageSize || pageSize,
        totalPages: result.totalPages || 0,
      };
    } catch {
      return { data: [], total: 0, page: 1, pageSize, totalPages: 0 };
    }
  }

  async createListing(data: any) {
    _cache.invalidate('listings:');
    return listingApi.createListing(data);
  }

  async updateListing(id: string, data: any) {
    _cache.invalidate('listings:');
    return listingApi.updateListing(id, data);
  }

  async deleteListing(id: string) {
    _cache.invalidate('listings:');
    return listingApi.deleteListing(id);
  }

  async toggleFavorite(listingId: string) {
    return listingApi.toggleFavorite(listingId);
  }

  async getFavorites(page = 1, pageSize = 100) {
    try {
      const all = (await listingApi.getFavorites()) as any[];
      const total = all.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const start = (page - 1) * pageSize;
      const data = all.slice(start, start + pageSize);
      return { data, total, totalPages, page, pageSize };
    } catch {
      return { data: [], total: 0, totalPages: 1, page: 1, pageSize };
    }
  }

  async getProposals(page = 1, pageSize = 20, filters?: any) {
    try {
      const params: any = {};
      if (filters?.status) params.status = filters.status;
      if (filters?.leadId) params.leadId = filters.leadId;

      const result = await proposalApi.getProposals(page, pageSize, params);
      return {
        data: result.data,
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
      };
    } catch (error) {
      console.error('getProposals error:', error);
      return { data: [], total: 0, page: 1, pageSize, totalPages: 0 };
    }
  }

  async getProposalById(id: string) {
    try {
      return await proposalApi.getProposalById(id);
    } catch {
      return null;
    }
  }

  async createProposal(data: any) {
    return proposalApi.createProposal(data);
  }

  async updateProposal(id: string, data: any) {
    if (data.status) {
      return proposalApi.updateStatus(id, data.status);
    }
    return data;
  }

  async deleteProposal(id: string) {
    return proposalApi.deleteProposal(id);
  }

  async getPendingProposals() {
    try {
      return await proposalApi.getPendingProposals();
    } catch {
      return [];
    }
  }

  async getContracts(page = 1, pageSize = 20, filters?: any) {
    const cleanFilters: Record<string, any> = {};
    if (filters) {
      for (const [k, v] of Object.entries(filters)) {
        if (v && v !== 'ALL') cleanFilters[k] = v;
      }
    }

    const cacheKey = `contracts:${page}:${pageSize}:${JSON.stringify(cleanFilters)}`;
    const cached = _cache.get(cacheKey);

    const fetchFresh = async () => {
      try {
        const result = await contractApi.getContracts(page, pageSize, cleanFilters);
        const out = {
          data: result.data,
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
          totalPages: result.totalPages,
        };
        _cache.set(cacheKey, out);
        return out;
      } catch (error) {
        console.error('getContracts error:', error);
        return { data: [], total: 0, page: 1, pageSize, totalPages: 0 };
      }
    };

    if (cached) {
      fetchFresh();
      return cached;
    }
    return fetchFresh();
  }

  async getContractById(id: string) {
    try {
      return await contractApi.getContractById(id);
    } catch {
      return null;
    }
  }

  async createContract(data: any) {
    _cache.invalidate('contracts:');
    return contractApi.createContract(data);
  }

  async updateContract(id: string, data: any) {
    _cache.invalidate('contracts:');
    return contractApi.updateContract(id, data);
  }

  async getInboxThreads() {
    try {
      const raw = await inboxApi.getThreads();
      return (raw || []).map((r: any) => ({
        lead: {
          id: r.leadId,
          name: r.leadName,
          phone: r.leadPhone,
          attributes: { avatar: r.leadAvatar },
          stage: r.leadStage,
          assignedTo: r.assignedTo,
          score: r.leadScore ?? undefined,
        } as any,
        lastMessage: r.lastTimestamp ? {
          id: `thread-${r.leadId}`,
          content: r.lastMessage || '',
          channel: r.lastChannel,
          direction: r.lastDirection,
          timestamp: r.lastTimestamp,
          type: r.lastType || 'TEXT',
          status: 'SENT',
          leadId: r.leadId,
          metadata: {},
        } as any : undefined,
        unreadCount: r.unreadCount || 0,
        status: ThreadStatus.AI_ACTIVE,
      }));
    } catch {
      return [];
    }
  }

  async getInteractions(leadId: string) {
    try {
      return await leadApi.getInteractions(leadId);
    } catch {
      return [];
    }
  }

  async sendInteraction(leadId: string, content: string, channel: string, options?: any) {
    return leadApi.sendInteraction(leadId, {
      content,
      channel,
      type: options?.type || 'TEXT',
      metadata: options?.metadata,
    });
  }

  async markThreadAsRead(leadId: string) {
    return inboxApi.markAsRead(leadId);
  }

  async deleteConversation(leadId: string) {
    return inboxApi.deleteConversation(leadId);
  }

  async getUsers() {
    try {
      const result = await userApi.getUsers();
      return result.data;
    } catch {
      return [];
    }
  }

  async getTeams() {
    try {
      return await userApi.getTeams();
    } catch {
      return [];
    }
  }

  async getAnalytics(timeRange?: string, _language?: string) {
    try {
      return await analyticsApi.getSummary(timeRange);
    } catch (error) {
      console.error('getAnalytics error:', error);
      return {
        totalLeads: 0, newLeads: 0, wonLeads: 0, lostLeads: 0,
        totalListings: 0, availableListings: 0,
        totalProposals: 0, approvedProposals: 0,
        totalContracts: 0, signedContracts: 0,
        revenue: 0, pipelineValue: 0, winProbability: 0, aiDeflectionRate: 0,
        leadsByStage: {}, leadsBySource: {},
        revenueByMonth: [],
      };
    }
  }

  async getAuditLogs(page = 1, pageSize = 50, filters?: { entityType?: string; action?: string; actorId?: string; since?: string }) {
    try {
      const result = await analyticsApi.getAuditLogs(page, pageSize, filters);
      return result as { data: any[]; total: number; page: number; pageSize: number; totalPages: number };
    } catch {
      return { data: [], total: 0, page: 1, pageSize, totalPages: 0 };
    }
  }

  async globalSearch(query: string) {
    try {
      const [leadsRes, listingsRes, usersRes] = await Promise.all([
        leadApi.getLeads(1, 5, { search: query }),
        listingApi.getListings(1, 5, { search: query }),
        userApi.getUsers(1, 5, { search: query }),
      ]);
      return {
        leads: leadsRes.data || [],
        listings: listingsRes.data || [],
        users: usersRes.data || [],
        total: (leadsRes.total || 0) + (listingsRes.total || 0) + (usersRes.total || 0),
      };
    } catch {
      return { leads: [], listings: [], users: [], total: 0 };
    }
  }

  async checkDuplicateLead(phone: string) {
    try {
      const result = await leadApi.getLeads(1, 1, { search: phone });
      return result.data.find((l: any) => l.phone === phone) || null;
    } catch {
      return null;
    }
  }

  async getEnterpriseConfig(): Promise<any> {
    try {
      const res = await fetch('/api/enterprise/config', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch enterprise config');
      return await res.json();
    } catch {
      return {
        id: '',
        tenantId: this.currentTenantId,
        language: 'vi',
        onboarding: { completedSteps: [], isDismissed: false, percentage: 0 },
        domains: [],
        sso: { enabled: false, provider: 'OIDC' },
        scim: { enabled: false, token: '', tokenCreatedAt: new Date().toISOString() },
        facebookPages: [],
        zalo: { enabled: false, oaId: '', oaName: '', webhookUrl: '' },
        email: { enabled: false, host: '', port: 587, secure: false, user: '', password: '', fromName: 'SGS LAND', fromAddress: '' },
        ipAllowlist: [],
        sessionTimeoutMins: 480,
        retention: { days: 365, autoDelete: false },
        legalHold: false,
        dlpRules: [],
        slaConfig: { responseTimeMinutes: 30, escalationTimeMinutes: 120 },
      };
    }
  }

  async updateEnterpriseConfig(data: any) {
    const res = await fetch('/api/enterprise/config', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to update enterprise config' }));
      throw new Error(err.error || 'Failed to update enterprise config');
    }
    return res.json();
  }

  async getScoringConfig() {
    try {
      return await api.get<any>('/api/scoring/config');
    } catch {
      return {
        weights: { engagement: 30, budget: 25, timeline: 20, fit: 15, source: 10 },
        thresholds: { A: 80, B: 60, C: 40, D: 20 },
      };
    }
  }

  async updateScoringConfig(data: any) {
    return api.put<any>('/api/scoring/config', data);
  }

  async getRoutingRules() {
    try {
      const result = await fetch('/api/routing-rules', { credentials: 'include' });
      if (!result.ok) throw new Error('Failed to fetch routing rules');
      return await result.json();
    } catch {
      return [];
    }
  }

  async createRoutingRule(data: any) {
    const result = await fetch('/api/routing-rules', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!result.ok) throw new Error('Failed to create routing rule');
    return result.json();
  }

  async updateRoutingRule(id: string, data: any) {
    const result = await fetch(`/api/routing-rules/${id}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!result.ok) throw new Error('Failed to update routing rule');
    return result.json();
  }

  async deleteRoutingRule(id: string) {
    const result = await fetch(`/api/routing-rules/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!result.ok) throw new Error('Failed to delete routing rule');
    return true;
  }

  async getSequences() {
    try {
      const result = await fetch('/api/sequences', { credentials: 'include' });
      if (!result.ok) throw new Error('Failed to fetch sequences');
      return await result.json();
    } catch {
      return [];
    }
  }

  async createSequence(data: any) {
    const result = await fetch('/api/sequences', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!result.ok) throw new Error('Failed to create sequence');
    return result.json();
  }

  async updateSequence(id: string, data: any) {
    const result = await fetch(`/api/sequences/${id}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!result.ok) throw new Error('Failed to update sequence');
    return result.json();
  }

  async deleteSequence(id: string) {
    const result = await fetch(`/api/sequences/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!result.ok) throw new Error('Failed to delete sequence');
    return true;
  }

  async getTemplates() {
    try {
      const result = await fetch('/api/templates', { credentials: 'include' });
      if (!result.ok) throw new Error('Failed to fetch templates');
      return await result.json();
    } catch {
      return [];
    }
  }

  async getDocuments(search?: string) {
    try {
      const result = await knowledgeApi.getDocuments(1, 50, search);
      return result.data;
    } catch {
      return [];
    }
  }

  async createDocument(data: any) {
    return knowledgeApi.createDocument(data);
  }

  async deleteDocument(id: string) {
    await knowledgeApi.deleteDocument(id);
    return true;
  }

  async getArticles(page = 1, pageSize = 50, params?: Record<string, any>) {
    try {
      const result = await knowledgeApi.getArticles(page, pageSize, params);
      return result;
    } catch {
      return { data: [], total: 0 };
    }
  }

  async getPublicArticles(page = 1, pageSize = 50, params?: Record<string, any>) {
    try {
      const result = await knowledgeApi.getPublicArticles(page, pageSize, params);
      return result;
    } catch {
      return { data: [], total: 0 };
    }
  }

  async getArticleById(id: string) {
    try {
      return await knowledgeApi.getPublicArticleById(id);
    } catch {
      return null;
    }
  }

  async createArticle(data: any) {
    return knowledgeApi.createArticle(data);
  }

  async updateArticle(id: string, data: any) {
    return knowledgeApi.updateArticle(id, data);
  }

  async deleteArticle(id: string) {
    await knowledgeApi.deleteArticle(id);
    return true;
  }

  async getSystemHealth() {
    try {
      const response = await fetch('/api/health');
      return response.json();
    } catch {
      return { status: 'unknown', components: [] };
    }
  }

  async generateBiMarts(timeRange?: string) {
    try {
      return await analyticsApi.getBiMarts(timeRange);
    } catch (error) {
      console.error('generateBiMarts error:', error);
      return { funnel: [], attribution: [], conversionByPeriod: [], campaignCosts: [] };
    }
  }

  async updateCampaignCost(id: string, cost: number) {
    try {
      return await analyticsApi.updateCampaignCost(id, cost);
    } catch (error) {
      console.error('updateCampaignCost error:', error);
      throw error;
    }
  }

  async createCampaignCost(data: { campaignName: string; source: string; cost: number; period: string }) {
    try {
      return await analyticsApi.createCampaignCost(data);
    } catch (error) {
      console.error('createCampaignCost error:', error);
      throw error;
    }
  }

  async deleteCampaignCost(id: string) {
    try {
      return await analyticsApi.deleteCampaignCost(id);
    } catch (error) {
      console.error('deleteCampaignCost error:', error);
      throw error;
    }
  }

  async duplicateLead(id: string) {
    const lead = await this.getLeadById(id);
    if (!lead) throw new Error('Lead not found');
    const { id: _id, createdAt, updatedAt, score, ...data } = lead;
    const uniqueSuffix = Date.now().toString().slice(-8);
    const placeholderPhone = `09${uniqueSuffix}`;
    return this.createLead({
      ...data,
      name: `${data.name} (Bản sao)`,
      phone: placeholderPhone,
    });
  }

  async receiveWebhookMessage(data: any) {
    return data;
  }

  async createUser(data: any) {
    return userApi.createUser(data);
  }

  async updateUser(id: string, data: any) {
    return userApi.updateUser(id, data);
  }

  async deleteUser(id: string) {
    return userApi.deleteUser(id);
  }

  async getTenantUsers(page = 1, pageSize = 50, search?: string, role?: string, sort?: any, status?: string) {
    try {
      const params: any = {};
      if (search) params.search = search;
      if (role) params.role = role;
      if (status) params.status = status;
      if (sort?.field) params.sortField = sort.field;
      if (sort?.order) params.sortOrder = sort.order;
      const result = await userApi.getUsers(page, pageSize, params);
      return {
        data: result.data,
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
        stats: (result as any).stats || { activeCount: 0, pendingCount: 0 },
      };
    } catch {
      return { data: [], total: 0, page: 1, pageSize, totalPages: 0, stats: { activeCount: 0, pendingCount: 0 } };
    }
  }

  async authenticate(email: string, password: string) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Login failed' }));
      throw new Error(err.error || 'Login failed');
    }
    const data = await res.json();
    this._isLoggedOut = false;
    this.cachedCurrentUser = data.user;
    window.dispatchEvent(new CustomEvent('auth:login'));
    return data.user;
  }

  async register(name: string, email: string, password: string, company?: string) {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, company }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Registration failed' }));
      throw new Error(err.error || 'Registration failed');
    }
    return res.json();
  }

  async logout() {
    this._isLoggedOut = true;
    this.clearUserCache();
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    window.dispatchEvent(new CustomEvent('auth:logout'));
  }

  async requestPasswordReset(email: string) {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to request password reset');
    }
    return await res.json();
  }

  async resetPassword(token: string, newPassword: string) {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ token, newPassword }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to reset password');
    }
    return true;
  }

  async testSmtpConnection() {
    const res = await api.post<any>('/api/enterprise/test-smtp', {});
    return res;
  }

  async sendTestEmail(to?: string) {
    const res = await api.post<any>('/api/enterprise/send-test-email', { to });
    return res;
  }

  async authenticateViaSSO(email: string) {
    const res = await fetch('/api/auth/sso', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'SSO login failed' }));
      throw new Error(err.error || 'SSO login failed');
    }
    const data = await res.json();
    this._isLoggedOut = false;
    this.cachedCurrentUser = data.user;
    return data.user;
  }

  async verifySsoConfig(): Promise<{ success: boolean; error?: string; metadata?: any }> {
    const res = await api.post<any>('/api/enterprise/verify-sso', {});
    return res;
  }

  async changeUserPassword(userId: string, currentPassword: string, newPassword: string) {
    return userApi.changePassword(userId, currentPassword, newPassword);
  }

  async changeUserEmail(userId: string, currentPassword: string, newEmail: string) {
    const updated = await userApi.changeEmail(userId, currentPassword, newEmail);
    if (updated) {
      this.cachedCurrentUser = { ...this.cachedCurrentUser, ...updated };
    }
    return updated;
  }

  async inviteUser(data: any) {
    return userApi.inviteUser(data);
  }

  async resendInvite(userId: string) {
    return userApi.resendInvite(userId);
  }

  async updateUserProfile(id: string, data: any) {
    const updated = await userApi.updateUser(id, data);
    if (updated && this.cachedCurrentUser?.id === id) {
      this.cachedCurrentUser = { ...this.cachedCurrentUser, ...updated };
    }
    return updated;
  }

  setTenantContext(tenantId: string) {
    this.currentTenantId = tenantId;
  }

  async getProposalByToken(token: string) {
    try {
      return await proposalApi.getProposalByToken(token);
    } catch {
      return null;
    }
  }

  async approveProposal(id: string) {
    return proposalApi.updateStatus(id, 'APPROVED');
  }

  async rejectProposal(id: string) {
    return proposalApi.updateStatus(id, 'REJECTED');
  }

  async deleteContract(id: string) {
    _cache.invalidate('contracts:');
    return true;
  }

  async duplicateListing(id: string) {
    const listing = await this.getListingById(id);
    if (!listing) throw new Error('Listing not found');
    const { id: _id, createdAt, updatedAt, ...data } = listing;
    return this.createListing({ ...data, title: `${data.title} (Copy)` });
  }

  async uploadFiles(files: File[]): Promise<{ files: { filename: string; originalName: string; mimetype: string; size: number; url: string }[] }> {
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(err.error || 'Upload failed');
    }
    return res.json();
  }

  async deleteUploadedFile(filename: string): Promise<void> {
    const res = await fetch(`/api/upload/${encodeURIComponent(filename)}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Delete failed' }));
      throw new Error(err.error || 'Delete failed');
    }
  }

  async addToFavorites(listingId: string) {
    return this.toggleFavorite(listingId);
  }

  async removeFromFavorites(listingId: string) {
    return listingApi.removeFavorite(listingId);
  }

  async getSimilarListings(listingId: string) {
    try {
      const result = await api.get<any>('/api/public/listings', { params: { page: 1, pageSize: 8 } });
      const items: any[] = result.data || [];
      return items.filter((l: any) => l.id !== listingId).slice(0, 4);
    } catch {
      return [];
    }
  }

  async getSubscription() {
    try {
      return await api.get<any>('/api/billing/subscription');
    } catch {
      return { planId: 'ENTERPRISE', status: 'ACTIVE', currentPeriodEnd: new Date(Date.now() + 30 * 86400000).toISOString() };
    }
  }

  async getUsageMetrics() {
    try {
      return await api.get<any>('/api/billing/usage');
    } catch {
      return { seats: 0, emailsSent: 0, aiRequests: 0 };
    }
  }

  async getInvoices() {
    try {
      return await api.get<any[]>('/api/billing/invoices');
    } catch {
      return [];
    }
  }

  async upgradeSubscription(planId: string) {
    return api.post<any>('/api/billing/upgrade', { planId });
  }

  async getActiveSessions() {
    try {
      const result = await fetch('/api/sessions', { credentials: 'include' });
      if (!result.ok) throw new Error('Failed to fetch sessions');
      return await result.json();
    } catch {
      return [];
    }
  }

  async revokeSession(id: string) {
    try {
      const result = await fetch(`/api/sessions/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!result.ok) throw new Error('Failed to revoke session');
      return true;
    } catch {
      return false;
    }
  }

  async getUserMenu(role?: string) {
    const core = { id: 'core', labelKey: 'menu.core', items: [
      { id: 'home', labelKey: 'menu.home', route: ROUTES.LANDING, iconKey: ROUTES.LANDING },
      { id: 'dash', labelKey: 'menu.dashboard', route: ROUTES.DASHBOARD, iconKey: ROUTES.DASHBOARD },
      { id: 'leads', labelKey: 'menu.leads', route: ROUTES.LEADS, iconKey: ROUTES.LEADS },
      { id: 'contracts', labelKey: 'menu.contracts', route: ROUTES.CONTRACTS, iconKey: ROUTES.CONTRACTS },
      { id: 'inv', labelKey: 'menu.inventory', route: ROUTES.INVENTORY, iconKey: ROUTES.INVENTORY },
      { id: 'inbox', labelKey: 'menu.inbox', route: ROUTES.INBOX, iconKey: ROUTES.INBOX },
      { id: 'fav', labelKey: 'menu.favorites', route: ROUTES.FAVORITES, iconKey: ROUTES.FAVORITES }
    ]};

    const ops = { id: 'ops', labelKey: 'menu.operations', items: [
      { id: 'knowledge', labelKey: 'menu.knowledge', route: ROUTES.KNOWLEDGE, iconKey: ROUTES.KNOWLEDGE },
      { id: 'rep', labelKey: 'menu.reports', route: ROUTES.REPORTS, iconKey: ROUTES.REPORTS }
    ]};

    const sys = { id: 'sys', labelKey: 'menu.ecosystem', items: [
      { id: 'users', labelKey: 'menu.admin-users', route: ROUTES.ADMIN_USERS, iconKey: ROUTES.ADMIN_USERS },
      { id: 'set', labelKey: 'menu.enterprise-settings', route: ROUTES.ENTERPRISE_SETTINGS, iconKey: ROUTES.ENTERPRISE_SETTINGS }
    ]};

    const partnerCore = { id: 'partner-core', labelKey: 'menu.partner_core', items: [
      { id: 'projects', labelKey: 'menu.projects', route: ROUTES.PROJECTS, iconKey: ROUTES.PROJECTS },
      { id: 'inv', labelKey: 'menu.inventory', route: ROUTES.INVENTORY, iconKey: ROUTES.INVENTORY },
    ]};

    if (role === 'PARTNER_ADMIN' || role === 'PARTNER_AGENT') {
      return [partnerCore];
    }
    if (role === UserRole.ADMIN || role === UserRole.TEAM_LEAD) {
      const projectsItem = { id: 'projects', labelKey: 'menu.projects', route: ROUTES.PROJECTS, iconKey: ROUTES.PROJECTS };
      core.items.splice(3, 0, projectsItem); // insert after contracts
      return [core, ops, sys];
    } else if (role === UserRole.SALES) {
      return [core, ops];
    }
    return [core];
  }

  async ping() {
    return { ok: true };
  }

  async getAiConfig() {
    try {
      return await api.get<any>('/api/ai/governance/config');
    } catch {
      return { enabled: true, allowedModels: ['gemini-3-flash-preview'], defaultModel: 'gemini-3-flash-preview', budgetCapUsd: 100, currentSpendUsd: 0 };
    }
  }

  async saveAiConfig(data: any) {
    return api.put<any>('/api/ai/governance/config', data);
  }

  async getAiSafetyLogs() {
    try {
      const result = await api.get<any>('/api/ai/governance/safety-logs');
      return result.data || result;
    } catch {
      return [];
    }
  }

  async getPromptTemplates() {
    try {
      return await api.get<any[]>('/api/ai/governance/prompt-templates');
    } catch {
      return [];
    }
  }

  async createPromptTemplate(data: any) {
    return api.post<any>('/api/ai/governance/prompt-templates', data);
  }

  async getMarketplaceApps() {
    return [];
  }

  async getInstalledApps() {
    return [];
  }

  async installApp(appId: string) {
    return true;
  }

  async uninstallApp(appId: string) {
    return true;
  }

  async getConnectorConfigs() {
    return [];
  }

  async createConnectorConfig(data: any) {
    return { id: `conn_${Date.now()}`, ...data };
  }

  async saveConnectorConfig(id: string, data: any) {
    return { id, ...data };
  }

  async deleteConnectorConfig(id: string) {
    return true;
  }

  async getSyncJobs() {
    return [];
  }

  async createSyncJob(data: any) {
    return { id: `sync_${Date.now()}`, ...data };
  }

  async updateSyncJob(id: string, data: any) {
    return { id, ...data };
  }

  async getComplianceConfig() {
    return {
      dataRetentionDays: 365,
      auditLogEnabled: true,
      gdprEnabled: true,
      autoDeleteInactive: false,
      allowedDomains: [],
      backups: [],
    };
  }

  async saveComplianceConfig(data: any) {
    return data;
  }

  async getZaloStatus() {
    try {
      const res = await fetch('/api/enterprise/zalo/status', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch Zalo status');
      return res.json();
    } catch {
      return { webhookSecretConfigured: false, appIdConfigured: false, webhookUrl: '/api/webhooks/zalo' };
    }
  }

  async connectZaloOA(data: { appId: string; oaId: string; oaName: string; appSecret?: string; accessToken?: string }) {
    const res = await fetch('/api/enterprise/zalo/connect', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Không thể kết nối Zalo OA');
    }
    return res.json();
  }

  async updateZaloToken(accessToken: string, refreshToken?: string) {
    const res = await fetch('/api/enterprise/zalo/token', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken, refreshToken }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Không thể cập nhật Zalo Access Token');
    }
    return res.json();
  }

  async disconnectZaloOA() {
    const res = await fetch('/api/enterprise/zalo/disconnect', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Không thể ngắt kết nối Zalo OA');
    }
    return res.json();
  }

  async getFacebookStatus() {
    try {
      const res = await fetch('/api/enterprise/facebook/status', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch Facebook status');
      return res.json();
    } catch {
      return { appSecretConfigured: false, verifyTokenConfigured: false, webhookUrl: '/api/webhooks/facebook' };
    }
  }

  async connectFacebookPage(data: { name: string; pageId: string; pageUrl?: string; accessToken?: string }) {
    const res = await fetch('/api/enterprise/facebook/connect', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Không thể kết nối Facebook Page');
    }
    return res.json();
  }

  async disconnectFacebookPage(pageId: string) {
    const res = await fetch(`/api/enterprise/facebook/disconnect/${encodeURIComponent(pageId)}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Không thể ngắt kết nối Facebook Page');
    }
    return res.json();
  }

  async saveSSOConfig(data: any) {
    return this.updateEnterpriseConfig({ sso: data });
  }

  async saveEmailConfig(data: any) {
    return this.updateEnterpriseConfig({ email: data });
  }

  async addDomain(domain: string) {
    const res = await fetch('/api/enterprise/domains', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to add domain' }));
      throw new Error(err.error || 'Failed to add domain');
    }
    return res.json();
  }

  async removeDomain(domain: string) {
    const res = await fetch(`/api/enterprise/domains/${encodeURIComponent(domain)}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to remove domain' }));
      throw new Error(err.error || 'Failed to remove domain');
    }
    return res.json();
  }

  async verifyDomain(domain: string) {
    const res = await fetch(`/api/enterprise/domains/${encodeURIComponent(domain)}/verify`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Domain verification failed' }));
      throw new Error(err.error || 'Domain verification failed');
    }
    return res.json();
  }

  // -------------------------------------------------------------------------
  // Projects (B2B2C)
  // -------------------------------------------------------------------------

  async getProjects(page = 1, pageSize = 20, filters?: { status?: string; search?: string }) {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (filters?.status) params.set('status', filters.status);
    if (filters?.search) params.set('search', filters.search);
    const res = await fetch(`/api/projects?${params}`, { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch projects');
    return res.json();
  }

  async getProjectById(id: string) {
    const res = await fetch(`/api/projects/${id}`, { credentials: 'include' });
    if (!res.ok) throw new Error('Project not found');
    return res.json();
  }

  async createProject(data: any) {
    const res = await fetch('/api/projects', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Failed to create project'); }
    return res.json();
  }

  async updateProject(id: string, data: any) {
    const res = await fetch(`/api/projects/${id}`, {
      method: 'PUT', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Failed to update project'); }
    return res.json();
  }

  async deleteProject(id: string) {
    const res = await fetch(`/api/projects/${id}`, { method: 'DELETE', credentials: 'include' });
    if (!res.ok) throw new Error('Failed to delete project');
    return res.json();
  }

  async getProjectAccess(projectId: string) {
    const res = await fetch(`/api/projects/${projectId}/access`, { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch access');
    return res.json();
  }

  async grantProjectAccess(projectId: string, data: { partnerTenantId: string; expiresAt?: string; note?: string }) {
    const res = await fetch(`/api/projects/${projectId}/access`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Failed to grant access'); }
    return res.json();
  }

  async revokeProjectAccess(projectId: string, partnerTenantId: string) {
    const res = await fetch(`/api/projects/${projectId}/access/${partnerTenantId}`, {
      method: 'DELETE', credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to revoke access');
    return res.json();
  }

  async listTenants() {
    const res = await fetch('/api/projects/tenants', { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch tenants');
    return res.json();
  }

  // ── Listing-level access (per-listing partner view permission) ──────────────

  async getListingAccess(listingId: string) {
    const res = await fetch(`/api/projects/listings/${listingId}/access`, { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch listing access');
    return res.json();
  }

  async grantListingAccess(listingId: string, data: { partnerTenantId: string; expiresAt?: string; note?: string }) {
    const res = await fetch(`/api/projects/listings/${listingId}/access`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Failed to grant listing access'); }
    return res.json();
  }

  async revokeListingAccess(listingId: string, partnerTenantId: string) {
    const res = await fetch(`/api/projects/listings/${listingId}/access/${partnerTenantId}`, {
      method: 'DELETE', credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to revoke listing access');
    return res.json();
  }

  async createBackup() {
    return { id: `backup_${Date.now()}`, createdAt: new Date().toISOString() };
  }

  async restoreBackup(backupId: string) {
    return true;
  }

  async exportData(params: any) {
    return { data: [], format: params?.format || 'json', exportedAt: new Date().toISOString() };
  }

  async updateOnboardingProgress(step: number, _completed?: boolean) {
    return { step, completed: step >= 5 };
  }

  async dismissOnboarding() {
    return true;
  }

}

const dbApi = new DatabaseApiClient();
export default dbApi;
export { dbApi as db };
