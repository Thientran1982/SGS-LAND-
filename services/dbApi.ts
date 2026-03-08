import { leadApi } from './api/leadApi';
import { listingApi } from './api/listingApi';
import { proposalApi } from './api/proposalApi';
import { contractApi } from './api/contractApi';
import { inboxApi } from './api/inboxApi';
import { userApi } from './api/userApi';
import { analyticsApi } from './api/analyticsApi';
import { PlanTier, Plan, UserRole } from '../types';
import { ROUTES } from '../config/routes';

export const PLANS: Record<PlanTier, Plan> = {
  [PlanTier.INDIVIDUAL]: {
    id: PlanTier.INDIVIDUAL,
    name: 'Individual',
    price: 0,
    features: ['Basic CRM', '1 User', '5 Listings'],
    limits: { seats: 1, emailsPerMonth: 100, aiRequestsPerMonth: 50 }
  },
  [PlanTier.TEAM]: {
    id: PlanTier.TEAM,
    name: 'Team',
    price: 49,
    features: ['Advanced CRM', '5 Users', 'Unlimited Listings', 'Team Routing'],
    limits: { seats: 5, emailsPerMonth: 2000, aiRequestsPerMonth: 500 }
  },
  [PlanTier.ENTERPRISE]: {
    id: PlanTier.ENTERPRISE,
    name: 'Enterprise',
    price: 199,
    features: ['Full Suite', 'Unlimited Users', 'API Access', 'Dedicated Support', 'Custom AI Models'],
    limits: { seats: 999, emailsPerMonth: 100000, aiRequestsPerMonth: 10000 }
  }
};

class DatabaseApiClient {
  private currentTenantId: string = '00000000-0000-0000-0000-000000000001';
  private cachedCurrentUser: any = null;

  async getCurrentUser() {
    if (this.cachedCurrentUser) return this.cachedCurrentUser;
    try {
      const result = await userApi.getMe();
      this.cachedCurrentUser = result.user;
      return result.user;
    } catch {
      return null;
    }
  }

  clearUserCache() {
    this.cachedCurrentUser = null;
  }

  async getLeads(page = 1, pageSize = 20, filters?: any) {
    try {
      const params: any = {};
      if (filters?.stage) params.stage = filters.stage;
      if (filters?.stages) params.stages = filters.stages.join(',');
      if (filters?.assignedTo) params.assignedTo = filters.assignedTo;
      if (filters?.source) params.source = filters.source;
      if (filters?.search) params.search = filters.search;
      if (filters?.slaBreached !== undefined) params.slaBreached = filters.slaBreached;

      const result = await leadApi.getLeads(page, pageSize, params);
      return {
        data: result.data,
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
      };
    } catch (error) {
      console.error('getLeads error:', error);
      return { data: [], total: 0, page: 1, pageSize };
    }
  }

  async getLeadById(id: string) {
    try {
      return await leadApi.getLeadById(id);
    } catch {
      return null;
    }
  }

  async createLead(data: any) {
    return leadApi.createLead(data);
  }

  async updateLead(id: string, data: any) {
    return leadApi.updateLead(id, data);
  }

  async deleteLead(id: string) {
    return leadApi.deleteLead(id);
  }

  async getListings(page = 1, pageSize = 20, filters?: any) {
    try {
      const params: any = {};
      if (filters?.type) params.type = filters.type;
      if (filters?.status) params.status = filters.status;
      if (filters?.transaction) params.transaction = filters.transaction;
      if (filters?.search) params.search = filters.search;
      if (filters?.priceMin) params.priceMin = filters.priceMin;
      if (filters?.priceMax) params.priceMax = filters.priceMax;

      const result = await listingApi.getListings(page, pageSize, params);
      return {
        data: result.data,
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
      };
    } catch (error) {
      console.error('getListings error:', error);
      return { data: [], total: 0, page: 1, pageSize };
    }
  }

  async getListingById(id: string) {
    try {
      return await listingApi.getListingById(id);
    } catch {
      return null;
    }
  }

  async createListing(data: any) {
    return listingApi.createListing(data);
  }

  async updateListing(id: string, data: any) {
    return listingApi.updateListing(id, data);
  }

  async deleteListing(id: string) {
    return listingApi.deleteListing(id);
  }

  async toggleFavorite(listingId: string) {
    return listingApi.toggleFavorite(listingId);
  }

  async getFavorites() {
    try {
      return await listingApi.getFavorites();
    } catch {
      return [];
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
    try {
      const result = await contractApi.getContracts(page, pageSize, filters);
      return {
        data: result.data,
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
      };
    } catch (error) {
      console.error('getContracts error:', error);
      return { data: [], total: 0, page: 1, pageSize, totalPages: 0 };
    }
  }

  async getContractById(id: string) {
    try {
      return await contractApi.getContractById(id);
    } catch {
      return null;
    }
  }

  async createContract(data: any) {
    return contractApi.createContract(data);
  }

  async updateContract(id: string, data: any) {
    return contractApi.updateContract(id, data);
  }

  async getInboxThreads() {
    try {
      return await inboxApi.getThreads();
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

  async getAuditLogs(page = 1, pageSize = 50) {
    try {
      const result = await analyticsApi.getAuditLogs(page, pageSize);
      return result.data;
    } catch {
      return [];
    }
  }

  async globalSearch(query: string) {
    try {
      const [leadsRes, listingsRes] = await Promise.all([
        leadApi.getLeads(1, 5, { search: query }),
        listingApi.getListings(1, 5, { search: query }),
      ]);
      return {
        leads: leadsRes.data,
        listings: listingsRes.data,
        total: leadsRes.total + listingsRes.total,
      };
    } catch {
      return { leads: [], listings: [], total: 0 };
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

  async getEnterpriseConfig() {
    return {
      sso: { enabled: false, provider: '', entityId: '', ssoUrl: '', certificate: '' },
      zaloOA: { oaId: '', accessToken: '' },
      facebookPages: [],
      dlpRules: [],
      slaConfig: { responseTimeMinutes: 30, escalationTimeMinutes: 120 },
    };
  }

  async updateEnterpriseConfig(data: any) {
    return data;
  }

  async getScoringConfig() {
    return {
      weights: { engagement: 30, budget: 25, timeline: 20, fit: 15, source: 10 },
      thresholds: { A: 80, B: 60, C: 40, D: 20 },
    };
  }

  async updateScoringConfig(data: any) {
    return data;
  }

  async getRoutingRules() {
    return [];
  }

  async createRoutingRule(data: any) {
    return { id: `rule_${Date.now()}`, ...data };
  }

  async updateRoutingRule(id: string, data: any) {
    return { id, ...data };
  }

  async deleteRoutingRule(id: string) {
    return true;
  }

  async getSequences() {
    return [];
  }

  async createSequence(data: any) {
    return { id: `seq_${Date.now()}`, ...data };
  }

  async updateSequence(id: string, data: any) {
    return { id, ...data };
  }

  async deleteSequence(id: string) {
    return true;
  }

  async getTemplates() {
    return [];
  }

  async getDocuments() {
    return [];
  }

  async createDocument(data: any) {
    return { id: `doc_${Date.now()}`, ...data };
  }

  async deleteDocument(id: string) {
    return true;
  }

  async getArticles() {
    return [];
  }

  async getArticleById(id: string) {
    return null;
  }

  async createArticle(data: any) {
    return { id: `art_${Date.now()}`, ...data };
  }

  async updateArticle(id: string, data: any) {
    return { id, ...data };
  }

  async deleteArticle(id: string) {
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

  async generateBiMarts() {
    return {};
  }

  async updateCampaignCost(data: any) {
    return data;
  }

  async duplicateLead(id: string) {
    const lead = await this.getLeadById(id);
    if (!lead) throw new Error('Lead not found');
    const { id: _id, createdAt, updatedAt, ...data } = lead;
    return this.createLead({ ...data, name: `${data.name} (Copy)` });
  }

  async receiveWebhookMessage(data: any) {
    return data;
  }

  async createUser(data: any) {
    return data;
  }

  async updateUser(id: string, data: any) {
    return userApi.updateUser(id, data);
  }

  async deleteUser(id: string) {
    return true;
  }

  async getTenantUsers(page = 1, pageSize = 50, search?: string, role?: string, sort?: any) {
    try {
      const params: any = {};
      if (search) params.search = search;
      if (role) params.role = role;
      const result = await userApi.getUsers(page, pageSize, params);
      return {
        data: result.data,
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
      };
    } catch {
      return { data: [], total: 0, page: 1, pageSize, totalPages: 0 };
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
    this.cachedCurrentUser = data.user;
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
    this.cachedCurrentUser = null;
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  }

  async requestPasswordReset(email: string) {
    return `reset_${Date.now()}`;
  }

  async resetPassword(token: string, newPassword: string) {
    return true;
  }

  async authenticateViaSSO(email: string) {
    return this.authenticate(email, 'sso_token');
  }

  async changeUserPassword(userId: string, newPassword: string) {
    return userApi.changePassword(userId, newPassword);
  }

  async inviteUser(data: any) {
    return { id: `user_${Date.now()}`, ...data };
  }

  async resendInvite(userId: string) {
    return true;
  }

  async updateUserProfile(data: any) {
    const user = await this.getCurrentUser();
    if (user) return userApi.updateUser(user.id, data);
    return data;
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
    return true;
  }

  async duplicateListing(id: string) {
    const listing = await this.getListingById(id);
    if (!listing) throw new Error('Listing not found');
    const { id: _id, createdAt, updatedAt, ...data } = listing;
    return this.createListing({ ...data, title: `${data.title} (Copy)` });
  }

  async addToFavorites(listingId: string) {
    return this.toggleFavorite(listingId);
  }

  async removeFromFavorites(listingId: string) {
    return this.toggleFavorite(listingId);
  }

  async getSimilarListings(listingId: string) {
    try {
      const result = await listingApi.getListings(1, 5);
      return result.data.filter((l: any) => l.id !== listingId);
    } catch {
      return [];
    }
  }

  async getSubscription() {
    return { planId: 'ENTERPRISE', status: 'ACTIVE', currentPeriodEnd: new Date(Date.now() + 30 * 86400000).toISOString() };
  }

  async getUsageMetrics() {
    return { seats: 8, emailsSent: 150, aiRequests: 42 };
  }

  async getInvoices() {
    return [];
  }

  async upgradeSubscription(planId: string) {
    return { planId, status: 'ACTIVE' };
  }

  async getActiveSessions() {
    return [{ id: '1', ip: '127.0.0.1', userAgent: navigator.userAgent, createdAt: new Date().toISOString() }];
  }

  async revokeSession(id: string) {
    return true;
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

    if (role === UserRole.ADMIN || role === UserRole.TEAM_LEAD) {
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
    return { enabled: true, model: 'gemini-2.0-flash', temperature: 0.7 };
  }

  async saveAiConfig(data: any) {
    return data;
  }

  async getAiSafetyLogs() {
    return [];
  }

  async getPromptTemplates() {
    return [];
  }

  async createPromptTemplate(data: any) {
    return { id: `pt_${Date.now()}`, ...data };
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

  async connectZaloOA(data: any) {
    return data;
  }

  async disconnectZaloOA() {
    return true;
  }

  async connectFacebookPage(data: any) {
    return data;
  }

  async disconnectFacebookPage(pageId: string) {
    return true;
  }

  async saveSSOConfig(data: any) {
    return data;
  }

  async saveEmailConfig(data: any) {
    return data;
  }

  async addDomain(domain: string) {
    return { domain, verified: false };
  }

  async removeDomain(domain: string) {
    return true;
  }

  async verifyDomain(domain: string) {
    return { domain, verified: true };
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

  async updateOnboardingProgress(step: number) {
    return { step, completed: step >= 5 };
  }

  async dismissOnboarding() {
    return true;
  }

  async aggregate(query: any) {
    return [];
  }

  async exec(sql: string) {
    return [];
  }

  async prepare(sql: string) {
    return { execute: async () => [] };
  }

  async getListingWithSensitiveData(id: string) {
    return this.getListingById(id);
  }
}

const dbApi = new DatabaseApiClient();
export default dbApi;
export { dbApi as db };
