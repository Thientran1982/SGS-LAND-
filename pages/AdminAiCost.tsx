import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { api } from '../services/api/apiClient';
import { db } from '../services/dbApi';
import { User, UserRole } from '../types';
import { useTranslation } from '../services/i18n';

interface CostReport {
  period: string;
  totalValuations: number;
  totalAiCalls: number;
  estimatedCostUsd: number;
  guestValuations: number;
  authValuations: number;
  byPlan: Array<{ planId: string; valuations: number; costUsd: number }>;
  bySource: Array<{ source: string; valuations: number }>;
  topUsers: Array<{
    userId: string;
    userName: string | null;
    userEmail: string | null;
    valuations: number;
    costUsd: number;
  }>;
  dailyTrend: Array<{ day: string; valuations: number; costUsd: number }>;
  prevPeriod: string;
  prevTotalValuations: number;
  prevEstimatedCostUsd: number;
  pricing: { pricePerCallUsd: number; callsPerValuation: number; costPerValuationUsd: number };
}

interface AlertConfig {
  thresholdUsd: number;
  alertEmail: string | null;
  lastAlertedPeriod: string | null;
  warnPercent: number;
  hardCapEnabled: boolean;
  lastWarnAlertedPeriod: string | null;
}

interface FeatureCostRow {
  feature: string;
  calls: number;
  aiCalls: number;
  costUsd: number;
}

interface FeatureBreakdown {
  rows: FeatureCostRow[];
  totalCostUsd: number;
  totalAiCalls: number;
}

interface ReportResponse {
  report: CostReport;
  alertConfig: AlertConfig;
  scope: 'tenant' | 'global';
  pricing: CostReport['pricing'];
  featureBreakdown?: FeatureBreakdown;
}

const FEATURE_LABELS: Record<string, string> = {
  VALUATION_SEARCH: 'Định giá — tìm kiếm thị trường',
  VALUATION_EXTRACT: 'Định giá — trích xuất kết quả',
  VALUATION_VERIFY: 'Định giá — xác thực giá',
  LEAD_SCORING: 'Chấm điểm lead',
  LEAD_SUMMARY: 'Tóm tắt lead (ARIA)',
  CHAT_ROUTER: 'Chatbot — định tuyến',
  CHAT_INVENTORY_AGENT: 'Chatbot — kho hàng',
  CHAT_FINANCE_AGENT: 'Chatbot — tài chính',
  CHAT_LEGAL_AGENT: 'Chatbot — pháp lý',
  CHAT_SALES_AGENT: 'Chatbot — đặt lịch',
  CHAT_MARKETING_AGENT: 'Chatbot — marketing',
  CHAT_CONTRACT_AGENT: 'Chatbot — hợp đồng',
  CHAT_LEAD_ANALYSIS: 'Chatbot — phân tích lead',
  CHAT_WRITER: 'Chatbot — soạn phản hồi',
};
function featureLabel(f: string): string {
  return FEATURE_LABELS[f] || f;
}

function fmtUsd(n: number): string {
  return `$${(n || 0).toFixed(2)}`;
}
function pct(now: number, prev: number): { text: string; positive: boolean | null } {
  if (!prev) return { text: now > 0 ? '—' : '0%', positive: null };
  const diff = ((now - prev) / prev) * 100;
  const sign = diff >= 0 ? '+' : '';
  return { text: `${sign}${diff.toFixed(1)}%`, positive: diff <= 0 };
}
function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function shiftPeriod(p: string, delta: number): string {
  const [y, m] = p.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const AdminAiCost: React.FC = () => {
  const { t } = useTranslation();
  const [me, setMe] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReportResponse | null>(null);
  const [period, setPeriod] = useState<string>(currentPeriod());
  const [savingAlert, setSavingAlert] = useState(false);
  const [alertDraft, setAlertDraft] = useState<{
    thresholdUsd: string;
    alertEmail: string;
    warnPercent: string;
    hardCapEnabled: boolean;
  }>({
    thresholdUsd: '',
    alertEmail: '',
    warnPercent: '80',
    hardCapEnabled: false,
  });
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const user = await db.getCurrentUser();
      setMe(user);
      if (user?.role !== UserRole.ADMIN) {
        setLoading(false);
        return;
      }
      const res = await api.get<ReportResponse>('/api/valuation/admin/cost-report', { month: period });
      setData(res);
      setAlertDraft({
        thresholdUsd: res.alertConfig.thresholdUsd ? String(res.alertConfig.thresholdUsd) : '',
        alertEmail: res.alertConfig.alertEmail || '',
        warnPercent: String(res.alertConfig.warnPercent ?? 80),
        hardCapEnabled: !!res.alertConfig.hardCapEnabled,
      });
    } catch (err: any) {
      setToast(err.message || 'Lỗi tải báo cáo');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const downloadCsv = useCallback(() => {
    const url = `/api/valuation/admin/cost-report.csv?month=${encodeURIComponent(period)}`;
    window.open(url, '_blank');
  }, [period]);

  const saveAlert = useCallback(async () => {
    setSavingAlert(true);
    try {
      const res = await api.put<AlertConfig>('/api/valuation/admin/cost-alert-config', {
        thresholdUsd: Number(alertDraft.thresholdUsd) || 0,
        alertEmail: alertDraft.alertEmail || null,
        warnPercent: Number(alertDraft.warnPercent) || 80,
        hardCapEnabled: alertDraft.hardCapEnabled,
      });
      setData((d) => d ? { ...d, alertConfig: res } : d);
      setToast('Đã lưu cấu hình cảnh báo');
      setTimeout(() => setToast(null), 2500);
    } catch (err: any) {
      setToast(err.message || 'Lưu thất bại');
    } finally {
      setSavingAlert(false);
    }
  }, [alertDraft]);

  if (loading && !data) {
    return <div className="p-10 text-center text-[var(--text-secondary)] font-mono animate-pulse">Đang tải báo cáo…</div>;
  }
  if (me && me.role !== UserRole.ADMIN) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Chỉ dành cho Admin</h2>
        <p className="text-[var(--text-tertiary)] max-w-md">Bạn không có quyền truy cập trang này.</p>
      </div>
    );
  }
  if (!data) return null;

  const r = data.report;
  const cfg = data.alertConfig;
  const trendCount = pct(r.totalValuations, r.prevTotalValuations);
  const trendCost = pct(r.estimatedCostUsd, r.prevEstimatedCostUsd);
  const maxDaily = Math.max(1, ...r.dailyTrend.map((d) => d.valuations));

  // Compute threshold banner state for the CURRENT period only — historical
  // months would be misleading because the cap is monthly.
  const isCurrentPeriod = period === currentPeriod();
  const pctOfCap = (isCurrentPeriod && cfg.thresholdUsd > 0)
    ? (r.estimatedCostUsd / cfg.thresholdUsd) * 100
    : 0;
  const warnPct = cfg.warnPercent || 80;
  let banner: { tone: 'over' | 'warn'; text: string } | null = null;
  if (isCurrentPeriod && cfg.thresholdUsd > 0) {
    if (pctOfCap >= 100) {
      banner = {
        tone: 'over',
        text: cfg.hardCapEnabled
          ? `Đã vượt ngưỡng (${pctOfCap.toFixed(0)}% của $${cfg.thresholdUsd.toFixed(2)}). Tự động chặn AI đang BẬT — các yêu cầu định giá AI mới đang bị tạm dừng.`
          : `Đã vượt ngưỡng (${pctOfCap.toFixed(0)}% của $${cfg.thresholdUsd.toFixed(2)}). Hãy bật "Tự động chặn" hoặc nâng ngưỡng để tránh phát sinh chi phí.`,
      };
    } else if (pctOfCap >= warnPct) {
      banner = {
        tone: 'warn',
        text: `Cảnh báo sớm: chi phí đã đạt ${pctOfCap.toFixed(0)}% của ngưỡng $${cfg.thresholdUsd.toFixed(2)} (giới hạn cảnh báo sớm: ${warnPct}%).`,
      };
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 animate-enter pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-[var(--bg-surface)] p-5 rounded-2xl border border-[var(--glass-border)] shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Chi phí AI định giá</h1>
          <p className="text-xs text-[var(--text-tertiary)] mt-1">
            Theo dõi số lượt và chi phí Gemini API • {data.scope === 'tenant' ? 'Phạm vi tenant của bạn' : 'Toàn hệ thống'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setPeriod((p) => shiftPeriod(p, -1))}
            className="px-3 py-2 text-xs font-bold rounded-lg border border-[var(--glass-border)] text-[var(--text-secondary)] hover:bg-[var(--glass-surface-hover)]"
          >‹ Trước</button>
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            max={currentPeriod()}
            className="px-3 py-2 text-xs font-mono rounded-lg border border-[var(--glass-border)] bg-[var(--bg-surface)] text-[var(--text-primary)]"
          />
          <button
            type="button"
            onClick={() => setPeriod((p) => period >= currentPeriod() ? p : shiftPeriod(p, 1))}
            disabled={period >= currentPeriod()}
            className="px-3 py-2 text-xs font-bold rounded-lg border border-[var(--glass-border)] text-[var(--text-secondary)] hover:bg-[var(--glass-surface-hover)] disabled:opacity-40"
          >Sau ›</button>
          <button
            type="button"
            onClick={downloadCsv}
            className="px-4 py-2 text-xs font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
          >Export CSV</button>
        </div>
      </div>

      {/* Threshold banner (current period only) */}
      {banner && (
        <div
          role="alert"
          className={`p-4 rounded-2xl border shadow-sm flex items-start gap-3 ${
            banner.tone === 'over'
              ? 'bg-rose-50 border-rose-300 text-rose-900'
              : 'bg-amber-50 border-amber-300 text-amber-900'
          }`}
        >
          <span className="text-2xl leading-none mt-0.5">
            {banner.tone === 'over' ? '⛔' : '⚠️'}
          </span>
          <div className="flex-1">
            <div className="font-bold text-sm">
              {banner.tone === 'over' ? 'Đã vượt ngưỡng chi phí AI' : 'Sắp đạt ngưỡng chi phí AI'}
            </div>
            <div className="text-sm mt-1">{banner.text}</div>
          </div>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Tổng lượt định giá"
          value={r.totalValuations.toLocaleString()}
          trend={trendCount.text}
          trendPositive={trendCount.positive}
          sub={`Tháng trước: ${r.prevTotalValuations.toLocaleString()}`}
        />
        <KpiCard
          label="Chi phí ước tính"
          value={fmtUsd(r.estimatedCostUsd)}
          trend={trendCost.text}
          trendPositive={trendCost.positive}
          sub={`Tháng trước: ${fmtUsd(r.prevEstimatedCostUsd)}`}
        />
        <KpiCard
          label="Số lệnh Gemini"
          value={r.totalAiCalls.toLocaleString()}
          sub={`${r.pricing.callsPerValuation} call/lượt × $${r.pricing.pricePerCallUsd.toFixed(4)}`}
        />
        <KpiCard
          label="Khách / Đăng nhập"
          value={`${r.guestValuations} / ${r.authValuations}`}
          sub={`Khách trả phí ${r.guestValuations === 0 ? '0%' : Math.round((r.guestValuations / r.totalValuations) * 100) + '%'}`}
        />
      </div>

      {/* Breakdown by plan + by source */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Chi phí theo gói">
          {r.byPlan.length === 0 ? (
            <EmptyRow text="Chưa có lượt định giá nào trong tháng." />
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-[var(--text-tertiary)] uppercase tracking-wide">
                <tr><th className="text-left py-2">Gói</th><th className="text-right py-2">Lượt</th><th className="text-right py-2">USD</th></tr>
              </thead>
              <tbody>
                {r.byPlan.map((p) => (
                  <tr key={p.planId} className="border-t border-[var(--glass-border)]">
                    <td className="py-2 font-bold text-[var(--text-primary)]">{p.planId}</td>
                    <td className="py-2 text-right">{p.valuations.toLocaleString()}</td>
                    <td className="py-2 text-right font-mono">{fmtUsd(p.costUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title="Nguồn dữ liệu">
          {r.bySource.length === 0 ? (
            <EmptyRow text="Chưa có dữ liệu." />
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-[var(--text-tertiary)] uppercase tracking-wide">
                <tr><th className="text-left py-2">Nguồn</th><th className="text-right py-2">Lượt</th><th className="text-right py-2">%</th></tr>
              </thead>
              <tbody>
                {r.bySource.map((s) => {
                  const pct = r.totalValuations ? (s.valuations / r.totalValuations) * 100 : 0;
                  return (
                    <tr key={s.source} className="border-t border-[var(--glass-border)]">
                      <td className="py-2 font-mono text-xs text-[var(--text-secondary)]">{s.source}</td>
                      <td className="py-2 text-right">{s.valuations.toLocaleString()}</td>
                      <td className="py-2 text-right">{pct.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      {/* Per-feature breakdown (all Gemini features, not just valuation) */}
      <Panel title="Chi phí theo tính năng AI">
        <p className="text-xs text-[var(--text-tertiary)] mb-3">
          Bao gồm tất cả các lệnh Gemini trong tháng (định giá, chấm điểm lead, tóm tắt, các agent chatbot…).
          {data.featureBreakdown && (
            <> Tổng theo tính năng: <span className="font-mono font-bold text-[var(--text-primary)]">{fmtUsd(data.featureBreakdown.totalCostUsd)}</span> ({data.featureBreakdown.totalAiCalls.toLocaleString()} lệnh).</>
          )}
        </p>
        {!data.featureBreakdown || data.featureBreakdown.rows.length === 0 ? (
          <EmptyRow text="Chưa có dữ liệu sử dụng AI trong tháng này." />
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-[var(--text-tertiary)] uppercase tracking-wide">
              <tr>
                <th className="text-left py-2">Tính năng</th>
                <th className="text-right py-2">Lệnh gọi</th>
                <th className="text-right py-2">USD</th>
                <th className="text-right py-2">% chi phí</th>
              </tr>
            </thead>
            <tbody>
              {data.featureBreakdown.rows.map((row) => {
                const pctCost = data.featureBreakdown!.totalCostUsd
                  ? (row.costUsd / data.featureBreakdown!.totalCostUsd) * 100
                  : 0;
                return (
                  <tr key={row.feature} className="border-t border-[var(--glass-border)]">
                    <td className="py-2">
                      <div className="font-bold text-[var(--text-primary)]">{featureLabel(row.feature)}</div>
                      <div className="text-[10px] text-[var(--text-tertiary)] font-mono">{row.feature}</div>
                    </td>
                    <td className="py-2 text-right">{row.calls.toLocaleString()}</td>
                    <td className="py-2 text-right font-mono">{fmtUsd(row.costUsd)}</td>
                    <td className="py-2 text-right">{pctCost.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>

      {/* Daily trend */}
      <Panel title="Xu hướng theo ngày">
        {r.dailyTrend.length === 0 ? (
          <EmptyRow text="Không có dữ liệu trong tháng này." />
        ) : (
          <div className="flex items-end gap-1 h-40 mt-2 overflow-x-auto pb-2">
            {r.dailyTrend.map((d) => {
              const h = Math.max(4, Math.round((d.valuations / maxDaily) * 100));
              return (
                <div key={d.day} className="flex flex-col items-center min-w-[24px] group">
                  <div
                    className="w-5 rounded-t bg-indigo-500/80 group-hover:bg-indigo-600 transition-all relative"
                    style={{ height: `${h}%` }}
                    title={`${d.day}: ${d.valuations} lượt • ${fmtUsd(d.costUsd)}`}
                  />
                  <span className="text-[9px] text-[var(--text-tertiary)] mt-1 font-mono">{d.day.slice(8)}</span>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      {/* Top users */}
      <Panel title="Top user dùng nhiều nhất">
        {r.topUsers.length === 0 ? (
          <EmptyRow text="Chưa có user nào sử dụng định giá AI tháng này." />
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-[var(--text-tertiary)] uppercase tracking-wide">
              <tr>
                <th className="text-left py-2">#</th>
                <th className="text-left py-2">Người dùng</th>
                <th className="text-right py-2">Lượt</th>
                <th className="text-right py-2">USD</th>
              </tr>
            </thead>
            <tbody>
              {r.topUsers.map((u, i) => (
                <tr key={u.userId} className="border-t border-[var(--glass-border)]">
                  <td className="py-2 text-[var(--text-tertiary)]">{i + 1}</td>
                  <td className="py-2">
                    <div className="font-bold text-[var(--text-primary)]">{u.userName || '(Không tên)'}</div>
                    <div className="text-xs text-[var(--text-tertiary)] font-mono">{u.userEmail || u.userId.slice(0, 8)}</div>
                  </td>
                  <td className="py-2 text-right">{u.valuations.toLocaleString()}</td>
                  <td className="py-2 text-right font-mono">{fmtUsd(u.costUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      {/* Alert config */}
      <Panel title="Cảnh báo chi phí qua email">
        <p className="text-xs text-[var(--text-tertiary)] mb-3">
          Đặt ngưỡng chi phí AI hàng tháng. Hệ thống sẽ gửi email cảnh báo sớm khi đạt
          mức cảnh báo (mặc định 80% ngưỡng), và gửi email cảnh báo vượt ngưỡng khi chạm 100%.
          Mỗi loại cảnh báo gửi tối đa 1 lần / tháng. Đặt ngưỡng = 0 hoặc bỏ trống email để tắt.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold text-[var(--text-secondary)]">Ngưỡng (USD / tháng)</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={alertDraft.thresholdUsd}
              onChange={(e) => setAlertDraft((d) => ({ ...d, thresholdUsd: e.target.value }))}
              placeholder="VD: 25"
              className="px-3 py-2 text-sm rounded-lg border border-[var(--glass-border)] bg-[var(--bg-surface)] text-[var(--text-primary)]"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold text-[var(--text-secondary)]">Cảnh báo sớm (% ngưỡng)</span>
            <input
              type="number"
              min={1}
              max={100}
              step="1"
              value={alertDraft.warnPercent}
              onChange={(e) => setAlertDraft((d) => ({ ...d, warnPercent: e.target.value }))}
              placeholder="80"
              className="px-3 py-2 text-sm rounded-lg border border-[var(--glass-border)] bg-[var(--bg-surface)] text-[var(--text-primary)]"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold text-[var(--text-secondary)]">Email nhận cảnh báo</span>
            <input
              type="email"
              value={alertDraft.alertEmail}
              onChange={(e) => setAlertDraft((d) => ({ ...d, alertEmail: e.target.value }))}
              placeholder="ketoan@congty.vn"
              className="px-3 py-2 text-sm rounded-lg border border-[var(--glass-border)] bg-[var(--bg-surface)] text-[var(--text-primary)]"
            />
          </label>
        </div>
        <label className="mt-4 flex items-start gap-3 p-3 rounded-lg bg-rose-50 border border-rose-200 cursor-pointer">
          <input
            type="checkbox"
            checked={alertDraft.hardCapEnabled}
            onChange={(e) => setAlertDraft((d) => ({ ...d, hardCapEnabled: e.target.checked }))}
            className="mt-0.5 h-4 w-4 accent-rose-600"
          />
          <span className="flex-1">
            <span className="block text-sm font-bold text-rose-900">
              Tự động chặn yêu cầu AI khi vượt ngưỡng (hard cap)
            </span>
            <span className="block text-xs text-rose-800/80 mt-0.5">
              Khi bật, mọi yêu cầu định giá AI mới sẽ bị từ chối ngay khi chi phí ước tính trong
              tháng đạt ngưỡng. Người dùng sẽ thấy thông báo lỗi đến khi sang tháng mới hoặc bạn
              nâng ngưỡng / tắt chế độ này.
            </span>
          </span>
        </label>
        <div className="mt-3 flex items-center gap-4 flex-wrap">
          <button
            onClick={saveAlert}
            disabled={savingAlert}
            className="px-5 py-2 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {savingAlert ? 'Đang lưu…' : 'Lưu cấu hình'}
          </button>
          {data.alertConfig.lastWarnAlertedPeriod && (
            <span className="text-xs text-[var(--text-tertiary)]">
              Cảnh báo sớm gần nhất: <span className="font-mono">{data.alertConfig.lastWarnAlertedPeriod}</span>
            </span>
          )}
          {data.alertConfig.lastAlertedPeriod && (
            <span className="text-xs text-[var(--text-tertiary)]">
              Cảnh báo vượt ngưỡng gần nhất: <span className="font-mono">{data.alertConfig.lastAlertedPeriod}</span>
            </span>
          )}
        </div>
      </Panel>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl bg-slate-900 text-white text-sm shadow-2xl animate-enter">
          {toast}
        </div>
      )}
    </div>
  );
};

const KpiCard: React.FC<{
  label: string; value: string; sub?: string; trend?: string; trendPositive?: boolean | null;
}> = ({ label, value, sub, trend, trendPositive }) => (
  <div className="bg-[var(--bg-surface)] p-5 rounded-2xl border border-[var(--glass-border)] shadow-sm">
    <div className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wide">{label}</div>
    <div className="mt-2 flex items-end justify-between gap-2">
      <span className="text-2xl font-bold text-[var(--text-primary)]">{value}</span>
      {trend && (
        <span className={`text-xs font-bold px-2 py-0.5 rounded ${
          trendPositive === null ? 'bg-slate-100 text-slate-600'
            : trendPositive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
        }`}>{trend}</span>
      )}
    </div>
    {sub && <div className="mt-2 text-xs text-[var(--text-tertiary)]">{sub}</div>}
  </div>
);

const Panel: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-[var(--bg-surface)] p-5 rounded-2xl border border-[var(--glass-border)] shadow-sm">
    <h3 className="text-sm font-bold text-[var(--text-primary)] mb-3">{title}</h3>
    {children}
  </div>
);

const EmptyRow: React.FC<{ text: string }> = ({ text }) => (
  <div className="py-6 text-center text-xs text-[var(--text-tertiary)]">{text}</div>
);

export default AdminAiCost;
