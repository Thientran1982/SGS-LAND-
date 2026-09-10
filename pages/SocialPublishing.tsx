import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowUpRight, Bot, CalendarClock, Check, Eye, ExternalLink, ImagePlus, PlugZap, RefreshCw, Send, Upload, X } from 'lucide-react';
import { ROUTES } from '../config/routes';
import { db } from '../services/dbApi';
import { listingApi } from '../services/api/listingApi';
import ListingDropdown, { SocialListingOption } from '../components/social-publishing/ListingDropdown';
import ProjectDropdown, { SocialProjectOption } from '../components/social-publishing/ProjectDropdown';
import { SocialImage } from '../components/social-publishing/SocialImage';
import { SelectDropdown } from '../components/task/SelectDropdown';
import {
  socialPublicationApi,
  SocialCapability,
  SocialPublication,
  SocialTarget,
  isSocialCapabilityReady,
} from '../services/api/socialPublicationApi';
import { useTranslation } from '../services/i18n';

const MAX_LISTING_IMAGES = 10;
const STALE_PUBLICATION_PAGE_SIZE = 25;

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

const normalizeRequestedPlatform = (value: string | null): string | null => {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  return ['INSTAGRAM', 'TIKTOK', 'LINKEDIN_PAGE'].includes(normalized) ? normalized : null;
};

function localizedSocialError(
  error: any,
  t: (key: string, params?: Record<string, string | number>) => string,
  fallbackKey: string,
): string {
  const raw = typeof error?.message === 'string' ? error.message.trim() : '';
  const normalized = raw.toLowerCase();
  const isInfrastructureError =
    !raw ||
    normalized.includes('operator does not exist') ||
    normalized.includes('uuid = character varying') ||
    normalized.includes('internal server error') ||
    normalized.includes('request failed: 500');
  return isInfrastructureError ? t(fallbackKey) : raw;
}

type SocialLoadWarnings = Partial<Record<'projects' | 'publications' | 'staleReport', string>>;

export const SocialPublishing: React.FC = () => {
  const { t } = useTranslation();
  const [catalog, setCatalog] = useState<SocialCapability[]>([]);
  const [listings, setListings] = useState<SocialListingOption[]>([]);
  const [projects, setProjects] = useState<SocialProjectOption[]>([]);
  const [publications, setPublications] = useState<SocialPublication[]>([]);
  const [stalePublications, setStalePublications] = useState<SocialPublication[]>([]);
  const [staleTotal, setStaleTotal] = useState(0);
  const [stalePage, setStalePage] = useState(1);
  const [staleCursor, setStaleCursor] = useState<string | null>(null);
  const [staleHasNext, setStaleHasNext] = useState(false);
  const [staleLoading, setStaleLoading] = useState(false);
  const [staleReportNeedsRefresh, setStaleReportNeedsRefresh] = useState(false);
  const [listingId, setListingId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [sourceType, setSourceType] = useState<'LISTING' | 'PROJECT'>('LISTING');
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [preview, setPreview] = useState<{ platform: string; title: string; text: string; imageUrls: string[]; link: string | null }[]>([]);
  const [caption, setCaption] = useState('');
  const [selectedImageUrls, setSelectedImageUrls] = useState<string[]>([]);
  const [uploadedImageUrls, setUploadedImageUrls] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [schedule, setSchedule] = useState<'NOW' | 'SCHEDULED'>('NOW');
  const [scheduledAt, setScheduledAt] = useState('');
  // Listing data is required for the default draft flow. Optional history
  // and project requests must not keep these controls disabled.
  const [loading, setLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [publicationsLoading, setPublicationsLoading] = useState(true);
  const [staleReportLoading, setStaleReportLoading] = useState(true);
  const [loadWarnings, setLoadWarnings] = useState<SocialLoadWarnings>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [expandedPublicationId, setExpandedPublicationId] = useState<string | null>(null);
  const [publicationDetails, setPublicationDetails] = useState<Record<string, SocialPublication>>({});
  const [detailLoading, setDetailLoading] = useState<string | null>(null);
  const [focusedPlatform] = useState(() => normalizeRequestedPlatform(new URLSearchParams(window.location.search).get('platform')));
  const [requestedListingId] = useState(() => new URLSearchParams(window.location.search).get('listingId'));
  const [requestedProjectId] = useState(() => new URLSearchParams(window.location.search).get('projectId'));
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
  const selectedProject = useMemo(
    () => projects.find(item => String(item.id) === projectId),
    [projects, projectId],
  );
  const selectedSourceId = sourceType === 'PROJECT' ? projectId : listingId;
  const selectedSource = sourceType === 'PROJECT' ? selectedProject : selectedListing;
  const imageCandidates = useMemo(
    () => Array.from(new Set([
      ...(selectedProject?.metadata?.coverImage ? [String(selectedProject.metadata.coverImage)] : []),
      ...(selectedProject?.metadata?.gallery && Array.isArray(selectedProject.metadata.gallery)
        ? selectedProject.metadata.gallery.map(String)
        : []),
      ...(selectedListing?.images || []),
      ...uploadedImageUrls,
    ])),
    [selectedListing, selectedProject, uploadedImageUrls],
  );
  const publisherCount = catalog.filter(item => item.hasPublisher).length;
  const readyCount = catalog.filter(item => isSocialCapabilityReady(item)).length;
  const facebookCapability = catalog.find(item => item.platform === 'FACEBOOK_PAGE');
  const maxFacebookImages = Math.min(
    facebookCapability?.maxImages ?? MAX_LISTING_IMAGES,
    MAX_LISTING_IMAGES,
  );
  const focusedCapability = focusedPlatform
    ? catalog.find(item => item.platform === focusedPlatform)
    : undefined;
  const autoDrafts = publications.filter(item => item.source === 'AUTO' && item.status === 'DRAFT');
  const manualPublications = publications.filter(item => item.source !== 'AUTO');
  const draftLoading = loading || catalogLoading || (sourceType === 'PROJECT' && projectsLoading);

  const mergeStalePublications = (
    current: SocialPublication[],
    incoming: SocialPublication[],
  ): SocialPublication[] => {
    const byId = new Map(current.map(item => [item.id, item]));
    incoming.forEach(item => byId.set(item.id, item));
    return [...byId.values()].sort((left, right) => {
      const createdAtDifference = new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      return createdAtDifference || right.id.localeCompare(left.id);
    });
  };

  useEffect(() => {
    const images = sourceType === 'PROJECT'
      ? imageCandidates
      : selectedListing?.images || [];
    setSelectedImageUrls(images.slice(0, MAX_LISTING_IMAGES).slice(0, maxFacebookImages));
  }, [imageCandidates, selectedListing, sourceType, maxFacebookImages]);

  const load = useCallback(async () => {
    setLoading(true);
    setCatalogLoading(true);
    setProjectsLoading(true);
    setPublicationsLoading(true);
    setStaleReportLoading(true);
    setLoadWarnings({});

    const catalogTask = (async () => {
      try {
        const catalogResult = await socialPublicationApi.getCatalog();
        setCatalog(catalogResult.data || []);
      } catch (error: any) {
        setCatalog([]);
        setMessage(current => current?.kind === 'error'
          ? current
          : { kind: 'error', text: localizedSocialError(error, t, 'social.error_provider') });
      } finally {
        setCatalogLoading(false);
      }
    })();

    const listingTask = (async () => {
      try {
        const listingResult = await listingApi.getListings(1, 100, {
          statuses: 'AVAILABLE,OPENING,BOOKING,BEST_MARKET',
          publicationEligible: 'true',
        });
        const listingData = listingResult.data || [];
        setListings(listingData);
        if (requestedListingId && listingData.some((item: SocialListingOption) => String(item.id) === requestedListingId)) {
          setListingId(requestedListingId);
        }
      } catch (error: any) {
        setListings([]);
        setMessage(current => current?.kind === 'error'
          ? current
          : { kind: 'error', text: localizedSocialError(error, t, 'social.error_load') });
      } finally {
        setLoading(false);
      }
    })();

    const projectsTask = (async () => {
      try {
        const projectResult = await db.getProjects(1, 100, { status: 'ACTIVE' });
        const projectData = projectResult?.data || [];
        setProjects(projectData);
        if (requestedProjectId && projectData.some((item: SocialProjectOption) => String(item.id) === requestedProjectId)) {
          setSourceType('PROJECT');
          setProjectId(requestedProjectId);
        }
      } catch (error: any) {
        setProjects([]);
        setLoadWarnings(current => ({
          ...current,
          projects: `Không tải được dữ liệu dự án: ${localizedSocialError(error, t, 'social.error_load')}`,
        }));
      } finally {
        setProjectsLoading(false);
      }
    })();

    const publicationsTask = (async () => {
      try {
        const publicationResult = await socialPublicationApi.getPublications({ limit: 200 });
        setPublications(publicationResult.data || []);
      } catch (error: any) {
        setPublications([]);
        setLoadWarnings(current => ({
          ...current,
          publications: `Không tải được lịch sử publication: ${localizedSocialError(error, t, 'common.error_loading')}`,
        }));
      } finally {
        setPublicationsLoading(false);
      }
    })();

    const staleReportTask = (async () => {
      try {
        const stalePublicationResult = await socialPublicationApi.getPublications({
          staleOnly: true,
          page: 1,
          pageSize: STALE_PUBLICATION_PAGE_SIZE,
        });
        const staleData = stalePublicationResult.data || [];
        const staleCount = Number.isFinite(stalePublicationResult.total)
          ? stalePublicationResult.total
          : staleData.length;
        const currentStalePage = stalePublicationResult.page || 1;
        const currentStalePageSize = stalePublicationResult.pageSize || STALE_PUBLICATION_PAGE_SIZE;
        setStalePublications(staleData);
        setStaleTotal(staleCount);
        setStalePage(currentStalePage);
        setStaleCursor(stalePublicationResult.nextCursor ?? null);
        setStaleHasNext(stalePublicationResult.hasNext ?? (
          currentStalePage * currentStalePageSize < staleCount
        ));
        setStaleReportNeedsRefresh(false);
      } catch (error: any) {
        setStalePublications([]);
        setStaleTotal(0);
        setStalePage(1);
        setStaleCursor(null);
        setStaleHasNext(false);
        setLoadWarnings(current => ({
          ...current,
          staleReport: `Không tải được báo cáo publication stale: ${localizedSocialError(error, t, 'common.error_loading')}`,
        }));
      } finally {
        setStaleReportLoading(false);
      }
    })();

    await Promise.all([catalogTask, listingTask, projectsTask, publicationsTask, staleReportTask]);
  }, [requestedListingId, requestedProjectId, t]);

  useEffect(() => { void load(); }, [load]);

  const loadMoreStalePublications = async () => {
    if (staleLoading || !staleHasNext) return;
    setStaleLoading(true);
    try {
      const nextPage = stalePage + 1;
      const result = await socialPublicationApi.getPublications({
        staleOnly: true,
        page: nextPage,
        pageSize: STALE_PUBLICATION_PAGE_SIZE,
        ...(staleCursor ? { cursor: staleCursor } : {}),
      });
      const nextRows = result.data || [];
      const nextTotal = Number.isFinite(result.total) ? result.total : staleTotal;
      // Keep the first page's count as the report snapshot. A publication
      // created after page one must appear after refresh, not shift this
      // operator's current review window.
      const reportTotal = staleTotal;
      if (nextTotal > staleTotal) {
        setStaleReportNeedsRefresh(true);
      }
      const currentPage = result.page || nextPage;
      const currentPageSize = result.pageSize || STALE_PUBLICATION_PAGE_SIZE;
      setStalePublications(current => mergeStalePublications(current, nextRows));
      setStaleTotal(reportTotal);
      setStalePage(currentPage);
      setStaleCursor(result.nextCursor ?? null);
      setStaleHasNext(result.nextCursor !== undefined
        ? Boolean(result.nextCursor) && currentPage * currentPageSize < reportTotal
        : result.hasNext ?? (currentPage * currentPageSize < reportTotal));
    } catch (error: any) {
      setMessage({ kind: 'error', text: localizedSocialError(error, t, 'common.error_loading') });
    } finally {
      setStaleLoading(false);
    }
  };

  const refreshStaleReport = async () => {
    if (staleLoading) return;
    setStaleLoading(true);
    try {
      const result = await socialPublicationApi.getPublications({
        staleOnly: true,
        page: 1,
        pageSize: STALE_PUBLICATION_PAGE_SIZE,
      });
      const refreshedRows = result.data || [];
      const refreshedTotal = Number.isFinite(result.total) ? result.total : refreshedRows.length;
      const refreshedPage = result.page || 1;
      const refreshedPageSize = result.pageSize || STALE_PUBLICATION_PAGE_SIZE;
      setStalePublications(current => mergeStalePublications(current, refreshedRows));
      setStaleTotal(current => Math.max(current, refreshedTotal));
      setStalePage(refreshedPage);
      setStaleCursor(result.nextCursor ?? null);
      setStaleHasNext(result.hasNext ?? (refreshedPage * refreshedPageSize < refreshedTotal));
      setStaleReportNeedsRefresh(false);
      setMessage({
        kind: 'ok',
        text: 'Đã tải lại báo cáo stale. Các publication đã hiển thị vẫn được giữ nguyên để tiếp tục rà soát.',
      });
    } catch (error: any) {
      setMessage({ kind: 'error', text: localizedSocialError(error, t, 'common.error_loading') });
    } finally {
      setStaleLoading(false);
    }
  };

  const togglePlatform = (platform: string) => {
    setPlatforms(current => current.includes(platform)
      ? current.filter(item => item !== platform)
      : [...current, platform]);
    setPreview([]);
  };

  const handleListingChange = (value: string) => {
    setSourceType('LISTING');
    setListingId(value);
    setCaption('');
    setPreview([]);
    setUploadedImageUrls([]);
  };

  const handleProjectChange = (value: string) => {
    setSourceType('PROJECT');
    setProjectId(value);
    setCaption('');
    setPreview([]);
    setUploadedImageUrls([]);
  };

  const handleSourceTypeChange = (value: string) => {
    const next = value === 'PROJECT' ? 'PROJECT' : 'LISTING';
    setSourceType(next);
    setCaption('');
    setPreview([]);
    setUploadedImageUrls([]);
    setSelectedImageUrls([]);
  };

  const toggleImage = (imageUrl: string) => {
    setSelectedImageUrls(current => {
      if (current.includes(imageUrl)) return current.filter(item => item !== imageUrl);
      if (current.length >= maxFacebookImages) return current;
      return [...current, imageUrl];
    });
    setPreview([]);
  };

  const uploadAdditionalImages = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    if (!selectedSource) {
      setMessage({ kind: 'error', text: `Chọn ${sourceType === 'PROJECT' ? 'dự án' : 'listing'} trước khi tải ảnh cho publication.` });
      return;
    }
    const remaining = maxFacebookImages - selectedImageUrls.length;
    if (remaining <= 0) {
      setMessage({ kind: 'error', text: `Đã chọn đủ ${maxFacebookImages} ảnh cho publication này.` });
      return;
    }
    const accepted = files.slice(0, remaining);
    setUploadingImages(true);
    setMessage(null);
    try {
      const result = await socialPublicationApi.uploadImages(accepted);
      const uploadedUrls = (result.files || []).map(file => file.url).filter(Boolean);
      if (!uploadedUrls.length) {
        throw new Error(result.warnings?.join(' ') || 'Không có ảnh hợp lệ được tải lên.');
      }
      setUploadedImageUrls(current => [...current, ...uploadedUrls]);
      setSelectedImageUrls(current => [...current, ...uploadedUrls].slice(0, maxFacebookImages));
      setPreview([]);
      setMessage({
        kind: 'ok',
        text: result.warnings?.length
          ? `Đã thêm ${uploadedUrls.length} ảnh. ${result.warnings.join(' ')}`
          : `Đã thêm ${uploadedUrls.length} ảnh vào publication draft.`,
      });
    } catch (error: any) {
      setMessage({ kind: 'error', text: error?.message || 'Tải ảnh thất bại. Vui lòng thử lại.' });
    } finally {
      setUploadingImages(false);
    }
  };

  const runPreview = async () => {
    if (!selectedSourceId || !platforms.length) {
      setMessage({ kind: 'error', text: `Chọn một ${sourceType === 'PROJECT' ? 'dự án' : 'sản phẩm'} và ít nhất một nền tảng.` });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const result = await socialPublicationApi.preview(selectedSourceId, platforms, selectedImageUrls, caption, sourceType);
      setPreview(result.previews || []);
      if (!caption.trim() && result.previews?.[0]?.text) {
        setCaption(result.previews[0].text);
      }
    } catch (error: any) {
      setMessage({ kind: 'error', text: localizedSocialError(error, t, 'social.error_preview') });
    } finally {
      setBusy(false);
    }
  };

  const saveDraft = async () => {
    if (!selectedSourceId || !platforms.length) {
      setMessage({ kind: 'error', text: `Chọn ${sourceType === 'PROJECT' ? 'dự án' : 'sản phẩm'} và nền tảng trước khi lưu.` });
      return;
    }
    if (schedule === 'SCHEDULED' && !scheduledAt) {
      setMessage({ kind: 'error', text: 'Chọn thời điểm hẹn đăng.' });
      return;
    }
    if (!caption.trim()) {
      setMessage({ kind: 'error', text: 'Nhập caption trước khi lưu bản nháp.' });
      return;
    }
    const imageRequiredPlatforms = platforms.filter(platform => (
      platform === 'FACEBOOK_PAGE' || platform === 'ZALO_BROADCAST'
    ));
    if (imageRequiredPlatforms.length && !selectedImageUrls.length) {
      setMessage({ kind: 'error', text: `${imageRequiredPlatforms.join(', ')} cần ít nhất một ảnh HTTPS công khai đã chọn.` });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await socialPublicationApi.createDraft({
        ...(sourceType === 'PROJECT' ? { projectId } : { listingId }),
        platforms,
        publishMode: schedule,
        scheduledAt: schedule === 'SCHEDULED' ? new Date(scheduledAt).toISOString() : null,
        caption,
        imageUrls: selectedImageUrls,
      });
      setMessage({ kind: 'ok', text: 'Đã lưu snapshot bất biến vào bản nháp. Chưa có nền tảng nào được báo là đã đăng.' });
      await load();
    } catch (error: any) {
      setMessage({ kind: 'error', text: localizedSocialError(error, t, 'social.error_save') });
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
      const isPublisherNotReady = error?.status === 409 && error?.code === 'PUBLISHERS_NOT_READY';
      const apiReason = typeof error?.data?.reason === 'string' ? error.data.reason.trim() : '';
      const targetReasons = isPublisherNotReady && Array.isArray(error?.data?.targets)
        ? error.data.targets
          .map((target: unknown) => {
            if (typeof target === 'string') return catalog.find(item => item.platform === target)?.reason;
            if (target && typeof target === 'object') {
              const platform = String((target as any).platform || '');
              const reason = typeof (target as any).reason === 'string' ? (target as any).reason : '';
              return reason || catalog.find(item => item.platform === platform)?.reason;
            }
            return '';
          })
          .filter((reason: unknown): reason is string => Boolean(reason))
        : [];
      const text = isPublisherNotReady
        ? apiReason || targetReasons.join(' ') || error?.message || 'Publisher chưa sẵn sàng'
        : localizedSocialError(error, t, 'social.error_provider');
      const requestId = typeof error?.data?.requestId === 'string' ? error.data.requestId : '';
      setMessage({
        kind: 'error',
        text: requestId ? `${text} Mã yêu cầu: ${requestId}` : text,
      });
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
      const code = typeof error?.code === 'string'
        ? error.code
        : typeof error?.data?.code === 'string' ? error.data.code : '';
      setMessage({
        kind: 'error',
        text: code === 'TARGET_STATE_CONFLICT'
          ? `${error?.message || 'Target đã được operator khác xử lý.'} [${code}]`
          : error?.message || 'Không thể cập nhật target',
      });
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

  const getPublicationLink = (publication: SocialPublication): string | null => (
    typeof publication.contentSnapshot?.publicUrl === 'string'
      ? publication.contentSnapshot.publicUrl
      : null
  );

  const getPublicationSourceLabel = (publication: SocialPublication): string => (
    publication.sourceType === 'PROJECT' || publication.projectId ? 'Dự án' : 'Sản phẩm'
  );

  const getPublicationSourceId = (publication: SocialPublication): string => (
    (publication.sourceType === 'PROJECT' || publication.projectId)
      ? String(publication.projectId || '—')
      : String(publication.listingId || '—')
  );

  const getListingReviewMessage = (publication: SocialPublication): string => {
    if (publication.projectId || publication.sourceType === 'PROJECT') {
      if (publication.projectReview?.reason === 'PROJECT_NOT_FOUND') {
        return 'Dự án không còn tồn tại trong tenant hiện tại.';
      }
      const status = publication.projectReview?.projectStatus || 'không xác định';
      return `Dự án hiện ở trạng thái ${status}, không còn đủ điều kiện xuất bản công khai.`;
    }
    if (publication.listingReview?.reason === 'LISTING_NOT_FOUND') {
      return 'Listing không còn tồn tại trong tenant hiện tại.';
    }
    const status = publication.listingReview?.listingStatus || 'không xác định';
    return `Listing hiện ở trạng thái ${status}, không còn đủ điều kiện xuất bản công khai.`;
  };

  return (
    <div className="min-h-full bg-[var(--bg-app)] p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-sgs-primary">Marketing operations</p>
            <h1 className="mt-2 text-3xl font-bold text-[var(--text-primary)]">Xuất bản sản phẩm công khai</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
              Preview và lưu kế hoạch xuất bản từ snapshot của sản phẩm hoặc dự án. Tin nhắn customer-service và gửi sản phẩm trực tiếp cho lead qua Zalo nằm riêng trong Inbox, không phải bài đăng công khai.
            </p>
          </div>
          <button onClick={() => void load()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--glass-border)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--glass-surface-hover)]">
            <RefreshCw size={16} /> Kiểm tra lại kết nối
          </button>
        </div>

        {message && (
          <div className={`flex items-start gap-3 rounded-2xl border p-4 text-sm ${message.kind === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
            {message.kind === 'error' ? <AlertTriangle size={18} /> : <Check size={18} />}
            <span>{message.text}</span>
          </div>
        )}

        <section
          aria-labelledby="social-connection-catalog-title"
          className="rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-surface)] p-5 shadow-sm"
        >
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div>
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-indigo-500/10 p-2 text-indigo-600"><PlugZap size={20} /></div>
                <div>
                  <h2 id="social-connection-catalog-title" className="font-bold text-[var(--text-primary)]">Cổng kết nối nền tảng</h2>
                  <p className="text-xs text-[var(--text-tertiary)]">Thêm API connector hoặc MCP server ở khu vực quản trị tương ứng.</p>
                </div>
              </div>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
                Kết nối được quản lý riêng khỏi nội dung xuất bản. Không nhập API key hoặc token trực tiếp vào publication draft.
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-[var(--glass-surface)] px-2.5 py-1 text-[var(--text-secondary)]">
                  Publisher đã tích hợp: {publisherCount}/{catalog.length}
                </span>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
                  Đã xác minh sẵn sàng: {readyCount}/{catalog.length}
                </span>
              </div>
              {focusedCapability && (
                <p role="status" className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-800">
                  Đang kiểm tra readiness của {focusedCapability.label}: {focusedCapability.status === 'UNSUPPORTED' ? 'provider chưa được hỗ trợ và đang bị khóa.' : focusedCapability.reason}
                </p>
              )}
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <a
              href={`/${ROUTES.DATA_PLATFORM}`}
              className="group flex items-start gap-3 rounded-2xl border border-[var(--glass-border)] p-4 transition-colors hover:border-sgs-primary hover:bg-sgs-primary/5"
            >
              <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-700"><PlugZap size={18} /></div>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
                  Thêm API / connector <ArrowUpRight size={15} className="text-[var(--text-tertiary)] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </span>
                <span className="mt-1 block text-xs leading-5 text-[var(--text-tertiary)]">Quản lý Google Sheets, CRM và webhook export theo tenant.</span>
              </span>
            </a>
            <a
              href={`/${ROUTES.AGENT_TASKS}?tab=mcp`}
              className="group flex items-start gap-3 rounded-2xl border border-[var(--glass-border)] p-4 transition-colors hover:border-indigo-500 hover:bg-indigo-500/5"
            >
              <div className="rounded-xl bg-indigo-500/10 p-2 text-indigo-600"><Bot size={18} /></div>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
                  Thêm MCP server <ArrowUpRight size={15} className="text-[var(--text-tertiary)] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </span>
                <span className="mt-1 block text-xs leading-5 text-[var(--text-tertiary)]">Đăng ký server và kiểm tra tool để Agent dùng trong workflow.</span>
              </span>
            </a>
          </div>
        </section>

        <section className="rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-surface)] p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-xl bg-sgs-primary/10 p-2 text-sgs-primary"><Send size={20} /></div>
            <div>
              <h2 className="font-bold text-[var(--text-primary)]">Tạo publication draft</h2>
              <p className="text-xs text-[var(--text-tertiary)]">Chưa gửi gì ra provider ở bước này.</p>
            </div>
          </div>
           <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
             <div className="min-w-0 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-[var(--text-primary)]">Nguồn nội dung</span>
                <SelectDropdown
                  value={sourceType}
                  onChange={handleSourceTypeChange}
                  options={[
                    { value: 'LISTING', label: 'Sản phẩm' },
                    { value: 'PROJECT', label: 'Dự án' },
                  ]}
                  disabled={loading}
                  ariaLabel="Chọn nguồn nội dung"
                  placeholder="Chọn nguồn nội dung"
                  height={48}
                  surface="primary"
                />
              </label>
              {loadWarnings.projects && (
                <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                  {loadWarnings.projects} Bạn vẫn có thể sử dụng nguồn sản phẩm trong lúc dữ liệu dự án được khôi phục.
                </p>
              )}
              {sourceType === 'LISTING' ? (
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-[var(--text-primary)]">Sản phẩm</span>
                  <ListingDropdown
                    listings={listings}
                    value={listingId}
                    disabled={loading}
                    onChange={handleListingChange}
                  />
                  <p className="mt-1.5 text-[11px] leading-5 text-[var(--text-tertiary)]">
                    Lấy từ kho listing của tenant hiện tại; chỉ hiển thị sản phẩm đang đủ điều kiện xuất bản.
                  </p>
                  {!loading && !listings.length && (
                    <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                      Chưa có listing đủ điều kiện xuất bản. Kiểm tra listing có trạng thái Sẵn sàng/Đang mở bán/Đang giữ chỗ và thử “Kiểm tra lại kết nối”.
                    </p>
                  )}
                  {!loading && requestedListingId && !listings.some(item => String(item.id) === requestedListingId) && (
                    <p role="alert" className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-800">
                      Liên kết đang trỏ tới listingId “{requestedListingId}”, nhưng listing này không còn trong danh sách đủ điều kiện xuất bản.
                    </p>
                  )}
                  {selectedListing && (
                     <div className="mt-3 flex min-w-0 items-center gap-3 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-app)] p-3">
                      {selectedListing.images?.[0] ? (
                         <SocialImage src={selectedListing.images[0]} alt="" className="h-12 w-16 flex-shrink-0 rounded-lg object-cover" />
                      ) : (
                        <div className="flex h-12 w-16 items-center justify-center rounded-lg bg-[var(--glass-surface)] px-1 text-center text-[10px] text-[var(--text-tertiary)]">Chưa có ảnh</div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{selectedListing.title || selectedListing.id}</p>
                        <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">{selectedListing.code || 'Không có mã'} · {selectedListing.status || 'Sẵn sàng'} · {selectedListing.images?.length || 0} ảnh · Đủ điều kiện public</p>
                        {!selectedListing.images?.length && (
                          <p className="mt-1 text-[11px] leading-4 text-amber-700">Listing chưa có ảnh trong gallery. Có thể dùng “Tải thêm ảnh” ở phần preview.</p>
                        )}
                      </div>
                    </div>
                  )}
                </label>
              ) : (
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-[var(--text-primary)]">Dự án</span>
                  <ProjectDropdown
                    projects={projects}
                    value={projectId}
                    disabled={projectsLoading}
                    onChange={handleProjectChange}
                  />
                  <p className="mt-1.5 text-[11px] leading-5 text-[var(--text-tertiary)]">
                    Tái sử dụng API quản lý dự án; chỉ hiển thị dự án có trạng thái ACTIVE (đang mở bán).
                  </p>
                  {!projectsLoading && !loadWarnings.projects && !projects.length ? (
                    <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                      Chưa có dự án đang mở bán đủ điều kiện xuất bản.
                    </p>
                  ) : null}
                  {!projectsLoading && !loadWarnings.projects && requestedProjectId && !projects.some(item => String(item.id) === requestedProjectId) && (
                    <p role="alert" className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-800">
                      Dự án được yêu cầu không còn ở trạng thái đủ điều kiện xuất bản.
                    </p>
                  )}
                  {selectedProject && (
                     <div className="mt-3 flex min-w-0 items-center gap-3 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-app)] p-3">
                      {imageCandidates[0] ? (
                         <SocialImage src={imageCandidates[0]} alt="" className="h-12 w-16 flex-shrink-0 rounded-lg object-cover" />
                      ) : (
                        <div className="flex h-12 w-16 items-center justify-center rounded-lg bg-[var(--glass-surface)] px-1 text-center text-[10px] text-[var(--text-tertiary)]">Chưa có ảnh</div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{selectedProject.name || selectedProject.id}</p>
                        <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">{selectedProject.code || 'Không có mã'} · Đang mở bán · {imageCandidates.length} ảnh</p>
                        {!imageCandidates.length && (
                          <p className="mt-1 text-[11px] leading-4 text-amber-700">Dự án chưa có ảnh đại diện/gallery. Có thể dùng “Tải thêm ảnh” ở phần preview.</p>
                        )}
                      </div>
                    </div>
                  )}
                </label>
              )}
              <div>
                <span className="mb-2 block text-sm font-semibold text-[var(--text-primary)]">Nền tảng đích</span>
                <div className="space-y-2">
                  {catalogLoading ? (
                    <p role="status" className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)] px-3 py-3 text-xs leading-5 text-[var(--text-tertiary)]">
                      Đang tải danh sách nền tảng…
                    </p>
                  ) : catalog.length === 0 ? (
                    <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs leading-5 text-amber-800">
                      {t('social.platforms_empty')}
                    </p>
                  ) : null}
                  {catalog.map(item => {
                    const isReady = isSocialCapabilityReady(item);
                    // Draft composition is intentionally available for every
                    // catalogued platform. Provider readiness is enforced
                    // when the operator activates a publication, not while
                    // they are preparing a multi-platform draft.
                    const canCompose = true;
                    const isFocused = item.platform === focusedPlatform;
                    const statusText = item.status === 'UNSUPPORTED'
                      ? 'Không hỗ trợ'
                      : isReady
                        ? 'Sẵn sàng'
                        : 'Chưa sẵn sàng';
                    return (
                     <label
                      key={item.platform}
                      data-social-platform={item.platform}
                       className={`flex min-w-0 items-start gap-3 rounded-xl border p-3 ${canCompose ? 'cursor-pointer' : 'cursor-not-allowed opacity-75'} ${platforms.includes(item.platform) ? 'border-sgs-primary bg-sgs-primary/5' : 'border-[var(--glass-border)]'} ${isFocused ? 'ring-2 ring-indigo-400 ring-offset-1' : ''}`}
                    >
                      <input type="checkbox" checked={platforms.includes(item.platform)} disabled={!canCompose} onChange={() => togglePlatform(item.platform)} className="mt-1 accent-[var(--sgs-primary)] disabled:cursor-not-allowed" />
                      <span className="min-w-0 flex-1">
                         <span className="flex min-w-0 flex-wrap items-start justify-between gap-2 text-sm font-semibold text-[var(--text-primary)]">
                           <span className="min-w-0 break-words">{item.label}</span>
                            <span className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] ${isReady ? 'bg-emerald-100 text-emerald-700' : item.status === 'UNSUPPORTED' ? 'bg-slate-100 text-slate-700' : 'bg-amber-100 text-amber-700'}`}>{statusText}</span>
                        </span>
                         <span className={`mt-1 block text-[10px] font-semibold ${item.hasPublisher ? 'text-indigo-700' : 'text-[var(--text-tertiary)]'}`}>
                           {item.hasPublisher ? 'Đã có publisher provider' : 'Chưa có publisher provider'}
                         </span>
                        {!!item.maxImages && <span className="mt-1 block text-[10px] font-semibold text-[var(--text-secondary)]">Tối đa {item.maxImages} ảnh mỗi bài</span>}
                        <span className="mt-1 block text-xs leading-5 text-[var(--text-tertiary)]">{item.reason}</span>
                         {!item.canPublish && canCompose && <span className="mt-1 block text-xs font-semibold text-amber-700">Có thể soạn preview/lưu draft; đăng thật cần xác minh publisher và quyền provider.</span>}
                      </span>
                    </label>
                    );
                  })}
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
                <button disabled={busy || draftLoading} onClick={() => void runPreview()} className="inline-flex items-center gap-2 rounded-xl border border-[var(--glass-border)] px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] disabled:opacity-50">
                  <Eye size={16} /> Xem preview
                </button>
                <button disabled={busy || draftLoading} onClick={() => void saveDraft()} className="inline-flex items-center gap-2 rounded-xl bg-sgs-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-50">
                  <CalendarClock size={16} /> Lưu draft
                </button>
              </div>
            </div>
             <div className="min-w-0 overflow-hidden rounded-2xl bg-[var(--bg-app)] p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Preview content</p>
                {!!selectedImageUrls.length && <span className="text-xs text-[var(--text-tertiary)]">{selectedImageUrls.length}/{maxFacebookImages} ảnh đã chọn</span>}
              </div>
                {selectedSource ? (
                  <div className="mb-4 min-w-0 overflow-hidden rounded-xl border border-[var(--glass-border)] bg-[var(--bg-surface)] p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                     <p className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]"><ImagePlus size={16} /> Ảnh bài đăng</p>
                     <p className="text-xs text-[var(--text-tertiary)]">{selectedImageUrls.length}/{maxFacebookImages} ảnh đã chọn</p>
                  </div>
                   {!imageCandidates.length ? (
                     <p className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                        {sourceType === 'PROJECT' ? 'Dự án chưa có ảnh. Hãy tải ảnh lên bên dưới để tạo bài Facebook.' : 'Listing chưa có ảnh. Hãy tải ảnh lên bên dưới để tạo bài Facebook.'}
                     </p>
                  ) : (
                     <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
                       {imageCandidates.map((imageUrl, index) => {
                        const selected = selectedImageUrls.includes(imageUrl);
                        const selectionLimitReached = !selected && selectedImageUrls.length >= maxFacebookImages;
                        return (
                           <label key={`${imageUrl}-${index}`} className={`relative min-w-0 cursor-pointer overflow-hidden rounded-lg border-2 ${selected ? 'border-sgs-primary' : 'border-transparent'}`}>
                               <SocialImage src={imageUrl} alt={`Ảnh ${index + 1} của ${sourceType === 'PROJECT' ? selectedProject?.name || 'dự án' : selectedListing?.title || 'listing'}`} className="aspect-square w-full object-cover" />
                            <span className="absolute left-1 top-1 rounded bg-white/90 px-1.5 py-1 text-[10px] font-semibold text-[var(--text-primary)]">
                              <input type="checkbox" checked={selected} disabled={selectionLimitReached} onChange={() => toggleImage(imageUrl)} className="mr-1 accent-[var(--sgs-primary)] disabled:opacity-50" />
                              {selected ? 'Đã chọn' : 'Chọn'}
                            </span>
                            {selected && selectedImageUrls[0] === imageUrl && <span className="absolute bottom-1 left-1 rounded bg-sgs-primary px-1.5 py-0.5 text-[10px] font-bold text-white">Đại diện</span>}
                          </label>
                        );
                      })}
                    </div>
                  )}
                   <label className={`mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-xs font-semibold transition-colors ${uploadingImages || selectedImageUrls.length >= maxFacebookImages ? 'cursor-not-allowed border-[var(--glass-border)] text-[var(--text-tertiary)] opacity-60' : 'border-sgs-primary/50 text-sgs-primary hover:bg-sgs-primary/5'}`}>
                     <Upload size={15} />
                     {uploadingImages ? 'Đang tải ảnh…' : 'Tải thêm ảnh'}
                     <input
                       type="file"
                       accept="image/jpeg,image/png,image/webp,image/gif"
                       multiple
                       disabled={uploadingImages || selectedImageUrls.length >= maxFacebookImages}
                       onChange={event => void uploadAdditionalImages(event)}
                       className="sr-only"
                     />
                   </label>
                   <p className="mt-2 text-[11px] leading-5 text-[var(--text-tertiary)]">
                      Ảnh nguồn và ảnh tải thêm đều chỉ được lưu vào publication draft, không tự thay đổi gallery gốc. Tối đa {maxFacebookImages} ảnh, mỗi ảnh 10MB.
                   </p>
                </div>
               ) : (
                 <div className="mb-4 rounded-xl border border-dashed border-[var(--glass-border)] bg-[var(--bg-surface)] p-4 text-center text-xs leading-5 text-[var(--text-tertiary)]">
                    Chọn sản phẩm hoặc dự án để hiển thị ảnh bài đăng và bật thao tác tải thêm ảnh.
                 </div>
               )}
               <label className="mb-4 block min-w-0">
                <span className="mb-2 block text-sm font-semibold text-[var(--text-primary)]">Caption đã duyệt</span>
                <textarea
                  value={caption}
                  onChange={event => {
                    setCaption(event.target.value);
                    setPreview(current => current.map(item => ({ ...item, text: event.target.value })));
                  }}
                  rows={8}
                  maxLength={63206}
                  placeholder="Bấm “Xem preview” để tạo caption, sau đó chỉnh sửa nội dung trước khi lưu."
                  className="w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-surface)] px-3 py-3 text-sm leading-6 text-[var(--text-primary)] outline-none focus:border-sgs-primary"
                />
                <span className="mt-1 block text-right text-xs text-[var(--text-tertiary)]">{caption.length.toLocaleString('vi-VN')}/63.206 ký tự</span>
              </label>
               {!preview.length ? (
                <div className="flex min-h-56 flex-col items-center justify-center gap-2 px-6 text-center text-sm text-[var(--text-tertiary)]">
                  <Eye size={22} className="text-[var(--text-tertiary)]" />
                   <p>Chọn sản phẩm hoặc dự án, kênh và ảnh, rồi bấm “Xem preview”.</p>
                  <p className="text-xs">Nếu Facebook chưa READY, bạn vẫn có thể soạn và lưu draft; chỉ thao tác đăng thật mới bị khóa.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {preview.map(item => (
                     <article key={item.platform} className="min-w-0 overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-surface)] p-4">
                       <div className="mb-2 flex min-w-0 items-start justify-between gap-2">
                         <h3 className="min-w-0 break-words font-bold text-[var(--text-primary)]">{catalog.find(c => c.platform === item.platform)?.label || item.platform}</h3>
                        {item.link && <a href={item.link} target="_blank" rel="noreferrer" className="text-sgs-primary"><ExternalLink size={15} /></a>}
                      </div>
                        {((item.imageUrls?.length ? item.imageUrls : selectedImageUrls).length > 0) ? (
                         <div className="mb-3 overflow-hidden rounded-xl border border-[var(--glass-border)] bg-[var(--bg-app)]">
                            <SocialImage
                              src={(item.imageUrls?.length ? item.imageUrls : selectedImageUrls)[0]}
                             alt={`Ảnh preview ${catalog.find(c => c.platform === item.platform)?.label || item.platform}`}
                             className="aspect-[16/9] w-full object-cover"
                           />
                            {(item.imageUrls?.length ? item.imageUrls : selectedImageUrls).length > 1 && (
                             <div className="grid grid-cols-4 gap-1 p-1">
                                {(item.imageUrls?.length ? item.imageUrls : selectedImageUrls).slice(1, 5).map((imageUrl, index) => (
                                  <SocialImage
                                   key={`${imageUrl}-${index}`}
                                    src={imageUrl}
                                   alt={`Ảnh ${index + 2}`}
                                   className="aspect-square w-full rounded-md object-cover"
                                 />
                               ))}
                             </div>
                           )}
                         </div>
                       ) : item.platform === 'FACEBOOK_PAGE' ? (
                         <div className="mb-3 rounded-xl border border-dashed border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
                           Chưa có ảnh HTTPS công khai trong preview Facebook.
                         </div>
                       ) : null}
                       <pre className="min-w-0 max-w-full whitespace-pre-wrap break-words font-sans text-sm leading-6 text-[var(--text-secondary)]">{caption || item.text}</pre>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <section
          aria-labelledby="stale-publication-links-title"
          className="rounded-3xl border border-red-200 bg-red-50/60 p-5 shadow-sm"
        >
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-red-100 p-2 text-red-700"><AlertTriangle size={20} /></div>
                <div>
                  <h2 id="stale-publication-links-title" className="font-bold text-[var(--text-primary)]">Rà soát liên kết publication cũ</h2>
              <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                    Các publication dưới đây đang chứa sản phẩm hoặc dự án không còn đủ điều kiện xuất bản. Báo cáo chỉ đọc: không tự xóa, sửa hoặc đăng lại nội dung.
                  </p>
                </div>
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-800">
              {staleTotal} cần rà soát
            </span>
          </div>
          {!loading && staleTotal > 0 && (
            <p className="mt-3 text-xs font-medium text-red-800" aria-live="polite">
              Đang xem {stalePublications.length} / {staleTotal} liên kết cần rà soát
            </p>
          )}
          {loadWarnings.staleReport && (
            <p role="status" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs leading-5 text-amber-800">
              {loadWarnings.staleReport} Báo cáo này không làm gián đoạn việc soạn hoặc lưu draft.
            </p>
          )}
          {staleReportNeedsRefresh && (
            <div
              role="status"
              aria-live="polite"
              className="mt-3 flex flex-col items-start justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 sm:flex-row sm:items-center"
            >
              <p className="max-w-3xl leading-5">
                Báo cáo đang giữ snapshot của phiên rà soát hiện tại. Có publication stale mới; dữ liệu mới sẽ xuất hiện sau khi tải lại. Các dòng đang hiển thị vẫn được giữ nguyên.
              </p>
              <button
                type="button"
                onClick={() => void refreshStaleReport()}
                disabled={staleLoading}
                className="shrink-0 rounded-lg border border-amber-400 bg-[var(--bg-surface)] px-3 py-2 text-xs font-bold text-amber-900 disabled:opacity-50"
              >
                {staleLoading ? 'Đang tải lại…' : 'Tải lại báo cáo stale'}
              </button>
            </div>
          )}
          {staleReportLoading ? (
            <p className="mt-4 text-sm text-[var(--text-tertiary)]">Đang tải báo cáo…</p>
          ) : loadWarnings.staleReport ? null : !stalePublications.length ? (
            <p className="mt-4 rounded-2xl border border-dashed border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              Không phát hiện liên kết publication nào cần rà soát trong tenant này.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {stalePublications.map(item => {
                const publicationLink = getPublicationLink(item);
                const providerLinks = item.targets
                  .map(target => target.providerPostUrl)
                  .filter((url): url is string => Boolean(url));
                return (
                  <article key={item.id} className="rounded-2xl border border-red-200 bg-[var(--bg-surface)] p-4">
                    <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-[var(--text-primary)]">
                            {String(item.contentSnapshot?.title || item.projectId || item.listingId)}
                          </p>
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800">CẦN RÀ SOÁT</span>
                        </div>
                        <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                           <span className="font-semibold">{getPublicationSourceLabel(item)} ID:</span> <span className="font-mono">{getPublicationSourceId(item)}</span> · Tạo {formatDate(item.createdAt)}
                        </p>
                        <p className="mt-2 text-xs font-semibold text-red-700">{getListingReviewMessage(item)}</p>
                        <div className="mt-2 space-y-1 text-xs text-[var(--text-secondary)]">
                          <p className="font-semibold">Liên kết cần rà soát:</p>
                          {publicationLink ? (
                            <a
                              href={publicationLink}
                              target="_blank"
                              rel="noreferrer"
                              className="block break-all text-sgs-primary underline"
                            >
                              {publicationLink}
                            </a>
                          ) : (
                             <p className="text-[var(--text-tertiary)]">Snapshot không lưu public URL; dùng ID nguồn để tìm và cập nhật liên kết.</p>
                          )}
                          {!!providerLinks.length && (
                            <p className="break-all text-[var(--text-tertiary)]">
                              Link provider đang lưu: {providerLinks.join(' · ')}
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={detailLoading === item.id}
                        onClick={() => void toggleDetails(item.id)}
                        className="shrink-0 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50"
                      >
                        {detailLoading === item.id ? 'Đang tải…' : expandedPublicationId === item.id ? 'Ẩn publication' : 'Mở publication'}
                      </button>
                    </div>
                    {expandedPublicationId === item.id && publicationDetails[item.id] && renderTargetDetails(publicationDetails[item.id])}
                  </article>
                );
              })}
              <div className="flex flex-col items-start justify-between gap-3 border-t border-red-200 pt-4 sm:flex-row sm:items-center">
                <p className="text-xs text-[var(--text-secondary)]" aria-live="polite">
                  {staleHasNext
                    ? `Đã tải ${stalePublications.length} / ${staleTotal}. Còn kết quả chưa hiển thị.`
                    : `Đã tải toàn bộ ${staleTotal} kết quả stale-only.`}
                </p>
                {staleHasNext && (
                  <button
                    type="button"
                    onClick={() => void loadMoreStalePublications()}
                    disabled={staleLoading}
                    className="rounded-lg border border-red-200 bg-[var(--bg-surface)] px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50"
                  >
                    {staleLoading ? 'Đang tải thêm…' : 'Tải thêm liên kết cũ'}
                  </button>
                )}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm">
          <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-amber-100 p-2 text-amber-700"><Bot size={20} /></div>
                <div>
                  <h2 className="font-bold text-[var(--text-primary)]">Bài chờ duyệt</h2>
                  <p className="text-xs text-[var(--text-tertiary)]">Bản nháp AUTO được selector tạo. Chưa bài nào được đăng cho tới khi admin bấm “Đăng ngay”.</p>
                </div>
              </div>
            </div>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">{autoDrafts.length} bản nháp</span>
          </div>
          {!autoDrafts.length ? (
            <p className="rounded-2xl border border-dashed border-amber-200 bg-[var(--bg-surface)] p-4 text-sm text-[var(--text-tertiary)]">Chưa có bản nháp tự động nào chờ duyệt.</p>
          ) : (
            <div className="space-y-3">
              {autoDrafts.map(item => (
                <article key={item.id} className="rounded-2xl border border-amber-200 bg-[var(--bg-surface)] p-4">
                  <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-[var(--text-primary)]">{String(item.contentSnapshot?.title || item.projectId || item.listingId)}</p>
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800">
                          Nguồn: {getPublicationSourceLabel(item)}
                        </span>
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">AUTO / DRAFT</span>
                      </div>
                      <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                        {getPublicationSourceLabel(item)} ID: <span className="font-mono">{getPublicationSourceId(item)}</span> · Tạo {formatDate(item.createdAt)} · Chờ admin kiểm tra
                      </p>
                      <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-xs leading-5 text-[var(--text-secondary)]">{String(item.contentSnapshot?.caption || `Caption tự động từ snapshot ${getPublicationSourceLabel(item).toLowerCase()}.`)}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {item.targets.map(target => (
                          <span key={target.id} className="rounded-full bg-[var(--glass-surface)] px-2.5 py-1 text-xs text-[var(--text-secondary)]">
                            {target.platform} · {statusLabel[target.status] || target.status}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button disabled={busy} onClick={() => void activate(item.id)} className="rounded-lg bg-sgs-primary px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Đăng ngay</button>
                      <button disabled={busy} onClick={() => void cancel(item.id)} className="rounded-lg border border-[var(--glass-border)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] disabled:opacity-50"><X size={14} /></button>
                      <button type="button" disabled={detailLoading === item.id} onClick={() => void toggleDetails(item.id)} className="rounded-lg border border-[var(--glass-border)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] disabled:opacity-50">
                        {detailLoading === item.id ? 'Đang tải…' : expandedPublicationId === item.id ? 'Ẩn' : 'Chi tiết'}
                      </button>
                    </div>
                  </div>
                  {expandedPublicationId === item.id && publicationDetails[item.id] && renderTargetDetails(publicationDetails[item.id])}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-surface)] p-5 shadow-sm">
          <h2 className="mb-4 font-bold text-[var(--text-primary)]">Publication đã lưu</h2>
          {loadWarnings.publications && (
            <p role="status" className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs leading-5 text-amber-800">
              {loadWarnings.publications} Các thao tác soạn và lưu draft mới vẫn khả dụng.
            </p>
          )}
          {publicationsLoading ? <p className="text-sm text-[var(--text-tertiary)]">Đang tải…</p> : loadWarnings.publications ? null : !manualPublications.length ? <p className="text-sm text-[var(--text-tertiary)]">Chưa có publication thủ công nào.</p> : (
            <div className="space-y-3">
              {manualPublications.map(item => (
                <article key={item.id} className="rounded-2xl border border-[var(--glass-border)] p-4">
                  <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-[var(--text-primary)]">{String(item.contentSnapshot?.title || item.projectId || item.listingId)}</p>
                          <span className="rounded-full bg-[var(--glass-surface)] px-2.5 py-0.5 text-[10px] font-bold text-[var(--text-secondary)]">
                            Nguồn: {getPublicationSourceLabel(item)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                          {getPublicationSourceLabel(item)} ID: <span className="font-mono">{getPublicationSourceId(item)}</span>
                        </p>
                      <p className="mt-1 text-xs text-[var(--text-tertiary)]">Tạo {formatDate(item.createdAt)} · {item.publishMode === 'SCHEDULED' ? `Hẹn ${formatDate(item.scheduledAt)}` : 'Khi được duyệt'}</p>
                        <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-xs leading-5 text-[var(--text-secondary)]">
                          {String(item.contentSnapshot?.caption || `Caption tự động từ snapshot ${getPublicationSourceLabel(item).toLowerCase()}.`)}
                        </p>
                        <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                          Ảnh đã duyệt: {Array.isArray(item.assetSnapshot) ? item.assetSnapshot.length : 0}
                        </p>
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
                      {item.status === 'DRAFT' && <button disabled={busy} onClick={() => void activate(item.id)} className="rounded-lg bg-sgs-primary px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Đăng ngay</button>}
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