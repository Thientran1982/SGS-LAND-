import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, ShieldCheck, AlertTriangle, BarChart3, Save, RotateCcw, CheckCircle2 } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
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
type OperationalEvent = {
  id: string;
  tenantId: string;
  eventType: string;
  payload: {
    thresholdVersion?: number;
    notification?: { title?: string; body?: string; type?: string };
  };
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
};

const formatVnd = (value: number | null) =>
  value == null ? '—' : `${Math.round(value).toLocaleString('vi-VN')} VND/m²`;
const formatPercent = (value: number | null) =>
  value == null ? '—' : `${(value * 100).toFixed(1)}%`;
const dateTime = (value: string) => new Date(value).toLocaleString('vi-VN');

function DriftNotificationEvents() {
  const [events, setEvents] = useState<OperationalEvent[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ id: string; message: string; success: boolean } | null>(null);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get<{ events: OperationalEvent[] }>(
        '/api/valuation/admin/operational-events',
        { eventType: 'valuation_drift_threshold_notification_failed' },
      );
      setEvents(response.events || []);
    } catch (err: any) {
      setError(err?.message || 'Không thể tải sự kiện gửi thông báo drift.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const openCount = events.filter(event => !event.resolvedAt).length;
  const resolvedCount = events.length - openCount;
  const visibleEvents = events.filter(event => (
    statusFilter === 'all' ||
    (statusFilter === 'open' && !event.resolvedAt) ||
    (statusFilter === 'resolved' && Boolean(event.resolvedAt))
  ));

  const retry = async (event: OperationalEvent) => {
    setRetryingId(event.id);
    setFeedback(null);
    try {
      const response = await api.post<{ event: OperationalEvent; retried: boolean }>(
        `/api/valuation/admin/operational-events/${encodeURIComponent(event.id)}/retry`,
      );
      setEvents(current => current.map(item => item.id === event.id ? response.event : item));
      setFeedback({ id: event.id, message: 'Đã gửi lại thông báo cho các quản trị viên.', success: true });
    } catch (err: any) {
      setFeedback({ id: event.id, message: err?.message || 'Gửi lại thông báo thất bại; sự kiện vẫn đang mở.', success: false });
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <section className="overflow-hidden rounded-[22px] border border-[var(--glass-border)] bg-[var(--bg-surface)] shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--glass-border)] px-4 py-4 sm:px-5">
        <div>
          <h2 className="font-bold text-[var(--text-primary)]">Thông báo drift bị bỏ lỡ</h2>
          <p className="mt-1 text-xs leading-relaxed text-[var(--text-tertiary)]">Theo dõi các lần gửi cảnh báo ngưỡng thất bại và xử lý lại từ workspace.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs" aria-label="Tóm tắt sự kiện drift">
            <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-800">Đang mở: {openCount}</span>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-800">Đã xử lý: {resolvedCount}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)]">
            <span>Lọc trạng thái</span>
            <select
              value={statusFilter}
              onChange={event => setStatusFilter(event.target.value as 'all' | 'open' | 'resolved')}
              className="min-h-10 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-surface)] px-2.5 py-2 text-xs font-semibold text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ui-brand)]"
            >
              <option value="all">Tất cả</option>
              <option value="open">Đang mở</option>
              <option value="resolved">Đã xử lý</option>
            </select>
          </label>
          <button
            onClick={loadEvents}
            disabled={loading}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[var(--glass-border)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--glass-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-brand)] disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Làm mới
          </button>
        </div>
      </div>
      {error && <div className="mx-4 my-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 sm:mx-5" role="alert">{error}</div>}
      {loading ? (
        <div className="space-y-3 p-5" aria-label="Đang tải sự kiện"><div className="h-16 animate-pulse rounded-xl bg-[var(--glass-surface)]" /><div className="h-16 animate-pulse rounded-xl bg-[var(--glass-surface)]" /></div>
      ) : events.length === 0 ? (
        <div className="p-5 text-sm text-[var(--text-tertiary)]">Chưa có sự kiện gửi thông báo drift nào.</div>
      ) : visibleEvents.length === 0 ? (
        <div className="p-5 text-sm text-[var(--text-tertiary)]">
          Không có sự kiện nào ở trạng thái {statusFilter === 'open' ? 'đang mở' : 'đã xử lý'}.
        </div>
      ) : (
        <div className="divide-y divide-[var(--glass-border)]">
          {visibleEvents.map(event => {
            const open = !event.resolvedAt;
            const notification = event.payload?.notification;
            return (
              <div key={event.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${open ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                        {open ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                        {open ? 'Đang mở' : 'Đã xử lý'}
                      </span>
                      <span className="text-xs text-[var(--text-tertiary)]">{dateTime(event.createdAt)}</span>
                    </div>
                    <h3 className="mt-2 font-semibold text-[var(--text-primary)]">{notification?.title || 'Gửi thông báo drift thất bại'}</h3>
                    {notification?.body && <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">{notification.body}</p>}
                  </div>
                  {open && (
                    <button
                      onClick={() => retry(event)}
                      disabled={retryingId === event.id}
                      className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg bg-[var(--ui-brand)] px-3 py-2 text-xs font-bold text-[var(--ui-on-brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-brand)] focus-visible:ring-offset-2 disabled:opacity-50"
                    >
                      <RotateCcw className={`h-3.5 w-3.5 ${retryingId === event.id ? 'animate-spin' : ''}`} />
                      {retryingId === event.id ? 'Đang gửi lại…' : 'Gửi lại'}
                    </button>
                  )}
                </div>
                <dl className="mt-4 grid gap-3 break-words text-xs text-[var(--text-secondary)] sm:grid-cols-3">
                  <div><dt className="text-[var(--text-tertiary)]">Tenant</dt><dd className="font-mono">{event.tenantId}</dd></div>
                  <div><dt className="text-[var(--text-tertiary)]">Phiên bản ngưỡng</dt><dd className="font-semibold">{event.payload?.thresholdVersion == null ? '—' : `v${event.payload.thresholdVersion}`}</dd></div>
                  <div><dt className="text-[var(--text-tertiary)]">{open ? 'Mã sự kiện' : 'Xử lý lúc'}</dt><dd className="font-mono">{open ? event.id : dateTime(event.resolvedAt!)}</dd></div>
                </dl>
                {feedback?.id === event.id && (
                  <p className={`mt-3 text-xs font-medium ${feedback.success ? 'text-emerald-700' : 'text-red-700'}`} role="status">
                    {feedback.message}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function MetricCard({ label, value, detail, comparison }: { label: string; value: string; detail?: string; comparison?: { actual: number | null; threshold: number; format: (value: number) => string } }) {
  const measured = comparison?.actual != null;
  const overThreshold = comparison?.actual != null && comparison.actual > comparison.threshold;
  return (
    <div className="min-w-0 rounded-[20px] border border-[var(--glass-border)] bg-[var(--bg-surface)] p-4 shadow-sm sm:p-5">
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">{label}</p>
      <p className="mt-2 break-words text-xl font-extrabold tabular-nums tracking-tight text-[var(--text-primary)] sm:text-2xl">{value}</p>
      {detail && <p className="mt-1 text-xs leading-relaxed text-[var(--text-tertiary)]">{detail}</p>}
      {comparison && (
        <div className={`mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--glass-border)] pt-3 text-xs ${measured ? overThreshold ? 'text-rose-700' : 'text-emerald-700' : 'text-[var(--text-tertiary)]'}`}>
          <span>{measured ? overThreshold ? 'Vượt ngưỡng áp dụng' : 'Trong ngưỡng áp dụng' : 'Chưa có metric đo được'}</span>
          <span className="font-mono font-semibold">Ngưỡng {comparison.format(comparison.threshold)}</span>
        </div>
      )}
    </div>
  );
}

function DriftStatus({ drift }: { drift: ResponseData['drift'] }) {
  const blocked = drift.status === 'BLOCKED';
  const warning = drift.status === 'WARNING';
  const colors = blocked
    ? 'border-rose-200 bg-rose-50 text-rose-950'
    : warning ? 'border-amber-200 bg-amber-50 text-amber-950'
      : 'border-emerald-200 bg-emerald-50 text-emerald-950';
  const title = blocked ? 'Đang chặn promotion do drift'
    : warning ? 'Cảnh báo drift cần xem xét' : 'Chưa phát hiện drift';
  return (
    <section className={`rounded-[22px] border p-5 sm:p-6 ${colors}`} aria-label="Trạng thái drift">
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
  const chartData = history.map(run => ({
    ...run,
    dateLabel: new Date(run.evaluatedAt).toLocaleDateString('vi-VN', { year: '2-digit', month: '2-digit', day: '2-digit' }),
    maeThreshold: run.thresholds?.maeVndPerM2 ?? null,
    mapePercent: run.mape == null ? null : run.mape * 100,
    mapeThresholdPercent: run.thresholds?.mape == null ? null : run.thresholds.mape * 100,
  }));
  const hasMae = chartData.some(run => run.mae != null || run.maeThreshold != null);
  const hasMape = chartData.some(run => run.mapePercent != null || run.mapeThresholdPercent != null);
  const renderTooltip = (metric: 'mae' | 'mapePercent') => ({ active, payload }: any) => {
    const point = payload?.[0]?.payload;
    if (!active || !point) return null;
    const value = point[metric] as number | null;
    const threshold = metric === 'mae' ? point.maeThreshold as number | null : point.mapeThresholdPercent as number | null;
    const format = metric === 'mae'
      ? (number: number | null) => formatVnd(number)
      : (number: number | null) => number == null ? '—' : `${number.toFixed(1)}%`;
    return (
      <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--bg-surface)] p-3 text-xs shadow-xl">
        <p className="mb-2 font-semibold text-[var(--text-primary)]">{dateTime(point.evaluatedAt)}</p>
        <p className="font-mono text-[var(--text-secondary)]">Đo được: {format(value)}</p>
        <p className="font-mono text-[var(--text-secondary)]">Ngưỡng lần chạy: {format(threshold)}</p>
        <p className="mt-1 text-[var(--text-tertiary)]">{point.thresholdVersion == null ? 'Không lưu phiên bản ngưỡng' : `Phiên bản ngưỡng v${point.thresholdVersion}`}</p>
      </div>
    );
  };
  return (
    <div>
      {!history.length ? (
        <p className="rounded-xl bg-[var(--glass-surface)] p-4 text-sm text-[var(--text-secondary)]">Chưa có lần chạy nào được lưu để hiển thị xu hướng.</p>
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-2">
            <section className="min-w-0 rounded-[18px] bg-[var(--glass-surface)] p-3 sm:p-4" aria-label="Xu hướng MAE theo VND trên mét vuông">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-[var(--text-primary)]">MAE · VND/m²</h3>
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--text-secondary)]">
                  <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[var(--ui-brand)]" /> Đo được</span>
                  <span className="inline-flex items-center gap-1.5"><i className="h-0 w-4 border-t-2 border-dashed border-amber-600" /> Ngưỡng lần chạy</span>
                </div>
              </div>
              <div className="h-60" role="img" aria-label="Biểu đồ MAE có trục giá trị VND trên mét vuông và ngưỡng theo từng lần chạy">
                {hasMae ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: 12 }}>
                      <CartesianGrid stroke="var(--glass-border)" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="dateLabel" tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={18} />
                      <YAxis width={78} domain={[0, 'auto']} tickFormatter={(value) => Number(value).toLocaleString('vi-VN', { maximumFractionDigits: 0 })} tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} tickLine={false} axisLine={false} />
                      <Tooltip content={renderTooltip('mae')} />
                      <Line type="stepAfter" dataKey="maeThreshold" name="Ngưỡng lần chạy" stroke="#b7791f" strokeDasharray="5 4" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
                      <Line type="monotone" dataKey="mae" name="MAE" stroke="var(--ui-brand)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <p className="flex h-full items-center justify-center text-sm text-[var(--text-tertiary)]">Chưa có MAE hoặc ngưỡng MAE đo được.</p>}
              </div>
            </section>
            <section className="min-w-0 rounded-[18px] bg-[var(--glass-surface)] p-3 sm:p-4" aria-label="Xu hướng MAPE theo phần trăm">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-[var(--text-primary)]">MAPE · %</h3>
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--text-secondary)]">
                  <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-sgs-primary" /> Đo được</span>
                  <span className="inline-flex items-center gap-1.5"><i className="h-0 w-4 border-t-2 border-dashed border-amber-600" /> Ngưỡng lần chạy</span>
                </div>
              </div>
              <div className="h-60" role="img" aria-label="Biểu đồ MAPE có trục phần trăm và ngưỡng theo từng lần chạy">
                {hasMape ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
                      <CartesianGrid stroke="var(--glass-border)" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="dateLabel" tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={18} />
                      <YAxis width={52} domain={[0, 'auto']} tickFormatter={(value) => `${Number(value).toFixed(1)}%`} tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} tickLine={false} axisLine={false} />
                      <Tooltip content={renderTooltip('mapePercent')} />
                      <Line type="stepAfter" dataKey="mapeThresholdPercent" name="Ngưỡng lần chạy" stroke="#b7791f" strokeDasharray="5 4" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
                      <Line type="monotone" dataKey="mapePercent" name="MAPE" stroke="#c47b16" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <p className="flex h-full items-center justify-center text-sm text-[var(--text-tertiary)]">Chưa có MAPE hoặc ngưỡng MAPE đo được.</p>}
              </div>
            </section>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[var(--text-tertiary)]">
            Mỗi biểu đồ dùng trục có đơn vị riêng, đường đứt nét là ngưỡng đã áp dụng cho lần chạy tương ứng. MAPE được đổi từ phân số sang phần trăm. Giá trị thiếu tạo khoảng trống, không bị coi là 0.
          </p>
        </>
      )}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-xs text-[var(--text-secondary)]">
          <thead className="border-b border-[var(--glass-border)] text-[var(--text-tertiary)]"><tr>
            <th className="py-2">Thời điểm</th><th>Phiên bản</th><th>MAE đo được</th><th>MAPE đo được</th><th>MAE ngưỡng</th><th>MAPE ngưỡng</th><th>Số lần liên tiếp</th>
          </tr></thead>
          <tbody>{[...history].reverse().map(run => <tr key={`threshold-${run.evaluatedAt}`} className="border-b border-[var(--glass-border)]">
            <td className="py-2">{dateTime(run.evaluatedAt)}</td>
            <td>{run.thresholdVersion == null ? 'Không lưu phiên bản' : `v${run.thresholdVersion}`}</td>
            <td className="font-mono">{formatVnd(run.mae)}</td>
            <td className="font-mono">{formatPercent(run.mape)}</td>
            <td>{run.thresholds ? formatVnd(run.thresholds.maeVndPerM2) : '—'}</td>
            <td>{run.thresholds ? formatPercent(run.thresholds.mape) : '—'}</td>
            <td>{run.thresholds?.consecutiveRuns ?? '—'}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

function GroupMetricBreakdown({ groups }: { groups: Group[] }) {
  const metrics = [
    {
      key: 'mae' as const,
      title: 'MAE cao nhất theo nhóm',
      format: (value: number) => formatVnd(value),
      value: (group: Group) => group.mae,
    },
    {
      key: 'mape' as const,
      title: 'MAPE cao nhất theo nhóm',
      format: (value: number) => formatPercent(value),
      value: (group: Group) => group.mape,
    },
  ];
  return (
    <div className="grid gap-4 border-b border-[var(--glass-border)] p-4 sm:p-5 lg:grid-cols-2">
      {metrics.map(metric => {
        const ranked = groups
          .filter(group => metric.value(group) != null)
          .sort((a, b) => (metric.value(b) as number) - (metric.value(a) as number))
          .slice(0, 5);
        const max = Math.max(0, ...ranked.map(group => metric.value(group) as number));
        return (
          <div key={metric.key} className="rounded-[18px] bg-[var(--glass-surface)] p-4">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">{metric.title}</h3>
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">Tối đa 5 nhóm · thanh so sánh tương đối trong nhóm hiển thị</p>
            {ranked.length ? (
              <div className="mt-4 space-y-3">
                {ranked.map(group => {
                  const value = metric.value(group) as number;
                  const width = max > 0 ? value / max * 100 : 0;
                  return (
                    <div key={`${group.locationKey}-${group.propertyType}-${metric.key}`} className="grid grid-cols-[minmax(0,1fr)_minmax(4rem,1.2fr)_auto] items-center gap-2">
                      <span className="truncate text-xs text-[var(--text-secondary)]" title={`${group.locationKey} · ${group.propertyType}`}>{group.locationKey} · {group.propertyType}</span>
                      <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-surface)]" role="img" aria-label={`${group.locationKey} ${metric.title}: ${metric.format(value)}`}>
                        <div className="h-full rounded-full bg-sgs-primary" style={{ width: `${width}%` }} />
                      </div>
                      <span className="max-w-[8rem] truncate text-right font-mono text-[11px] font-semibold text-[var(--text-primary)]" title={metric.format(value)}>{metric.format(value)}</span>
                    </div>
                  );
                })}
              </div>
            ) : <p className="mt-4 rounded-xl bg-[var(--bg-surface)] p-3 text-xs text-[var(--text-tertiary)]">Chưa có giá trị đo được cho metric này.</p>}
          </div>
        );
      })}
    </div>
  );
}

const ValuationAccuracyReport: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [userResolved, setUserResolved] = useState(false);
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
    db.getCurrentUser().then(setUser).catch(() => setUser(null)).finally(() => setUserResolved(true));
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

  if (userResolved && !isAdmin) {
    return <div className="min-h-[100dvh] bg-[var(--bg-app)] p-6 text-[var(--text-secondary)] sm:p-8">Bạn không có quyền xem báo cáo này.</div>;
  }

  return (
    <div className="min-h-[100dvh] bg-[var(--bg-app)] p-4 text-[var(--text-primary)] sm:p-6 md:p-8">
      <SeoHead title="Sai số định giá | SGS Land" description="Báo cáo backtest độ chính xác mô hình định giá trên gold set đã xác minh" />
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--ui-brand)]">AI Governance · Admin</p>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-3xl">Báo cáo sai số định giá</h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--text-secondary)]">
              Backtest mô hình hiện tại trên gold set giao dịch đã xác minh, phân rã theo khu vực và loại bất động sản.
            </p>
          </div>
          <button onClick={runBacktest} disabled={loading || running}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--ui-brand)] px-4 py-2.5 text-sm font-bold text-[var(--ui-on-brand)] shadow-sm transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-brand)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${running ? 'animate-spin' : ''}`} />
            {running ? 'Đang chạy…' : 'Chạy lại backtest'}
          </button>
        </header>

        <div className="flex items-start gap-3 rounded-[20px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <p><strong>Lưu ý:</strong> {data?.disclaimer || 'Báo cáo này là kết quả đánh giá offline trên dữ liệu đã xác minh, không phải dữ liệu giao dịch trực tiếp.'}</p>
        </div>

        {error && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert">
            <span>{error}</span>
            {!data && <button type="button" onClick={load} className="rounded-lg border border-rose-300 px-3 py-2 text-xs font-bold hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500">Thử tải lại</button>}
          </div>
        )}
        {isAdmin && thresholdDraft && data?.thresholdConfig && (
          <section className="rounded-[22px] border border-[var(--glass-border)] bg-[var(--bg-surface)] p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-bold text-[var(--text-primary)]">Ngưỡng phát hiện drift</h2>
                <p className="mt-1 text-xs leading-relaxed text-[var(--text-tertiary)]">Phiên bản hiện tại: v{data.thresholdConfig.version}. Thay đổi chỉ áp dụng cho các lần đánh giá mới.</p>
              </div>
              <button onClick={saveThresholds} disabled={savingThresholds}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[var(--ui-brand)] px-3 py-2 text-sm font-bold text-[var(--ui-on-brand)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-brand)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                <Save className="h-4 w-4" /> {savingThresholds ? 'Đang lưu…' : 'Lưu ngưỡng'}
              </button>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <label className="text-sm font-semibold text-[var(--text-secondary)]">MAE (VND/m²)
                <input type="number" min="1" max="1000000000" step="100000"
                  value={thresholdDraft.maeVndPerM2}
                  onChange={event => setThresholdDraft({ ...thresholdDraft, maeVndPerM2: Number(event.target.value) })}
                  className="mt-1 min-h-11 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)] px-3 py-2 font-mono font-normal text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ui-brand)]" />
              </label>
              <label className="text-sm font-semibold text-[var(--text-secondary)]">MAPE (%)
                <input type="number" min="0.01" max="200" step="0.1"
                  value={thresholdDraft.mape * 100}
                  onChange={event => setThresholdDraft({ ...thresholdDraft, mape: Number(event.target.value) / 100 })}
                  className="mt-1 min-h-11 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)] px-3 py-2 font-mono font-normal text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ui-brand)]" />
              </label>
              <label className="text-sm font-semibold text-[var(--text-secondary)]">Последовательных запусков
                <input type="number" min="1" max="100" step="1"
                  value={thresholdDraft.consecutiveRuns}
                  onChange={event => setThresholdDraft({ ...thresholdDraft, consecutiveRuns: Number(event.target.value) })}
                  className="mt-1 min-h-11 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)] px-3 py-2 font-mono font-normal text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ui-brand)]" />
              </label>
            </div>
            {data.thresholdHistory.length > 0 && (
              <div className="mt-5 overflow-x-auto">
                <h3 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">История изменений</h3>
                <table className="w-full min-w-[620px] text-left text-xs text-[var(--text-secondary)]">
                  <thead className="border-b border-[var(--glass-border)] text-[var(--text-tertiary)]"><tr><th className="py-2">Версия</th><th>Время</th><th>Автор</th><th>Ngưỡng cũ</th><th>Ngưỡng mới</th></tr></thead>
                  <tbody>{data.thresholdHistory.map(change => <tr key={change.version} className="border-b border-[var(--glass-border)]">
                    <td className="py-2 font-medium">v{change.version}</td><td>{dateTime(change.changedAt)}</td><td>{change.authorId || '—'}</td>
                    <td>{change.oldThresholds ? `${formatVnd(change.oldThresholds.maeVndPerM2)} · ${formatPercent(change.oldThresholds.mape)} · ${change.oldThresholds.consecutiveRuns}` : '—'}</td>
                    <td>{formatVnd(change.newThresholds.maeVndPerM2)} · {formatPercent(change.newThresholds.mape)} · {change.newThresholds.consecutiveRuns}</td>
                  </tr>)}</tbody>
                </table>
              </div>
            )}
          </section>
        )}
        {loading ? (
          <div className="space-y-4" aria-label="Đang tải báo cáo">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[0, 1, 2, 3].map(item => <div key={item} className="h-28 animate-pulse rounded-[20px] border border-[var(--glass-border)] bg-[var(--glass-surface)]" />)}
            </div>
            <div className="h-64 animate-pulse rounded-[22px] border border-[var(--glass-border)] bg-[var(--glass-surface)]" />
          </div>
        ) : isAdmin && report && (
          <>
            {data?.drift && <DriftStatus drift={data.drift} />}
            {report.thresholdVersion != null && report.appliedThresholds && (
              <p className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)] px-4 py-3 text-xs leading-relaxed text-[var(--text-secondary)]">Backtest này đã áp dụng bộ ngưỡng phiên bản v{report.thresholdVersion}: MAE {formatVnd(report.appliedThresholds.maeVndPerM2)} · MAPE {formatPercent(report.appliedThresholds.mape)} · {report.appliedThresholds.consecutiveRuns} lần liên tiếp.</p>
            )}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard label="MAE" value={formatVnd(report.mae)} detail="Sai số tuyệt đối trung bình · VND/m²" comparison={report.appliedThresholds ? { actual: report.mae, threshold: report.appliedThresholds.maeVndPerM2, format: formatVnd } : undefined} />
              <MetricCard label="MAPE" value={formatPercent(report.mape)} detail="Sai số phần trăm tuyệt đối trung bình" comparison={report.appliedThresholds ? { actual: report.mape, threshold: report.appliedThresholds.mape, format: formatPercent } : undefined} />
              <MetricCard label="Median absolute error" value={formatVnd(report.medianAbsoluteError)} detail="Trung vị sai số tuyệt đối · VND/m²" />
              <MetricCard label="Interval coverage" value={formatPercent(report.intervalCoverage)} detail="Khoảng dự báo ±15%" />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <MetricCard label="Mẫu gold set" value={report.sampleCount.toLocaleString('vi-VN')} detail={`${data?.dataset.name} · ${data?.dataset.unitLabel}`} />
              <MetricCard label="Đã đánh giá" value={report.evaluatedCount.toLocaleString('vi-VN')} detail={`${report.sampleCount > 0 ? formatPercent(report.evaluatedCount / report.sampleCount) : '—'} trên tổng mẫu`} />
              <MetricCard label="Bị reject" value={report.rejectedCount.toLocaleString('vi-VN')} detail={`Reject rate: ${formatPercent(report.rejectRate)}`} />
            </div>
            <section className="rounded-[22px] border border-[var(--glass-border)] bg-[var(--bg-surface)] p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                <div><h2 className="font-bold text-[var(--text-primary)]">Xu hướng sai số theo thời gian</h2><p className="mt-1 text-xs text-[var(--text-tertiary)]">Tối đa 30 lần chạy gần nhất · dùng để phát hiện model drift trước promotion</p></div>
                <span className="rounded-full bg-[var(--glass-surface)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]">{data.history.length} lần chạy đã lưu</span>
              </div>
              <TrendChart history={data.history} />
            </section>
            <DriftNotificationEvents />

            <section className="overflow-hidden rounded-[22px] border border-[var(--glass-border)] bg-[var(--bg-surface)] shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--glass-border)] px-4 py-4 sm:px-5">
                <div><h2 className="font-bold text-[var(--text-primary)]">Phân rã theo khu vực / loại BĐS</h2><p className="mt-1 text-xs text-[var(--text-tertiary)]">Tất cả giá đều tính bằng VND/m²</p></div>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800"><ShieldCheck className="h-4 w-4" /> Dữ liệu đã xác minh</span>
              </div>
              <GroupMetricBreakdown groups={report.groups} />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[780px] text-left text-sm">
                  <thead className="bg-[var(--glass-surface)] text-xs uppercase tracking-wide text-[var(--text-tertiary)]"><tr>
                    <th className="px-5 py-3">Location key</th><th className="px-5 py-3">Loại BĐS</th><th className="px-5 py-3">Mẫu</th><th className="px-5 py-3">MAE</th><th className="px-5 py-3">MAPE</th><th className="px-5 py-3">Coverage</th><th className="px-5 py-3">Reject</th>
                  </tr></thead>
                  <tbody>{report.groups.length ? report.groups.map(group => <tr key={`${group.locationKey}-${group.propertyType}`} className="border-t border-[var(--glass-border)] hover:bg-[var(--glass-surface)]">
                    <td className="px-5 py-3 font-medium text-[var(--text-primary)]">{group.locationKey}</td><td className="px-5 py-3 text-[var(--text-secondary)]">{group.propertyType}</td><td className="px-5 py-3 tabular-nums">{group.sampleCount.toLocaleString('vi-VN')}</td><td className="px-5 py-3 font-mono">{formatVnd(group.mae)}</td><td className="px-5 py-3 font-mono">{formatPercent(group.mape)}</td><td className="px-5 py-3 font-mono">{formatPercent(group.intervalCoverage)}</td><td className="px-5 py-3 font-mono">{group.rejectedCount.toLocaleString('vi-VN')} ({formatPercent(group.rejectRate)})</td>
                  </tr>) : <tr><td colSpan={7} className="px-5 py-10 text-center text-sm text-[var(--text-tertiary)]">Không có nhóm dữ liệu cho lần chạy này.</td></tr>}</tbody>
                </table>
              </div>
            </section>
            <footer className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-tertiary)]">
              <BarChart3 className="h-4 w-4" /> Chạy lúc: {dateTime(report.evaluatedAt)} · Nguồn xác minh: {data?.dataset.sources.join(', ')}
            </footer>
          </>
        )}
        {!loading && !report && !error && (
          <div className="rounded-[22px] border border-[var(--glass-border)] bg-[var(--bg-surface)] p-8 text-center text-sm text-[var(--text-secondary)]">
            Không có kết quả backtest để hiển thị.
          </div>
        )}
      </div>
    </div>
  );
};

export default ValuationAccuracyReport;