import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, Check, Eye, ExternalLink, RefreshCw, Send, X } from 'lucide-react';
import { listingApi } from '../services/api/listingApi';
import {
  socialPublicationApi,
  SocialCapability,
  SocialPublication,
  SocialTarget,
} from '../services/api/socialPublicationApi';

type ListingOption = {
  id: string;
  code?: string;
  title?: string;
  status?: string;
  images?: string[];
};

const statusLabel: Record<string, string> = {
  DRAFT: 'Bản nháp',
  SCHEDULED: 'Đã hẹn',
  PROCESSING: 'Đang xử lý',
  PARTIALLY_PUBLISHED: 'Đăng một phần',
  PUBLISHED: 'Đã đăng',
  FAILED: 'Thất bại',
  CANCELLED: 'Đã hủy',
  NOT_READY: 'Chưa sẵn sàng',
  PENDING: 'Đang chờ',
  FAILED_FINAL: 'Lỗi cuối',
  AMBIGUOUS: 'Chưa xác định',
};

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '—';

export const SocialPublishing: React.FC = () => {
  const [catalog, setCatalog] = useState<SocialCapability[]>([]);
  const [listings, setListings] = useState<ListingOption[]>([]);
  const [publications, setPublications] = useState<SocialPublication[]>([]);
  const [listingId, setListingId] = useState('');
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [preview, setPreview] = useState<{ platform: string; title: string; text: string; imageUrls: string[]; link: string | null }[]>([]);
  const [schedule, setSchedule] = useState<'NOW' | 'SCHEDULED'>('NOW');
  const [scheduledAt, setScheduledAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [expandedPublicationId, setExpandedPublicationId] = useState<string | null>(null);
  const [publicationDetails, setPublicationDetails] = useState<Record<string, SocialPublication>>({});
  const [detailLoading, setDetailLoading] = useState<string | null>(null);
  const [reconcileForm, setReconcileForm] = useState<{
    publicationId: string;
    targetId: string;
    action: 'CONFIRM_PUBLISHED' | 'MARK_FAILED' | 'REQUEUE';
    reason: string;
    providerPostId: string;
    providerPostUrl: string;
  } | null>(null);

  const selectedListing = useMemo(
    () => listings.find(item => String(item.id) === listingId),
    [listings, listingId],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [catalogResult, listingResult, publicationResult] = await Promise.all([
        socialPublicationApi.getCatalog(),
        listingApi.getListings(1, 100, { status: 'AVAILABLE,OPENING,BOOKING,BEST_MARKET' }),
        socialPublicationApi.getPublications(),
      ]);
      setCatalog(catalogResult.data || []);
      setListings(listingResult.data || []);
      setPublications(publicationResult.data || []);
      const queryListingId = new URLSearchParams(window.location.search).get('listingId');
      if (queryListingId && (listingResult.data || []).some((item: ListingOption) => String(item.id) === queryListingId)) {
        setListingId(queryListingId);
      }
    } catch (error: any) {
      setMessage({ kind: 'error', text: error?.message || 'Không tải được dữ liệu đăng đa nền tảng' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const togglePlatform = (platform: string) => {
    setPlatforms(current => current.includes(platform)
      ? current.filter(item => item !== platform)
      : [...current, platform]);
    setPreview([]);
  };

  const runPreview = async () => {
    if (!listingId || !platforms.length) {
      setMessage({ kind: 'error', text: 'Chọn một sản phẩm và ít nhất một nền tảng.' });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const result = await socialPublicationApi.preview(listingId, platforms, selectedListing?.images || []);
      setPreview(result.previews || []);
    } catch (error: any) {
      setMessage({ kind: 'error', text: error?.message || 'Không tạo được preview' });
    } finally {
      setBusy(false);
    }
  };

  const saveDraft = async () => {
    if (!listingId || !platforms.length) {
      setMessage({ kind: 'error', text: 'Chọn sản phẩm và nền tảng trước khi lưu.' });
      return;
    }
    if (schedule === 'SCHEDULED' && !scheduledAt) {
      setMessage({ kind: 'error', text: 'Chọn thời điểm hẹn đăng.' });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await socialPublicationApi.createDraft({
        listingId,
        platforms,
        publishMode: schedule,
        scheduledAt: schedule === 'SCHEDULED' ? new Date(scheduledAt).toISOString() : null,
      });
      setMessage({ kind: 'ok', text: 'Đã lưu snapshot bất biến vào bản nháp. Chưa có nền tảng nào được báo là đã đăng.' });
      await load();
    } catch (error: any) {
      setMessage({ kind: 'error', text: error?.message || 'Không lưu được publication' });
    } finally {
      setBusy(false);
    }
  };

  const activate = async (id: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await socialPublicationApi.activate(id);
      setMessage({ kind: 'ok', text: 'Publication đã được kích hoạt.' });
      await load();
    } catch (error: any) {
      setMessage({ kind: 'error', text: error?.message || 'Chưa thể kích hoạt publication' });
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (id: string) => {
    setBusy(true);
    try {
      await socialPublicationApi.cancel(id);
      await load();
    } catch (error: any) {
      setMessage({ kind: 'error', text: error?.message || 'Không thể hủy publication' });
    } finally {
      setBusy(false);
    }
  };

  const toggleDetails = async (id: string) => {
    if (expandedPublicationId === id) {
      setExpandedPublicationId(null);
      return;
    }
    setExpandedPublicationId(id);
    if (publicationDetails[id]) return;
    setDetailLoading(id);
    try {
      const detail = await socialPublicationApi.getPublication(id);
      setPublicationDetails(current => ({ ...current, [id]: detail }));
    } catch (error: any) {
      setMessage({ kind: 'error', text: error?.message || 'Không tải được lịch sử publication' });
    } finally {
      setDetailLoading(null);
    }
  };

  const beginReconcile = (
    publicationId: string,
    target: SocialTarget,
    action: 'CONFIRM_PUBLISHED' | 'MARK_FAILED' | 'REQUEUE',
  ) => {
    setReconcileForm({
      publicationId,
      targetId: target.id,
      action,
      reason: '',
      providerPostId: target.providerPostId || '',
      providerPostUrl: target.providerPostUrl || '',
    });
  };

  const submitReconcile = async () => {
    if (!reconcileForm) return;
    if (reconcileForm.reason.trim().length < 3) {
      setMessage({ kind: 'error', text: 'Cần ghi lý do xử lý tối thiểu 3 ký tự.' });
      return;
    }
    if (reconcileForm.action === 'CONFIRM_PUBLISHED' && !reconcileForm.providerPostId.trim()) {
      setMessage({ kind: 'error', text: 'Cần provider post ID để xác nhận đã đăng.' });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const detail = await socialPublicationApi.reconcile(
        reconcileForm.publicationId,
        reconcileForm.targetId,
        {
          action: reconcileForm.action,
          reason: reconcileForm.reason.trim(),
          providerPostId: reconcileForm.providerPostId.trim() || undefined,
          providerPostUrl: reconcileForm.providerPostUrl.trim() || undefined,
        },
      );
      setPublicationDetails(current => ({ ...current, [detail.id]: detail }));
      setReconcileForm(null);
      setMessage({ kind: 'ok', text: 'Đã ghi nhận thao tác và cập nhật trạng thái publication.' });
      await load();
    } catch (error: any) {
      setMessage({ kind: 'error', text: error?.message || 'Không thể cập nhật target' });
    } finally {
      setBusy(false);
    }
  };

  const renderTargetDetails = (publication: SocialPublication) => (
    <div className="mt-4 space-y-4 border-t border-[var(--glass-border)] pt-4">
      <div className="space-y-3">
        {publication.targets.map(target => (
          <div key={target.id} className="rounded-xl bg-[var(--bg-app)] p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">{target.platform}</p>
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                  Attempt: {target.attemptCount ?? 0}
                  {target.providerRequestId ? ` · Request ID: ${target.providerRequestId}` : ''}
                </p>
              </div>
              <span className="rounded-full bg-[var(--glass-surface)] px-2.5 py-1 text-xs text-[var(--text-secondary)]">
                {statusLabel[target.status] || target.status}
              </span>
            </div>
            {target.providerPostId && (
              <p className="mt-2 break-all text-xs text-emerald-700">
                Provider post ID: {target.providerPostId}
                {target.providerPostUrl && <a className="ml-2 underline" href={target.providerPostUrl} target="_blank" rel="noreferrer">Mở bài đăng</a>}
              </p>
            )}
            {target.lastErrorMessage && (
              <p className="mt-2 text-xs text-red-700">
                {target.lastErrorCode ? `${target.lastErrorCode}: ` : ''}{target.lastErrorMessage}
              </p>
            )}
            {!!target.attempts?.length && (
              <div className="mt-3 space-y-1 text-xs text-[var(--text-tertiary)]">
                <p className="font-semibold text-[var(--text-secondary)]">Lịch sử provider attempts</p>
                {target.attempts.map(attempt => (
                  <p key={attempt.id}>
                    #{attempt.attemptNumber} · {attempt.resultStatus}
                    {attempt.providerRequestId ? ` · ${attempt.providerRequestId}` : ''}
                    {attempt.errorMessage ? ` · ${attempt.errorMessage}` : ''}
                  </p>
                ))}
              </div>
            )}
            {target.status === 'AMBIGUOUS' && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => beginReconcile(publication.id, target, 'CONFIRM_PUBLISHED')}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                >
                  Xác nhận đã đăng
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => beginReconcile(publication.id, target, 'MARK_FAILED')}
                  className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50"
                >
                  Đánh dấu thất bại
                </button>
              </div>
            )}
            {['FAILED_RETRYABLE', 'FAILED_FINAL'].includes(target.status) && (
              <button
                type="button"
                disabled={busy}
                onClick={() => beginReconcile(publication.id, target, 'REQUEUE')}
                className="mt-3 rounded-lg border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-800 disabled:opacity-50"
              >
                Cho chạy lại sau khi kiểm tra
              </button>
            )}
            {reconcileForm?.targetId === target.id && (
              <div className="mt-3 space-y-2 rounded-xl border border-sgs-primary/30 bg-[var(--bg-surface)] p-3">
                <p className="text-xs font-semibold text-[var(--text-primary)]">
                  {reconcileForm.action === 'CONFIRM_PUBLISHED'
                    ? 'Xác nhận provider đã tạo bài đăng'
                    : reconcileForm.action === 'MARK_FAILED' ? 'Đánh dấu kết quả cuối' : 'Đưa target về hàng đợi'}
                </p>
                {reconcileForm.action === 'CONFIRM_PUBLISHED' && (
                  <>
                    <input
                      value={reconcileForm.providerPostId}
                      onChange={event => setReconcileForm(current => current && ({ ...current, providerPostId: event.target.value }))}
                      placeholder="Provider post ID bắt buộc"
                      className="w-full rounded-lg border border-[var(--glass-border)] bg-[var(--bg-app)] px-3 py-2 text-xs text-[var(--text-primary)]"
                    />
                    <input
                      value={reconcileForm.providerPostUrl}
                      onChange={event => setReconcileForm(current => current && ({ ...current, providerPostUrl: event.target.value }))}
                      placeholder="URL bài đăng (không bắt buộc)"
                      className="w-full rounded-lg border border-[var(--glass-border)] bg-[var(--bg-app)] px-3 py-2 text-xs text-[var(--text-primary)]"
                    />
                  </>
                )}
                <textarea
                  value={reconcileForm.reason}
                  onChange={event => setReconcileForm(current => current && ({ ...current, reason: event.target.value }))}
                  placeholder="Lý do và bằng chứng operator đã kiểm tra"
                  rows={2}
                  className="w-full rounded-lg border border-[var(--glass-border)] bg-[var(--bg-app)] px-3 py-2 text-xs text-[var(--text-primary)]"
                />
                <div className="flex gap-2">
                  <button type="button" disabled={busy} onClick={() => void submitReconcile()} className="rounded-lg bg-sgs-primary px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Lưu xử lý</button>
                  <button type="button" disabled={busy} onClick={() => setReconcileForm(null)} className="rounded-lg border border-[var(--glass-border)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]">Hủy</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      {!!publication.events?.length && (
        <div className="rounded-xl border border-[var(--glass-border)] p-3">
          <p className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">Audit history</p>
          <div className="space-y-2 text-xs text-[var(--text-tertiary)]">
            {publication.events.map(event => (
              <p key={event.id}>
                {formatDate(event.createdAt)} · <span className="font-semibold">{event.eventType}</span>
                {event.fromStatus || event.toStatus ? ` · ${event.fromStatus || '—'} → ${event.toStatus || '—'}` : ''}
                {event.reason ? ` · ${event.reason}` : ''}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-full bg-[var(--bg-app)] p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-sgs-primary">Marketing operations</p>
            <h1 className="mt-2 text-3xl font-bold text-[var(--text-primary)]">Đăng sản phẩm đa nền tảng</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
              Preview và lưu kế hoạch đăng từ snapshot của listing. Kênh nhắn tin lead không được xem là public publisher.
            </p>
          </div>
          <button onClick={() => void load()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--glass-border)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--glass-surface-hover)]">
            <RefreshCw size={16} /> Làm mới
          </button>
        </div>

        {message && (
          <div className={`flex items-start gap-3 rounded-2xl border p-4 text-sm ${message.kind === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
            {message.kind === 'error' ? <AlertTriangle size={18} /> : <Check size={18} />}
            <span>{message.text}</span>
          </div>
        )}

        <section className="rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-surface)] p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-xl bg-sgs-primary/10 p-2 text-sgs-primary"><Send size={20} /></div>
            <div>
              <h2 className="font-bold text-[var(--text-primary)]">Tạo publication draft</h2>
              <p className="text-xs text-[var(--text-tertiary)]">Chưa gửi gì ra provider ở bước này.</p>
            </div>
          </div>
          <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-[var(--text-primary)]">Sản phẩm</span>
                <select value={listingId} onChange={event => { setListingId(event.target.value); setPreview([]); }} className="w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-app)] px-3 py-3 text-sm text-[var(--text-primary)]">
                  <option value="">Chọn listing đủ điều kiện public</option>
                  {listings.map(item => <option key={item.id} value={item.id}>{item.code ? `${item.code} — ` : ''}{item.title || item.id}</option>)}
                </select>
              </label>
              <div>
                <span className="mb-2 block text-sm font-semibold text-[var(--text-primary)]">Nền tảng đích</span>
                <div className="space-y-2">
                  {catalog.map(item => (
                    <label key={item.platform} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${platforms.includes(item.platform) ? 'border-sgs-primary bg-sgs-primary/5' : 'border-[var(--glass-border)]'}`}>
                      <input type="checkbox" checked={platforms.includes(item.platform)} onChange={() => togglePlatform(item.platform)} className="mt-1 accent-[var(--sgs-primary)]" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2 text-sm font-semibold text-[var(--text-primary)]">
                          {item.label}
                          <span className={`rounded-full px-2 py-0.5 text-[10px] ${item.status === 'READY' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{item.status === 'READY' ? 'Sẵn sàng' : 'Chưa sẵn sàng'}</span>
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-[var(--text-tertiary)]">{item.reason}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className={`rounded-xl border p-3 ${schedule === 'NOW' ? 'border-sgs-primary bg-sgs-primary/5' : 'border-[var(--glass-border)]'}`}>
                  <input type="radio" checked={schedule === 'NOW'} onChange={() => setSchedule('NOW')} className="mr-2 accent-[var(--sgs-primary)]" />
                  <span className="text-sm font-semibold text-[var(--text-primary)]">Khi được duyệt</span>
                </label>
                <label className={`rounded-xl border p-3 ${schedule === 'SCHEDULED' ? 'border-sgs-primary bg-sgs-primary/5' : 'border-[var(--glass-border)]'}`}>
                  <input type="radio" checked={schedule === 'SCHEDULED'} onChange={() => setSchedule('SCHEDULED')} className="mr-2 accent-[var(--sgs-primary)]" />
                  <span className="text-sm font-semibold text-[var(--text-primary)]">Hẹn giờ</span>
                </label>
              </div>
              {schedule === 'SCHEDULED' && <input type="datetime-local" value={scheduledAt} onChange={event => setScheduledAt(event.target.value)} className="w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-app)] px-3 py-3 text-sm text-[var(--text-primary)]" />}
              <div className="flex flex-wrap gap-2">
                <button disabled={busy || loading} onClick={() => void runPreview()} className="inline-flex items-center gap-2 rounded-xl border border-[var(--glass-border)] px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] disabled:opacity-50">
                  <Eye size={16} /> Xem preview
                </button>
                <button disabled={busy || loading} onClick={() => void saveDraft()} className="inline-flex items-center gap-2 rounded-xl bg-sgs-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-50">
                  <CalendarClock size={16} /> Lưu draft
                </button>
              </div>
            </div>
            <div className="rounded-2xl bg-[var(--bg-app)] p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Preview content</p>
              {!preview.length ? (
                <div className="flex min-h-56 items-center justify-center text-center text-sm text-[var(--text-tertiary)]">Chọn listing, kênh rồi bấm “Xem preview”.</div>
              ) : (
                <div className="space-y-4">
                  {preview.map(item => (
                    <article key={item.platform} className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-surface)] p-4">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <h3 className="font-bold text-[var(--text-primary)]">{catalog.find(c => c.platform === item.platform)?.label || item.platform}</h3>
                        {item.link && <a href={item.link} target="_blank" rel="noreferrer" className="text-sgs-primary"><ExternalLink size={15} /></a>}
                      </div>
                      <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-6 text-[var(--text-secondary)]">{item.text}</pre>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-surface)] p-5 shadow-sm">
          <h2 className="mb-4 font-bold text-[var(--text-primary)]">Publication đã lưu</h2>
          {loading ? <p className="text-sm text-[var(--text-tertiary)]">Đang tải…</p> : !publications.length ? <p className="text-sm text-[var(--text-tertiary)]">Chưa có draft nào.</p> : (
            <div className="space-y-3">
              {publications.map(item => (
                <article key={item.id} className="rounded-2xl border border-[var(--glass-border)] p-4">
                  <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                    <div>
                      <p className="font-semibold text-[var(--text-primary)]">{String(item.contentSnapshot?.title || item.listingId)}</p>
                      <p className="mt-1 text-xs text-[var(--text-tertiary)]">Tạo {formatDate(item.createdAt)} · {item.publishMode === 'SCHEDULED' ? `Hẹn ${formatDate(item.scheduledAt)}` : 'Khi được duyệt'}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {item.targets.map(target => (
                            <span key={target.id} className="rounded-full bg-[var(--glass-surface)] px-2.5 py-1 text-xs text-[var(--text-secondary)]">
                              {target.platform} · {statusLabel[target.status] || target.status}
                              {target.providerRequestId ? ` · ${target.providerRequestId}` : ''}
                            </span>
                          ))}
                        </div>
                        {item.targets.some(target => target.lastErrorMessage) && (
                          <p className="mt-2 text-xs text-red-700">
                            {item.targets.find(target => target.lastErrorMessage)?.lastErrorMessage}
                          </p>
                        )}
                    </div>
                    <div className="flex gap-2">
                      {item.status === 'DRAFT' && <button disabled={busy} onClick={() => void activate(item.id)} className="rounded-lg bg-sgs-primary px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Kích hoạt</button>}
                      {['DRAFT', 'SCHEDULED', 'FAILED'].includes(item.status) && <button disabled={busy} onClick={() => void cancel(item.id)} className="rounded-lg border border-[var(--glass-border)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] disabled:opacity-50"><X size={14} /></button>}
                        <button
                          type="button"
                          disabled={detailLoading === item.id}
                          onClick={() => void toggleDetails(item.id)}
                          className="rounded-lg border border-[var(--glass-border)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] disabled:opacity-50"
                        >
                          {detailLoading === item.id ? 'Đang tải…' : expandedPublicationId === item.id ? 'Ẩn lịch sử' : 'Chi tiết & lịch sử'}
                        </button>
                    </div>
                  </div>
                    {expandedPublicationId === item.id && publicationDetails[item.id] && renderTargetDetails(publicationDetails[item.id])}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default SocialPublishing;