import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  report: null as any,
  sendEmail: vi.fn(),
}));

const query = vi.hoisted(() => vi.fn(async (sql: string, params: any[] = []) => {
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
}));

vi.mock('../services/emailService', () => ({
  emailService: { sendEmail: state.sendEmail },
}));

import { buildReportSummary, renderReportEmail, runDailyReport } from '../services/dailyAdminReportService';

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
  beforeEach(() => {
    state.report = null;
    state.sendEmail.mockReset();
  });

  it('keeps unavailable sources explicit instead of inventing zeroes', () => {
    const summary = buildReportSummary(metrics);
    expect(summary.leads.new).toBeNull();
    expect(summary.tasks.created).toBeNull();
    expect(summary.geoSeo.note).toBe('chưa có dữ liệu');
    expect(summary.dataNotes.join(' ')).toContain('chưa có dữ liệu');
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
    expect(state.report.status).toBe('failed');
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
});