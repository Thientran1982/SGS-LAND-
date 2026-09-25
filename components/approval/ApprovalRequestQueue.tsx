import React from 'react';

export interface PendingApprovalRequest {
    id: string;
    actionType?: string | null;
    status: string;
    leadId?: string | null;
    leadName?: string | null;
    reasoning?: string | null;
    requestedAt?: string | null;
    expiresAt?: string | null;
    subjectType?: string | null;
    subjectId?: string | null;
    payload?: unknown;
}

export interface ArchivedApprovalRequest extends PendingApprovalRequest {
    archiveReason?: string | null;
    archivedAt?: string | null;
    archivedBy?: string | null;
    archivedByName?: string | null;
}

const ACTION_LABELS: Record<string, { vn: string; en: string }> = {
    CONFIRM_DEPOSIT: { vn: 'Xác minh đặt cọc', en: 'Verify deposit' },
    CHANGE_LEAD_STAGE: { vn: 'Chuyển giai đoạn khách hàng', en: 'Change lead stage' },
    CREATE_PROPOSAL: { vn: 'Tạo đề xuất', en: 'Create proposal' },
    BOOK_VIEWING: { vn: 'Đặt lịch xem', en: 'Book a viewing' },
    SEND_DOCS: { vn: 'Gửi tài liệu', en: 'Send documents' },
    REVIEW_REPAIR_SPIKE: { vn: 'Rà soát đột biến sửa chữa', en: 'Review repair spike' },
    PROMOTE_LEARNING_CANDIDATE: { vn: 'Nâng cấp ứng viên học máy', en: 'Promote learning candidate' },
    ROLLBACK_LEARNING_CANDIDATE: { vn: 'Khôi phục ứng viên học máy', en: 'Roll back learning candidate' },
    DRAFT_PROACTIVE_FOLLOWUP: { vn: 'Tạo bản nháp follow-up', en: 'Create follow-up draft' },
    REVIEW_LISTING_PRICE: { vn: 'Rà soát giá tin đăng', en: 'Review listing price' },
    REVIEW_CSAT_DROP: { vn: 'Rà soát CSAT giảm', en: 'Review CSAT drop' },
};

export const isApprovalActionSupported = (actionType?: string | null): boolean =>
    Boolean(actionType && Object.prototype.hasOwnProperty.call(ACTION_LABELS, actionType));

const payloadRecord = (payload: unknown): Record<string, unknown> =>
    payload && typeof payload === 'object' && !Array.isArray(payload)
        ? payload as Record<string, unknown>
        : {};

const safeText = (value: unknown, limit = 240): string =>
    typeof value === 'string' ? value.trim().slice(0, limit) : '';

const safeNumber = (value: unknown): number | null => {
    const number = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(number) ? number : null;
};

const formatMoney = (value: unknown, locale: string, currencyValue: unknown): string => {
    const amount = safeNumber(value);
    if (amount === null) return '';
    const currency = typeof currencyValue === 'string' && /^[A-Z]{3}$/.test(currencyValue)
        ? currencyValue
        : 'VND';
    try {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency,
            maximumFractionDigits: 0,
        }).format(amount);
    } catch {
        return `${amount.toLocaleString(locale)} ${currency}`;
    }
};

const summarizeAction = (item: PendingApprovalRequest, isVietnamese: boolean, locale: string): string => {
    const payload = payloadRecord(item.payload);
    const value = (key: string) => safeText(payload[key]);
    const subjectFallback = item.subjectId
        ? `${safeText(item.subjectType) ? `${safeText(item.subjectType)} · ` : ''}${safeText(item.subjectId, 80)}`
        : '';

    switch (item.actionType) {
        case 'CONFIRM_DEPOSIT': {
            const bookingId = value('bookingId');
            return bookingId
                ? `${isVietnamese ? 'Xác minh booking' : 'Verify booking'} ${bookingId.slice(-8)}`
                : '';
        }
        case 'CHANGE_LEAD_STAGE':
            return value('targetStage')
                ? `${isVietnamese ? 'Chuyển sang giai đoạn' : 'Move to stage'}: ${value('targetStage')}`
                : '';
        case 'CREATE_PROPOSAL': {
            const basePrice = formatMoney(payload.basePrice, locale, payload.currency);
            const finalPrice = formatMoney(payload.finalPrice, locale, payload.currency);
            if (basePrice && finalPrice) {
                return `${isVietnamese ? 'Giá gốc' : 'Base price'} ${basePrice} · ${isVietnamese ? 'giá đề xuất' : 'proposed'} ${finalPrice}`;
            }
            return value('listingId') ? `${isVietnamese ? 'Tin đăng' : 'Listing'} ${value('listingId')}` : '';
        }
        case 'BOOK_VIEWING': {
            const dateText = value('dateText');
            const listingId = value('listingId');
            return [dateText, listingId ? `${isVietnamese ? 'tin đăng' : 'listing'} ${listingId}` : '']
                .filter(Boolean)
                .join(' · ');
        }
        case 'SEND_DOCS': {
            const documents = Array.isArray(payload.documentIds) ? payload.documentIds.length : 0;
            const recipient = value('recipientEmail');
            return [
                documents ? `${isVietnamese ? 'Gửi' : 'Send'} ${documents} ${isVietnamese ? 'tài liệu' : 'documents'}` : '',
                recipient ? `${isVietnamese ? 'đến' : 'to'} ${recipient}` : '',
            ].filter(Boolean).join(' ');
        }
        case 'REVIEW_REPAIR_SPIKE':
            return value('pattern') || value('summary');
        case 'PROMOTE_LEARNING_CANDIDATE':
            return [
                value('candidateId') || subjectFallback,
                value('weightVersionId') ? `weight ${value('weightVersionId')}` : '',
            ].filter(Boolean).join(' · ');
        case 'ROLLBACK_LEARNING_CANDIDATE':
            return value('candidateId') || subjectFallback;
        case 'DRAFT_PROACTIVE_FOLLOWUP':
            return value('summary') || value('subject') || value('draftText');
        case 'REVIEW_LISTING_PRICE': {
            const current = formatMoney(payload.currentPrice, locale, payload.currency);
            const suggested = formatMoney(payload.suggestedPrice, locale, payload.currency);
            return current && suggested
                ? `${isVietnamese ? 'Hiện tại' : 'Current'} ${current} · ${isVietnamese ? 'tham khảo' : 'reference'} ${suggested}`
                : value('summary') || (value('listingId') ? `${isVietnamese ? 'Tin đăng' : 'Listing'} ${value('listingId')}` : '');
        }
        case 'REVIEW_CSAT_DROP':
            return value('summary') || value('pattern');
        default:
            return '';
    }
};

const formatDate = (value: string | null | undefined, locale: string): string => {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString(locale);
};

interface ApprovalRequestQueueProps {
    items: PendingApprovalRequest[];
    language: string;
    processingId: string | null;
    uncertainIds: ReadonlySet<string>;
    onApprove: (id: string) => void;
    onReject: (id: string) => void;
    onArchive: (id: string) => void;
}

export const ApprovalRequestQueue: React.FC<ApprovalRequestQueueProps> = ({
    items,
    language,
    processingId,
    uncertainIds,
    onApprove,
    onReject,
    onArchive,
}) => {
    const isVietnamese = language === 'vn';
    const locale = isVietnamese ? 'vi-VN' : 'en-US';
    const requests = items.filter(item => item.actionType !== 'DRAFT_OUTREACH');
    if (!requests.length) return null;

    const copy = isVietnamese
        ? {
            title: 'Yêu cầu phê duyệt khác',
            unknown: 'Loại yêu cầu này chưa được hỗ trợ trong màn hình phê duyệt.',
            expired: 'Đã hết hạn — không thể phê duyệt',
            uncertain: 'Chưa xác định được kết quả thao tác. Hãy kiểm tra trạng thái trước khi thử lại.',
            execute: 'Duyệt và thực hiện',
            reject: 'Từ chối',
            archive: 'Từ chối + lưu trữ',
            archiveHint: 'Giữ lịch sử và ngăn hệ thống tạo lại yêu cầu này khi quét lại.',
            requested: 'Gửi lúc',
            expires: 'Hết hạn lúc',
            subject: 'Đối tượng',
            noReason: 'Không có giải thích bổ sung.',
            actionWarning: 'Phê duyệt sẽ thực hiện hành động được mô tả bên dưới.',
        }
        : {
            title: 'Other approval requests',
            unknown: 'This request type is not supported in the approval screen.',
            expired: 'Expired — cannot approve',
            uncertain: 'The action result is unknown. Verify its status before trying again.',
            execute: 'Approve and execute',
            reject: 'Reject',
            archive: 'Reject + archive',
            archiveHint: 'Keeps its history and prevents later scans from recreating this request.',
            requested: 'Requested',
            expires: 'Expires',
            subject: 'Subject',
            noReason: 'No additional explanation was provided.',
            actionWarning: 'Approving will execute the action described below.',
        };

    return (
        <section aria-label={copy.title} className="space-y-3">
            <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-[var(--text-primary)]">
                    {copy.title} <span className="text-sm font-semibold text-[var(--text-tertiary)]">({requests.length})</span>
                </h2>
            </div>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {requests.map(item => {
                    const actionType = item.actionType || '';
                    const supported = isApprovalActionSupported(actionType);
                    const expiredAt = item.expiresAt ? new Date(item.expiresAt).getTime() : Number.NaN;
                    const expired = Number.isFinite(expiredAt) && expiredAt <= Date.now();
                    const uncertain = uncertainIds.has(item.id);
                    const busy = processingId === item.id;
                    const canAct = supported && item.status === 'PENDING' && !expired && !uncertain;
                    const canArchive = item.status === 'PENDING' && !uncertain;
                    const actionLabel = ACTION_LABELS[actionType];
                    const actionSummary = summarizeAction(item, isVietnamese, locale);
                    const reasoning = safeText(item.reasoning, 1000);
                    const requestedAt = formatDate(item.requestedAt, locale);
                    const expiresAtLabel = formatDate(item.expiresAt, locale);
                    const subject = safeText(item.leadName)
                        || (item.subjectId
                            ? `${safeText(item.subjectType) ? `${safeText(item.subjectType)} · ` : ''}${safeText(item.subjectId, 80)}`
                            : item.leadId ? `Lead · ${safeText(item.leadId, 80)}` : '');

                    return (
                        <article
                            key={item.id}
                            data-testid={`approval-request-${item.id}`}
                            className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-surface)] p-4 shadow-sm"
                        >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <h3 className="font-bold text-[var(--text-primary)]">
                                        {actionLabel ? actionLabel[isVietnamese ? 'vn' : 'en'] : actionType || (isVietnamese ? 'Không rõ loại yêu cầu' : 'Unknown request type')}
                                    </h3>
                                    {subject && <p className="mt-1 text-xs text-[var(--text-secondary)]">{copy.subject}: {subject}</p>}
                                </div>
                                <span className="rounded-full border border-[var(--sgs-accent)]/30 bg-[var(--sgs-accent)]/5 px-2.5 py-1 text-[11px] font-bold text-[var(--sgs-accent-text)]">
                                    {item.status}
                                </span>
                            </div>
                            {actionSummary && (
                                <p className="mt-3 rounded-lg bg-[var(--glass-surface)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)]">
                                    {actionSummary}
                                </p>
                            )}
                            <p className="mt-3 whitespace-pre-line break-words text-sm text-[var(--text-secondary)]">
                                {reasoning || copy.noReason}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--text-tertiary)]">
                                {requestedAt && <span>{copy.requested}: {requestedAt}</span>}
                                {expiresAtLabel && <span>{copy.expires}: {expiresAtLabel}</span>}
                            </div>
                            {!supported && (
                                <p role="status" className="mt-3 rounded-lg border border-amber-300/50 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                                    {copy.unknown}
                                </p>
                            )}
                            {expired && (
                                <p role="status" className="mt-3 rounded-lg border border-amber-300/50 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                                    {copy.expired}
                                </p>
                            )}
                            {uncertain && (
                                <p role="alert" className="mt-3 rounded-lg border border-rose-300/50 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800 dark:bg-rose-950/30 dark:text-rose-200">
                                    {copy.uncertain}
                                </p>
                            )}
                            {canAct && (
                                <>
                                    <p className="mt-3 text-[11px] text-[var(--text-tertiary)]">{copy.actionWarning}</p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={() => onApprove(item.id)}
                                            disabled={busy}
                                            className="rounded-xl bg-sgs-primary-deep px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-50"
                                        >
                                            {busy ? (isVietnamese ? 'Đang xử lý…' : 'Processing…') : copy.execute}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onReject(item.id)}
                                            disabled={busy}
                                            className="rounded-xl border border-[var(--glass-border)] px-4 py-2 text-xs font-bold text-[var(--text-primary)] hover:bg-[var(--glass-surface-hover)] disabled:cursor-wait disabled:opacity-50"
                                        >
                                            {copy.reject}
                                        </button>
                                    </div>
                                </>
                            )}
                            {canArchive && (
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => onArchive(item.id)}
                                        disabled={busy}
                                        title={copy.archiveHint}
                                        className="rounded-xl border border-[var(--ui-danger)]/30 px-4 py-2 text-xs font-bold text-[var(--ui-danger)] hover:bg-[var(--ui-danger)]/5 disabled:cursor-wait disabled:opacity-50"
                                    >
                                        {copy.archive}
                                    </button>
                                    <span className="text-[11px] text-[var(--text-tertiary)]">{copy.archiveHint}</span>
                                </div>
                            )}
                        </article>
                    );
                })}
            </div>
        </section>
    );
};

interface ApprovalRequestArchiveHistoryProps {
    items: ArchivedApprovalRequest[];
    total: number;
    language: string;
    loading: boolean;
    unavailable: boolean;
    loadingMore: boolean;
    onRetry: () => void;
    onLoadMore: () => void;
}

export const ApprovalRequestArchiveHistory: React.FC<ApprovalRequestArchiveHistoryProps> = ({
    items,
    total,
    language,
    loading,
    unavailable,
    loadingMore,
    onRetry,
    onLoadMore,
}) => {
    const isVietnamese = language === 'vn';
    const locale = isVietnamese ? 'vi-VN' : 'en-US';
    const copy = isVietnamese
        ? {
            title: 'Lịch sử yêu cầu đã lưu trữ',
            empty: 'Chưa có yêu cầu nào được lưu trữ.',
            loading: 'Đang tải lịch sử lưu trữ…',
            unavailable: 'Không thể tải lịch sử lưu trữ.',
            retry: 'Thử tải lại',
            rejected: 'Đã từ chối',
            reason: 'Lý do lưu trữ',
            performedBy: 'Người thực hiện',
            archivedAt: 'Thời điểm lưu trữ',
            unknown: 'Không xác định',
            loadMore: 'Tải thêm',
            loadingMore: 'Đang tải…',
        }
        : {
            title: 'Archived request history',
            empty: 'No requests have been archived.',
            loading: 'Loading archived history…',
            unavailable: 'Archived history could not be loaded.',
            retry: 'Retry',
            rejected: 'Rejected',
            reason: 'Archive reason',
            performedBy: 'Performed by',
            archivedAt: 'Archived at',
            unknown: 'Unknown',
            loadMore: 'Load more',
            loadingMore: 'Loading…',
        };

    return (
        <section aria-label={copy.title} className="space-y-3" data-testid="approval-archive-history">
            <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-[var(--text-primary)]">
                    {copy.title} <span className="text-sm font-semibold text-[var(--text-tertiary)]">({total})</span>
                </h2>
            </div>
            {unavailable ? (
                <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-300/50 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:bg-rose-950/30 dark:text-rose-200">
                    <span>{copy.unavailable}</span>
                    <button type="button" onClick={onRetry} className="rounded-lg border border-current px-3 py-1.5 text-xs font-bold">
                        {copy.retry}
                    </button>
                </div>
            ) : loading && !items.length ? (
                <p role="status" className="rounded-xl border border-[var(--glass-border)] px-4 py-3 text-sm text-[var(--text-secondary)]">
                    {copy.loading}
                </p>
            ) : items.length === 0 ? (
                <p className="rounded-xl border border-[var(--glass-border)] px-4 py-3 text-sm text-[var(--text-secondary)]">
                    {copy.empty}
                </p>
            ) : (
                <>
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                        {items.map(item => {
                            const actionLabel = ACTION_LABELS[item.actionType || ''];
                            const action = actionLabel
                                ? (isVietnamese ? actionLabel.vn : actionLabel.en)
                                : safeText(item.actionType, 100).replace(/_/g, ' ');
                            const archivedAt = formatDate(item.archivedAt || null, locale) || copy.unknown;
                            const performedBy = safeText(item.archivedByName, 200)
                                || safeText(item.archivedBy, 100)
                                || copy.unknown;
                            return (
                                <article
                                    key={item.id}
                                    data-testid={`archived-approval-request-${item.id}`}
                                    className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-surface)] p-4 shadow-sm"
                                >
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <h3 className="font-bold text-[var(--text-primary)]">{action || item.id}</h3>
                                            {item.leadName && <p className="mt-1 text-sm text-[var(--text-secondary)]">{item.leadName}</p>}
                                        </div>
                                        <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
                                            {copy.rejected}
                                        </span>
                                    </div>
                                    <dl className="mt-4 grid gap-3 text-sm">
                                        <div>
                                            <dt className="text-xs font-semibold text-[var(--text-tertiary)]">{copy.reason}</dt>
                                            <dd className="mt-1 whitespace-pre-wrap text-[var(--text-primary)]">
                                                {safeText(item.archiveReason, 1000) || copy.unknown}
                                            </dd>
                                        </div>
                                        <div className="flex flex-wrap gap-x-6 gap-y-2">
                                            <div>
                                                <dt className="text-xs font-semibold text-[var(--text-tertiary)]">{copy.performedBy}</dt>
                                                <dd className="mt-1 text-[var(--text-primary)]">{performedBy}</dd>
                                            </div>
                                            <div>
                                                <dt className="text-xs font-semibold text-[var(--text-tertiary)]">{copy.archivedAt}</dt>
                                                <dd className="mt-1 text-[var(--text-primary)]">
                                                    <time dateTime={item.archivedAt || undefined}>{archivedAt}</time>
                                                </dd>
                                            </div>
                                        </div>
                                    </dl>
                                </article>
                            );
                        })}
                    </div>
                    {items.length < total && (
                        <div className="flex justify-center">
                            <button
                                type="button"
                                onClick={onLoadMore}
                                disabled={loadingMore}
                                className="rounded-xl border border-[var(--glass-border)] px-4 py-2 text-sm font-bold text-[var(--text-primary)] hover:bg-[var(--glass-surface-hover)] disabled:cursor-wait disabled:opacity-50"
                            >
                                {loadingMore ? copy.loadingMore : copy.loadMore}
                            </button>
                        </div>
                    )}
                </>
            )}
        </section>
    );
};