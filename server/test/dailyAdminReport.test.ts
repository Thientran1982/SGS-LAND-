import { describe, expect, it } from 'vitest';
import { buildReportSummary, renderReportEmail } from '../services/dailyAdminReportService';

const metrics = {
  reportDate: '2026-08-24',
  leads: { new: null, byStage: { NEW: 4 }, bySource: {} },
  brokers: { active: null, assignedLeads: null, top: [] },
  listings: { new: 2, priceUpdated: 1, topViewed: [] },
  tasks: { created: null, overdue: null, completed: 3 },
  minh: { conversations: 5, averageCsat: null, unanswered: null },
  geoSeo: { available: false as const, note: 'chưa có dữ liệu' },
  warnings: { count: null, notable: [] },
};

describe('daily admin report', () => {
  it('keeps unavailable sources explicit instead of inventing zeroes', () => {
    const summary = buildReportSummary(metrics);
    expect(summary.leads.new).toBeNull();
    expect(summary.tasks.created).toBeNull();
    expect(summary.geoSeo.note).toBe('chưa có dữ liệu');
    expect(summary.dataNotes.join(' ')).toContain('chưa có dữ liệu');
  });

  it('renders a Vietnamese subject and does not expose customer PII', () => {
    const summary = buildReportSummary(metrics);
    const email = renderReportEmail(summary);
    expect(email.subject).toBe('[SGSLand] Báo cáo ngày 24/08/2026');
    expect(email.html).not.toContain('0912345678');
    expect(email.html).not.toContain('CCCD');
    expect(email.html).not.toContain('Nguyễn Văn Khách');
    expect(email.html).toContain('chưa có dữ liệu');
  });
});