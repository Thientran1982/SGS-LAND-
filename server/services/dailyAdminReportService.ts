import { PoolClient } from 'pg';
import { withTenantContext, withRlsBypass, withDistributedLock } from '../db';
import { DEFAULT_TENANT_ID } from '../constants';
import { emailService } from './emailService';
import { logger } from '../middleware/logger';
import { notificationRepository } from '../repositories/notificationRepository';
import { agentOperatingRepository } from '../repositories/agentOperatingRepository';
import { notificationService } from './notificationService';
import {
  classifySupportCsatReason,
  SUPPORT_CSAT_REASON_CATEGORIES,
  SupportCsatReasonCategory,
} from './agentMemoryService';

export const REPORT_TIME_ZONE = 'Asia/Ho_Chi_Minh';
const MISSING = 'chưa có dữ liệu';

export interface DailyReportMetrics {
  reportDate: string;
  leads: { new: number | null; byStage: Record<string, number>; bySource: Record<string, number> };
  brokers: { active: number | null; assignedLeads: number | null; top: Array<{ name: string; leads: number }> };
  listings: { new: number | null; priceUpdated: number | null; topViewed: Array<{ title: string; views: number }> };
  traffic: {
    propertyViews: number | null;
    listingSearches: number | null;
    topSearches: Array<{ query: string; searches: number }>;
  };
  tasks: { created: number | null; overdue: number | null; completed: number | null };
  minh: {
    conversations: number | null;
    averageCsat: number | null;
    unanswered: number | null;
    lowCsatReasons?: Array<{ category: SupportCsatReasonCategory; count: number }>;
  };
  geoSeo: {
    available: boolean;
    note: string;
    snapshotDate?: string | null;
    capturedAt?: string | null;
    aiMentionRate?: number | null;
    aiMentions?: number | null;
    aiQueries?: number | null;
    seoScore?: number | null;
    measuredSources?: string[];
    sourceStatuses?: string[];
  };
  warnings: { count: number | null; notable: string[] };
}

export interface DailyReportSummary extends DailyReportMetrics {
  overview: Array<{ label: string; value: number | string }>;
  comparisons: Record<string, { yesterday: number | null; sevenDayAverage: number | null }>;
  dataNotes: string[];
  agentOperations?: {
    shift: string;
    summary: string;
    metrics: Record<string, unknown>;
  };
}

function vnDate(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: REPORT_TIME_ZONE }).format(date);
}
function dateParts(date: string) {
  return { start: `${date} 00:00:00+07`, end: `${date} 00:00:00+07` };
}
function safeNumber(value: any): number { return Number(value || 0); }
function queryDateRange(column: string) {
  return `${column} >= $2::timestamptz AND ${column} < ($2::date + INTERVAL '1 day')`;
}

async function optional<T>(client: PoolClient, sql: string, params: any[], fallback: T): Promise<T> {
  try { const result = await client.query(sql, params); return (result.rows[0] as T) ?? fallback; }
  catch (err: any) {
    if (!/does not exist|undefined column/i.test(err?.message || '')) logger.warn(`[DailyReport] optional source unavailable: ${err.message}`);
    return fallback;
  }
}

async function optionalRows<T>(client: PoolClient, sql: string, params: any[], fallback: T[]): Promise<T[]> {
  try { return (await client.query(sql, params)).rows as T[]; }
  catch (err: any) {
    if (!/does not exist|undefined column/i.test(err?.message || '')) logger.warn(`[DailyReport] optional source unavailable: ${err.message}`);
    return fallback;
  }
}

function parseJsonObject(value: unknown): Record<string, any> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * CSAT signals are stored as JSON text for backwards compatibility. The
 * accepted contract is a 1–5 score under score, rating, csat, or value.
 * Invalid values are ignored rather than changing the report to a false zero.
 */
export function extractSupportCsatScore(payload: unknown): number | null {
  const data = parseJsonObject(payload);
  if (!data) return null;
  const candidate = [data.score, data.rating, data.csat, data.value]
    .find(value => value !== null && value !== undefined && value !== '');
  const score = Number(candidate);
  return Number.isFinite(score) && score >= 1 && score <= 5 ? score : null;
}

const SUPPORT_CSAT_REASON_CATEGORY_SET = new Set<string>(SUPPORT_CSAT_REASON_CATEGORIES);

/**
 * Only low scores can contribute a reason. Prefer the category captured at
 * write time, but classify legacy payloads locally without returning their
 * free text to a report.
 */
export function extractSupportCsatReasonCategory(payload: unknown): SupportCsatReasonCategory | null {
  const data = parseJsonObject(payload);
  const score = extractSupportCsatScore(data);
  if (!data || score === null || score > 2) return null;
  const stored = String(data.reasonCategory || '').trim();
  if (SUPPORT_CSAT_REASON_CATEGORY_SET.has(stored)) return stored as SupportCsatReasonCategory;
  const reason = String(data.reason || '').trim();
  return reason ? classifySupportCsatReason(reason) : null;
}

export function groupSupportCsatReasons(
  signals: Array<{ payload: unknown }>,
): Array<{ category: SupportCsatReasonCategory; count: number }> {
  const counts = new Map<SupportCsatReasonCategory, number>();
  for (const signal of signals) {
    const category = extractSupportCsatReasonCategory(signal.payload);
    if (category) counts.set(category, (counts.get(category) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
}

function buildGeoSeoMetrics(snapshot: any): DailyReportMetrics['geoSeo'] {
  if (!snapshot) return { available: false, note: MISSING };

  const ai = parseJsonObject(snapshot.ai_mentions_json) || {};
  const engines = ai.engines && typeof ai.engines === 'object' ? Object.values(ai.engines) as any[] : [];
  const measuredEngines = engines.filter(engine => engine?.status === 'measured');
  const aiQueries = measuredEngines.reduce((sum, engine) => sum + safeNumber(engine?.queries), 0);
  const aiMentions = measuredEngines.reduce((sum, engine) => sum + safeNumber(engine?.mentions), 0);
  const aiMentionRate = aiQueries > 0 ? Number((aiMentions / aiQueries).toFixed(3)) : null;

  const gsc = parseJsonObject(snapshot.gsc_top20_json) || {};
  const gscMeasured = Array.isArray(gsc.keywords)
    ? gsc.keywords.filter((keyword: any) => Number.isFinite(Number(keyword?.position))).length
    : 0;
  const lighthouse = parseJsonObject(snapshot.lighthouse_json) || {};
  const lighthousePages = Array.isArray(lighthouse.pages) ? lighthouse.pages : [];
  const seoScores = lighthousePages
    .filter((page: any) => page?.status === 'measured' && Number.isFinite(Number(page?.scores?.seo)))
    .map((page: any) => Number(page.scores.seo));
  const seoScore = seoScores.length
    ? Math.round(seoScores.reduce((sum, score) => sum + score, 0) / seoScores.length)
    : null;

  const measuredSources: string[] = [];
  if (aiQueries > 0) measuredSources.push('AI mention probes');
  if (gscMeasured > 0) measuredSources.push('Google Search Console');
  if (seoScores.length > 0) measuredSources.push('PageSpeed Insights');
  const sourceStatuses = [
    `AI mention probes: ${
      measuredEngines.length > 0
        ? 'đã đo'
        : engines.some(engine => engine?.status === 'error')
          ? 'API lỗi'
          : engines.some(engine => engine?.status === 'skipped')
            ? 'bỏ qua'
            : 'chưa đo'
    }`,
    `Google Search Console: ${gscMeasured > 0 ? 'đã đo' : gsc.error ? 'lỗi' : 'chưa có dữ liệu'}`,
    `PageSpeed Insights: ${
      seoScores.length > 0
        ? 'đã đo'
        : lighthousePages.some((page: any) => page?.status === 'error')
          ? 'lỗi'
          : lighthousePages.some((page: any) => page?.status === 'skipped')
            ? 'bỏ qua'
            : 'chưa đo'
    }`,
  ];
  const available = measuredSources.length > 0;
  const snapshotDate = snapshot.snapshot_date ? String(snapshot.snapshot_date).slice(0, 10) : null;
  const sourceSummary = sourceStatuses.join(' · ');
  const details = [
    aiQueries > 0 ? `AI ${Math.round((aiMentionRate || 0) * 100)}%` : null,
    gscMeasured > 0 ? `GSC ${gscMeasured} từ khóa` : null,
    seoScores.length > 0 ? `SEO ${seoScore}/100` : null,
  ].filter(Boolean);

  return {
    available,
    note: available
      ? `Snapshot ${snapshotDate || MISSING}${details.length ? ` · ${details.join(' · ')}` : ''} · Nguồn: ${sourceSummary}`
      : `Snapshot ${snapshotDate || MISSING} chưa có phép đo thành công · Nguồn: ${sourceSummary}`,
    snapshotDate,
    capturedAt: snapshot.captured_at ? new Date(snapshot.captured_at).toISOString() : null,
    aiMentionRate,
    aiMentions: aiQueries > 0 ? aiMentions : null,
    aiQueries: aiQueries > 0 ? aiQueries : null,
    seoScore,
    measuredSources,
    sourceStatuses,
  };
}

export async function collectDailyMetrics(tenantId: string, reportDate: string): Promise<DailyReportMetrics> {
  const { start } = dateParts(reportDate);
  return withTenantContext(tenantId, async (client) => {
    const lead = await optional(client, `SELECT COUNT(*)::int AS new FROM leads
      WHERE tenant_id=$1 AND ${queryDateRange('created_at')}`, [tenantId, start], { new: null });
    const leadStages = await optional(client, `SELECT COALESCE(jsonb_object_agg(COALESCE(stage,'UNKNOWN'), count),'{}') AS stages
      FROM (SELECT stage, COUNT(*)::int AS count FROM leads WHERE tenant_id=$1 GROUP BY stage) s`,
      [tenantId], { stages: {} });
    const leadSources = await optional(client, `SELECT COALESCE(jsonb_object_agg(COALESCE(source,'UNKNOWN'), count),'{}') AS sources
      FROM (SELECT source, COUNT(*)::int AS count FROM leads WHERE tenant_id=$1 AND ${queryDateRange('created_at')} GROUP BY source) s`,
      [tenantId, start], { sources: {} });
    const broker = await optional(client, `SELECT COUNT(DISTINCT assigned_to) FILTER (WHERE assigned_to IS NOT NULL)::int AS active,
      COUNT(*) FILTER (WHERE assigned_to IS NOT NULL)::int AS assigned FROM leads WHERE tenant_id=$1 AND ${queryDateRange('created_at')}`,
      [tenantId, start], { active: null, assigned: null });
    const topBrokers = await client.query(`SELECT COALESCE(u.name,u.email,'Không rõ') AS name, COUNT(l.id)::int AS leads
      FROM leads l LEFT JOIN users u ON u.id=l.assigned_to AND u.tenant_id=$1
      WHERE l.tenant_id=$1 AND ${queryDateRange('l.created_at')} GROUP BY u.name,u.email ORDER BY leads DESC LIMIT 5`, [tenantId, start]);
    const listings = await optional(client, `SELECT
      COUNT(*) FILTER (WHERE ${queryDateRange('created_at')})::int AS new,
      COUNT(*) FILTER (WHERE updated_at >= $2::timestamptz AND updated_at < ($2::date + INTERVAL '1 day') AND updated_at > created_at)::int AS price_updated
      FROM listings WHERE tenant_id=$1`, [tenantId, start], { new: null, price_updated: null });
    const traffic = await optional(client, `SELECT
      COUNT(*) FILTER (WHERE event_type = 'property_view')::int AS property_views,
      COUNT(*) FILTER (WHERE event_type = 'listing_search')::int AS listing_searches
      FROM visitor_events
      WHERE tenant_id=$1 AND ${queryDateRange('created_at')}`,
      [tenantId, start], { property_views: null, listing_searches: null });
    const topViewed = await optionalRows<{ title: string; views: number }>(client, `SELECT
      COALESCE(NULLIF(l.title, ''), ev.metadata->>'listingCode', 'BĐS không xác định') AS title,
      COUNT(*)::int AS views
      FROM visitor_events ev
      LEFT JOIN listings l
        ON l.tenant_id=$1
       AND (l.code = ev.metadata->>'listingCode' OR l.id::text = ev.metadata->>'listingCode')
      WHERE ev.tenant_id=$1
        AND ev.event_type='property_view'
        AND ${queryDateRange('ev.created_at')}
        AND NULLIF(trim(ev.metadata->>'listingCode'), '') IS NOT NULL
      GROUP BY l.title, ev.metadata->>'listingCode'
      ORDER BY views DESC LIMIT 5`,
      [tenantId, start], []);
    const topSearches = await optionalRows<{ query: string; searches: number }>(client, `SELECT
      lower(trim(metadata->>'query')) AS query,
      COUNT(*)::int AS searches
      FROM visitor_events
      WHERE tenant_id=$1
        AND event_type='listing_search'
        AND ${queryDateRange('created_at')}
        AND NULLIF(trim(metadata->>'query'), '') IS NOT NULL
      GROUP BY lower(trim(metadata->>'query'))
      ORDER BY searches DESC LIMIT 5`,
      [tenantId, start], []);
    const tasks = await optional(client, `SELECT
      COUNT(*) FILTER (WHERE ${queryDateRange('created_at')})::int AS created,
      COUNT(*) FILTER (WHERE due_date < NOW() AND status NOT IN ('DONE','COMPLETED','CANCELLED'))::int AS overdue,
      COUNT(*) FILTER (WHERE status IN ('DONE','COMPLETED') AND updated_at >= $2::timestamptz AND updated_at < ($2::date + INTERVAL '1 day'))::int AS completed
      FROM tasks WHERE tenant_id=$1`, [tenantId, start], { created: null, overdue: null, completed: null });
    const interactions = await optional(client, `SELECT COUNT(*) FILTER (WHERE ${queryDateRange('timestamp')} AND COALESCE(channel,'') IN ('WEB_CHAT','WEB','ZALO','FACEBOOK'))::int AS conversations
      FROM interactions WHERE tenant_id=$1`, [tenantId, start], { conversations: null, csat: null });
    const csatSignals = await optionalRows<{ payload: unknown }>(client, `SELECT payload
      FROM agent_signals
      WHERE tenant_id=$1 AND signal_type='support_csat' AND ${queryDateRange('created_at')}
      ORDER BY created_at ASC`,
      [tenantId, start], []);
    const csatScores = csatSignals.map(row => extractSupportCsatScore(row.payload)).filter((score): score is number => score !== null);
    const averageCsat = csatScores.length
      ? Number((csatScores.reduce((sum, score) => sum + score, 0) / csatScores.length).toFixed(2))
      : null;
    const lowCsatReasons = groupSupportCsatReasons(csatSignals);
    const unanswered = await optional(client, `SELECT COUNT(*)::int AS count FROM agent_human_questions WHERE tenant_id=$1 AND status='OPEN' AND ${queryDateRange('created_at')}`, [tenantId, start], { count: null });
    const warnings = await optional(client, `SELECT COUNT(*)::int AS count FROM error_logs WHERE tenant_id=$1 AND ${queryDateRange('created_at')}`, [tenantId, start], { count: null });
    const geoSnapshot = tenantId === DEFAULT_TENANT_ID
      ? await optional(client, `SELECT date::text AS snapshot_date, ai_mentions_json, gsc_top20_json, lighthouse_json, created_at AS captured_at
          FROM seo_geo_snapshots
          WHERE date <= $1::date
          ORDER BY date DESC LIMIT 1`, [reportDate], null)
      : null;
    const topViewedListings = topViewed.map(row => ({ title: row.title, views: safeNumber(row.views) }));
    return {
      reportDate, leads: { new: lead.new == null ? null : safeNumber(lead.new), byStage: leadStages.stages || {}, bySource: leadSources.sources || {} },
      brokers: { active: broker.active == null ? null : safeNumber(broker.active), assignedLeads: broker.assigned == null ? null : safeNumber(broker.assigned), top: topBrokers.rows },
      listings: { new: listings.new == null ? null : safeNumber(listings.new), priceUpdated: listings.price_updated == null ? null : safeNumber(listings.price_updated), topViewed: topViewedListings },
      traffic: {
        propertyViews: traffic.property_views == null ? null : safeNumber(traffic.property_views),
        listingSearches: traffic.listing_searches == null ? null : safeNumber(traffic.listing_searches),
        topSearches: topSearches.map(row => ({ query: row.query, searches: safeNumber(row.searches) })),
      },
      tasks: { created: tasks.created == null ? null : safeNumber(tasks.created), overdue: tasks.overdue == null ? null : safeNumber(tasks.overdue), completed: tasks.completed == null ? null : safeNumber(tasks.completed) },
      minh: {
        conversations: interactions.conversations == null ? null : safeNumber(interactions.conversations),
        averageCsat,
        unanswered: unanswered.count == null ? null : safeNumber(unanswered.count),
        lowCsatReasons,
      },
      geoSeo: buildGeoSeoMetrics(geoSnapshot),
      warnings: { count: warnings.count == null ? null : safeNumber(warnings.count), notable: [] },
    };
  });
}

export function buildReportSummary(metrics: DailyReportMetrics): DailyReportSummary {
  const trafficAvailable = metrics.traffic?.propertyViews != null || metrics.traffic?.listingSearches != null;
  const dataNotes = [
    `GEO/SEO: ${metrics.geoSeo.available ? metrics.geoSeo.note : metrics.geoSeo.note || MISSING}`,
    trafficAvailable
      ? 'Lượt xem/tìm kiếm: nguồn thống nhất visitor_events'
      : 'Lượt xem/tìm kiếm: visitor_events chưa khả dụng',
  ];
  return {
    ...metrics,
    overview: [
      { label: 'Lead mới', value: metrics.leads.new ?? MISSING },
      { label: 'Tin đăng mới', value: metrics.listings.new ?? MISSING },
      { label: 'Công việc hoàn thành', value: metrics.tasks.completed ?? MISSING },
      { label: 'Câu hỏi Minh chờ xử lý', value: metrics.minh.unanswered ?? MISSING },
    ],
    comparisons: {},
    dataNotes,
  };
}

function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]!));
}
export function renderReportEmail(summary: DailyReportSummary): { subject: string; html: string; text: string } {
  const [y,m,d] = summary.reportDate.split('-');
  const subject = `[SGSLand] Báo cáo ngày ${d}/${m}/${y}`;
  const row = (label: string, value: unknown) => `<tr><td style="padding:7px;border-bottom:1px solid #e2e8f0">${esc(label)}</td><td style="padding:7px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:bold">${esc(value)}</td></tr>`;
  const table = (rows: string) => `<table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 18px;background:#fff">${rows}</table>`;
  const breakdown = (values: Record<string, number>, labels: Record<string, string>) => {
    const entries = Object.entries(values || {});
    if (entries.length === 0) return MISSING;
    return entries.map(([key, value]) => `${labels[key] || key}: ${value}`).join(' · ');
  };
  const leadStageLabels: Record<string, string> = {
    NEW: 'Mới', CONTACTED: 'Đã liên hệ', QUALIFIED: 'Đủ điều kiện',
    NEGOTIATING: 'Đang thương lượng', WON: 'Thành công', LOST: 'Thất bại', UNKNOWN: 'Chưa xác định',
  };
  const leadSourceLabels: Record<string, string> = {
    WEBSITE: 'Website', WIDGET: 'Widget', FACEBOOK: 'Facebook', ZALO: 'Zalo',
    REFERRAL: 'Giới thiệu', IMPORT: 'Nhập dữ liệu', UNKNOWN: 'Chưa xác định',
  };
  const agentSectionLabels: Record<string, string> = {
    events: 'Sự kiện Agent', executions: 'Lượt chạy Agent', humanQuestions: 'Câu hỏi cần người xử lý',
  };
  const agentMetricRows = summary.agentOperations
    ? Object.entries(summary.agentOperations.metrics).flatMap(([section, values]) => {
        if (!values || typeof values !== 'object' || Array.isArray(values)) return [row(section, values)];
        const data = values as Record<string, unknown>;
        const labels: Record<string, string> = {
          total: 'Tổng số',
          success: 'Thành công',
          failed: 'Thất bại',
          done: 'Hoàn tất',
          answered: 'Đã trả lời',
        };
        return Object.entries(data).map(([key, value]) => row(`${agentSectionLabels[section] || section} · ${labels[key] || key}`, value));
      }).join('')
    : '';
  const agentSection = summary.agentOperations
    ? `<h3 style="margin:22px 0 8px">Vận hành Agent</h3><p style="margin:0 0 8px">${esc(summary.agentOperations.summary)}</p>${table(agentMetricRows)}`
    : `<h3 style="margin:22px 0 8px">Vận hành Agent</h3><p style="color:#64748b">Chưa có báo cáo ca của Agent.</p>`;
  const traffic = summary.traffic || { propertyViews: null, listingSearches: null, topSearches: [] };
  const topViewedText = (summary.listings.topViewed || []).length
    ? summary.listings.topViewed.map(item => `${item.title}: ${item.views}`).join(' · ')
    : MISSING;
  const topSearchesText = (traffic.topSearches || []).length
    ? traffic.topSearches.map(item => `${item.query}: ${item.searches}`).join(' · ')
    : MISSING;
  const trafficValue = traffic.propertyViews == null && traffic.listingSearches == null
    ? MISSING
    : `${traffic.propertyViews ?? MISSING} lượt xem · ${traffic.listingSearches ?? MISSING} lượt tìm kiếm`;
  const csatReasonLabels: Record<string, string> = {
    response_time: 'Phản hồi chậm',
    resolution: 'Chưa giải quyết được vấn đề',
    answer_quality: 'Câu trả lời chưa phù hợp',
    communication: 'Cách giao tiếp',
    information: 'Thông tin/giá chưa phù hợp',
    technical: 'Lỗi kỹ thuật/kênh liên hệ',
    other: 'Lý do khác',
  };
  const lowCsatReasons = summary.minh.lowCsatReasons || [];
  const lowCsatReasonsText = lowCsatReasons.length
    ? lowCsatReasons.map(item => `${csatReasonLabels[item.category] || 'Lý do khác'}: ${item.count}`).join(' · ')
    : MISSING;
  const dataNotesSection = table(
    row('GEO/SEO', summary.geoSeo.available ? 'Đã có dữ liệu' : summary.geoSeo.note || MISSING) +
    row('Lượt xem / tìm kiếm dự án', `${trafficValue} · nguồn visitor_events`) +
    row('Nguồn GEO/SEO', summary.geoSeo.note || MISSING),
  );
  const html = `<div style="font-family:Arial,sans-serif;max-width:620px;color:#1e293b;line-height:1.45"><h2>SGSLand — Báo cáo vận hành ngày ${esc(d+'/'+m+'/'+y)}</h2>
    ${table(summary.overview.map(x => row(x.label,x.value)).join(''))}
    <h3 style="margin:22px 0 8px">Leads & môi giới F1</h3>${table(row('Lead mới', summary.leads.new ?? MISSING) + row('Lead theo trạng thái', breakdown(summary.leads.byStage, leadStageLabels)) + row('Lead theo nguồn', breakdown(summary.leads.bySource, leadSourceLabels)) + row('Môi giới hoạt động', summary.brokers.active ?? MISSING) + row('Lead được phân bổ', summary.brokers.assignedLeads ?? MISSING))}
    <h3 style="margin:22px 0 8px">Listing, lượt xem & công việc</h3>${table(row('Tin đăng mới', summary.listings.new) + row('Tin cập nhật giá', summary.listings.priceUpdated) + row('Lượt xem sản phẩm', traffic.propertyViews ?? MISSING) + row('Lượt tìm kiếm', traffic.listingSearches ?? MISSING) + row('Top sản phẩm được xem', topViewedText) + row('Top từ khóa tìm kiếm', topSearchesText) + row('Task tạo mới', summary.tasks.created) + row('Task quá hạn', summary.tasks.overdue))}
    <h3 style="margin:22px 0 8px">Minh & cảnh báo</h3>${table(row('Hội thoại', summary.minh.conversations ?? MISSING) + row('CSAT trung bình', summary.minh.averageCsat ?? MISSING) + row('Nhóm lý do CSAT thấp', lowCsatReasonsText) + row('Câu hỏi chưa trả lời', summary.minh.unanswered ?? MISSING) + row('Cảnh báo hệ thống', summary.warnings.count ?? MISSING))}
    ${agentSection}
    <h3 style="margin:22px 0 8px">Nguồn dữ liệu bổ sung</h3>${dataNotesSection}
    </div>`;
  const text = [subject, ...summary.overview.map(x => `${x.label}: ${x.value}`), `GEO/SEO: ${summary.geoSeo.available ? summary.geoSeo.note : summary.geoSeo.note || MISSING}`, `Lượt xem / tìm kiếm dự án: ${trafficValue} · nguồn visitor_events`, `CSAT trung bình: ${summary.minh.averageCsat ?? MISSING}`, `Nhóm lý do CSAT thấp: ${lowCsatReasonsText}`, `Cảnh báo: ${summary.warnings.count ?? MISSING}`, summary.agentOperations ? `Vận hành Agent: ${summary.agentOperations.summary}` : 'Vận hành Agent: chưa có báo cáo ca'].join('\n');
  return { subject, html, text };
}

async function adminsByTenant(): Promise<Array<{ tenantId: string; email: string }>> {
  return withRlsBypass(async client => {
    const result = await client.query(`SELECT tenant_id AS "tenantId", email FROM users WHERE role IN ('ADMIN','SUPER_ADMIN') AND status='ACTIVE' AND email IS NOT NULL ORDER BY tenant_id,email`);
    return result.rows;
  });
}

export async function runDailyReport(reportDate = vnDate(), force = false) {
  const recipients = await adminsByTenant();
  const byTenant = new Map<string, string[]>();
  for (const r of recipients) byTenant.set(r.tenantId, [...(byTenant.get(r.tenantId) || []), r.email]);
  const results: any[] = [];
  for (const [tenantId, emails] of byTenant) {
    const agentShiftReport = await agentOperatingRepository.generateDailyShiftReport(tenantId, reportDate, 'ALL_DAY')
      .catch((error: any) => {
        logger.warn(`[DailyReport] agent shift report unavailable for tenant ${tenantId}: ${error?.message || error}`);
        return null;
      });
    const result = await withTenantContext(tenantId, async client => {
      const existing = await client.query('SELECT * FROM agent_report_log WHERE tenant_id=$1 AND report_date=$2::date', [tenantId, reportDate]);
      if (existing.rows[0]?.status === 'sent' && !force) return { tenantId, status: 'skipped', reason: 'already_sent' };
      if (existing.rows[0]?.status === 'delivery_unknown' && !force) {
        return {
          tenantId,
          status: 'delivery_unknown',
          recipients: (existing.rows[0].recipients || emails).length,
          manualAction: 'Kiểm tra provider bằng delivery key trước khi gửi thủ công; hệ thống không tự động gửi lại.',
        };
      }
      if (force && existing.rows[0]?.status === 'delivery_unknown') {
        const priorRecipients = existing.rows[0].recipients || emails;
        const verification = await Promise.all(priorRecipients.map((email: string) =>
          emailService.verifyDelivery(tenantId, `daily-report:${tenantId}:${reportDate}:${email}`),
        ));
        const canRetry = verification.every((result: any) => result.status === 'not_received');
        if (!canRetry) {
          return {
            tenantId,
            status: 'delivery_unknown',
            recipients: priorRecipients.length,
            deliveryVerification: verification,
            manualAction: 'Provider chưa xác nhận tất cả thư chưa nhận. Không được tự động gửi lại; cần xử lý thủ công.',
          };
        }
      }
      // A force-run retries delivery without rewriting the evidence captured
      // for a failed report.
      const baseSummary = existing.rows[0]?.status === 'failed' && existing.rows[0]?.summary_snapshot
        ? existing.rows[0].summary_snapshot as DailyReportSummary
        : buildReportSummary(await collectDailyMetrics(tenantId, reportDate));
      const summary: DailyReportSummary = agentShiftReport?.shift
        ? {
            ...baseSummary,
            agentOperations: {
              shift: agentShiftReport.shift,
              summary: agentShiftReport.summary,
              metrics: agentShiftReport.metrics_json || {},
            },
          }
        : baseSummary;
      await client.query(`INSERT INTO agent_report_log(tenant_id,report_date,status,recipients,summary_snapshot)
        VALUES($1,$2,'pending',$3::jsonb,$4::jsonb) ON CONFLICT(tenant_id,report_date) DO UPDATE SET status='pending',recipients=$3::jsonb,summary_snapshot=$4::jsonb,error_detail=NULL,updated_at=NOW()`,
        [tenantId, reportDate, JSON.stringify(emails), JSON.stringify(summary)]);
      const mail = renderReportEmail(summary);
      let last: any;
      for (let attempt=1; attempt<=3; attempt++) {
        last = await Promise.all(emails.map(email => emailService.sendEmail(tenantId, { to: email, subject: mail.subject, html: mail.html, text: mail.text, template: 'daily_admin_report', dedupeKey: `daily-report:${reportDate}:${email}`, deliveryKey: `daily-report:${tenantId}:${reportDate}:${email}`, dedupeWindowMinutes: 0, skipQuota: true })));
        if (last.every((x: any) => x.success) || last.some((x: any) => x.ambiguous)) break;
        await new Promise(resolve => setTimeout(resolve, attempt * 100));
      }
      const ok = last?.every((x: any) => x.success);
      const ambiguous = !ok && last?.some((x: any) => x.ambiguous);
      const status = ok ? 'sent' : ambiguous ? 'delivery_unknown' : 'failed';
      await client.query(`UPDATE agent_report_log SET status=$3,error_detail=$4,sent_at=CASE WHEN $3='sent' THEN NOW() ELSE NULL END,updated_at=NOW() WHERE tenant_id=$1 AND report_date=$2::date`,
        [tenantId, reportDate, status, ok ? null : JSON.stringify(last)]);
      if (ok) {
        await notificationRepository.createForTenantAdmins(tenantId, {
          type: 'daily_admin_report',
          title: `Đã nhận báo cáo vận hành ngày ${reportDate}`,
          body: agentShiftReport
            ? `Báo cáo ngày đã gửi qua email và có kèm báo cáo ca Agent: ${agentShiftReport.summary}`
            : 'Báo cáo ngày đã gửi qua email. Chưa có báo cáo ca Agent.',
          metadata: { reportDate, hasAgentShiftReport: Boolean(agentShiftReport) },
        }).catch(err => logger.error(`[DailyReport] could not create sent notification for tenant ${tenantId}`, err));
      }
      if (ambiguous) {
        const payload = {
          reportDate,
          recipients: emails,
          deliveryKeys: emails.map(email => `daily-report:${tenantId}:${reportDate}:${email}`),
          providerErrors: last.filter((x: any) => x.ambiguous).map((x: any) => x.error || 'provider timeout'),
          manualAction: 'Xác minh trạng thái trên provider bằng delivery key. Chỉ gửi thủ công sau khi provider xác nhận chưa nhận thư.',
        };
        await notificationRepository.recordOperationalEvent(tenantId, 'daily_report_delivery_unknown', payload).catch(err =>
          logger.error(`[DailyReport] could not persist unknown-delivery alert for tenant ${tenantId}`, err));
        await notificationRepository.createForTenantAdmins(tenantId, {
          type: 'daily_report_delivery_unknown',
          title: `Báo cáo ngày ${reportDate} chưa xác định trạng thái gửi`,
          body: `Provider timeout. Kiểm tra provider trước khi gửi lại; người nhận: ${emails.join(', ')}`,
          metadata: payload,
        }).catch(err => logger.error(`[DailyReport] could not create in-app alert for tenant ${tenantId}`, err));
        await Promise.all(emails.map(email => emailService.sendDailyReportDeliveryAlertEmail(tenantId, email, reportDate, emails)
          .catch(err => logger.error(`[DailyReport] could not email unknown-delivery alert to ${email}`, err))));
      }
      return {
        tenantId,
        status,
        recipients: emails.length,
        ...(ambiguous ? { manualAction: 'Kiểm tra provider bằng delivery key trước khi gửi thủ công; hệ thống không tự động gửi lại.' } : {}),
      };
    });
    results.push(result);
  }
  return { reportDate, results };
}

export async function getDailyReport(tenantId: string, reportDate: string) {
  return withTenantContext(tenantId, async client => (await client.query('SELECT * FROM agent_report_log WHERE tenant_id=$1 AND report_date=$2::date', [tenantId,reportDate])).rows[0] || null);
}
export async function listDailyReports(tenantId: string, limit = 30) {
  return withTenantContext(tenantId, async client => (await client.query('SELECT * FROM agent_report_log WHERE tenant_id=$1 ORDER BY report_date DESC LIMIT $2', [tenantId, Math.min(Math.max(limit,1),100)])).rows);
}

const REPLAY_MAX_ATTEMPTS = 5;
const REPLAY_STALE_MINUTES = 10;

/**
 * Reconcile interrupted Brevo deliveries one recipient at a time. A provider
 * lookup is always performed before sending, so a timeout cannot turn into a
 * duplicate. The report snapshot is reused; metrics are never recollected.
 */
async function replayInterruptedDailyReportsUnlocked(tenantId?: string): Promise<{ inspected: number; replayed: number; failed: number }> {
  const tenantClause = tenantId ? ' AND c.tenant_id=$1::uuid' : '';
  const candidates = await withRlsBypass(async client => (await client.query(`
    SELECT c.tenant_id AS "tenantId", c.delivery_key AS "deliveryKey",
           c.provider_message_id AS "messageId", r.report_date AS "reportDate",
           r.recipients, r.summary_snapshot AS "summarySnapshot"
      FROM email_delivery_claims c
      JOIN agent_report_log r ON r.tenant_id=c.tenant_id
        AND c.delivery_key LIKE 'daily-report:' || c.tenant_id::text || ':' || r.report_date::text || ':%'
     WHERE c.status='UNKNOWN' AND r.status <> 'sent'
       AND c.updated_at < NOW() - INTERVAL '10 minutes'
       ${tenantClause}
     ORDER BY c.updated_at ASC
     LIMIT 100`, tenantId ? [tenantId] : [])).rows);
  let replayed = 0;
  let failed = 0;
  for (const candidate of candidates) {
    const claimed = await withRlsBypass(async client => (await client.query(`
      INSERT INTO daily_report_delivery_replays
        (tenant_id, report_date, delivery_key, message_id, status, attempt_count)
      VALUES ($1::uuid,$2::date,$3,$4,'PROCESSING',1)
      ON CONFLICT (tenant_id, delivery_key) DO UPDATE SET
        status='PROCESSING', attempt_count=daily_report_delivery_replays.attempt_count+1,
        message_id=COALESCE(EXCLUDED.message_id,daily_report_delivery_replays.message_id),
        requested_at=NOW()
      WHERE daily_report_delivery_replays.attempt_count < $5
        AND daily_report_delivery_replays.status IN ('PENDING','FAILED')
      RETURNING attempt_count`, [
        candidate.tenantId, candidate.reportDate, candidate.deliveryKey,
        candidate.messageId || null, REPLAY_MAX_ATTEMPTS,
      ])).rows[0]);
    if (!claimed) continue;
    const attempt = Number(claimed.attempt_count);
    try {
      const verification = await emailService.verifyDelivery(candidate.tenantId, candidate.deliveryKey);
      if (verification.status === 'delivered') {
        await processBrevoReportDeliveryEvent({
          deliveryKey: candidate.deliveryKey, event: 'delivered',
          messageId: verification.messageId || candidate.messageId,
        });
        await withRlsBypass(client => client.query(
          `UPDATE daily_report_delivery_replays SET status='SENT', completed_at=NOW(), next_retry_at=NOW(), error=NULL
           WHERE tenant_id=$1::uuid AND delivery_key=$2`, [candidate.tenantId, candidate.deliveryKey]));
        replayed++;
        continue;
      }
      if (verification.status !== 'not_received') {
        throw new Error(verification.error || 'Brevo delivery status remains unknown');
      }
      const snapshot = candidate.summarySnapshot as DailyReportSummary;
      const mail = renderReportEmail(snapshot);
      const recipient = String(candidate.deliveryKey).split(':').slice(3).join(':');
      const result = await emailService.sendEmail(candidate.tenantId, {
        to: recipient, subject: mail.subject, html: mail.html, text: mail.text,
        template: 'daily_admin_report', dedupeKey: `daily-report:${candidate.reportDate}:${recipient}`,
        deliveryKey: candidate.deliveryKey, dedupeWindowMinutes: 0, skipQuota: true,
      });
      if (!result.success) throw new Error(result.error || 'Replay send failed');
      await processBrevoReportDeliveryEvent({
        deliveryKey: candidate.deliveryKey, event: 'delivered', messageId: result.messageId,
      });
      await withRlsBypass(client => client.query(
        `UPDATE daily_report_delivery_replays SET status='SENT', completed_at=NOW(), next_retry_at=NOW(), error=NULL
         WHERE tenant_id=$1::uuid AND delivery_key=$2`, [candidate.tenantId, candidate.deliveryKey]));
      replayed++;
    } catch (error: any) {
      const terminal = attempt >= REPLAY_MAX_ATTEMPTS;
      const message = error?.message || String(error);
      await withRlsBypass(client => client.query(
        `UPDATE daily_report_delivery_replays
            SET status=$3, error=$4, completed_at=CASE WHEN $3='DEAD_LETTER' THEN NOW() ELSE NULL END,
                next_retry_at=NOW() + ($5 || ' minutes')::interval
          WHERE tenant_id=$1::uuid AND delivery_key=$2`,
        [candidate.tenantId, candidate.deliveryKey, terminal ? 'DEAD_LETTER' : 'FAILED', message, String(Math.min(60, attempt * 10))]));
      await notificationRepository.recordOperationalEvent(candidate.tenantId,
        terminal ? 'daily_report_delivery_replay_dead_letter' : 'daily_report_delivery_replay_failed',
        { reportDate: candidate.reportDate, deliveryKey: candidate.deliveryKey, messageId: candidate.messageId || null, attempt, maxAttempts: REPLAY_MAX_ATTEMPTS, error: message })
        .catch(err => logger.error('[DailyReport] replay audit failed', err));
      if (terminal) await notificationRepository.createForTenantAdmins(candidate.tenantId, {
        type: 'daily_report_delivery_replay_dead_letter',
        title: `Replay báo cáo ngày ${candidate.reportDate} thất bại liên tục`,
        body: `Không thể khôi phục delivery sau ${REPLAY_MAX_ATTEMPTS} lần; cần kiểm tra Brevo thủ công.`,
        metadata: { deliveryKey: candidate.deliveryKey, attempt, error: message },
      }).catch(err => logger.error('[DailyReport] replay alert failed', err));
      failed++;
    }
  }
  return { inspected: candidates.length, replayed, failed };
}

/**
 * Replay is scheduled independently by every application process. The lock
 * covers discovery and processing, not just one delivery claim, so a second
 * instance cannot race the first instance's candidate list.
 */
export async function replayInterruptedDailyReports(tenantId?: string): Promise<{ inspected: number; replayed: number; failed: number }> {
  // Keep manual tenant replays mutually exclusive with the all-tenant
  // scheduler as well; otherwise the two scopes could race on one delivery.
  const result = await withDistributedLock('daily-report-replay', () => replayInterruptedDailyReportsUnlocked(tenantId));
  return result ?? { inspected: 0, replayed: 0, failed: 0 };
}

/**
 * Replay only the in-app delivery of a persisted Zalo readiness transition.
 * The provider verification is intentionally never called from this worker.
 */
export async function retryZaloReadinessNotificationAlerts(limit = 25): Promise<{
  claimed: number;
  delivered: number;
  failed: number;
  exhausted: number;
}> {
  const retries = await notificationRepository.claimDueZaloReadinessNotificationRetries(limit);
  const result = { claimed: retries.length, delivered: 0, failed: 0, exhausted: 0 };

  for (const retry of retries) {
    try {
      await notificationService.notifyZaloBroadcastNotReady(retry.tenantId, {
        reasonCode: retry.reasonCode as any,
        checkedAt: retry.checkedAt,
        transitionEventId: retry.transitionEventId,
      });
      await notificationRepository.markZaloReadinessNotificationRetryDelivered(retry.id);
      result.delivered++;
    } catch (error) {
      result.failed++;
      const status = await notificationRepository.markZaloReadinessNotificationRetryFailed(
        retry.id,
        retry.attemptCount,
      );
      if (status === 'EXHAUSTED') {
        result.exhausted++;
        await notificationRepository.recordZaloReadinessNotificationExhausted(
          retry.tenantId,
          {
            transitionEventId: retry.transitionEventId,
            reasonCode: retry.reasonCode,
            checkedAt: retry.checkedAt,
            attempts: retry.attemptCount,
          },
        ).catch((signalError) => {
          logger.warn(`[Zalo] Failed to record exhausted readiness notification retry for tenant ${retry.tenantId}: ${signalError instanceof Error ? signalError.message : 'unknown error'}`);
        });
      }
      logger.warn(`[Zalo] Readiness notification retry failed for tenant ${retry.tenantId} (attempt ${retry.attemptCount}): ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  return result;
}

const DAILY_REPORT_DELIVERY_KEY = /^daily-report:([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}):(\d{4}-\d{2}-\d{2}):([^:]+@[^:]+)$/i;
const BOUNCE_EVENTS = new Set(['bounced', 'bounce', 'hardbounce', 'softbounce', 'blocked', 'invalid', 'error']);

export interface BrevoReportDeliveryEvent {
  deliveryKey: string;
  event: string;
  email?: string;
  messageId?: string;
  timestamp?: number;
  tags?: string[];
}

/**
 * Apply a Brevo delivery event to the durable claim and its daily report.
 * The tenant is derived from, and checked against, the delivery key; the
 * webhook never trusts a global/default tenant for report delivery updates.
 */
export async function processBrevoReportDeliveryEvent(event: BrevoReportDeliveryEvent): Promise<{
  matched: boolean;
  tenantId?: string;
  deliveryKey: string;
  claimStatus?: string;
  reportStatus?: string;
}> {
  const match = DAILY_REPORT_DELIVERY_KEY.exec(event.deliveryKey);
  const eventName = String(event.event || '').replace(/[_\s-]/g, '').toLowerCase();
  if (!match || (eventName !== 'delivered' && !BOUNCE_EVENTS.has(eventName))) {
    return { matched: false, deliveryKey: event.deliveryKey };
  }
  const [, tenantId, reportDate, recipient] = match;
  const isDelivered = eventName === 'delivered';

  return withRlsBypass(async client => {
    const claimResult = await client.query(
      `SELECT status, provider_message_id FROM email_delivery_claims
       WHERE tenant_id=$1::uuid AND delivery_key=$2 FOR UPDATE`,
      [tenantId, event.deliveryKey],
    );
    if (!claimResult.rows[0]) {
      return { matched: false, tenantId, deliveryKey: event.deliveryKey };
    }

    const previousClaimStatus = claimResult.rows[0].status;
    const claimUpdate = await client.query(
      `UPDATE email_delivery_claims
       SET status = CASE
           WHEN status = 'SENT' THEN 'SENT'
           WHEN $3::boolean THEN 'SENT'
           ELSE 'FAILED'
         END,
           provider='brevo',
           provider_message_id=COALESCE($4, provider_message_id),
           error=CASE WHEN $3::boolean THEN NULL ELSE $5 END,
           updated_at=NOW()
       WHERE tenant_id=$1::uuid AND delivery_key=$2
       RETURNING status`,
      [tenantId, event.deliveryKey, isDelivered, event.messageId || null, `Brevo event: ${event.event}`],
    );
    const claimStatus = claimUpdate.rows[0]?.status || previousClaimStatus;
    const reportResult = await client.query(
      `SELECT status, recipients FROM agent_report_log
       WHERE tenant_id=$1::uuid AND report_date=$2::date FOR UPDATE`,
      [tenantId, reportDate],
    );
    let reportStatus = reportResult.rows[0]?.status;
    if (reportResult.rows[0] && reportStatus !== 'sent') {
      if (!isDelivered) {
        reportStatus = 'failed';
      } else {
        const recipients = Array.isArray(reportResult.rows[0].recipients)
          ? reportResult.rows[0].recipients
          : [];
        const claimStatuses = await client.query(
          `SELECT status FROM email_delivery_claims
           WHERE tenant_id=$1::uuid
             AND delivery_key LIKE $2`,
          [tenantId, `daily-report:${tenantId}:${reportDate}:%`],
        );
        const expected = recipients.length || claimStatuses.rowCount || 1;
        reportStatus = claimStatuses.rows.length >= expected &&
          claimStatuses.rows.every((row: any) => row.status === 'SENT') ? 'sent' : reportStatus;
      }
      if (reportStatus !== reportResult.rows[0].status) {
        await client.query(
          `UPDATE agent_report_log
           SET status=$3, sent_at=CASE WHEN $3='sent' THEN COALESCE(sent_at,NOW()) ELSE sent_at END,
               updated_at=NOW()
           WHERE tenant_id=$1::uuid AND report_date=$2::date`,
          [tenantId, reportDate, reportStatus],
        );
      }
    }

    await client.query(
      `INSERT INTO notification_operational_events (tenant_id, event_type, payload)
       VALUES ($1::uuid, 'daily_report_delivery_event', $2::jsonb)`,
      [tenantId, JSON.stringify({
        deliveryKey: event.deliveryKey,
        recipient,
        event: event.event,
        messageId: event.messageId || null,
        timestamp: event.timestamp || null,
        previousClaimStatus,
        claimStatus,
        reportStatus,
      })],
    );
    return { matched: true, tenantId, deliveryKey: event.deliveryKey, claimStatus, reportStatus };
  });
}

let schedulerStarted = false;
export function startDailyReportScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;
  setInterval(() => {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: REPORT_TIME_ZONE, hour:'2-digit', minute:'2-digit' }).formatToParts(now);
    if (parts.find(x=>x.type==='hour')?.value === '18' && parts.find(x=>x.type==='minute')?.value === '00') runDailyReport().catch(err => logger.error('[DailyReport] scheduled run failed', err));
  }, 60_000);
  setInterval(() => replayInterruptedDailyReports().catch(err =>
    logger.error('[DailyReport] automatic delivery replay failed', err)), 5 * 60_000);
  setInterval(() => retryZaloReadinessNotificationAlerts().catch(err =>
    logger.error('[Zalo] readiness notification retry worker failed', err)), 5 * 60_000);
  logger.info('[DailyReport] in-process scheduler started at 18:00 Asia/Ho_Chi_Minh');
}
