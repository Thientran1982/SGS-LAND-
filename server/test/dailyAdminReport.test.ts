import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  report: null as any,
  sendEmail: vi.fn(),
  verifyDelivery: vi.fn(),
  sendDailyReportDeliveryAlertEmail: vi.fn(),
  lockCalls: 0,
  collectionRows: null as Record<string, any> | null,
}));

const query = vi.hoisted(() => vi.fn(async (sql: string, params: any[] = []) => {
  if (state.collectionRows && sql.includes('FROM visitor_events') && sql.includes('COUNT(*) FILTER')) {
    return { rows: [state.collectionRows.traffic] };
  }
  if (state.collectionRows && sql.includes('FROM visitor_events') && sql.includes("event_type='property_view'")) {
    return { rows: state.collectionRows.topViewed };
  }
  if (state.collectionRows && sql.includes('FROM visitor_events') && sql.includes("event_type='listing_search'")) {
    return { rows: state.collectionRows.topSearches };
  }
  if (state.collectionRows && sql.includes('FROM agent_signals')) {
    return { rows: state.collectionRows.csatSignals };
  }
  if (state.collectionRows && sql.includes('FROM seo_geo_snapshots')) {
    return { rows: [state.collectionRows.geoSnapshot] };
  }
  if (state.collectionRows && sql.includes('FROM interactions')) {
    return { rows: [state.collectionRows.interactions] };
  }
  if (sql.includes('FROM users WHERE role IN')) {
    return { rows: [{ tenantId: '11111111-1111-1111-1111-111111111111', email: 'admin@example.com' }] };
  }
  if (sql.includes('FROM agent_report_log')) return { rows: state.report ? [state.report] : [] };
  if (sql.startsWith('INSERT INTO agent_report_log')) {
    state.report = {
      tenant_id: params[0],
      report_date: params[1],
      status: 'pending',
      recipients: JSON.parse(params[2]),
      summary_snapshot: JSON.parse(params[3]),
    };
    return { rows: [] };
  }
  if (sql.startsWith('UPDATE agent_report_log')) {
    state.report.status = params[2];
    state.report.error_detail = params[3];
    return { rows: [] };
  }
  return { rows: [{}] };
}));

vi.mock('../db', () => ({
  withRlsBypass: vi.fn(async (fn: (client: any) => Promise<unknown>) => fn({ query })),
  withTenantContext: vi.fn(async (_tenantId: string, fn: (client: any) => Promise<unknown>) => fn({ query })),
  withDistributedLock: vi.fn(async (_name: string, fn: () => Promise<unknown>) => {
    state.lockCalls++;
    return fn();
  }),
}));

vi.mock('../services/emailService', () => ({
  emailService: {
    sendEmail: state.sendEmail,
    verifyDelivery: state.verifyDelivery,
    sendDailyReportDeliveryAlertEmail: state.sendDailyReportDeliveryAlertEmail,
  },
}));

vi.mock('../repositories/notificationRepository', () => ({
  notificationRepository: {
    recordOperationalEvent: vi.fn().mockResolvedValue({}),
    createForTenantAdmins: vi.fn().mockResolvedValue(undefined),
  },
}));

import {
  buildReportSummary,
  collectDailyMetrics,
  extractSupportCsatScore,
  renderReportEmail,
  replayInterruptedDailyReports,
  runDailyReport,
} from '../services/dailyAdminReportService';

const metrics = {
  reportDate: '2026-08-24',
  leads: { new: null, byStage: { NEW: 4 }, bySource: {} },
  brokers: { active: null, assignedLeads: null, top: [] },
  listings: { new: 2, priceUpdated: 1, topViewed: [] },
  traffic: { propertyViews: null, listingSearches: null, topSearches: [] },
  tasks: { created: null, overdue: null, completed: 3 },
  minh: { conversations: 5, averageCsat: null, unanswered: null },
  geoSeo: { available: false as const, note: 'chưa có dữ liệu' },
  warnings: { count: null, notable: [] },
};

describe('daily admin report', () => {
  beforeEach(() => {
    state.report = null;
    state.sendEmail.mockReset();
    state.verifyDelivery.mockReset().mockResolvedValue({ status: 'unknown', provider: 'brevo' });
    state.sendDailyReportDeliveryAlertEmail.mockReset().mockResolvedValue({ success: true, status: 'sent' });
    state.lockCalls = 0;
    state.collectionRows = null;
  });

  it('keeps unavailable sources explicit instead of inventing zeroes', () => {
    const summary = buildReportSummary(metrics);
    expect(summary.leads.new).toBeNull();
    expect(summary.tasks.created).toBeNull();
    expect(summary.geoSeo.note).toBe('chưa có dữ liệu');
    expect(summary.dataNotes.join(' ')).toContain('chưa có dữ liệu');
  });

  it('extracts only valid 1-5 CSAT signal scores', () => {
    expect(extractSupportCsatScore({ score: 5 })).toBe(5);
    expect(extractSupportCsatScore(JSON.stringify({ rating: 4 }))).toBe(4);
    expect(extractSupportCsatScore({ score: 0 })).toBeNull();
    expect(extractSupportCsatScore({ score: 9 })).toBeNull();
  });

  it('collects views/searches, GEO/SEO and CSAT from their unified sources', async () => {
    state.collectionRows = {
      traffic: { property_views: 12, listing_searches: 7 },
      topViewed: [{ title: 'The Global City', views: 8 }],
      topSearches: [{ query: 'Aqua City', searches: 4 }],
      interactions: { conversations: 6 },
      csatSignals: [{ payload: JSON.stringify({ score: 5 }) }, { payload: JSON.stringify({ rating: 4 }) }],
      geoSnapshot: {
        snapshot_date: '2026-08-24',
        created_at: '2026-08-24T11:00:00.000Z',
        ai_mentions_json: {
          engines: { gemini: { status: 'measured', queries: 5, mentions: 2 } },
        },
        gsc_top20_json: { keywords: [{ keyword: 'sgs land', position: 3 }] },
        lighthouse_json: {
          pages: [{ status: 'measured', scores: { seo: 91 } }],
        },
      },
    };

    const collected = await collectDailyMetrics('00000000-0000-0000-0000-000000000001', '2026-08-24');
    expect(collected.traffic).toEqual({
      propertyViews: 12,
      listingSearches: 7,
      topSearches: [{ query: 'Aqua City', searches: 4 }],
    });
    expect(collected.listings.topViewed).toEqual([{ title: 'The Global City', views: 8 }]);
    expect(collected.minh.averageCsat).toBe(4.5);
    expect(collected.geoSeo).toMatchObject({
      available: true,
      snapshotDate: '2026-08-24',
      aiMentionRate: 0.4,
      aiMentions: 2,
      aiQueries: 5,
      seoScore: 91,
    });
    expect(collected.geoSeo.note).toContain('Nguồn:');
    expect(collected.geoSeo.sourceStatuses).toEqual([
      'AI mention probes: đã đo',
      'Google Search Console: đã đo',
      'PageSpeed Insights: đã đo',
    ]);

    const email = renderReportEmail(buildReportSummary(collected));
    expect(email.html).toContain('12 lượt xem');
    expect(email.html).toContain('7 lượt tìm kiếm');
    expect(email.html).toContain('CSAT trung bình');
    expect(email.html).toContain('Snapshot 2026-08-24');
  });

  it('keeps snapshot provenance visible when every measurement is unavailable', async () => {
    state.collectionRows = {
      traffic: { property_views: null, listing_searches: null },
      topViewed: [],
      topSearches: [],
      interactions: { conversations: null },
      csatSignals: [],
      geoSnapshot: {
        snapshot_date: '2026-09-08',
        created_at: '2026-09-08T16:52:11.428Z',
        ai_mentions_json: {
          engines: {
            gemini: { status: 'error', queries: 5, mentions: 0 },
            perplexity: { status: 'skipped', queries: 0, mentions: 0 },
          },
        },
        gsc_top20_json: { keywords: [] },
        lighthouse_json: {
          pages: [{ status: 'skipped', scores: { seo: null } }],
        },
      },
    };

    const collected = await collectDailyMetrics('00000000-0000-0000-0000-000000000001', '2026-09-08');
    expect(collected.geoSeo).toMatchObject({
      available: false,
      snapshotDate: '2026-09-08',
      aiMentionRate: null,
      aiMentions: null,
      aiQueries: null,
      seoScore: null,
      sourceStatuses: [
        'AI mention probes: API lỗi',
        'Google Search Console: chưa có dữ liệu',
        'PageSpeed Insights: bỏ qua',
      ],
    });
    expect(collected.geoSeo.note).toBe(
      'Snapshot 2026-09-08 chưa có phép đo thành công · Nguồn: AI mention probes: API lỗi · Google Search Console: chưa có dữ liệu · PageSpeed Insights: bỏ qua',
    );
    expect(renderReportEmail(buildReportSummary(collected)).html).toContain('2026-09-08');
  });

  it('renders a Vietnamese subject and does not expose customer PII', () => {
    const email = renderReportEmail(buildReportSummary(metrics));
    expect(email.subject).toBe('[SGSLand] Báo cáo ngày 24/08/2026');
    expect(email.html).not.toContain('0912345678');
    expect(email.html).not.toContain('CCCD');
    expect(email.html).not.toContain('Nguyễn Văn Khách');
    expect(email.html).toContain('chưa có dữ liệu');
  });

  it('retries definitive provider failures three times, then records one failed report', async () => {
    state.sendEmail.mockResolvedValue({ success: false, status: 'failed', error: 'provider rejected request' });
    const result = await runDailyReport('2026-08-24');
    expect(result.results).toEqual([{ tenantId: '11111111-1111-1111-1111-111111111111', status: 'failed', recipients: 1 }]);
    expect(state.sendEmail).toHaveBeenCalledTimes(3);
    expect(state.report.status).toBe('failed');
    expect(state.sendEmail.mock.calls.every(([, options]) =>
      options.deliveryKey === 'daily-report:11111111-1111-1111-1111-111111111111:2026-08-24:admin@example.com')).toBe(true);
  });

  it('does not retry an ambiguous timeout, preventing a possible duplicate provider delivery', async () => {
    state.sendEmail.mockResolvedValue({ success: false, status: 'failed', ambiguous: true, error: 'provider timeout' });
    await runDailyReport('2026-08-24');
    expect(state.sendEmail).toHaveBeenCalledTimes(1);
    expect(state.report.status).toBe('delivery_unknown');
  });

  it('records an unknown delivery and alerts admins without retrying it', async () => {
    state.sendEmail.mockResolvedValue({ success: false, status: 'failed', ambiguous: true, error: 'provider timeout' });
    const result = await runDailyReport('2026-08-24');
    expect(result.results[0].status).toBe('delivery_unknown');
    expect(result.results[0].manualAction).toContain('không tự động gửi lại');
    expect(state.report.status).toBe('delivery_unknown');
    expect(state.sendEmail).toHaveBeenCalledTimes(1);
    expect(state.sendDailyReportDeliveryAlertEmail).toHaveBeenCalledWith(
      '11111111-1111-1111-1111-111111111111',
      'admin@example.com',
      '2026-08-24',
      ['admin@example.com'],
    );
  });

  it('automatically verifies an unknown delivery before allowing a retry', async () => {
    state.report = {
      tenant_id: '11111111-1111-1111-1111-111111111111',
      report_date: '2026-08-24',
      status: 'delivery_unknown',
      recipients: ['admin@example.com'],
      summary_snapshot: buildReportSummary(metrics),
    };
    state.verifyDelivery.mockResolvedValue({ status: 'not_received', provider: 'brevo' });
    state.sendEmail.mockResolvedValue({ success: true, status: 'sent', messageId: 'provider-2' });

    await runDailyReport('2026-08-24', true);

    expect(state.verifyDelivery).toHaveBeenCalledWith(
      '11111111-1111-1111-1111-111111111111',
      'daily-report:11111111-1111-1111-1111-111111111111:2026-08-24:admin@example.com',
    );
    expect(state.sendEmail).toHaveBeenCalledTimes(1);
    expect(state.report.status).toBe('sent');
  });

  it('keeps an unknown delivery blocked when verification is inconclusive', async () => {
    state.report = {
      tenant_id: '11111111-1111-1111-1111-111111111111',
      report_date: '2026-08-24',
      status: 'delivery_unknown',
      recipients: ['admin@example.com'],
      summary_snapshot: buildReportSummary(metrics),
    };
    state.verifyDelivery.mockResolvedValue({ status: 'unknown', provider: 'brevo' });

    const result = await runDailyReport('2026-08-24', true);

    expect(result.results[0].status).toBe('delivery_unknown');
    expect(state.sendEmail).not.toHaveBeenCalled();
  });

  it('keeps the failed report snapshot when force-running delivery again', async () => {
    const snapshot = buildReportSummary(metrics);
    state.report = {
      tenant_id: '11111111-1111-1111-111111111111',
      report_date: '2026-08-24',
      status: 'failed',
      summary_snapshot: snapshot,
    };
    state.sendEmail.mockResolvedValue({ success: true, status: 'sent', messageId: 'provider-1' });
    await runDailyReport('2026-08-24', true);
    expect(state.report.status).toBe('sent');
    expect(state.report.summary_snapshot).toEqual(snapshot);
    expect(state.sendEmail).toHaveBeenCalledTimes(1);
  });

  it('does not create a second successful delivery when the process is run again', async () => {
    state.sendEmail.mockResolvedValue({ success: true, status: 'sent', messageId: 'provider-1' });
    await runDailyReport('2026-08-24');
    await runDailyReport('2026-08-24');
    expect(state.sendEmail).toHaveBeenCalledTimes(1);
    expect(state.report.status).toBe('sent');
  });

  it('allows only the lock holder to run a competing replay worker', async () => {
    const db = await import('../db');
    const lock = db.withDistributedLock as unknown as ReturnType<typeof vi.fn>;
    let occupied = false;
    lock.mockImplementation(async (_name: string, fn: () => Promise<unknown>) => {
      if (occupied) return null;
      occupied = true;
      await new Promise(resolve => setTimeout(resolve, 5));
      try {
        return await fn();
      } finally {
        occupied = false;
      }
    });

    const [first, second] = await Promise.all([
      replayInterruptedDailyReports(),
      replayInterruptedDailyReports(),
    ]);

    expect([first, second]).toContainEqual({ inspected: 0, replayed: 0, failed: 0 });
    expect([first, second]).toContainEqual({ inspected: 1, replayed: 0, failed: 1 });
    expect(lock).toHaveBeenCalledTimes(2);
  });
});