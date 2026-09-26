import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ValuationAccuracyReport from '../../pages/ValuationAccuracyReport';
import { DICTIONARY } from '../../config/locales';
import { I18nProvider } from '../../services/i18n';

const { apiGet, apiPost, apiPut, getCurrentUser } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  getCurrentUser: vi.fn(),
}));

vi.mock('../../services/api/apiClient', () => ({
  api: { get: apiGet, post: apiPost, put: apiPut },
}));

vi.mock('../../services/dbApi', () => ({
  db: { getCurrentUser },
}));

vi.mock('../../components/SeoHead', () => ({
  SeoHead: () => null,
}));

const evaluationReport = {
  report: {
    sampleCount: 4,
    evaluatedCount: 3,
    rejectedCount: 1,
    rejectRate: 0.25,
    mae: 12_500_000,
    mape: 0.125,
    medianAbsoluteError: 9_000_000,
    intervalCoverage: 0.75,
    evaluatedAt: '2026-09-25T10:30:00.000Z',
    thresholdVersion: 3,
    appliedThresholds: { maeVndPerM2: 20_000_000, mape: 0.2, consecutiveRuns: 3 },
    groups: ['townhouse_center', 'apartment_suburb', 'land_urban'].map((propertyType, index) => ({
      locationKey: ['Quận 1, TP. Hồ Chí Minh', 'Quận 7, TP. Hồ Chí Minh', 'Cầu Giấy, Hà Nội'][index],
      propertyType,
      sampleCount: 4,
      evaluatedCount: 3,
      rejectedCount: 1,
      rejectRate: 0.25,
      mae: 12_500_000,
      mape: 0.125,
      medianAbsoluteError: 9_000_000,
      intervalCoverage: 0.75,
    })),
  },
  history: [{
    sampleCount: 4,
    evaluatedCount: 3,
    rejectedCount: 1,
    rejectRate: 0.25,
    mae: 12_500_000,
    mape: 0.125,
    medianAbsoluteError: 9_000_000,
    intervalCoverage: 0.75,
    evaluatedAt: '2026-09-25T10:30:00.000Z',
    thresholdVersion: 3,
    thresholds: { maeVndPerM2: 20_000_000, mape: 0.2, consecutiveRuns: 3 },
  }],
  drift: {
    status: 'WARNING' as const,
    promotionBlocked: false,
    thresholds: { maeVndPerM2: 20_000_000, mape: 0.2, consecutiveRuns: 3 },
    consecutiveRunsRequired: 3,
    consecutiveMaeRuns: 2,
    consecutiveMapeRuns: 1,
    reasons: [],
  },
  dataset: {
    name: 'Verified valuation gold set',
    sampleCount: 4,
    unitLabel: 'VND/m²',
    sources: ['owner_contract', 'bank_disbursement'],
  },
  disclaimer: 'This server-provided text must not override the selected language.',
  thresholdConfig: {
    version: 3,
    thresholds: { maeVndPerM2: 20_000_000, mape: 0.2, consecutiveRuns: 3 },
    updatedAt: '2026-09-25T10:30:00.000Z',
    updatedBy: 'admin-user',
  },
  thresholdHistory: [{
    version: 3,
    changedAt: '2026-09-25T10:30:00.000Z',
    authorId: 'admin-user',
    oldThresholds: { maeVndPerM2: 18_000_000, mape: 0.18, consecutiveRuns: 3 },
    newThresholds: { maeVndPerM2: 20_000_000, mape: 0.2, consecutiveRuns: 3 },
  }],
};

const operationalEvents = [{
  id: 'event-1',
  tenantId: 'tenant-1',
  eventType: 'valuation_drift_threshold_notification_failed',
  payload: {
    thresholdVersion: 3,
    notification: {
        type: 'drift_threshold_changed',
        title: 'Server-only title that must not be rendered.',
      body: 'This provider text is also intentionally not rendered.',
        metadata: {
          authorName: null,
          version: 3,
          thresholds: { maeVndPerM2: 20_000_000, mape: 0.2, consecutiveRuns: 3 },
        },
    },
  },
  resolvedAt: null,
  resolvedBy: null,
  createdAt: '2026-09-25T11:00:00.000Z',
}];

const renderReport = (language: 'en' | 'vn') => {
  localStorage.setItem('sgs_lang', language);
  return render(
    <I18nProvider>
      <ValuationAccuracyReport />
    </I18nProvider>,
  );
};

describe('ValuationAccuracyReport localization', () => {
  beforeEach(() => {
    localStorage.clear();
    getCurrentUser.mockResolvedValue({ id: 'admin-user', role: 'ADMIN' });
    apiGet.mockImplementation((path: string) => Promise.resolve(
      path.endsWith('/operational-events')
        ? { events: operationalEvents }
        : evaluationReport,
    ));
    apiPost.mockReset();
    apiPut.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders the report, chart, event controls, and threshold administration in English', async () => {
    renderReport('en');

    expect(await screen.findByRole('heading', { name: 'Valuation error report' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run backtest again' })).toBeInTheDocument();
    expect(screen.getByText('This is a backtest on a verified transaction dataset, not live transaction data or a quote for customers.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Drift detection thresholds' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save thresholds' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Filter by status' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Open' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'MAE chart with a VND per square meter value axis and thresholds for each run' })).toBeInTheDocument();
    expect(await screen.findByText('Valuation drift thresholds updated')).toBeInTheDocument();
    expect(screen.getByText('an administrator updated drift thresholds to version 3: MAE 20,000,000 VND/m², MAPE 20.0%, 3 consecutive runs.')).toBeInTheDocument();
    expect(screen.getByText('City-center townhouse')).toBeInTheDocument();
    expect(screen.getByText('Suburban apartment')).toBeInTheDocument();
    expect(screen.getByText('Urban land')).toBeInTheDocument();
    expect(screen.getByText(/Owner contract, Bank disbursement/)).toBeInTheDocument();
    expect(screen.queryByText('This server-provided text must not override the selected language.')).toBeNull();
    expect(screen.queryByText('Server-only title that must not be rendered.')).toBeNull();
    expect(screen.queryByText('This provider text is also intentionally not rendered.')).toBeNull();
    expect(screen.getByRole('spinbutton', { name: 'MAE (VND/m²)' })).toHaveAttribute('min', '1');
    expect(screen.getByRole('spinbutton', { name: 'MAPE (%)' })).toHaveAttribute('max', '200');
    expect(screen.getByRole('spinbutton', { name: 'MAE (VND/m²)' })).toHaveValue(20_000_000);
    expect(screen.getByRole('spinbutton', { name: 'MAPE (%)' })).toHaveValue(20);
    expect(screen.getByRole('spinbutton', { name: 'Consecutive runs' })).toHaveValue(3);
    expect(screen.getAllByText('12,500,000 VND/m²').length).toBeGreaterThan(0);
  });

  it('renders the report and operational controls in Vietnamese', async () => {
    renderReport('vn');

    expect(await screen.findByRole('heading', { name: 'Báo cáo sai số định giá' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chạy lại backtest' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ngưỡng phát hiện drift' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lưu ngưỡng' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Lọc trạng thái' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Đang mở' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Biểu đồ MAE có trục giá trị VND trên mét vuông và ngưỡng theo từng lần chạy' })).toBeInTheDocument();
    expect(await screen.findByText('Ngưỡng drift định giá đã được cập nhật')).toBeInTheDocument();
    expect(screen.getByText('quản trị viên đã cập nhật ngưỡng drift phiên bản 3: MAE 20.000.000 VND/m², MAPE 20,0%, 3 lần chạy liên tiếp.')).toBeInTheDocument();
    expect(screen.getByText('Nhà phố trung tâm')).toBeInTheDocument();
    expect(screen.getByText('Căn hộ ven đô')).toBeInTheDocument();
    expect(screen.getByText('Đất đô thị')).toBeInTheDocument();
    expect(screen.getByText(/Hợp đồng chủ sở hữu, Giải ngân ngân hàng/)).toBeInTheDocument();
    expect(screen.getAllByText('12.500.000 VND/m²').length).toBeGreaterThan(0);
    expect(screen.queryByText('This provider text is also intentionally not rendered.')).toBeNull();
    expect(screen.queryByText('Server-only title that must not be rendered.')).toBeNull();
  });

  it.each([
    ['en', 'Unable to load the report.'],
    ['vn', 'Không thể tải báo cáo.'],
  ] as const)('keeps report errors in %s', async (language, reportError) => {
    apiGet.mockRejectedValue(new Error('Server error that should not leak into localized UI.'));
    renderReport(language);

    expect(await screen.findByText(reportError)).toBeInTheDocument();
    expect(screen.queryByText('Server error that should not leak into localized UI.')).toBeNull();
  });

  it.each([
    ['en', 'Unable to load drift notification events.'],
    ['vn', 'Không thể tải sự kiện gửi thông báo drift.'],
  ] as const)('keeps operational-event errors in %s', async (language, eventsError) => {
    apiGet.mockImplementation((path: string) => Promise.resolve(
      path.endsWith('/operational-events')
        ? Promise.reject(new Error('Server event error that should not leak.'))
        : evaluationReport,
    ));
    renderReport(language);

    expect(await screen.findByText(eventsError)).toBeInTheDocument();
    expect(screen.queryByText('Server event error that should not leak.')).toBeNull();
  });

  it.each([
    ['en', 'No saved runs are available to show a trend.', 'There are no drift notification events.', 'There are no data groups for this run.'],
    ['vn', 'Chưa có lần chạy nào được lưu để hiển thị xu hướng.', 'Chưa có sự kiện gửi thông báo drift nào.', 'Không có nhóm dữ liệu cho lần chạy này.'],
  ] as const)('localizes empty report states in %s', async (language, noRuns, noEvents, noGroups) => {
    const emptyReport = {
      ...evaluationReport,
      report: { ...evaluationReport.report, groups: [] },
      history: [],
    };
    apiGet.mockImplementation((path: string) => Promise.resolve(
      path.endsWith('/operational-events')
        ? { events: [] }
        : emptyReport,
    ));
    renderReport(language);

    expect(await screen.findByText(noRuns)).toBeInTheDocument();
    expect(await screen.findByText(noEvents)).toBeInTheDocument();
    expect(screen.getByText(noGroups)).toBeInTheDocument();
  });

  it.each([
    ['en', 'There are no backtest results to display.'],
    ['vn', 'Không có kết quả backtest để hiển thị.'],
  ] as const)('localizes the no-result state in %s', async (language, noResult) => {
    apiGet.mockResolvedValue({ ...evaluationReport, report: null });
    renderReport(language);

    expect(await screen.findByText(noResult)).toBeInTheDocument();
  });

  it('provides localized labels for chart tooltip values', () => {
    expect(DICTIONARY.en['valuationAccuracy.trend.measuredValue']).toBe('Measured: {value}');
    expect(DICTIONARY.en['valuationAccuracy.trend.runThresholdValue']).toBe('Run threshold: {value}');
    expect(DICTIONARY.vn['valuationAccuracy.trend.measuredValue']).toBe('Đo được: {value}');
    expect(DICTIONARY.vn['valuationAccuracy.trend.runThresholdValue']).toBe('Ngưỡng lần chạy: {value}');
  });

  it('keeps report access restricted to the existing admin roles', async () => {
    getCurrentUser.mockResolvedValue({ id: 'viewer-user', role: 'AGENT' });
    renderReport('en');

    expect(await screen.findByText("You don't have permission to view this report.")).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save thresholds' })).toBeNull();
  });
});