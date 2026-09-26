import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { auctionApi } from '../services/api/auctionApi';
import { listingApi } from '../services/api/listingApi';
import { db } from '../services/dbApi';
import { socket, useSocket } from '../services/websocket';
import { useTranslation } from '../services/i18n';
import { ConfirmModal } from '../components/ConfirmModal';
import {
    AuctionStatus,
    STATUS_ACTIONS,
    elapsedRatio,
    formatVnd,
    isTerminal,
    minimumNextBid,
    parseMoney,
    splitDuration,
} from '../utils/auction';

interface AuctionItem {
    id: string; title: string; listingId: string; listingCode?: string; listingImages?: string[];
    startPrice: number; stepPrice: number; currentBid: number; bidCount: number;
    status: AuctionStatus; startsAt: string; endsAt: string; winnerName?: string; winnerUserId?: string;
}

type Filter = 'ALL' | AuctionStatus;
const FILTERS: Filter[] = ['ALL', 'LIVE', 'UPCOMING', 'PAUSED', 'ENDED', 'CANCELLED'];
const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD'];
const BID_ROLES = ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD', 'SALES', 'MARKETING'];

// Literal class maps so Tailwind keeps them.
const STATUS_BADGE: Record<AuctionStatus, string> = {
    UPCOMING: 'ui-badge ui-badge-info',
    LIVE: 'ui-badge ui-badge-success',
    PAUSED: 'ui-badge ui-badge-warning',
    ENDED: 'ui-badge ui-badge-neutral',
    CANCELLED: 'ui-badge ui-badge-danger',
};
const ACTION_STYLE: Record<string, string> = {
    LIVE: 'bg-sgs-primary text-white border-transparent hover:opacity-90',
    PAUSED: 'bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--glass-border)] hover:bg-[var(--glass-surface-hover)]',
    ENDED: 'bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--glass-border)] hover:bg-[var(--glass-surface-hover)]',
    CANCELLED: 'bg-[var(--bg-surface)] text-rose-600 border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-900/20',
};

const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const newKey = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

export default function Auction() {
    const { t } = useTranslation();
    const { isConnected } = useSocket();
    const [user, setUser] = useState<any>(null);
    const [items, setItems] = useState<AuctionItem[]>([]);
    const [filter, setFilter] = useState<Filter>('ALL');
    const [search, setSearch] = useState('');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [bids, setBids] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [busy, setBusy] = useState(false);
    const [bidInput, setBidInput] = useState('');
    const [confirm, setConfirm] = useState<null | 'ENDED' | 'CANCELLED'>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [now, setNow] = useState(() => Date.now());

    const isAdmin = ADMIN_ROLES.includes(user?.role);
    const canBid = BID_ROLES.includes(user?.role);
    const money = useCallback((n: number) => formatVnd(n, { billion: t('format.billion'), million: t('format.million'), dong: t('auction.dong') }), [t]);
    const dateTime = (s: string) => new Date(s).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
    const selected = useMemo(() => items.find(i => i.id === selectedId) || null, [items, selectedId]);

    // One clock for every countdown on the page.
    useEffect(() => {
        const id = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(id);
    }, []);
    useEffect(() => { db.getCurrentUser().then(setUser).catch(() => setUser(null)); }, []);

    const load = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        setError('');
        try {
            setItems(await auctionApi.list({ status: 'ALL' }));
        } catch (e: any) {
            setError(e?.message || t('auction.load_error'));
        } finally {
            if (!silent) setLoading(false);
        }
    }, [t]);
    useEffect(() => { void load(); }, [load]);

    const loadBids = useCallback((id: string) => {
        auctionApi.bids(id).then(setBids).catch(() => setBids([]));
    }, []);
    useEffect(() => {
        setBidInput('');
        setNotice('');
        if (selectedId) loadBids(selectedId); else setBids([]);
    }, [selectedId, loadBids]);

    // A countdown that reaches zero means the server will settle the session on the next read.
    const endedLocally = useRef(new Set<string>());
    useEffect(() => {
        const due = items.filter(i => (i.status === 'LIVE' || i.status === 'PAUSED' || i.status === 'UPCOMING')
            && new Date(i.endsAt).getTime() <= now && !endedLocally.current.has(i.id));
        const starting = items.filter(i => i.status === 'UPCOMING' && new Date(i.startsAt).getTime() <= now
            && new Date(i.endsAt).getTime() > now && !endedLocally.current.has(`start:${i.id}`));
        if (due.length || starting.length) {
            due.forEach(i => endedLocally.current.add(i.id));
            starting.forEach(i => endedLocally.current.add(`start:${i.id}`));
            void load(true);
        }
    }, [now, items, load]);

    // Live updates from other users.
    useEffect(() => {
        const apply = (event: any) => {
            if (!event?.auctionId) return;
            setItems(prev => prev.map(item => item.id === event.auctionId ? {
                ...item,
                ...(event.status ? { status: event.status } : {}),
                ...(event.currentBid !== undefined ? { currentBid: event.currentBid } : {}),
                ...(event.bidCount !== undefined ? { bidCount: event.bidCount } : {}),
                ...(event.winnerName !== undefined ? { winnerName: event.winnerName } : {}),
                ...(event.winnerUserId !== undefined ? { winnerUserId: event.winnerUserId } : {}),
            } : item));
            if (event.auctionId === selectedId) loadBids(event.auctionId);
        };
        const reconcile = () => { void load(true); };
        socket.on('auction:bid', apply);
        socket.on('auction:status', apply);
        socket.on('connect', reconcile);
        return () => {
            socket.off('auction:bid', apply);
            socket.off('auction:status', apply);
            socket.off('connect', reconcile);
        };
    }, [selectedId, load, loadBids]);

    const counts = useMemo(() => {
        const c: Record<Filter, number> = { ALL: items.length, LIVE: 0, UPCOMING: 0, PAUSED: 0, ENDED: 0, CANCELLED: 0 };
        items.forEach(i => { c[i.status] = (c[i.status] || 0) + 1; });
        return c;
    }, [items]);
    const q = search.trim().toLowerCase();
    const visible = useMemo(() => items.filter(i => (filter === 'ALL' || i.status === filter)
        && (!q || i.title.toLowerCase().includes(q) || (i.listingCode || '').toLowerCase().includes(q))), [items, filter, q]);

    const countdown = (a: AuctionItem) => {
        if (isTerminal(a.status)) return null;
        const startsIn = new Date(a.startsAt).getTime() - now;
        if (a.status === 'UPCOMING' && startsIn > 0) {
            return { label: t('auction.starts_in'), parts: splitDuration(startsIn) };
        }
        return { label: t('auction.ends_in'), parts: splitDuration(new Date(a.endsAt).getTime() - now) };
    };
    const durationText = (p: { d: number; h: number; m: number; s: number }) =>
        p.d > 0 ? t('auction.dur_dh', { d: p.d, h: p.h }) : p.h > 0 ? t('auction.dur_hm', { h: p.h, m: p.m }) : t('auction.dur_ms', { m: p.m, s: String(p.s).padStart(2, '0') });

    const changeStatus = async (status: 'LIVE' | 'PAUSED' | 'ENDED' | 'CANCELLED') => {
        if (!selected) return;
        setBusy(true); setError(''); setNotice('');
        try {
            const updated = await auctionApi.updateStatus(selected.id, status);
            setItems(prev => prev.map(i => i.id === updated.id ? { ...i, ...updated } : i));
            if (status === 'ENDED') loadBids(selected.id);
        } catch (e: any) {
            setError(e?.message || t('auction.status_error'));
        } finally {
            setBusy(false);
        }
    };

    const minBid = selected ? minimumNextBid(selected) : 0;
    const parsedBid = parseMoney(bidInput);
    const bidTooLow = parsedBid !== null && parsedBid < minBid;
    const placeBid = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selected || parsedBid === null || bidTooLow) return;
        setBusy(true); setError(''); setNotice('');
        try {
            const result = await auctionApi.placeBid(selected.id, parsedBid, newKey());
            if (result?.auction) setItems(prev => prev.map(i => i.id === result.auction.id ? { ...i, ...result.auction } : i));
            setBidInput('');
            setNotice(t('auction.bid_ok', { amount: money(parsedBid) }));
            loadBids(selected.id);
        } catch (err: any) {
            setError(err?.message || t('auction.bid_error'));
        } finally {
            setBusy(false);
        }
    };

    const convert = async (target: 'booking' | 'contract') => {
        if (!selected) return;
        setBusy(true); setError(''); setNotice('');
        try {
            const result = await auctionApi.convert(selected.id, target);
            setNotice(result?.created
                ? t(target === 'booking' ? 'auction.booking_created' : 'auction.contract_created')
                : t(target === 'booking' ? 'auction.booking_exists' : 'auction.contract_exists'));
        } catch (err: any) {
            setError(err?.message || t('auction.convert_error'));
        } finally {
            setBusy(false);
        }
    };

    const actionLabel: Record<string, string> = {
        LIVE: selected?.status === 'PAUSED' ? t('auction.action_resume') : t('auction.action_start'),
        PAUSED: t('auction.action_pause'),
        ENDED: t('auction.action_end'),
        CANCELLED: t('auction.action_cancel'),
    };

    return (
        <div className="h-full flex flex-col bg-[var(--bg-app)] overflow-hidden">
            {/* Header */}
            <div className="shrink-0 px-4 lg:px-6 py-3 border-b border-[var(--glass-border)] bg-[var(--bg-surface)]">
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex-none min-w-0">
                        <h1 className="text-base font-bold text-[var(--text-primary)] leading-tight">{t('auction.title')}</h1>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5 flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} aria-hidden="true" />
                            {isConnected ? t('auction.realtime_on') : t('auction.realtime_off')}
                        </p>
                    </div>
                    <div className="hidden sm:block h-8 w-px bg-[var(--glass-border)]" />
                    <div className="relative flex-1 min-w-[180px] max-w-xs">
                        <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        <input
                            type="search"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder={t('auction.search_placeholder')}
                            aria-label={t('auction.search_placeholder')}
                            className="w-full pl-9 pr-3 h-10 border border-[var(--glass-border)] rounded-xl bg-[var(--bg-app)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-sgs-primary"
                        />
                    </div>
                    <div className="flex-1" />
                    {isAdmin && (
                        <button type="button" onClick={() => setShowCreate(true)} className="shrink-0 inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-sgs-primary text-white text-sm font-semibold hover:opacity-90">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                            {t('auction.create')}
                        </button>
                    )}
                </div>
                <div className="mt-3 flex gap-1.5 overflow-x-auto no-scrollbar" role="group" aria-label={t('auction.filter_status')}>
                    {FILTERS.map(f => (
                        <button
                            key={f}
                            type="button"
                            aria-pressed={filter === f}
                            onClick={() => setFilter(f)}
                            className={`shrink-0 min-h-[32px] px-3 rounded-full text-xs font-medium border inline-flex items-center gap-1.5 transition-colors ${filter === f ? 'bg-[var(--sgs-primary)] border-[var(--sgs-primary)] text-white' : 'bg-[var(--bg-surface)] border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                        >
                            {f === 'LIVE' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />}
                            {t(`auction.status_${f}`)}
                            <span className="tabular-nums opacity-75">{counts[f]}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 min-h-0 flex">
                {/* List */}
                <div className="flex-1 min-w-0 overflow-y-auto no-scrollbar p-4 lg:p-6">
                    {error && !selected && <Alert tone="error" onClose={() => setError('')}>{error}</Alert>}
                    {loading ? (
                        <div className="flex items-center justify-center h-48">
                            <div className="w-8 h-8 border-4 border-[var(--glass-border)] border-t-[var(--sgs-primary)] rounded-full animate-spin" />
                        </div>
                    ) : visible.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-[var(--glass-border)] bg-[var(--bg-surface)] px-6 py-12 text-center">
                            <h3 className="text-sm font-semibold text-[var(--text-primary)]">{items.length === 0 ? t('auction.empty_title') : t('auction.no_match_title')}</h3>
                            <p className="mt-1 text-sm text-[var(--text-secondary)] max-w-md mx-auto">{items.length === 0 ? (isAdmin ? t('auction.empty_body_admin') : t('auction.empty_body')) : t('auction.no_match_body')}</p>
                            {items.length === 0 && isAdmin && (
                                <button type="button" onClick={() => setShowCreate(true)} className="mt-4 inline-flex items-center h-10 px-4 rounded-xl bg-sgs-primary text-white text-sm font-semibold hover:opacity-90">{t('auction.create')}</button>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3">
                            {visible.map(a => {
                                const cd = countdown(a);
                                return (
                                    <button
                                        key={a.id}
                                        type="button"
                                        onClick={() => setSelectedId(a.id)}
                                        aria-pressed={selectedId === a.id}
                                        className={`text-left rounded-2xl border bg-[var(--bg-surface)] p-4 transition-colors hover:border-[var(--sgs-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sgs-primary)] ${selectedId === a.id ? 'border-[var(--sgs-primary)] ring-1 ring-[var(--sgs-primary)]' : 'border-[var(--glass-border)]'}`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="font-semibold text-sm text-[var(--text-primary)] line-clamp-2">{a.title}</div>
                                                {a.listingCode && <div className="text-xs text-[var(--text-tertiary)] mt-0.5">{a.listingCode}</div>}
                                            </div>
                                            <span className={`${STATUS_BADGE[a.status]} shrink-0`}>{t(`auction.status_${a.status}`)}</span>
                                        </div>
                                        <div className="mt-3 flex items-end justify-between gap-3">
                                            <div>
                                                <div className="text-xs text-[var(--text-secondary)]">{Number(a.bidCount) > 0 ? t('auction.current_bid') : t('auction.start_price')}</div>
                                                <div className="text-lg font-bold text-[var(--text-primary)] tabular-nums">{money(Number(a.currentBid))}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xs text-[var(--text-secondary)]">{t('auction.bid_count')}</div>
                                                <div className="text-sm font-semibold text-[var(--text-primary)] tabular-nums">{a.bidCount}</div>
                                            </div>
                                        </div>
                                        <div className="mt-3 pt-3 border-t border-[var(--glass-border)] text-xs text-[var(--text-secondary)] flex items-center justify-between gap-2">
                                            {cd ? (
                                                <span className={a.status === 'LIVE' ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : ''}>{cd.label} {durationText(cd.parts)}</span>
                                            ) : a.status === 'ENDED' ? (
                                                <span>{a.winnerName ? t('auction.winner_short', { name: a.winnerName }) : t('auction.no_winner')}</span>
                                            ) : <span>{t('auction.cancelled_at', { date: dateTime(a.endsAt) })}</span>}
                                            <span className="tabular-nums">{dateTime(a.endsAt)}</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Detail */}
                {selected && (
                    <aside className="fixed inset-x-0 bottom-0 z-[60] max-h-[85dvh] rounded-t-2xl md:static md:z-auto md:max-h-none md:rounded-none md:w-[380px] md:shrink-0 border-t md:border-t-0 md:border-l border-[var(--glass-border)] bg-[var(--bg-surface)] shadow-2xl md:shadow-none overflow-y-auto" aria-label={t('auction.detail')}>
                        <div className="flex items-start justify-between gap-2 p-4 border-b border-[var(--glass-border)]">
                            <div className="min-w-0">
                                <span className={STATUS_BADGE[selected.status]}>{t(`auction.status_${selected.status}`)}</span>
                                <h2 className="mt-1.5 text-base font-bold text-[var(--text-primary)]">{selected.title}</h2>
                                <p className="text-xs text-[var(--text-tertiary)]">{t('auction.listing_code', { code: selected.listingCode || selected.listingId })}</p>
                            </div>
                            <button type="button" onClick={() => setSelectedId(null)} aria-label={t('common.close')} className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--glass-surface-hover)]">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="p-4 space-y-4">
                            {error && <Alert tone="error" onClose={() => setError('')}>{error}</Alert>}
                            {notice && <Alert tone="success" onClose={() => setNotice('')}>{notice}</Alert>}

                            {/* Price block */}
                            <div className="rounded-xl bg-[var(--glass-surface)] p-4">
                                <div className="text-xs text-[var(--text-secondary)]">{Number(selected.bidCount) > 0 ? t('auction.current_bid') : t('auction.start_price')}</div>
                                <div className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">{money(Number(selected.currentBid))}</div>
                                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                                    <div><dt className="text-[var(--text-tertiary)]">{t('auction.start_price')}</dt><dd className="font-semibold text-[var(--text-primary)] tabular-nums">{money(Number(selected.startPrice))}</dd></div>
                                    <div><dt className="text-[var(--text-tertiary)]">{t('auction.step_price')}</dt><dd className="font-semibold text-[var(--text-primary)] tabular-nums">{money(Number(selected.stepPrice))}</dd></div>
                                    <div><dt className="text-[var(--text-tertiary)]">{t('auction.bid_count')}</dt><dd className="font-semibold text-[var(--text-primary)] tabular-nums">{selected.bidCount}</dd></div>
                                    {!isTerminal(selected.status) && <div><dt className="text-[var(--text-tertiary)]">{t('auction.min_next')}</dt><dd className="font-semibold text-[var(--text-primary)] tabular-nums">{money(minBid)}</dd></div>}
                                </dl>
                            </div>

                            {/* Timeline */}
                            <div>
                                <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                                    <span>{dateTime(selected.startsAt)}</span>
                                    <span>{dateTime(selected.endsAt)}</span>
                                </div>
                                <div className="mt-1.5 h-1.5 rounded-full bg-[var(--glass-surface-hover)] overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(elapsedRatio(selected, now) * 100)}>
                                    <div className="h-full bg-[var(--sgs-primary)]" style={{ width: `${elapsedRatio(selected, now) * 100}%` }} />
                                </div>
                                {countdown(selected) && (
                                    <p className="mt-1.5 text-sm font-semibold text-[var(--text-primary)] tabular-nums">
                                        {countdown(selected)!.label} {durationText(countdown(selected)!.parts)}
                                    </p>
                                )}
                            </div>

                            {/* Operator controls */}
                            {isAdmin && STATUS_ACTIONS[selected.status].length > 0 && (
                                <div>
                                    <div className="text-xs font-semibold text-[var(--text-secondary)] mb-2">{t('auction.controls')}</div>
                                    <div className="flex flex-wrap gap-2">
                                        {STATUS_ACTIONS[selected.status].map(s => (
                                            <button
                                                key={s}
                                                type="button"
                                                disabled={busy}
                                                onClick={() => (s === 'ENDED' || s === 'CANCELLED') ? setConfirm(s) : void changeStatus(s)}
                                                className={`min-h-[40px] px-3.5 rounded-xl border text-sm font-semibold transition-colors disabled:opacity-50 ${ACTION_STYLE[s]}`}
                                            >
                                                {actionLabel[s]}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Bid form */}
                            {selected.status === 'LIVE' && (canBid ? (
                                <form onSubmit={placeBid} className="space-y-2">
                                    <label htmlFor="auction-bid" className="block text-xs font-semibold text-[var(--text-secondary)]">{t('auction.your_bid')}</label>
                                    <div className="flex gap-2">
                                        <input
                                            id="auction-bid"
                                            inputMode="decimal"
                                            value={bidInput}
                                            onChange={e => setBidInput(e.target.value)}
                                            placeholder={t('auction.bid_placeholder', { amount: money(minBid) })}
                                            aria-invalid={bidTooLow}
                                            className={`flex-1 min-w-0 h-11 px-3 rounded-xl border bg-[var(--bg-surface)] text-sm text-[var(--text-primary)] tabular-nums focus:outline-none focus:ring-2 focus:ring-sgs-primary ${bidTooLow ? 'border-rose-400' : 'border-[var(--glass-border)]'}`}
                                        />
                                        <button type="submit" disabled={busy || parsedBid === null || bidTooLow} className="h-11 px-4 rounded-xl bg-sgs-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40">
                                            {t('auction.place_bid')}
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {[1, 2, 5].map(k => {
                                            const amount = minBid + (k - 1) * Number(selected.stepPrice);
                                            return (
                                                <button key={k} type="button" onClick={() => setBidInput(amount.toLocaleString('vi-VN'))} className="min-h-[32px] px-2.5 rounded-lg border border-[var(--glass-border)] text-xs text-[var(--text-secondary)] hover:border-[var(--sgs-primary)] hover:text-[var(--text-primary)] tabular-nums">
                                                    {money(amount)}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <p className={`text-xs ${bidTooLow ? 'text-rose-600' : 'text-[var(--text-tertiary)]'}`}>
                                        {bidTooLow ? t('auction.bid_too_low', { amount: money(minBid) }) : parsedBid !== null ? t('auction.bid_preview', { amount: money(parsedBid) }) : t('auction.bid_hint')}
                                    </p>
                                </form>
                            ) : (
                                <p className="text-xs text-[var(--text-tertiary)]">{t('auction.bid_not_allowed')}</p>
                            ))}

                            {/* Result + next steps */}
                            {selected.status === 'ENDED' && (
                                <div className="rounded-xl border border-[var(--glass-border)] p-4">
                                    <div className="text-xs text-[var(--text-secondary)]">{t('auction.result')}</div>
                                    {selected.winnerUserId || selected.winnerName ? (
                                        <>
                                            <div className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{t('auction.winner', { name: selected.winnerName || '—' })}</div>
                                            <div className="text-sm text-[var(--text-primary)] tabular-nums">{money(Number(selected.currentBid))}</div>
                                            {isAdmin && (
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    <button type="button" disabled={busy} onClick={() => void convert('booking')} className="min-h-[40px] px-3.5 rounded-xl bg-sgs-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50">{t('auction.to_booking')}</button>
                                                    <button type="button" disabled={busy} onClick={() => void convert('contract')} className="min-h-[40px] px-3.5 rounded-xl border border-[var(--glass-border)] text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--glass-surface-hover)] disabled:opacity-50">{t('auction.to_contract')}</button>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="mt-1 text-sm text-[var(--text-primary)]">{t('auction.no_winner')}</div>
                                    )}
                                </div>
                            )}

                            {/* Bid history */}
                            <div>
                                <div className="text-xs font-semibold text-[var(--text-secondary)] mb-2">{t('auction.history', { n: bids.length })}</div>
                                {bids.length === 0 ? (
                                    <p className="text-sm text-[var(--text-tertiary)]">{t('auction.no_bids')}</p>
                                ) : (
                                    <ol className="divide-y divide-[var(--glass-border)] rounded-xl border border-[var(--glass-border)]">
                                        {bids.map((b, i) => (
                                            <li key={b.id} className={`flex items-center justify-between gap-3 px-3 py-2.5 text-sm ${i === 0 ? 'bg-emerald-50/60 dark:bg-emerald-900/10' : ''}`}>
                                                <div className="min-w-0">
                                                    <div className="font-medium text-[var(--text-primary)] truncate">{b.bidderName || t('auction.bidder_unknown')}</div>
                                                    <div className="text-xs text-[var(--text-tertiary)] tabular-nums">{b.createdAt ? dateTime(b.createdAt) : ''}</div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <div className="font-semibold text-[var(--text-primary)] tabular-nums">{money(Number(b.amount))}</div>
                                                    {i === 0 && <div className="text-[11px] text-emerald-700 dark:text-emerald-400">{t('auction.highest')}</div>}
                                                </div>
                                            </li>
                                        ))}
                                    </ol>
                                )}
                            </div>
                        </div>
                    </aside>
                )}
            </div>

            <ConfirmModal
                isOpen={confirm !== null}
                title={confirm === 'CANCELLED' ? t('auction.confirm_cancel_title') : t('auction.confirm_end_title')}
                message={confirm === 'CANCELLED' ? t('auction.confirm_cancel_msg') : t('auction.confirm_end_msg')}
                confirmLabel={confirm === 'CANCELLED' ? t('auction.action_cancel') : t('auction.action_end')}
                cancelLabel={t('common.cancel')}
                onConfirm={() => { const s = confirm; setConfirm(null); if (s) void changeStatus(s); }}
                onCancel={() => setConfirm(null)}
                variant="danger"
            />

            {showCreate && (
                <CreateAuctionModal
                    t={t}
                    money={money}
                    onClose={() => setShowCreate(false)}
                    onCreated={created => { setItems(prev => [created, ...prev]); setSelectedId(created.id); setShowCreate(false); }}
                />
            )}
        </div>
    );
}

function Alert({ tone, children, onClose }: { tone: 'error' | 'success'; children: React.ReactNode; onClose: () => void }) {
    const cls = tone === 'error'
        ? 'border-rose-200 bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:border-rose-800 dark:text-rose-300'
        : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-300';
    return (
        <div role={tone === 'error' ? 'alert' : 'status'} className={`mb-3 rounded-xl border px-3 py-2.5 text-sm flex items-start justify-between gap-2 ${cls}`}>
            <span className="min-w-0">{children}</span>
            <button type="button" onClick={onClose} aria-label="×" className="shrink-0 opacity-70 hover:opacity-100">×</button>
        </div>
    );
}

function CreateAuctionModal({ t, money, onClose, onCreated }: {
    t: (k: string, p?: any) => string;
    money: (n: number) => string;
    onClose: () => void;
    onCreated: (a: any) => void;
}) {
    const [query, setQuery] = useState('');
    const [options, setOptions] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);
    const [listing, setListing] = useState<any | null>(null);
    const [title, setTitle] = useState('');
    const [startPrice, setStartPrice] = useState('');
    const [stepPrice, setStepPrice] = useState('');
    const [startsAt, setStartsAt] = useState(() => toLocalInput(new Date(Date.now() + 10 * 60000)));
    const [endsAt, setEndsAt] = useState(() => toLocalInput(new Date(Date.now() + 24 * 3600000)));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // Server-side listing search (the old <select> only showed the first 200 listings).
    useEffect(() => {
        let cancelled = false;
        const id = window.setTimeout(async () => {
            setSearching(true);
            try {
                const res: any = await listingApi.getListings(1, 20, query.trim() ? { search: query.trim() } : {});
                if (!cancelled) setOptions(res?.data || []);
            } catch {
                if (!cancelled) setOptions([]);
            } finally {
                if (!cancelled) setSearching(false);
            }
        }, 300);
        return () => { cancelled = true; window.clearTimeout(id); };
    }, [query]);

    const pick = (l: any) => {
        setListing(l);
        setTitle(l.title || '');
        if (l.price) {
            setStartPrice(Number(l.price).toLocaleString('vi-VN'));
            setStepPrice(Math.max(1_000_000, Math.round(Number(l.price) * 0.005 / 1_000_000) * 1_000_000).toLocaleString('vi-VN'));
        }
    };

    const start = parseMoney(startPrice);
    const step = parseMoney(stepPrice);
    const startDate = new Date(startsAt);
    const endDate = new Date(endsAt);
    const timeInvalid = !(endDate.getTime() > startDate.getTime());
    const valid = !!listing && start !== null && step !== null && !timeInvalid;

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!valid || !listing) return;
        setSaving(true); setError('');
        try {
            const created = await auctionApi.create({
                listingId: listing.id,
                title: title.trim(),
                startPrice: start,
                stepPrice: step,
                startsAt: startDate.toISOString(),
                endsAt: endDate.toISOString(),
            });
            onCreated({ ...created, listingCode: created.listingCode || listing.code });
        } catch (err: any) {
            setError(err?.message || t('auction.create_error'));
        } finally {
            setSaving(false);
        }
    };

    const field = 'w-full h-11 px-3 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-surface)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-sgs-primary';
    const label = 'block text-xs font-semibold text-[var(--text-secondary)] mb-1.5';

    return (
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="auction-create-title">
            <form onSubmit={submit} className="w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-[var(--bg-surface)] border border-[var(--glass-border)] shadow-2xl">
                <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-[var(--glass-border)]">
                    <h2 id="auction-create-title" className="text-base font-bold text-[var(--text-primary)]">{t('auction.create_title')}</h2>
                    <button type="button" onClick={onClose} aria-label={t('common.close')} className="w-10 h-10 rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--glass-surface-hover)]">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="p-5 space-y-4">
                    {error && <Alert tone="error" onClose={() => setError('')}>{error}</Alert>}
                    {/* Listing picker */}
                    <div>
                        <span className={label}>{t('auction.field_listing')}</span>
                        {listing ? (
                            <div className="flex items-center justify-between gap-2 rounded-xl border border-[var(--sgs-primary)] bg-[var(--glass-surface)] px-3 py-2.5">
                                <div className="min-w-0">
                                    <div className="text-sm font-semibold text-[var(--text-primary)] truncate">{listing.title}</div>
                                    <div className="text-xs text-[var(--text-tertiary)]">{listing.code}{listing.price ? ` · ${money(Number(listing.price))}` : ''}</div>
                                </div>
                                <button type="button" onClick={() => setListing(null)} className="shrink-0 text-xs font-semibold text-sgs-primary px-2 py-1 rounded-lg hover:bg-[var(--glass-surface-hover)]">{t('auction.change')}</button>
                            </div>
                        ) : (
                            <>
                                <input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('auction.listing_search')} aria-label={t('auction.listing_search')} className={field} />
                                <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-[var(--glass-border)] divide-y divide-[var(--glass-border)]">
                                    {searching ? (
                                        <div className="px-3 py-3 text-sm text-[var(--text-tertiary)]">{t('common.loading')}</div>
                                    ) : options.length === 0 ? (
                                        <div className="px-3 py-3 text-sm text-[var(--text-tertiary)]">{t('auction.listing_none')}</div>
                                    ) : options.map(l => (
                                        <button key={l.id} type="button" onClick={() => pick(l)} className="w-full text-left px-3 py-2.5 hover:bg-[var(--glass-surface-hover)]">
                                            <div className="text-sm font-medium text-[var(--text-primary)] truncate">{l.title}</div>
                                            <div className="text-xs text-[var(--text-tertiary)]">{l.code}{l.price ? ` · ${money(Number(l.price))}` : ''}</div>
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                    <div>
                        <label htmlFor="auc-title" className={label}>{t('auction.field_title')}</label>
                        <input id="auc-title" value={title} onChange={e => setTitle(e.target.value)} placeholder={t('auction.field_title_ph')} className={field} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label htmlFor="auc-start" className={label}>{t('auction.start_price')}</label>
                            <input id="auc-start" inputMode="decimal" value={startPrice} onChange={e => setStartPrice(e.target.value)} placeholder={t('auction.money_ph')} className={field} />
                            {start !== null && <p className="mt-1 text-xs text-[var(--text-tertiary)] tabular-nums">{money(start)}</p>}
                        </div>
                        <div>
                            <label htmlFor="auc-step" className={label}>{t('auction.step_price')}</label>
                            <input id="auc-step" inputMode="decimal" value={stepPrice} onChange={e => setStepPrice(e.target.value)} placeholder={t('auction.money_ph')} className={field} />
                            {step !== null && <p className="mt-1 text-xs text-[var(--text-tertiary)] tabular-nums">{money(step)}</p>}
                        </div>
                        <div>
                            <label htmlFor="auc-from" className={label}>{t('auction.starts_at')}</label>
                            <input id="auc-from" type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)} className={field} />
                        </div>
                        <div>
                            <label htmlFor="auc-to" className={label}>{t('auction.ends_at')}</label>
                            <input id="auc-to" type="datetime-local" value={endsAt} onChange={e => setEndsAt(e.target.value)} aria-invalid={timeInvalid} className={`${field} ${timeInvalid ? '!border-rose-400' : ''}`} />
                        </div>
                    </div>
                    {timeInvalid && <p className="text-xs text-rose-600">{t('auction.time_invalid')}</p>}
                    <p className="text-xs text-[var(--text-tertiary)]">{t('auction.create_hint')}</p>
                </div>
                <div className="flex justify-end gap-2 px-5 py-4 border-t border-[var(--glass-border)]">
                    <button type="button" onClick={onClose} className="h-10 px-4 rounded-xl border border-[var(--glass-border)] text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--glass-surface-hover)]">{t('common.cancel')}</button>
                    <button type="submit" disabled={!valid || saving} className="h-10 px-4 rounded-xl bg-sgs-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40">{saving ? t('auction.saving') : t('auction.create')}</button>
                </div>
            </form>
        </div>
    );
}
