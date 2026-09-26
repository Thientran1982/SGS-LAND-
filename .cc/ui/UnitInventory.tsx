import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { db } from '../services/dbApi';
import { listingApi } from '../services/api/listingApi';
import { useTranslation } from '../services/i18n';
import { Dropdown } from '../components/Dropdown';
import {
    InventoryUnit,
    StatusFilter,
    UnitTone,
    buildStackingPlan,
    matchesStatus,
    summarize,
    toInventoryUnit,
} from '../utils/unitInventory';

/**
 * Tồn kho cấp căn — stacking plan of a project's units (tower → floor → unit).
 * Source of truth is the project's product catalog (listings with the project's code);
 * nothing is stored separately, so a status change in the catalog shows up here immediately.
 */

const PAGE_SIZE = 200;
const MAX_PAGES = 25; // 5,000 units per project is far above any real launch
const LAST_PROJECT_KEY = 'sgs_unit_inventory_project';

// Literal class maps so Tailwind keeps every class.
const CELL_TONE: Record<UnitTone, string> = {
    available: 'bg-emerald-50 border-emerald-200 hover:border-emerald-400 dark:bg-emerald-900/20 dark:border-emerald-800',
    opening: 'bg-sky-50 border-sky-200 hover:border-sky-400 dark:bg-sky-900/20 dark:border-sky-800',
    booking: 'bg-indigo-50 border-indigo-200 hover:border-indigo-400 dark:bg-indigo-900/20 dark:border-indigo-800',
    hold: 'bg-amber-50 border-amber-200 hover:border-amber-400 dark:bg-amber-900/20 dark:border-amber-800',
    sold: 'bg-[var(--glass-surface-hover)] border-[var(--glass-border)] hover:border-[var(--text-tertiary)] opacity-80',
    inactive: 'bg-rose-50 border-rose-200 hover:border-rose-400 dark:bg-rose-900/20 dark:border-rose-800',
};
const DOT_TONE: Record<UnitTone, string> = {
    available: 'bg-emerald-500',
    opening: 'bg-sky-500',
    booking: 'bg-indigo-500',
    hold: 'bg-amber-500',
    sold: 'bg-slate-400',
    inactive: 'bg-rose-500',
};
const BADGE_TONE: Record<UnitTone, string> = {
    available: 'ui-badge ui-badge-success',
    opening: 'ui-badge ui-badge-info',
    booking: 'ui-badge ui-badge-info',
    hold: 'ui-badge ui-badge-warning',
    sold: 'ui-badge ui-badge-neutral',
    inactive: 'ui-badge ui-badge-danger',
};
const LEGEND: UnitTone[] = ['available', 'opening', 'booking', 'hold', 'sold', 'inactive'];

async function fetchProjectUnits(projectCode: string): Promise<any[]> {
    const all: any[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
        const res: any = await listingApi.getListings(page, PAGE_SIZE, { projectCode });
        const rows: any[] = res?.data || [];
        all.push(...rows);
        const totalPages = Number(res?.totalPages) || 1;
        if (rows.length < PAGE_SIZE || page >= totalPages) break;
    }
    return all;
}

const readLastProject = (): string => {
    try { return localStorage.getItem(LAST_PROJECT_KEY) || ''; } catch { return ''; }
};
const writeLastProject = (id: string) => {
    try { localStorage.setItem(LAST_PROJECT_KEY, id); } catch { /* storage unavailable */ }
};

export default function UnitInventory() {
    const { t } = useTranslation();
    const [projects, setProjects] = useState<any[]>([]);
    const [projectsLoading, setProjectsLoading] = useState(true);
    const [projectId, setProjectId] = useState('');
    const [units, setUnits] = useState<InventoryUnit[]>([]);
    const [unitsLoading, setUnitsLoading] = useState(false);
    const [error, setError] = useState('');
    const [tower, setTower] = useState('all');
    const [status, setStatus] = useState<StatusFilter>('all');
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState<InventoryUnit | null>(null);

    const fmtPrice = useCallback((v: number | null) => {
        if (!v) return '—';
        if (v >= 1e9) return `${(v / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} ${t('format.billion')}`;
        return `${Math.round(v / 1e6).toLocaleString('vi-VN')} ${t('format.million')}`;
    }, [t]);
    const fmtUnitPrice = useCallback((u: InventoryUnit) => {
        const area = u.clearArea || u.area;
        if (!u.price || !area) return null;
        return `${(u.price / area / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} ${t('unitinv.million_per_sqm')}`;
    }, [t]);
    const statusLabel = useCallback((s: string) => {
        const key = `status.${s}`;
        const v = t(key);
        return v && v !== key ? v : s;
    }, [t]);
    const typeLabel = useCallback((type: string | null) => {
        if (!type) return '—';
        const key = `property.${type.toUpperCase()}`;
        const v = t(key);
        return v && v !== key ? v : type;
    }, [t]);
    const directionLabel = useCallback((d: string | null) => {
        if (!d) return '—';
        const key = `direction.${d}`;
        const v = t(key);
        return v && v !== key ? v : d;
    }, [t]);

    // Projects: default to the last one viewed, else the one with the most catalog units.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            setProjectsLoading(true);
            try {
                const res: any = await db.getProjects(1, 100, {});
                const list: any[] = (res?.data || res || []).filter((p: any) => p?.code);
                if (cancelled) return;
                setProjects(list);
                const last = readLastProject();
                const fallback = [...list].sort((a, b) => (Number(b.listingCount) || 0) - (Number(a.listingCount) || 0))[0];
                setProjectId(list.some(p => p.id === last) ? last : (fallback?.id || ''));
            } catch (e: any) {
                if (!cancelled) setError(e?.message || t('unitinv.load_error'));
            } finally {
                if (!cancelled) setProjectsLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [t]);

    const project = useMemo(() => projects.find(p => p.id === projectId) || null, [projects, projectId]);

    const loadUnits = useCallback(async () => {
        if (!project?.code) { setUnits([]); return; }
        setUnitsLoading(true);
        setError('');
        try {
            const rows = await fetchProjectUnits(project.code);
            setUnits(rows.map(toInventoryUnit));
        } catch (e: any) {
            setError(e?.message || t('unitinv.load_error'));
            setUnits([]);
        } finally {
            setUnitsLoading(false);
        }
    }, [project?.code, t]);

    useEffect(() => {
        setTower('all');
        setStatus('all');
        setQuery('');
        setSelected(null);
        void loadUnits();
    }, [loadUnits]);

    const onProjectChange = (id: string) => {
        setProjectId(id);
        writeLastProject(id);
    };

    const towerScoped = useMemo(() => units.filter(u => tower === 'all' || u.tower === tower), [units, tower]);
    const summary = useMemo(() => summarize(towerScoped), [towerScoped]);
    const towerNames = useMemo(() => buildStackingPlan(units).towers.map(tp => tp.tower), [units]);
    const q = query.trim().toLowerCase();
    const visible = useMemo(() => towerScoped.filter(u => matchesStatus(u, status)
        && (!q || u.label.toLowerCase().includes(q) || u.code.toLowerCase().includes(q) || u.title.toLowerCase().includes(q))), [towerScoped, status, q]);
    const plan = useMemo(() => buildStackingPlan(visible), [visible]);
    const statusCounts = useMemo(() => {
        const c: Record<StatusFilter, number> = { all: towerScoped.length, available: 0, reserved: 0, sold: 0, inactive: 0 };
        towerScoped.forEach(u => (['available', 'reserved', 'sold', 'inactive'] as StatusFilter[]).forEach(f => { if (matchesStatus(u, f)) c[f]++; }));
        return c;
    }, [towerScoped]);

    const kpis: Array<{ key: string; label: string; value: string; hint?: string; tone?: string }> = [
        { key: 'total', label: t('unitinv.kpi_total'), value: summary.total.toLocaleString('vi-VN') },
        { key: 'available', label: t('unitinv.kpi_available'), value: summary.available.toLocaleString('vi-VN'), tone: 'text-emerald-600 dark:text-emerald-400' },
        { key: 'reserved', label: t('unitinv.kpi_reserved'), value: summary.reserved.toLocaleString('vi-VN'), tone: 'text-amber-600 dark:text-amber-400' },
        { key: 'sold', label: t('unitinv.kpi_sold'), value: summary.sold.toLocaleString('vi-VN'), hint: t('unitinv.kpi_sold_rate', { n: Math.round(summary.soldRate * 100) }) },
        { key: 'value', label: t('unitinv.kpi_available_value'), value: fmtPrice(summary.availableValue) },
    ];
    const statusChips: Array<{ key: StatusFilter; label: string }> = [
        { key: 'all', label: t('unitinv.filter_all') },
        { key: 'available', label: t('unitinv.filter_available') },
        { key: 'reserved', label: t('unitinv.filter_reserved') },
        { key: 'sold', label: t('unitinv.filter_sold') },
        { key: 'inactive', label: t('unitinv.filter_inactive') },
    ];
    const chipClass = (active: boolean) => `shrink-0 min-h-[32px] px-3 rounded-full text-xs font-medium border transition-colors inline-flex items-center gap-1.5 ${active
        ? 'bg-[var(--sgs-primary)] border-[var(--sgs-primary)] text-white'
        : 'bg-[var(--bg-surface)] border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-tertiary)]'}`;

    const UnitCell = ({ u, wide = false }: { u: InventoryUnit; wide?: boolean }) => (
        <button
            type="button"
            onClick={() => setSelected(u)}
            title={`${u.label} · ${statusLabel(u.status)}`}
            aria-label={`${u.label}, ${statusLabel(u.status)}`}
            className={`text-left rounded-lg border px-2.5 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sgs-primary)] ${wide ? 'w-full' : 'w-[132px] shrink-0'} ${CELL_TONE[u.tone]} ${selected?.id === u.id ? 'ring-2 ring-[var(--sgs-primary)]' : ''}`}
        >
            <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full shrink-0 ${DOT_TONE[u.tone]}`} aria-hidden="true" />
                <span className="text-xs font-bold text-[var(--text-primary)] truncate">{u.label}</span>
            </div>
            <div className="mt-1 text-[11px] text-[var(--text-secondary)] truncate">
                {[u.bedrooms ? t('unitinv.bedrooms_short', { n: u.bedrooms }) : typeLabel(u.type), (u.clearArea || u.area) ? `${u.clearArea || u.area} m²` : null].filter(Boolean).join(' · ')}
            </div>
            <div className="text-[11px] font-semibold text-[var(--text-primary)] tabular-nums truncate">{fmtPrice(u.price)}</div>
        </button>
    );

    const projectOptions = projects.map(p => ({
        value: p.id,
        label: Number(p.listingCount) > 0 ? `${p.name} (${p.listingCount})` : p.name,
    }));

    return (
        <div className="h-full flex flex-col bg-[var(--bg-app)] overflow-hidden">
            {/* Header */}
            <div className="shrink-0 px-4 lg:px-6 py-3 border-b border-[var(--glass-border)] bg-[var(--bg-surface)]">
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex-none min-w-0">
                        <h1 className="text-base font-bold text-[var(--text-primary)] leading-tight">{t('unitinv.title')}</h1>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t('unitinv.subtitle')}</p>
                    </div>
                    <div className="hidden sm:block h-8 w-px bg-[var(--glass-border)]" />
                    <div className="w-full sm:w-72">
                        <Dropdown
                            value={projectId}
                            onChange={v => onProjectChange(String(v))}
                            options={projectOptions}
                            placeholder={projectsLoading ? t('unitinv.loading_projects') : t('unitinv.select_project')}
                            variant="compact"
                            disabled={projectsLoading || projects.length === 0}
                        />
                    </div>
                    <div className="relative flex-1 min-w-[160px] max-w-xs">
                        <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        <input
                            type="search"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder={t('unitinv.search_placeholder')}
                            aria-label={t('unitinv.search_placeholder')}
                            className="w-full pl-9 pr-3 h-10 border border-[var(--glass-border)] rounded-xl bg-[var(--bg-app)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-sgs-primary"
                        />
                    </div>
                    <div className="flex-1" />
                    <button
                        type="button"
                        onClick={() => void loadUnits()}
                        disabled={!project || unitsLoading}
                        className="shrink-0 inline-flex items-center gap-1.5 h-10 px-3 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-surface)] text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--glass-surface-hover)] disabled:opacity-50"
                    >
                        <svg className={`w-4 h-4 ${unitsLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        <span className="hidden sm:inline">{t('unitinv.refresh')}</span>
                    </button>
                    <a
                        href="/projects"
                        className="shrink-0 inline-flex items-center gap-1.5 h-10 px-3 rounded-xl bg-sgs-primary text-white text-sm font-semibold hover:opacity-90"
                    >
                        {t('unitinv.open_catalog')}
                    </a>
                </div>
            </div>

            <div className="flex-1 min-h-0 flex">
                <div className="flex-1 min-w-0 overflow-y-auto no-scrollbar p-4 lg:p-6 space-y-4">
                    {error && (
                        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 flex items-center justify-between gap-3" role="alert">
                            <span className="min-w-0">{error}</span>
                            <button type="button" onClick={() => void loadUnits()} className="shrink-0 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold">{t('unitinv.retry')}</button>
                        </div>
                    )}

                    {/* Source note */}
                    {project && (
                        <p className="text-xs text-[var(--text-tertiary)]">
                            {t('unitinv.source_note', { project: project.name, code: project.code })}
                        </p>
                    )}

                    {/* KPIs */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
                        {kpis.map(k => (
                            <div key={k.key} className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-surface)] px-4 py-3">
                                <div className="text-xs text-[var(--text-secondary)]">{k.label}</div>
                                <div className={`mt-1 text-xl font-bold tabular-nums ${k.tone || 'text-[var(--text-primary)]'}`}>{unitsLoading ? '…' : k.value}</div>
                                {k.hint && !unitsLoading && <div className="text-xs text-[var(--text-tertiary)] mt-0.5">{k.hint}</div>}
                            </div>
                        ))}
                    </div>

                    {/* Filters */}
                    {units.length > 0 && (
                        <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-surface)] p-3 space-y-2.5">
                            {towerNames.length > 0 && (
                                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar" role="group" aria-label={t('unitinv.filter_tower')}>
                                    <span className="shrink-0 text-xs font-semibold text-[var(--text-secondary)] w-16">{t('unitinv.tower')}</span>
                                    {['all', ...towerNames].map(tw => (
                                        <button key={tw} type="button" aria-pressed={tower === tw} onClick={() => setTower(tw)} className={chipClass(tower === tw)}>
                                            {tw === 'all' ? t('unitinv.all_towers') : t('unitinv.tower_name', { name: tw })}
                                        </button>
                                    ))}
                                </div>
                            )}
                            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar" role="group" aria-label={t('unitinv.filter_status')}>
                                <span className="shrink-0 text-xs font-semibold text-[var(--text-secondary)] w-16">{t('unitinv.status')}</span>
                                {statusChips.map(c => (
                                    <button key={c.key} type="button" aria-pressed={status === c.key} onClick={() => setStatus(c.key)} className={chipClass(status === c.key)}>
                                        {c.label}
                                        <span className="tabular-nums opacity-75">{statusCounts[c.key]}</span>
                                    </button>
                                ))}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-[11px] text-[var(--text-tertiary)]">
                                {LEGEND.map(tone => (
                                    <span key={tone} className="inline-flex items-center gap-1.5">
                                        <span className={`w-2.5 h-2.5 rounded-sm ${DOT_TONE[tone]}`} aria-hidden="true" />
                                        {t(`unitinv.tone_${tone}`)}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Body */}
                    {projectsLoading || unitsLoading ? (
                        <div className="flex items-center justify-center h-48">
                            <div className="w-8 h-8 border-4 border-[var(--glass-border)] border-t-[var(--sgs-primary)] rounded-full animate-spin" />
                        </div>
                    ) : !project ? (
                        <EmptyState title={t('unitinv.no_project_title')} body={t('unitinv.no_project_body')} />
                    ) : units.length === 0 ? (
                        <EmptyState title={t('unitinv.empty_title')} body={t('unitinv.empty_body')} action={<a href="/projects" className="mt-3 inline-flex items-center h-10 px-4 rounded-xl bg-sgs-primary text-white text-sm font-semibold hover:opacity-90">{t('unitinv.open_catalog')}</a>} />
                    ) : visible.length === 0 ? (
                        <EmptyState title={t('unitinv.no_match_title')} body={t('unitinv.no_match_body')} />
                    ) : (
                        <>
                            {plan.towers.map(tp => (
                                <section key={tp.tower} className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-surface)] overflow-hidden" aria-label={t('unitinv.tower_name', { name: tp.tower })}>
                                    <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--glass-border)]">
                                        <h2 className="text-sm font-semibold text-[var(--text-primary)]">{t('unitinv.tower_name', { name: tp.tower })}</h2>
                                        <span className="text-xs text-[var(--text-secondary)] tabular-nums">{t('unitinv.tower_summary', { total: tp.total, available: tp.available })}</span>
                                    </header>
                                    <div className="overflow-x-auto thin-scrollbar">
                                        <div className="min-w-max p-3 space-y-2">
                                            {tp.floors.map(row => (
                                                <div key={row.floor} className="flex items-stretch gap-2">
                                                    <div className="sticky left-0 z-[1] w-14 shrink-0 flex items-center justify-center rounded-lg bg-[var(--glass-surface)] text-xs font-semibold text-[var(--text-secondary)] tabular-nums">
                                                        {t('unitinv.floor_short', { n: row.floor })}
                                                    </div>
                                                    {row.units.map(u => <UnitCell key={u.id} u={u} />)}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </section>
                            ))}
                            {plan.unplaced.length > 0 && (
                                <section className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-surface)] overflow-hidden">
                                    <header className="px-4 py-3 border-b border-[var(--glass-border)]">
                                        <h2 className="text-sm font-semibold text-[var(--text-primary)]">{t('unitinv.unplaced_title', { n: plan.unplaced.length })}</h2>
                                        <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{t('unitinv.unplaced_hint')}</p>
                                    </header>
                                    <div className="p-3 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
                                        {plan.unplaced.map(u => <UnitCell key={u.id} u={u} wide />)}
                                    </div>
                                </section>
                            )}
                        </>
                    )}
                </div>

                {/* Unit detail */}
                {selected && (
                    <aside className="fixed inset-x-0 bottom-0 z-[60] max-h-[75dvh] rounded-t-2xl md:static md:z-auto md:max-h-none md:rounded-none md:w-[320px] md:shrink-0 border-t md:border-t-0 md:border-l border-[var(--glass-border)] bg-[var(--bg-surface)] shadow-2xl md:shadow-none overflow-y-auto" aria-label={t('unitinv.detail_title')}>
                        <div className="flex items-start justify-between gap-2 p-4 border-b border-[var(--glass-border)]">
                            <div className="min-w-0">
                                <div className="text-xs text-[var(--text-tertiary)]">{t('unitinv.detail_title')}</div>
                                <h2 className="text-base font-bold text-[var(--text-primary)] truncate">{selected.label}</h2>
                                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                    <span className={BADGE_TONE[selected.tone]}>{statusLabel(selected.status)}</span>
                                    {selected.code && selected.code !== selected.label && <span className="ui-badge ui-badge-neutral">{selected.code}</span>}
                                </div>
                            </div>
                            <button type="button" onClick={() => setSelected(null)} aria-label={t('common.close')} className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--glass-surface-hover)]">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="p-4">
                            <div className="rounded-xl bg-[var(--glass-surface)] px-4 py-3 mb-4">
                                <div className="text-xs text-[var(--text-secondary)]">{t('unitinv.price')}</div>
                                <div className="text-lg font-bold text-[var(--text-primary)] tabular-nums">{fmtPrice(selected.price)}</div>
                                {fmtUnitPrice(selected) && <div className="text-xs text-[var(--text-tertiary)] tabular-nums">{fmtUnitPrice(selected)}</div>}
                            </div>
                            <dl className="space-y-2.5 text-sm">
                                {([
                                    [t('unitinv.tower'), selected.tower ? t('unitinv.tower_name', { name: selected.tower }) : '—'],
                                    [t('unitinv.floor'), selected.floor ?? '—'],
                                    [t('unitinv.type'), typeLabel(selected.type)],
                                    [t('unitinv.bedrooms'), selected.bedrooms ?? '—'],
                                    [t('unitinv.area'), selected.area ? `${selected.area} m²` : '—'],
                                    [t('unitinv.clear_area'), selected.clearArea ? `${selected.clearArea} m²` : '—'],
                                    [t('unitinv.direction'), directionLabel(selected.direction)],
                                    [t('unitinv.view'), selected.view || '—'],
                                ] as Array<[string, React.ReactNode]>).map(([k, v]) => (
                                    <div key={k} className="flex items-start justify-between gap-3">
                                        <dt className="text-[var(--text-tertiary)] shrink-0">{k}</dt>
                                        <dd className="text-[var(--text-primary)] font-medium text-right min-w-0 break-words">{v}</dd>
                                    </div>
                                ))}
                            </dl>
                            {selected.title && selected.title !== selected.label && (
                                <p className="mt-4 text-xs text-[var(--text-secondary)] leading-relaxed">{selected.title}</p>
                            )}
                            <p className="mt-4 text-xs text-[var(--text-tertiary)] leading-relaxed">{t('unitinv.detail_hint')}</p>
                        </div>
                    </aside>
                )}
            </div>
        </div>
    );
}

function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
    return (
        <div className="rounded-2xl border border-dashed border-[var(--glass-border)] bg-[var(--bg-surface)] px-6 py-12 text-center">
            <div className="mx-auto mb-3 w-12 h-12 rounded-2xl bg-[var(--glass-surface)] flex items-center justify-center text-[var(--text-tertiary)]">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M4 21V5a2 2 0 012-2h8a2 2 0 012 2v16M16 9h2a2 2 0 012 2v10M8 7h4M8 11h4M8 15h4M3 21h18" /></svg>
            </div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
            <p className="mt-1 text-sm text-[var(--text-secondary)] max-w-md mx-auto">{body}</p>
            {action}
        </div>
    );
}
