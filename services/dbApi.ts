import { leadApi } from './api/leadApi';
import { listingApi } from './api/listingApi';
import { proposalApi } from './api/proposalApi';
import { contractApi } from './api/contractApi';
import { inboxApi } from './api/inboxApi';
import { userApi } from './api/userApi';
import { analyticsApi } from './api/analyticsApi';
import { knowledgeApi } from './api/knowledgeApi';
import { api } from './api/apiClient';
import { PlanTier, Plan, UserRole, ThreadStatus, ComplianceConfig } from '../types';
import { ROUTES } from '../config/routes';

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

export const PLANS: Record<PlanTier, Plan> = {
  [PlanTier.INDIVIDUAL]: {
    id: PlanTier.INDIVIDUAL,
    name: 'Individual',
    price: 0,
    features: [
      'billing.f_individual_0',
      'billing.f_individual_1',
      'billing.f_individual_2',
      'billing.f_individual_3',
      'billing.f_individual_4',
    ],
    limits: { seats: 1, emailsPerMonth: 100, aiRequestsPerMonth: 50 }
  },
  [PlanTier.TEAM]: {
    id: PlanTier.TEAM,
    name: 'Team',
    price: 49,
    features: [
      'billing.f_team_0',
      'billing.f_team_1',
      'billing.f_team_2',
      'billing.f_team_3',
      'billing.f_team_4',
      'billing.f_team_5',
    ],
    limits: { seats: 5, emailsPerMonth: 2000, aiRequestsPerMonth: 500 }
  },
  [PlanTier.ENTERPRISE]: {
    id: PlanTier.ENTERPRISE,
    name: 'Enterprise',
    price: 199,
    features: [
      'billing.f_enterprise_0',
      'billing.f_enterprise_1',
      'billing.f_enterprise_2',
      'billing.f_enterprise_3',
      'billing.f_enterprise_4',
      'billing.f_enterprise_5',
      'billing.f_enterprise_6',
    ],
    limits: { seats: 999, emailsPerMonth: 100000, aiRequestsPerMonth: 10000 }
  }
};

const CACHE_TTL = 30_000;

class SimpleCache {
  private store = new Map<string, { data: any; ts: number }>();
  // Per-prefix generation counters — only the affected prefix's generation is bumped on invalidate.
  // Background fetchFresh() captures the generation before the HTTP request and checks it
  // on completion; if the generation has changed the stale write is discarded.
  private generations = new Map<string, number>();

  private generationFor(prefix: string): number {
    return this.generations.get(prefix) ?? 0;
  }

  get(key: string): any | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > CACHE_TTL) return null;
    return entry.data;
  }

  // Call before starting an async fetch.  Returns an opaque token to pass to set().
  snapshot(prefix: string): number {
    return this.generationFor(prefix);
  }

  set(key: string, data: any, prefix?: string, snapshot?: number) {
    if (prefix !== undefined && snapshot !== undefined) {
      if (this.generationFor(prefix) !== snapshot) {
        // Cache was invalidated after this fetch started — discard the stale write.
        return;
      }
    }
    this.store.set(key, { data, ts: Date.now() });
  }

  invalidate(prefix: string) {
    this.generations.set(prefix, this.generationFor(prefix) + 1);
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  clearAll() {
    this.store.clear();
    this.generations.clear();
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
    _cache.clearAll();
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
      const snap = _cache.snapshot('leads:');
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
        _cache.set(cacheKey, out, 'leads:', snap);
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
    const result = await leadApi.createLead(data);
    _cache.invalidate('leads:');
    return result;
  }

  async createPublicLead(data: { name: string; phone: string; notes?: string; source?: string; stage?: string }) {
    return api.post<any>('/api/public/leads', data);
  }

  async updateLead(id: string, data: any) {
    const result = await leadApi.updateLead(id, data);
    _cache.invalidate('leads:');
    return result;
  }

  async mergeLead(id: string, data: any) {
    const result = await leadApi.mergeLead(id, data);
    _cache.invalidate('leads:');
    return result;
  }

  async deleteLead(id: string) {
    const result = await leadApi.deleteLead(id);
    _cache.invalidate('leads:');
    return result;
  }

  // ── Cursor-based getLeads — used by Leads page (LIST view) ─────────────────
  async getLeadsCursor(pageSize = 20, cursor: string | undefined, filters?: any): Promise<{
    data: any[];
    nextCursor: string | null;
    hasNext: boolean;
    total: number;
    stats: any;
  }> {
    const params: any = {};
    if (filters?.stage && filters.stage !== 'ALL') params.stage = filters.stage;
    if (filters?.source && filters.source !== 'ALL') params.source = filters.source;
    if (filters?.search) params.search = filters.search;
    if (filters?.sort) params.sort = filters.sort;
    if (filters?.order) params.order = filters.order;
    try {
      const result = await leadApi.getLeadsCursor(pageSize, cursor, params);
      return {
        data:       result.data       ?? [],
        nextCursor: result.nextCursor ?? null,
        hasNext:    result.hasNext    ?? false,
        total:      result.total      ?? 0,
        stats:      result.stats      ?? {},
      };
    } catch {
      return { data: [], nextCursor: null, hasNext: false, total: 0, stats: {} };
    }
  }

  // ── Cursor-based getListings — used by Inventory page ───────────────────────
  async getListingsCursor(pageSize = 20, cursor: string | undefined, filters?: any): Promise<{
    data: any[];
    nextCursor: string | null;
    hasNext: boolean;
    total: number;
    stats: any;
  }> {
    const params: any = {};
    if (filters?.type && filters.type !== 'ALL') params.type = filters.type;
    if (filters?.status && filters.status !== 'ALL') params.status = filters.status;
    if (filters?.transaction && filters.transaction !== 'ALL') params.transaction = filters.transaction;
    if (filters?.search) params.search = filters.search;
    if (filters?.priceMin) params.priceMin = filters.priceMin;
    if (filters?.priceMax) params.priceMax = filters.priceMax;
    if (filters?.projectCode) params.projectCode = filters.projectCode;
    if (filters?.noProjectCode) params.noProjectCode = true;

    try {
      const result = await listingApi.getListingsCursor(pageSize, cursor, params);
      return {
        data:       result.data       ?? [],
        nextCursor: result.nextCursor ?? null,
        hasNext:    result.hasNext    ?? false,
        total:      result.total      ?? 0,
        stats:      result.stats      ?? {},
      };
    } catch (error) {
      console.error('getListingsCursor error:', error);
      return { data: [], nextCursor: null, hasNext: false, total: 0, stats: {} };
    }
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
    if (filters?.noProjectCode) params.noProjectCode = true;

    const cacheKey = `listings:${page}:${pageSize}:${JSON.stringify(params)}`;
    const cached = _cache.get(cacheKey);

    const fetchFresh = async () => {
      const snap = _cache.snapshot('listings:');
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
        _cache.set(cacheKey, out, 'listings:', snap);
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

  async getListingStats() {
    try {
      return await listingApi.getStats();
    } catch {
      return { availableCount: 0, holdCount: 0, soldCount: 0, rentedCount: 0, bookingCount: 0, openingCount: 0, inactiveCount: 0, totalCount: 0 };
    }
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

  async getPublicListingsCursor(pageSize = 20, cursor: string | undefined, filters?: any): Promise<{
    data: any[];
    nextCursor: string | null;
    hasNext: boolean;
    total: number;
  }> {
    try {
      const params: any = { cursorMode: 'true', pageSize };
      if (cursor) params.cursor = cursor;
      if (filters?.type && filters.type !== 'ALL') params.type = filters.type;
      if (filters?.transaction && filters.transaction !== 'ALL') params.transaction = filters.transaction;
      if (filters?.search) params.search = filters.search;
      if (filters?.priceMin) params.priceMin = filters.priceMin;
      if (filters?.priceMax) params.priceMax = filters.priceMax;
      if (filters?.location && filters.location !== 'ALL') params.location = filters.location;
      if (filters?.isVerified) params.isVerified = 'true';
      const result = await api.get<any>('/api/public/listings', params);
      return {
        data:       result.data       ?? [],
        nextCursor: result.nextCursor ?? null,
        hasNext:    result.hasNext    ?? false,
        total:      result.total      ?? 0,
      };
    } catch {
      return { data: [], nextCursor: null, hasNext: false, total: 0 };
    }
  }

  async getPublicListingsLocations(): Promise<string[]> {
    try {
      return await api.get<string[]>('/api/public/listings/locations');
    } catch {
      return [];
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
      if (filters?.projectCode) params.projectCode = filters.projectCode;
      const result = await api.get<any>('/api/public/listings', params);
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
    const result = await listingApi.createListing(data);
    _cache.invalidate('listings:');
    return result;
  }

  async updateListing(id: string, data: any) {
    const result = await listingApi.updateListing(id, data);
    _cache.invalidate('listings:');
    return result;
  }

  async updateListingStatus(id: string, status: string) {
    const result = await listingApi.updateListingStatus(id, status);
    _cache.invalidate('listings:');
    return result;
  }

  async deleteListing(id: string) {
    const result = await listingApi.deleteListing(id);
    _cache.invalidate('listings:');
    return result;
  }

  async bulkCreateListings(listings: Record<string, unknown>[]) {
    const result = await listingApi.bulkCreateListings(listings);
    _cache.invalidate('listings:');
    return result;
  }

  async assignListing(id: string, userId: string | null) {
    const result = await listingApi.assignListing(id, userId);
    _cache.invalidate('listings:');
    return result;
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
      const snap = _cache.snapshot('contracts:');
      try {
        const result = await contractApi.getContracts(page, pageSize, cleanFilters);
        const out = {
          data: result.data,
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
          totalPages: result.totalPages,
          stats: result.stats,
        };
        _cache.set(cacheKey, out, 'contracts:', snap);
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
    const result = await contractApi.createContract(data);
    _cache.invalidate('contracts:');
    return result;
  }

  async updateContract(id: string, data: any) {
    const result = await contractApi.updateContract(id, data);
    _cache.invalidate('contracts:');
    return result;
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
          assignedToName: r.assignedToName ?? undefined,
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
        status: r.threadStatus === 'HUMAN_TAKEOVER' ? ThreadStatus.HUMAN_TAKEOVER : ThreadStatus.AI_ACTIVE,
        lastChannel: r.lastChannel,
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

  async updateThreadAiMode(leadId: string, status: 'AI_ACTIVE' | 'HUMAN_TAKEOVER') {
    return inboxApi.updateAiMode(leadId, status);
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

  async getActivitySummary(fromDate?: string, toDate?: string): Promise<any[]> {
    try {
      const params: any = {};
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      return await api.get<any[]>('/api/activity/summary', params);
    } catch {
      return [];
    }
  }

  async getUserActivityDetail(userId: string, fromDate?: string, toDate?: string): Promise<{ pageStats: any[]; recentVisits: any[] }> {
    try {
      const params: any = {};
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      return await api.get<any>(`/api/activity/user/${userId}`, params);
    } catch {
      return { pageStats: [], recentVisits: [] };
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
      const res = await fetch(`/api/leads/check-phone?phone=${encodeURIComponent(phone)}`, { credentials: 'include' });
      if (!res.ok) return null;
      const data = await res.json();
      return data.duplicate || null;
    } catch {
      return null;
    }
  }

  async checkDuplicateLeadByEmail(email: string) {
    try {
      const res = await fetch(`/api/leads/check-email?email=${encodeURIComponent(email)}`, { credentials: 'include' });
      if (!res.ok) return null;
      const data = await res.json();
      return data.duplicate || null;
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
        retention: { messagesDays: 365, auditLogsDays: 730 },
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
    return api.get<any>('/api/scoring/config');
  }

  async updateScoringConfig(data: any) {
    return api.put<any>('/api/scoring/config', data);
  }

  async getRoutingRules() {
    const result = await fetch('/api/routing-rules', { credentials: 'include' });
    if (!result.ok) throw new Error('Failed to fetch routing rules');
    return result.json();
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

  // ── Campaigns (Chiến dịch tự động) ─────────────────────────────────────────
  async getCampaigns() {
    const r = await fetch('/api/campaigns', { credentials: 'include' });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Không tải được danh sách chiến dịch');
    const j = await r.json();
    return j.data || [];
  }

  async getCampaign(id: string) {
    const r = await fetch(`/api/campaigns/${id}`, { credentials: 'include' });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Không tải được chiến dịch');
    return r.json();
  }

  async createCampaign(data: any) {
    const r = await fetch('/api/campaigns', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Failed to create campaign');
    return r.json();
  }

  async updateCampaign(id: string, data: any) {
    const r = await fetch(`/api/campaigns/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Failed to update campaign');
    return r.json();
  }

  async deleteCampaign(id: string) {
    const r = await fetch(`/api/campaigns/${id}`, { method: 'DELETE', credentials: 'include' });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Failed to delete campaign');
    return true;
  }

  async activateCampaign(id: string) {
    const r = await fetch(`/api/campaigns/${id}/activate`, { method: 'POST', credentials: 'include' });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Failed to activate');
    return r.json();
  }

  async pauseCampaign(id: string) {
    const r = await fetch(`/api/campaigns/${id}/pause`, { method: 'POST', credentials: 'include' });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Failed to pause');
    return r.json();
  }

  async runCampaignNow(id: string) {
    const r = await fetch(`/api/campaigns/${id}/run-now`, { method: 'POST', credentials: 'include' });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Failed to run');
    return r.json();
  }

  async previewCampaignAudience(audience: any) {
    const r = await fetch('/api/campaigns/preview-audience', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audience }),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Không thể xem trước đối tượng');
    const j = await r.json();
    return j.count || 0;
  }

  async getCampaignRecipients(id: string) {
    const r = await fetch(`/api/campaigns/${id}/recipients`, { credentials: 'include' });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Không tải được danh sách người nhận');
    const j = await r.json();
    return j.data || [];
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
    const placeholderPhone = `09${Math.floor(10000000 + Math.random() * 89999999)}`;
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

  async getMembers(search?: string) {
    try {
      const result = await userApi.getMembers(100, search);
      return { data: result.data, total: result.total };
    } catch {
      return { data: [], total: 0 };
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
      const error: any = new Error(err.error || 'Login failed');
      if (err.error === 'EMAIL_NOT_VERIFIED') {
        error.code = 'EMAIL_NOT_VERIFIED';
        error.email = err.email || email;
      } else if (err.error === 'TENANT_PENDING_APPROVAL') {
        error.code = 'TENANT_PENDING_APPROVAL';
        error.email = err.email || email;
      } else if (err.error === 'TENANT_REJECTED') {
        error.code = 'TENANT_REJECTED';
        error.email = err.email || email;
      }
      throw error;
    }
    const data = await res.json();
    this._isLoggedOut = false;
    _cache.clearAll();
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

  /**
   * B2B vendor self-signup: tạo tenant mới + ADMIN user + subscription INDIVIDUAL trial 14 ngày.
   * Trả về { needsVerification, email, tenantId, tenantDomain, plan, trialDays, ...devVerifyToken? }.
   */
  async onboardVendor(
    company: string | undefined,
    name: string,
    email: string,
    password: string,
    phone?: string
  ) {
    const res = await fetch('/api/auth/onboard-vendor', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company: company || undefined, name, email, password, phone }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Onboarding failed' }));
      throw new Error(err.error || 'Onboarding failed');
    }
    return res.json();
  }

  async verifyEmail(token: string) {
    const res = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`, {
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Verification failed' }));
      throw new Error(err.error || 'Verification failed');
    }
    const data = await res.json();
    this._isLoggedOut = false;
    _cache.clearAll();
    this.cachedCurrentUser = data.user;
    window.dispatchEvent(new CustomEvent('auth:login'));
    return data;
  }

  async resendVerificationEmail(email: string) {
    const res = await fetch('/api/auth/resend-verification', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to resend' }));
      throw new Error(err.error || 'Failed to resend verification email');
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
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Failed to reset password');
    }
    return data;
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

  async rejectProposal(id: string, reason?: string) {
    return proposalApi.updateStatus(id, 'REJECTED', reason);
  }

  async deleteContract(id: string) {
    _cache.invalidate('contracts:');
    return contractApi.deleteContract(id);
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
      const result = await api.get<any>('/api/public/listings', { page: 1, pageSize: 8 });
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
      return null;
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

  async getUserMenu(role?: string, tenantId?: string) {
    // Vendor tenants (không phải host) không nên thấy public marketplace trong sidebar —
    // họ chỉ nên quản lý sản phẩm của chính mình qua ROUTES.INVENTORY.
    const isHostTenant = !tenantId || tenantId === DEFAULT_TENANT_ID;

    const coreItems: any[] = [
      { id: 'home', labelKey: 'menu.home', route: ROUTES.LANDING, iconKey: ROUTES.LANDING },
      { id: 'dash', labelKey: 'menu.dashboard', route: ROUTES.DASHBOARD, iconKey: ROUTES.DASHBOARD },
    ];
    if (isHostTenant) {
      coreItems.push({ id: 'search', labelKey: 'menu.marketplace', route: ROUTES.SEARCH, iconKey: ROUTES.SEARCH });
    }
    coreItems.push(
      { id: 'leads', labelKey: 'menu.leads', route: ROUTES.LEADS, iconKey: ROUTES.LEADS },
      { id: 'contracts', labelKey: 'menu.contracts', route: ROUTES.CONTRACTS, iconKey: ROUTES.CONTRACTS },
      { id: 'inv', labelKey: 'menu.inventory', route: ROUTES.INVENTORY, iconKey: ROUTES.INVENTORY },
      { id: 'inbox', labelKey: 'menu.inbox', route: ROUTES.INBOX, iconKey: ROUTES.INBOX },
      { id: 'fav', labelKey: 'menu.favorites', route: ROUTES.FAVORITES, iconKey: ROUTES.FAVORITES }
    );
    const core = { id: 'core', labelKey: 'menu.core', items: coreItems };

    const ops = { id: 'ops', labelKey: 'menu.operations', items: [
      { id: 'projects', labelKey: 'menu.projects', route: ROUTES.PROJECTS, iconKey: ROUTES.PROJECTS },
      { id: 'approvals', labelKey: 'menu.approvals', route: ROUTES.APPROVALS, iconKey: ROUTES.APPROVALS },
      { id: 'routing', labelKey: 'menu.routing-rules', route: ROUTES.ROUTING_RULES, iconKey: ROUTES.ROUTING_RULES },
      { id: 'seq', labelKey: 'menu.sequences', route: ROUTES.SEQUENCES, iconKey: ROUTES.SEQUENCES },
      { id: 'campaigns', labelKey: 'menu.campaigns', route: ROUTES.CAMPAIGNS, iconKey: ROUTES.CAMPAIGNS },
      { id: 'scoring', labelKey: 'menu.scoring-rules', route: ROUTES.SCORING_RULES, iconKey: ROUTES.SCORING_RULES },
      { id: 'knowledge', labelKey: 'menu.knowledge', route: ROUTES.KNOWLEDGE, iconKey: ROUTES.KNOWLEDGE },
      { id: 'rep', labelKey: 'menu.reports', route: ROUTES.REPORTS, iconKey: ROUTES.REPORTS }
    ]};

    // SALES: dự án (xem rổ hàng), tài liệu, báo cáo
    const opsBasic = { id: 'ops', labelKey: 'menu.operations', items: [
      { id: 'projects', labelKey: 'menu.projects', route: ROUTES.PROJECTS, iconKey: ROUTES.PROJECTS },
      { id: 'knowledge', labelKey: 'menu.knowledge', route: ROUTES.KNOWLEDGE, iconKey: ROUTES.KNOWLEDGE },
      { id: 'rep', labelKey: 'menu.reports', route: ROUTES.REPORTS, iconKey: ROUTES.REPORTS }
    ]};

    // MARKETING: dự án + công cụ marketing (campaigns/sequences) + tài liệu + báo cáo
    const opsMarketing = { id: 'ops', labelKey: 'menu.operations', items: [
      { id: 'projects', labelKey: 'menu.projects', route: ROUTES.PROJECTS, iconKey: ROUTES.PROJECTS },
      { id: 'campaigns', labelKey: 'menu.campaigns', route: ROUTES.CAMPAIGNS, iconKey: ROUTES.CAMPAIGNS },
      { id: 'seq', labelKey: 'menu.sequences', route: ROUTES.SEQUENCES, iconKey: ROUTES.SEQUENCES },
      { id: 'knowledge', labelKey: 'menu.knowledge', route: ROUTES.KNOWLEDGE, iconKey: ROUTES.KNOWLEDGE },
      { id: 'rep', labelKey: 'menu.reports', route: ROUTES.REPORTS, iconKey: ROUTES.REPORTS }
    ]};

    // Các công cụ ADMIN thấy: quản lý người dùng + cài đặt doanh nghiệp
    const sysAdminItems = [
      { id: 'users', labelKey: 'menu.admin-users', route: ROUTES.ADMIN_USERS, iconKey: ROUTES.ADMIN_USERS },
      { id: 'set', labelKey: 'menu.enterprise-settings', route: ROUTES.ENTERPRISE_SETTINGS, iconKey: ROUTES.ENTERPRISE_SETTINGS },
    ];
    // Các công cụ chỉ SUPER_ADMIN thấy: hệ thống, chi phí, bảo mật, hạ tầng, v.v.
    const sysSuperAdminItems = [
      { id: 'vendors', labelKey: 'menu.vendor-management', route: ROUTES.VENDOR_MANAGEMENT, iconKey: ROUTES.VENDOR_MANAGEMENT },
      { id: 'users', labelKey: 'menu.admin-users', route: ROUTES.ADMIN_USERS, iconKey: ROUTES.ADMIN_USERS },
      { id: 'set', labelKey: 'menu.enterprise-settings', route: ROUTES.ENTERPRISE_SETTINGS, iconKey: ROUTES.ENTERPRISE_SETTINGS },
      { id: 'ai-cost', labelKey: 'menu.admin-ai-cost', route: ROUTES.ADMIN_AI_COST, iconKey: ROUTES.ADMIN_AI_COST },
      { id: 'billing', labelKey: 'menu.billing', route: ROUTES.BILLING, iconKey: ROUTES.BILLING },
      { id: 'security', labelKey: 'menu.security', route: ROUTES.SECURITY, iconKey: ROUTES.SECURITY },
      { id: 'ai-gov', labelKey: 'menu.ai-governance', route: ROUTES.AI_GOVERNANCE, iconKey: ROUTES.AI_GOVERNANCE },
      { id: 'seo', labelKey: 'menu.seo-manager', route: ROUTES.SEO_MANAGER, iconKey: ROUTES.SEO_MANAGER },
      { id: 'error-monitor', labelKey: 'menu.error-monitor', route: ROUTES.ERROR_MONITOR, iconKey: ROUTES.ERROR_MONITOR },
      { id: 'scraper', labelKey: 'menu.scraper', route: ROUTES.SCRAPER, iconKey: ROUTES.SCRAPER },
      { id: 'data', labelKey: 'menu.data-platform', route: ROUTES.DATA_PLATFORM, iconKey: ROUTES.DATA_PLATFORM },
      { id: 'system', labelKey: 'menu.system', route: ROUTES.SYSTEM, iconKey: ROUTES.SYSTEM },
    ];
    // ADMIN/TEAM_LEAD: chỉ thấy người dùng + cài đặt doanh nghiệp
    const sys = { id: 'sys', labelKey: 'menu.ecosystem', items: sysAdminItems };
    // SUPER_ADMIN: thấy toàn bộ hệ thống (vendor management + tất cả công cụ)
    const sysSuperAdmin = { id: 'sys', labelKey: 'menu.ecosystem', items: sysSuperAdminItems };

    const taskMgmt = { id: 'task', labelKey: 'menu.task_management', items: [
      { id: 'task-dashboard', labelKey: 'menu.task-dashboard', route: ROUTES.TASK_DASHBOARD, iconKey: ROUTES.TASK_DASHBOARD },
      { id: 'task-kanban', labelKey: 'menu.task-kanban', route: ROUTES.TASK_KANBAN, iconKey: ROUTES.TASK_KANBAN },
      { id: 'tasks', labelKey: 'menu.tasks', route: ROUTES.TASKS, iconKey: ROUTES.TASKS },
      { id: 'employees', labelKey: 'menu.employees', route: ROUTES.EMPLOYEES, iconKey: ROUTES.EMPLOYEES },
      { id: 'task-reports', labelKey: 'menu.task-reports', route: ROUTES.TASK_REPORTS, iconKey: ROUTES.TASK_REPORTS },
    ]};

    const taskMgmtBasic = { id: 'task', labelKey: 'menu.task_management', items: [
      { id: 'task-kanban', labelKey: 'menu.task-kanban', route: ROUTES.TASK_KANBAN, iconKey: ROUTES.TASK_KANBAN },
      { id: 'tasks', labelKey: 'menu.tasks', route: ROUTES.TASKS, iconKey: ROUTES.TASKS },
    ]};

    const partnerCore = { id: 'partner-core', labelKey: 'menu.partner_core', items: [
      { id: 'projects', labelKey: 'menu.projects', route: ROUTES.PROJECTS, iconKey: ROUTES.PROJECTS },
      { id: 'inv', labelKey: 'menu.inventory', route: ROUTES.INVENTORY, iconKey: ROUTES.INVENTORY },
    ]};

    if (role === 'PARTNER_ADMIN' || role === 'PARTNER_AGENT') {
      return [partnerCore];
    }
    if (role === UserRole.SUPER_ADMIN) {
      return [core, ops, taskMgmt, sysSuperAdmin];
    }
    if (role === UserRole.ADMIN || role === UserRole.TEAM_LEAD) {
      return [core, ops, taskMgmt, sys];
    } else if (role === UserRole.MARKETING) {
      return [core, opsMarketing, taskMgmtBasic];
    } else if (role === UserRole.SALES) {
      return [core, opsBasic, taskMgmtBasic];
    }
    // VIEWER + bất kỳ role không xác định: chỉ core + task kanban cơ bản (read-only UX)
    return [core, taskMgmtBasic];
  }

  async ping(): Promise<boolean> {
    try {
      const res = await fetch('/api/health', { credentials: 'include' });
      return res.ok;
    } catch {
      return false;
    }
  }

  async getAiConfig() {
    try {
      return await api.get<any>('/api/ai/governance/config');
    } catch {
      return { enabled: true, allowedModels: ['gemini-2.5-flash', 'gemini-2.5-pro'], defaultModel: 'gemini-2.5-flash', budgetCapUsd: 100, currentSpendUsd: 0 };
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

  async updatePromptTemplate(id: string, data: any) {
    return api.put<any>(`/api/ai/governance/prompt-templates/${id}`, data);
  }

  async simulatePrompt(systemPrompt: string, userInput: string, model?: string) {
    return api.post<{ output: string }>('/api/ai/governance/simulate', { systemPrompt, userInput, model });
  }

  async getFeedbackStats(days: number = 30) {
    try {
      return await api.get<any>('/api/ai/governance/feedback/stats', { days });
    } catch {
      return { totalFeedback: 0, positiveCount: 0, negativeCount: 0, approvalRate: 0, byIntent: [], byNode: [], recentCorrections: [] };
    }
  }

  async getRewardSignals() {
    try {
      return await api.get<any[]>('/api/ai/governance/feedback/rewards');
    } catch {
      return [];
    }
  }

  async getFeedbackTrends(days: number = 90) {
    try {
      return await api.get<any[]>('/api/ai/governance/feedback/trends', { days });
    } catch {
      return [];
    }
  }

  async listFeedback(page: number = 1, intent?: string) {
    try {
      const params: any = { page };
      if (intent) params.intent = intent;
      return await api.get<any>('/api/ai/governance/feedback/list', params);
    } catch {
      return { data: [], total: 0 };
    }
  }

  async recomputeRewards() {
    return api.post<any>('/api/ai/governance/feedback/recompute', {});
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
    return api.get<any[]>('/api/connectors');
  }

  async createConnectorConfig(data: any) {
    return api.post<any>('/api/connectors', data);
  }

  async saveConnectorConfig(id: string, data: any) {
    return api.put<any>(`/api/connectors/${id}`, data);
  }

  async deleteConnectorConfig(id: string) {
    await api.delete<any>(`/api/connectors/${id}`);
    return true;
  }

  async getSyncJobs() {
    return api.get<any[]>('/api/connectors/jobs');
  }

  async createSyncJob(data: any) {
    const connectorId = typeof data === 'string' ? data : data.connectorId;
    return api.post<any>(`/api/connectors/${connectorId}/sync`, {});
  }

  async updateSyncJob(id: string, data: any) {
    return { id, ...data };
  }

  async getComplianceConfig(): Promise<ComplianceConfig> {
    try {
      const config = await this.getEnterpriseConfig();
      return {
        retention: config.retention ?? { messagesDays: 365, auditLogsDays: 730 },
        legalHold: config.legalHold ?? false,
        dlpRules: config.dlpRules ?? [],
        ipAllowlist: config.ipAllowlist ?? [],
      };
    } catch {
      return { retention: { messagesDays: 365, auditLogsDays: 730 }, legalHold: false, dlpRules: [], ipAllowlist: [] };
    }
  }

  async saveComplianceConfig(data: ComplianceConfig) {
    const res = await fetch('/api/enterprise/config', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        retention: data.retention,
        legalHold: data.legalHold,
        dlpRules: data.dlpRules,
        ipAllowlist: data.ipAllowlist,
      }),
    });
    if (!res.ok) throw new Error('Failed to save compliance config');
    return res.json();
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
    if (!res.ok) throw new Error('Không thể tải danh sách dự án');
    return res.json();
  }

  async getProjectById(id: string) {
    const res = await fetch(`/api/projects/${id}`, { credentials: 'include' });
    if (!res.ok) throw new Error('Không tìm thấy dự án');
    return res.json();
  }

  async createProject(data: any) {
    const res = await fetch('/api/projects', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Không thể tạo dự án'); }
    return res.json();
  }

  async updateProject(id: string, data: any) {
    const res = await fetch(`/api/projects/${id}`, {
      method: 'PUT', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Không thể cập nhật dự án'); }
    return res.json();
  }

  async deleteProject(id: string) {
    const res = await fetch(`/api/projects/${id}`, { method: 'DELETE', credentials: 'include' });
    if (!res.ok) throw new Error('Không thể xóa dự án');
    return res.json();
  }

  async getProjectAccess(projectId: string) {
    const res = await fetch(`/api/projects/${projectId}/access`, { credentials: 'include' });
    if (!res.ok) throw new Error('Không thể tải danh sách quyền truy cập');
    return res.json();
  }

  async grantProjectAccess(projectId: string, data: { partnerTenantId: string; expiresAt?: string; note?: string }) {
    const res = await fetch(`/api/projects/${projectId}/access`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Không thể cấp quyền truy cập'); }
    return res.json();
  }

  async revokeProjectAccess(projectId: string, partnerTenantId: string) {
    const res = await fetch(`/api/projects/${projectId}/access/${partnerTenantId}`, {
      method: 'DELETE', credentials: 'include',
    });
    if (!res.ok) throw new Error('Không thể thu hồi quyền truy cập');
    return res.json();
  }

  async listTenants() {
    const res = await fetch('/api/projects/tenants', { credentials: 'include' });
    if (!res.ok) throw new Error('Không thể tải danh sách đối tác');
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

  async getThemeConfig(): Promise<any> {
    const res = await fetch('/api/enterprise/theme', { credentials: 'include' });
    if (!res.ok) return {};
    return res.json();
  }

  async saveThemeConfig(config: any): Promise<any> {
    const res = await fetch('/api/enterprise/theme', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Không thể lưu cấu hình giao diện'); }
    return res.json();
  }

  async resetThemeConfig(): Promise<void> {
    const res = await fetch('/api/enterprise/theme', { method: 'DELETE', credentials: 'include' });
    if (!res.ok) throw new Error('Không thể đặt lại giao diện');
  }

  async createBackup(): Promise<string> {
    return JSON.stringify({ id: `backup_${Date.now()}`, createdAt: new Date().toISOString() });
  }

  async restoreBackup(backupId: string) {
    return true;
  }

  async exportData(params: any) {
    return { data: [], format: params?.format || 'json', exportedAt: new Date().toISOString(), newWatermark: new Date().toISOString() };
  }

  async updateOnboardingProgress(step: number, _completed?: boolean) {
    return { step, completed: step >= 5 };
  }

  async dismissOnboarding() {
    return true;
  }

  // ── Vendor Management (Platform Admin) ────────────────────────────────────

  async getVendors(params?: { status?: string; search?: string; page?: number; limit?: number }) {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.search) qs.set('search', params.search);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    const res = await fetch(`/api/vendors?${qs.toString()}`, { credentials: 'include' });
    if (!res.ok) throw new Error('Không thể tải danh sách vendor');
    return res.json();
  }

  async approveVendor(tenantId: string) {
    const res = await fetch(`/api/vendors/${tenantId}/approve`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).error || 'Không thể phê duyệt vendor');
    }
    return res.json();
  }

  async rejectVendor(tenantId: string, reason: string) {
    const res = await fetch(`/api/vendors/${tenantId}/reject`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).error || 'Không thể từ chối vendor');
    }
    return res.json();
  }

  async suspendVendor(tenantId: string, reason?: string) {
    const res = await fetch(`/api/vendors/${tenantId}/suspend`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).error || 'Không thể tạm ngừng vendor');
    }
    return res.json();
  }

}

const dbApi = new DatabaseApiClient();
export default dbApi;
export { dbApi as db };
