import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, RefreshCw, ShieldAlert, Trash2 } from 'lucide-react';
import { api } from '../services/api/apiClient';

type GalleryCleanupStatus = 'PENDING' | 'RUNNING' | 'FAILED';

export type GalleryCleanupJob = {
  id: string;
  status: GalleryCleanupStatus;
  attempts: number;
  lastAttemptAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type CleanupJobsResponse = {
  jobs?: GalleryCleanupJob[];
  counts?: {
    pending?: number;
    retrying?: number;
    failed?: number;
  };
};

const STATUS_COPY: Record<GalleryCleanupStatus, { label: string; className: string }> = {
  PENDING: { label: 'Đang chờ', className: 'bg-slate-100 text-slate-700' },
  RUNNING: { label: 'Đang thử lại', className: 'bg-amber-100 text-amber-800' },
  FAILED: { label: 'Thất bại', className: 'bg-rose-100 text-rose-800' },
};

function formatAge(value: string | null | undefined): string {
  if (!value) return 'Chưa rõ thời điểm';
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return 'Chưa rõ thời điểm';

  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return 'Vừa cập nhật';
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.floor(hours / 24)} ngày trước`;
}

function getErrorMessage(error: unknown, action: 'load' | 'retry'): string {
  const status = Number((error as { status?: number })?.status);
  if (status === 403) return 'Tài khoản của bạn không có quyền xem hàng đợi dọn dẹp ảnh.';
  return action === 'load'
    ? 'Không thể tải trạng thái dọn dẹp ảnh. Hãy thử lại sau.'
    : 'Không thể thử lại tác vụ này. Tác vụ vẫn được giữ trong hàng đợi.';
}

function normalizeJobs(value: CleanupJobsResponse | GalleryCleanupJob[] | null | undefined): GalleryCleanupJob[] {
  const jobs = Array.isArray(value) ? value : value?.jobs;
  if (!Array.isArray(jobs)) return [];
  return jobs.filter((job): job is GalleryCleanupJob => (
    Boolean(job) &&
    typeof job.id === 'string' &&
    (job.status === 'PENDING' || job.status === 'RUNNING' || job.status === 'FAILED')
  ));
}

export function GalleryCleanupPanel() {
  const [jobs, setJobs] = useState<GalleryCleanupJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [retryError, setRetryError] = useState('');
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [serverCounts, setServerCounts] = useState<CleanupJobsResponse['counts']>();

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const response = await api.get<CleanupJobsResponse>('/api/landing-pages/cleanup-failures', { limit: 100 });
      setJobs(normalizeJobs(response));
      setServerCounts(response && !Array.isArray(response) ? response.counts : undefined);
    } catch (error) {
      setJobs([]);
      setServerCounts(undefined);
      setLoadError(getErrorMessage(error, 'load'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  const counts = useMemo(() => ({
    pending: Number.isFinite(serverCounts?.pending) ? Number(serverCounts?.pending) : jobs.filter(job => job.status === 'PENDING').length,
    failed: Number.isFinite(serverCounts?.failed) ? Number(serverCounts?.failed) : jobs.filter(job => job.status === 'FAILED').length,
    running: Number.isFinite(serverCounts?.retrying) ? Number(serverCounts?.retrying) : jobs.filter(job => job.status === 'RUNNING').length,
  }), [jobs, serverCounts]);

  const retryJob = async (job: GalleryCleanupJob) => {
    setRetryingId(job.id);
    setRetryError('');
    try {
      await api.post(`/api/landing-pages/cleanup-failures/${encodeURIComponent(job.id)}/retry`, {});
      await loadJobs();
    } catch (error) {
      setRetryError(getErrorMessage(error, 'retry'));
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <section
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      aria-label="Hàng đợi dọn dẹp ảnh"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Trash2 size={19} className="mt-0.5 text-amber-700" aria-hidden="true" />
          <div>
            <h2 className="font-semibold text-slate-900">Dọn dẹp ảnh gallery</h2>
            <p className="mt-1 text-xs text-slate-500">
              Theo dõi các tệp chờ xóa khỏi storage trong tenant này.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void loadJobs()}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
          Làm mới
        </button>
      </div>

      {loadError ? (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {loadError.includes('quyền') ? <ShieldAlert size={17} className="mt-0.5 shrink-0" aria-hidden="true" /> : <AlertTriangle size={17} className="mt-0.5 shrink-0" aria-hidden="true" />}
          <span>{loadError}</span>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center gap-2 rounded-lg bg-slate-50 p-6 text-sm text-slate-500" role="status">
          <RefreshCw size={16} className="animate-spin" aria-hidden="true" />
          Đang tải trạng thái dọn dẹp…
        </div>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-3" aria-label="Tổng số tác vụ dọn dẹp">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Đang chờ</div>
              <div className="mt-1 text-xl font-bold text-slate-800">{counts.pending}</div>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">Đang thử lại</div>
              <div className="mt-1 text-xl font-bold text-amber-800">{counts.running}</div>
            </div>
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-rose-700">Thất bại</div>
              <div className="mt-1 text-xl font-bold text-rose-800">{counts.failed}</div>
            </div>
          </div>

          {retryError && (
            <div role="alert" className="mt-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              <AlertTriangle size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>{retryError}</span>
            </div>
          )}

          {jobs.length === 0 ? (
            <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-emerald-50 p-5 text-sm text-emerald-700">
              <CheckCircle2 size={17} aria-hidden="true" />
              Không có tác vụ dọn dẹp nào cần xử lý.
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {jobs.map(job => {
                const status = STATUS_COPY[job.status];
                const canRetry = job.status === 'PENDING' || job.status === 'FAILED';
                return (
                  <div key={job.id} className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${status.className}`}>
                            {status.label}
                          </span>
                          <span className="text-xs text-slate-500">
                            <Clock3 size={13} className="mr-1 inline" aria-hidden="true" />
                            {formatAge(job.updatedAt)}
                          </span>
                        </div>
                        <div className="mt-2 text-xs text-slate-600">
                          Lần thử: <b>{Number.isFinite(job.attempts) ? job.attempts : 0}</b>
                        </div>
                      </div>
                      {canRetry && (
                        <button
                          type="button"
                          onClick={() => void retryJob(job)}
                          disabled={retryingId === job.id}
                          className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                          <RefreshCw size={14} className={retryingId === job.id ? 'animate-spin' : ''} aria-hidden="true" />
                          {retryingId === job.id ? 'Đang thử lại…' : 'Thử lại'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}