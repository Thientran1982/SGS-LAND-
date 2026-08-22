import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, ShieldCheck, AlertTriangle, BarChart3, Save } from 'lucide-react';
import { SeoHead } from '../components/SeoHead';
import { db } from '../services/dbApi';
import { api } from '../services/api/apiClient';
import type { User } from '../types';

type Metrics = {
  sampleCount: number;
  evaluatedCount: number;
  rejectedCount: number;
  rejectRate: number;
  mae: number | null;
  mape: number | null;
  medianAbsoluteError: number | null;
  intervalCoverage: number | null;
};
type Group = Metrics & { locationKey: string; propertyType: string };
type ResponseData = {
  report: Metrics & { evaluatedAt: string; groups: Group[]; thresholdVersion?: number; appliedThresholds?: Thresholds };
  history: Array<Metrics & { evaluatedAt: string; thresholdVersion: number | null; thresholds: Thresholds | null }>;
  drift: {
    status: 'CLEAR' | 'WARNING' | 'BLOCKED';
    promotionBlocked: boolean;
    thresholds: Thresholds;
    consecutiveRunsRequired: number;
    consecutiveMaeRuns: number;
    consecutiveMapeRuns: number;
    reasons: string[];
  };
  dataset: { name: string; sampleCount: number; unitLabel: string; sources: string[] };
  disclaimer: string;
  thresholdConfig: { version: number; thresholds: Thresholds; updatedAt: string | null; updatedBy: string | null };
  thresholdHistory: Array<{ version: number; changedAt: string; authorId: string | null; oldThresholds: Thresholds | null; newThresholds: Thresholds }>;
};
type Thresholds = { maeVndPerM2: number; mape: number; consecutiveRuns: number };

const formatVnd = (value: number | null) =>
  value == null ? '—' : `${Math.round(value).toLocaleString('vi-VN')} VND/m²`;
const formatPercent = (value: number | null) =>
  value == null ? '—' : `${(value * 100).toFixed(1)}%`;
const dateTime = (value: string) => new Date(value).toLocaleString('vi-VN');

function MetricCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
      {detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}
    </div>
  );
}

function DriftStatus({ drift }: { drift: ResponseData['drift'] }) {
  const blocked = drift.status === 'BLOCKED';
  const warning = drift.status === 'WARNING';
  const colors = blocked
    ? 'border-red-200 bg-red-50 text-red-900'
    : warning ? 'border-amber-200 bg-amber-50 text-amber-900'
      : 'border-emerald-200 bg-emerald-50 text-emerald-900';
  const title = blocked ? 'Đang chặn promotion do drift'
    : warning ? 'Cảnh báo drift cần xem xét' : 'Chưa phát hiện drift';
  return (
    <section className={`rounded-2xl border p-5 ${colors}`} aria-label="Trạng thái drift">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="min-w-0">
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-1 text-sm">
            {blocked
              ? 'Tín hiệu này yêu cầu giữ promotion hiện tại để review; không tự thay đổi quyết định promotion.'
              : warning
                ? 'Một metric đã vượt ngưỡng hoặc đang tăng liên tiếp, nhưng chưa đủ điều kiện chặn.'
                : 'Các metric hiện nằm dưới ngưỡng cảnh báo định lượng.'}
          </p>
          <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
            <span>MAE: {drift.consecutiveMaeRuns}/{drift.consecutiveRunsRequired} lần tăng · ngưỡng {formatVnd(drift.thresholds.maeVndPerM2)}</span>
            <span>MAPE: {drift.consecutiveMapeRuns}/{drift.consecutiveRunsRequired} lần tăng · ngưỡng {formatPercent(drift.thresholds.mape)}</span>
            <span>Trạng thái audit: {drift.status}</span>
          </div>
          {drift.reasons.length > 0 && <p className="mt-3 text-xs font-medium">Lý do: {drift.reasons.join(', ')}</p>}
        </div>
      </div>
    </section>
  );
}

function TrendChart({ history }: { history: ResponseData['history'] }) {
  if (history.length < 2) {
    return <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">Cần ít nhất hai lần chạy để hiển thị xu hướng.</p>;
  }
  const width = 720;
  const height = 220;
  const pad = { top: 20, right: 20, bottom: 42, left: 58 };
  const maeValues = history.map(run => run.mae == null ? 0 : run.mae);
  const mapeValues = history.map(run => run.mape == null ? 0 : run.mape * 100);
  const maxMae = Math.max(...maeValues, 1);
  const maxMape = Math.max(...mapeValues, 1);
  const point = (value: number, index: number, maxValue: number) => {
    const x = pad.left + (index / Math.max(history.length - 1, 1)) * (width - pad.left - pad.right);
    const y = pad.top + (1 - value / maxValue) * (height - pad.top - pad.bottom);
    return `${x},${y}`;
  };
  const maePoints = maeValues.map((value, index) => point(value, index, maxMae)).join(' ');
  const mapePoints = mapeValues.map((value, index) => point(value, index, maxMape)).join(' ');
  const first = history[0];
  const last = history[history.length - 1];
  const rising = last.mae != null && first.mae != null && last.mae > first.mae ||
    last.mape != null && first.mape != null && last.mape > first.mape;
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-indigo-600" /> MAE (VND/m²)</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-amber-500" /> MAPE (%)</span>
        <span className={`ml-auto rounded-full px-2.5 py-1 font-medium ${rising ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
          {rising ? 'Có dấu hiệu sai số tăng' : 'Chưa thấy sai số tăng'}
        </span>
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-56 min-w-[620px] w-full" role="img" aria-label="Xu hướng MAE và MAPE theo các lần backtest">
          <line x1={pad.left} y1={height - pad.bottom} x2={width - pad.right} y2={height - pad.bottom} stroke="#cbd5e1" />
          <polyline points={maePoints} fill="none" stroke="#4f46e5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points={mapePoints} fill="none" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          {history.map((run, index) => <text key={run.evaluatedAt} x={point(0, index, 1).split(',')[0]} y={height - 16} textAnchor="middle" fontSize="10" fill="#64748b">{new Date(run.evaluatedAt).toLocaleDateString('vi-VN')}</text>)}
        </svg>
      </div>
      <p className="text-xs text-slate-500">Mỗi đường dùng thang tương đối riêng để không che khuất metric còn lại; MAPE được quy đổi sang phần trăm. Mỗi điểm là một lần chạy.</p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[620px] text-left text-xs text-slate-600">
          <thead className="border-b border-slate-100 text-slate-500"><tr>
            <th className="py-2">Thời điểm</th><th>Phiên bản ngưỡng</th><th>MAE</th><th>MAPE</th><th>Số lần liên tiếp</th>
          </tr></thead>
          <tbody>{[...history].reverse().map(run => <tr key={`threshold-${run.evaluatedAt}`} className="border-b border-slate-50">
            <td className="py-2">{dateTime(run.evaluatedAt)}</td>
            <td>{run.thresholdVersion == null ? 'Không lưu phiên bản' : `v${run.thresholdVersion}`}</td>
            <td>{run.thresholds ? formatVnd(run.thresholds.maeVndPerM2) : '—'}</td>
            <td>{run.thresholds ? formatPercent(run.thresholds.mape) : '—'}</td>
            <td>{run.thresholds?.consecutiveRuns ?? '—'}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

const ValuationAccuracyReport: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [data, setData] = useState<ResponseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [savingThresholds, setSavingThresholds] = useState(false);
  const [thresholdDraft, setThresholdDraft] = useState<Thresholds | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get<ResponseData>('/api/valuation/admin/evaluation-report');
      setData(response);
      setThresholdDraft(response.thresholdConfig.thresholds);
    } catch (err: any) {
      setError(err?.message || 'Không thể tải báo cáo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    db.getCurrentUser().then(setUser).catch(() => setUser(null));
    load();
  }, [load]);

  const runBacktest = async () => {
    setRunning(true);
    await load();
    setRunning(false);
  };

  const saveThresholds = async () => {
    if (!thresholdDraft) return;
    setSavingThresholds(true);
    setError('');
    try {
      const response = await api.put<{ config: ResponseData['thresholdConfig']; thresholdHistory: ResponseData['thresholdHistory'] }>(
        '/api/valuation/admin/drift-thresholds', thresholdDraft,
      );
      setData(current => current ? { ...current, thresholdConfig: response.config, thresholdHistory: response.thresholdHistory } : current);
    } catch (err: any) {
      setError(err?.message || 'Không thể lưu ngưỡng drift.');
    } finally {
      setSavingThresholds(false);
    }
  };

  const report = data?.report;
  const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(user?.role || '');

  if (!loading && user && !isAdmin) {
    return <div className="min-h-screen bg-slate-50 p-8 text-slate-700">Bạn không có quyền xem báo cáo này.</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      <SeoHead title="Sai số định giá | SGS Land" description="Báo cáo backtest độ chính xác mô hình định giá trên gold set đã xác minh" />
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">AI Governance · Admin</p>
            <h1 className="mt-1 text-3xl font-bold text-slate-900">Báo cáo sai số định giá</h1>
            <p className="mt-2 max-w-3xl text-slate-600">
              Backtest mô hình hiện tại trên gold set giao dịch đã xác minh, phân rã theo khu vực và loại bất động sản.
            </p>
          </div>
          <button onClick={runBacktest} disabled={loading || running}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${running ? 'animate-spin' : ''}`} />
            {running ? 'Đang chạy…' : 'Chạy lại backtest'}
          </button>
        </header>

        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <p><strong>Lưu ý:</strong> {data?.disclaimer || 'Báo cáo này là kết quả đánh giá offline trên dữ liệu đã xác minh, không phải dữ liệu giao dịch trực tiếp.'}</p>
        </div>

        {error && <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        {isAdmin && thresholdDraft && data?.thresholdConfig && (
          <section className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-slate-900">Ngưỡng phát hiện drift</h2>
                <p className="mt-1 text-xs text-slate-500">Phiên bản hiện tại: v{data.thresholdConfig.version}. Thay đổi chỉ áp dụng cho các lần đánh giá mới.</p>
              </div>
              <button onClick={saveThresholds} disabled={savingThresholds}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
                <Save className="h-4 w-4" /> {savingThresholds ? 'Đang lưu…' : 'Lưu ngưỡng'}
              </button>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <label className="text-sm font-medium text-slate-700">MAE (VND/m²)
                <input type="number" min="1" max="1000000000" step="100000"
                  value={thresholdDraft.maeVndPerM2}
                  onChange={event => setThresholdDraft({ ...thresholdDraft, maeVndPerM2: Number(event.target.value) })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
              </label>
              <label className="text-sm font-medium text-slate-700">MAPE (%)
                <input type="number" min="0.01" max="200" step="0.1"
                  value={thresholdDraft.mape * 100}
                  onChange={event => setThresholdDraft({ ...thresholdDraft, mape: Number(event.target.value) / 100 })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
              </label>
              <label className="text-sm font-medium text-slate-700">Последовательных запусков
                <input type="number" min="1" max="100" step="1"
                  value={thresholdDraft.consecutiveRuns}
                  onChange={event => setThresholdDraft({ ...thresholdDraft, consecutiveRuns: Number(event.target.value) })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
              </label>
            </div>
            {data.thresholdHistory.length > 0 && (
              <div className="mt-5 overflow-x-auto">
                <h3 className="mb-2 text-sm font-semibold text-slate-800">История изменений</h3>
                <table className="w-full min-w-[620px] text-left text-xs text-slate-600">
                  <thead className="border-b border-slate-100 text-slate-500"><tr><th className="py-2">Версия</th><th>Время</th><th>Автор</th><th>Старые значения</th><th>Новые значения</th></tr></thead>
                  <tbody>{data.thresholdHistory.map(change => <tr key={change.version} className="border-b border-slate-50">
                    <td className="py-2 font-medium">v{change.version}</td><td>{dateTime(change.changedAt)}</td><td>{change.authorId || '—'}</td>
                    <td>{change.oldThresholds ? `${formatVnd(change.oldThresholds.maeVndPerM2)} · ${formatPercent(change.oldThresholds.mape)} · ${change.oldThresholds.consecutiveRuns}` : '—'}</td>
                    <td>{formatVnd(change.newThresholds.maeVndPerM2)} · {formatPercent(change.newThresholds.mape)} · {change.newThresholds.consecutiveRuns}</td>
                  </tr>)}</tbody>
                </table>
              </div>
            )}
          </section>
        )}
        {loading ? <div className="rounded-2xl bg-white p-8 text-slate-500">Đang chạy backtest…</div> : report && (
          <>
            {data?.drift && <DriftStatus drift={data.drift} />}
            {report.thresholdVersion && report.appliedThresholds && (
              <p className="text-xs text-slate-500">Backtest này đã áp dụng bộ ngưỡng phiên bản v{report.thresholdVersion}: MAE {formatVnd(report.appliedThresholds.maeVndPerM2)} · MAPE {formatPercent(report.appliedThresholds.mape)} · {report.appliedThresholds.consecutiveRuns} lần liên tiếp.</p>
            )}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard label="MAE" value={formatVnd(report.mae)} detail="Sai số tuyệt đối trung bình" />
              <MetricCard label="MAPE" value={formatPercent(report.mape)} detail="Sai số phần trăm tuyệt đối trung bình" />
              <MetricCard label="Median absolute error" value={formatVnd(report.medianAbsoluteError)} detail="Trung vị sai số tuyệt đối" />
              <MetricCard label="Interval coverage" value={formatPercent(report.intervalCoverage)} detail="Khoảng dự báo ±15%" />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <MetricCard label="Mẫu gold set" value={report.sampleCount.toLocaleString('vi-VN')} detail={`${data?.dataset.name} · ${data?.dataset.unitLabel}`} />
              <MetricCard label="Đã đánh giá" value={report.evaluatedCount.toLocaleString('vi-VN')} detail={`${formatPercent(report.evaluatedCount / Math.max(report.sampleCount, 1))} trên tổng mẫu`} />
              <MetricCard label="Bị reject" value={report.rejectedCount.toLocaleString('vi-VN')} detail={`Reject rate: ${formatPercent(report.rejectRate)}`} />
            </div>
            <section className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                <div><h2 className="font-semibold text-slate-900">Xu hướng sai số theo thời gian</h2><p className="text-xs text-slate-500">Tối đa 30 lần chạy gần nhất · dùng để phát hiện model drift trước promotion</p></div>
                <span className="text-xs text-slate-500">{data.history.length} lần chạy đã lưu</span>
              </div>
              <TrendChart history={data.history} />
            </section>

            <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
                <div><h2 className="font-semibold text-slate-900">Phân rã theo khu vực / loại BĐS</h2><p className="text-xs text-slate-500">Tất cả giá đều tính bằng VND/m²</p></div>
                <span className="inline-flex items-center gap-1 text-xs text-slate-500"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Dữ liệu đã xác minh</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[780px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>
                    <th className="px-5 py-3">Location key</th><th className="px-5 py-3">Loại BĐS</th><th className="px-5 py-3">Mẫu</th><th className="px-5 py-3">MAE</th><th className="px-5 py-3">MAPE</th><th className="px-5 py-3">Coverage</th><th className="px-5 py-3">Reject</th>
                  </tr></thead>
                  <tbody>{report.groups.map(group => <tr key={`${group.locationKey}-${group.propertyType}`} className="border-t border-slate-100">
                    <td className="px-5 py-3 font-medium text-slate-800">{group.locationKey}</td><td className="px-5 py-3 text-slate-600">{group.propertyType}</td><td className="px-5 py-3">{group.sampleCount}</td><td className="px-5 py-3">{formatVnd(group.mae)}</td><td className="px-5 py-3">{formatPercent(group.mape)}</td><td className="px-5 py-3">{formatPercent(group.intervalCoverage)}</td><td className="px-5 py-3">{group.rejectedCount} ({formatPercent(group.rejectRate)})</td>
                  </tr>)}</tbody>
                </table>
              </div>
            </section>
            <footer className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <BarChart3 className="h-4 w-4" /> Chạy lúc: {dateTime(report.evaluatedAt)} · Nguồn xác minh: {data?.dataset.sources.join(', ')}
            </footer>
          </>
        )}
      </div>
    </div>
  );
};

export default ValuationAccuracyReport;