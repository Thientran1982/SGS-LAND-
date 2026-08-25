import { analyticsRepository, AnalyticsSummary } from '../repositories/analyticsRepository';
import { interactionRepository } from '../repositories/interactionRepository';

export type GuideDataGroup = 'dashboard' | 'leads' | 'inventory' | 'inbox' | 'contracts';
export type GuideLanguage = 'vn' | 'en';

export interface GuideDataIdentity {
  tenantId: string;
  userId: string;
  role: string;
}

export interface GuideSummaryResult {
  group: GuideDataGroup;
  language: GuideLanguage;
  status: 'ok' | 'empty' | 'forbidden';
  scope: 'personal' | 'company';
  freshness: string;
  summary: Record<string, unknown>;
}

function normalizeGuideQuery(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

function number(value: unknown): number {
  return Number(value || 0);
}

function sinceForTimeRange(timeRange: string): string | undefined {
  if (timeRange === 'all' || !timeRange) return undefined;
  const days = Number.parseInt(timeRange, 10);
  if (!Number.isFinite(days) || days <= 0) return undefined;
  const boundedDays = Math.min(days, 3650);
  return new Date(Date.now() - boundedDays * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Read-only guide contract. The repository receives the server-derived identity,
 * while the assistant only receives a deliberately small aggregate projection.
 */
export async function getGuideDataSummary(
  identity: GuideDataIdentity,
  group: GuideDataGroup,
  timeRange = '30d',
  language: GuideLanguage = 'vn',
): Promise<GuideSummaryResult> {
  if (!identity.tenantId || !identity.userId || !identity.role) {
    return {
      group,
      language,
      status: 'forbidden',
      scope: 'personal',
      freshness: new Date().toISOString(),
      summary: {},
    };
  }

  const fullScopeRoles = new Set(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TEAM_LEAD']);
  const personalScopeRoles = new Set(['SALES', 'MARKETING', 'VIEWER']);
  if (identity.role === 'PARTNER_ADMIN' || identity.role === 'PARTNER_AGENT') {
    return {
      group,
      language,
      status: 'forbidden',
      scope: 'personal',
      freshness: new Date().toISOString(),
      summary: {},
    };
  }
  if (group === 'inbox' && !fullScopeRoles.has(identity.role) && !personalScopeRoles.has(identity.role)) {
    return {
      group,
      language,
      status: 'forbidden',
      scope: 'personal',
      freshness: new Date().toISOString(),
      summary: {},
    };
  }

  if (group === 'inbox') {
    const inbox = await interactionRepository.getGuideInboxSummary(
      identity.tenantId,
      identity.userId,
      identity.role,
      sinceForTimeRange(timeRange),
    );
    const hasData = Object.values(inbox).some(value => typeof value === 'number' ? value > 0 : value !== null);
    return {
      group,
      language,
      status: hasData ? 'ok' : 'empty',
      scope: personalScopeRoles.has(identity.role) ? 'personal' : 'company',
      freshness: new Date().toISOString(),
      summary: inbox,
    };
  }

  // AnalyticsRepository already scopes SALES by assigned lead. Normalize the
  // other restricted CRM roles to the same personal read-only contract.
  const effectiveRole = personalScopeRoles.has(identity.role) ? 'SALES' : identity.role;
  const data: AnalyticsSummary = await analyticsRepository.getSummary(
    identity.tenantId,
    timeRange,
    identity.userId,
    effectiveRole,
  );
  const scope = group === 'inventory' ? 'company' : data.scopeLabel;
  const freshness = new Date().toISOString();

  const projections: Record<GuideDataGroup, Record<string, unknown>> = {
    dashboard: {
      totalLeads: number(data.totalLeads),
      newLeads: number(data.newLeads),
      wonLeads: number(data.wonLeads),
      lostLeads: number(data.lostLeads),
      totalListings: number(data.totalListings),
      availableListings: number(data.availableListings),
      totalContracts: number(data.totalContracts),
      signedContracts: number(data.signedContracts),
      revenue: number(data.revenue),
      pipelineValue: number(data.pipelineValue),
      conversionRate: number(data.conversionRate),
    },
    leads: {
      total: number(data.totalLeads),
      new: number(data.newLeads),
      won: number(data.wonLeads),
      lost: number(data.lostLeads),
      byStage: data.leadsByStage || {},
      bySource: data.leadsBySource || {},
    },
    inventory: {
      total: number(data.totalListings),
      available: number(data.availableListings),
      ...(data.inventoryOverview || {}),
    },
    inbox: {
      ...(data.inboxOverview || {}),
    },
    contracts: {
      total: number(data.totalContracts),
      signed: number(data.signedContracts),
      pending: number(data.workQueue?.contracts),
      proposals: number(data.totalProposals),
      approvedProposals: number(data.approvedProposals),
    },
  };

  const summary = projections[group];
  const hasData = Object.values(summary).some(value => {
    if (typeof value === 'number') return value > 0;
    if (value && typeof value === 'object') return Object.keys(value).length > 0;
    return Boolean(value);
  });

  return { group, language, status: hasData ? 'ok' : 'empty', scope, freshness, summary };
}

export function detectGuideDataGroup(message: string): GuideDataGroup | null {
  const value = normalizeGuideQuery(message);
  // A module keyword alone is not enough to make this a data question.
  // Procedural/capability questions must go to the platform guide instead
  // (for example, "Làm thế nào để tạo một lead?" is not a lead summary).
  if (/(lam the nao|cach nao|cach de|huong dan|how do i|how can i|what can i|toi co the|co the lam gi|tao|them moi|chinh sua|xoa|dang|mo o dau|o dau|where can i|how to)/i.test(value)) {
    return null;
  }
  if (!/(bao nhieu|so lieu|thong ke|tom tat|tong quan|hien tai|hom nay|dang co|chua doc|da ky|available|count|summary|stats|metrics|how many|current)/i.test(value)) {
    return null;
  }
  if (/(dashboard|kpi|doanh thu|doanh so|pipeline|tong quan)/i.test(value)) return 'dashboard';
  if (/(lead|khach hang tiem nang|khach hang|sales funnel)/i.test(value)) return 'leads';
  if (/(inventory|kho hang|bat dong san|listing|san pham)/i.test(value)) return 'inventory';
  if (/(inbox|tin nhan|hoi thoai|zalo|facebook|web chat)/i.test(value)) return 'inbox';
  if (/(contract|hop dong|proposal|de xuat|ky)/i.test(value)) return 'contracts';
  return null;
}

export function renderGuideDataSummary(result: GuideSummaryResult): string {
  const vn = result.language === 'vn';
  const scope = result.scope === 'personal'
    ? (vn ? 'phạm vi cá nhân' : 'personal scope')
    : (vn ? 'phạm vi công ty' : 'company scope');
  if (result.status === 'empty') {
    return vn
      ? `Chưa có dữ liệu trong ${scope} cho khoảng thời gian đã chọn.`
      : `No data is available in the ${scope} for the selected period.`;
  }
  if (result.status === 'forbidden') {
    return vn ? 'Bạn không có quyền xem nhóm dữ liệu này.' : 'You do not have permission to view this data group.';
  }

  const s = result.summary as any;
  const lines: string[] = vn
    ? [`Tóm tắt dữ liệu (${scope}):`]
    : [`Data summary (${scope}):`];
  switch (result.group) {
    case 'dashboard':
      lines.push(vn
        ? `Leads: ${s.totalLeads} tổng, ${s.newLeads} mới, ${s.wonLeads} thắng, ${s.lostLeads} mất.`
        : `Leads: ${s.totalLeads} total, ${s.newLeads} new, ${s.wonLeads} won, ${s.lostLeads} lost.`);
      lines.push(vn
        ? `Kho: ${s.availableListings}/${s.totalListings} BĐS đang có sẵn. Hợp đồng: ${s.signedContracts}/${s.totalContracts} đã ký.`
        : `Inventory: ${s.availableListings}/${s.totalListings} listings available. Contracts: ${s.signedContracts}/${s.totalContracts} signed.`);
      lines.push(vn ? `Doanh thu: ${s.revenue}; pipeline: ${s.pipelineValue}.` : `Revenue: ${s.revenue}; pipeline: ${s.pipelineValue}.`);
      break;
    case 'leads':
      lines.push(vn
        ? `Tổng ${s.total} leads: ${s.new} mới, ${s.won} thắng, ${s.lost} mất.`
        : `${s.total} leads: ${s.new} new, ${s.won} won, ${s.lost} lost.`);
      break;
    case 'inventory':
      lines.push(vn
        ? `Tổng ${s.total} BĐS; đang hoạt động ${s.active ?? s.available}; đã bán ${s.sold}; cho thuê ${s.rented}; hết hạn ${s.expired}.`
        : `${s.total} listings; active ${s.active ?? s.available}; sold ${s.sold}; rented ${s.rented}; expired ${s.expired}.`);
      break;
    case 'inbox':
      lines.push(vn
        ? `Tin chưa đọc — Zalo: ${s.zalo || 0}, Facebook: ${s.facebook || 0}, Web chat: ${s.webChat || 0}.`
        : `Unread messages — Zalo: ${s.zalo || 0}, Facebook: ${s.facebook || 0}, Web chat: ${s.webChat || 0}.`);
      lines.push(vn ? `Thời gian phản hồi trung bình: ${s.avgResponseMinutes ?? 'chưa có dữ liệu'} phút.` : `Average response time: ${s.avgResponseMinutes ?? 'no data'} minutes.`);
      break;
    case 'contracts':
      lines.push(vn
        ? `Hợp đồng: ${s.total} tổng, ${s.signed} đã ký, ${s.pending} đang chờ xử lý.`
        : `Contracts: ${s.total} total, ${s.signed} signed, ${s.pending} pending.`);
      break;
  }
  return lines.join('\n');
}