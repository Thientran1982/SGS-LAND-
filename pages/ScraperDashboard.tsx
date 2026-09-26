import { uiNotify } from '../utils/uiDialog';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Globe, Building2, Users, Play, RefreshCw, Check, AlertTriangle, ExternalLink,
  Lock, Settings2, Upload, Download, Table2, LayoutGrid, Search,
} from 'lucide-react';
import { scraperApi } from '../services/api/scraperApi';
import { useTranslation } from '../services/i18n';
import { Dropdown } from '../components/Dropdown';
import { SeoHead } from '../components/SeoHead';
import {
  SettingsPage, SettingsHeader, SettingsCard, StatTile, StatGrid, UsageMeter, DistributionBar,
  StatusBadge, EmptyState, TONE_COLOR, SERIES_COLORS,
  type Tone, type Segment,
} from '../components/settings/SettingsUI';
import { DashboardValueBars, type DashboardBarItem } from '../components/dashboard/DashboardVisuals';

// ── Types ─────────────────────────────────────────────────────────────────────
type Tab = 'market' | 'projects' | 'leads';
type TFn = (key: string, params?: Record<string, string | number>) => string;
// -- Market tab
interface SourceStatus  { id: string; name: string; status: 'active' | 'blocked'; note: string; listings: string; }
interface ScrapeResult  { source: string; ok: boolean; count: number; error?: string; warning?: string; durationMs: number; }
interface ExternalListing {
  id: string; source: string; title: string; type: string; transaction: string;
  price: number; priceDisplay: string; area: number; pricePerM2: number;
  location: string; province: string; bedrooms: number | null;
  imageUrl: string | null; url: string; postedAt: string | null; scrapedAt: string;
}
interface StatusResponse { sources: SourceStatus[]; cacheValid: boolean; cacheAge: number | null; cacheTtlMin: number; scraperApiConfigured: boolean; }
interface RunResponse    { ok: boolean; results: ScrapeResult[]; listings: ExternalListing[]; totalListings: number; scrapedAt: string; }
// -- Projects tab
interface ProjectCatalog {
  id: string; name: string; siteUrl: string; note: string;
  color: string; logo: string; apiReady: boolean;
}
interface CatalogResponse { projects: ProjectCatalog[]; cacheValid: boolean; cacheAge: number | null; cacheTtlMin: number; }
interface ProjectResultSummary {
  projectId: string; project: string; siteUrl: string;
  ok: boolean; count: number; error?: string; warning?: string; durationMs: number;
}
interface ProjectUnit {
  id: string; project: string; projectId: string; type: string;
  block: string; floor: string; area: number; price: number;
  priceDisplay: string; pricePerM2: number;
  status: 'available' | 'sold' | 'reserved' | 'unknown';
  direction: string; url: string; imageUrl: string | null; scrapedAt: string;
}
interface ProjectRunResponse {
  ok: boolean; results: ProjectResultSummary[];
  units: ProjectUnit[]; totalUnits: number; scrapedAt: string;
}

// ── Shared class names ────────────────────────────────────────────────────────
const TH = 'px-3 py-2.5 text-left text-xs font-semibold text-[var(--text-secondary)] whitespace-nowrap';
const TD = 'px-3 py-3 align-top';
const CHIP = 'inline-flex items-center rounded-md bg-[var(--glass-surface)] px-1.5 py-0.5 text-xs font-medium text-[var(--text-secondary)] whitespace-nowrap';
const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)]';
const LINK = `rounded text-[var(--sgs-primary)] hover:underline ${FOCUS}`;

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDuration(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}
function fmtPrice(price: number, display: string, t: TFn): string {
  if (display && display !== '0') return display;
  if (!price) return t('scraper.v2_price_contact');
  if (price >= 1e9) return `${(price / 1e9).toFixed(1)} ${t('scraper.v2_unit_billion')}`;
  if (price >= 1e6) return `${(price / 1e6).toFixed(0)} ${t('scraper.v2_unit_million')}`;
  return price.toLocaleString('vi-VN');
}
/** Price per m² in millions (e.g. "85.3 tr"). */
const fmtPpm2 = (v: number, t: TFn) => t('scraper.v2_ppm2_value', { n: (v / 1e6).toFixed(1) });
function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
/** Count items per key, sorted by count desc. */
function countBy<T>(items: T[], key: (item: T) => string | null): Array<[string, number]> {
  const map = new Map<string, number>();
  for (const it of items) {
    const k = key(it);
    if (k) map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}
/** District-level area of a listing: prefer a "Quận/Huyện/Thị xã" segment, else the first segment, else province. */
function areaOf(l: ExternalListing): string | null {
  const parts = (l.location || '').split(',').map(s => s.trim()).filter(Boolean);
  const district = parts.find(p => /^(quận|q\.|huyện|thị xã|district)\s*/i.test(p));
  return district || parts[0] || l.province?.trim() || null;
}

const Spinner: React.FC<{ small?: boolean }> = ({ small }) => (
  <span className={`${small ? 'h-3 w-3' : 'h-4 w-4'} inline-block animate-spin rounded-full border-2 border-current border-t-transparent`} aria-hidden="true" />
);
const ErrorAlert: React.FC<{ message: string }> = ({ message }) => (
  <div role="alert" className="mt-3 flex items-start gap-2 rounded-xl border p-3 text-sm" style={{ color: TONE_COLOR.danger, borderColor: 'color-mix(in srgb, var(--ui-danger) 35%, transparent)', background: 'color-mix(in srgb, var(--ui-danger) 8%, transparent)' }}>
    <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
    <span className="min-w-0 break-words">{message}</span>
  </div>
);
const SearchInput: React.FC<{ value: string; onChange: (v: string) => void; placeholder: string }> = ({ value, onChange, placeholder }) => (
  <label className="relative block">
    <span className="sr-only">{placeholder}</span>
    <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" aria-hidden="true" />
    <input type="search" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="ui-input h-11 w-full pl-9" />
  </label>
);
const TruncationNote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="border-t border-[var(--glass-border)] px-4 py-2 text-center text-xs text-[var(--text-tertiary)]">{children}</div>
);
const RefreshButton: React.FC<{ onClick: () => void; loading: boolean; label: string }> = ({ onClick, loading, label }) => (
  <button type="button" onClick={onClick} disabled={loading} aria-label={label} title={label} className="ui-button ui-button-secondary ui-button-md min-h-10 min-w-10">
    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
  </button>
);

// Project logo tile colours (catalog provides a colour name; literal classes for Tailwind purge).
const PROJECT_COLOR_MAP: Record<string, string> = {
  indigo:  'bg-[var(--sgs-primary)]/10 text-[var(--sgs-primary)] border-[var(--sgs-primary)]/40',
  violet:  'bg-[var(--sgs-primary)]/10 text-[var(--sgs-primary)] border-[var(--sgs-primary)]/40',
  purple:  'bg-[var(--sgs-primary)]/10 text-[var(--sgs-primary)] border-[var(--sgs-primary)]/40',
  emerald: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700',
  green:   'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700',
  teal:    'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-700',
  blue:    'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700',
  sky:     'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-700',
  cyan:    'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-700',
  amber:   'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700',
  yellow:  'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-700',
  orange:  'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-700',
  rose:    'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-700',
  pink:    'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-700',
  lime:    'bg-lime-100 dark:bg-lime-900/30 text-lime-700 dark:text-lime-300 border-lime-200 dark:border-lime-700',
  slate:   'bg-slate-100 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600',
};
const ProjectLogo: React.FC<{ proj: ProjectCatalog; size?: 'sm' | 'md' }> = ({ proj, size = 'sm' }) => (
  <span aria-hidden="true" className={`flex shrink-0 items-center justify-center border font-bold leading-none ${size === 'md' ? 'h-10 w-10 rounded-xl text-[10px]' : 'h-6 w-6 rounded-lg text-[9px]'} ${PROJECT_COLOR_MAP[proj.color] ?? PROJECT_COLOR_MAP.indigo}`}>
    {proj.logo}
  </span>
);

const UNIT_STATUS: Record<ProjectUnit['status'], { labelKey: string; tone: Tone }> = {
  available: { labelKey: 'scraper.v2_unit_available', tone: 'success' },
  reserved:  { labelKey: 'scraper.v2_unit_reserved',  tone: 'warning' },
  sold:      { labelKey: 'scraper.v2_unit_sold',      tone: 'neutral' },
  unknown:   { labelKey: 'scraper.v2_unit_unknown',   tone: 'info' },
};
const UNIT_STATUS_ORDER: ProjectUnit['status'][] = ['available', 'reserved', 'sold', 'unknown'];
const SORT_OPTIONS = [
  { value: 'price',      labelKey: 'scraper.v2_sort_price' },
  { value: 'area',       labelKey: 'scraper.v2_sort_area' },
  { value: 'pricePerM2', labelKey: 'scraper.v2_sort_ppm2' },
];

// ── MARKET TAB ────────────────────────────────────────────────────────────────
const MARKET_SOURCES = ['chotot', 'alonhadat', 'batdongsan', 'muaban'] as const;
// Brand names, not translated.
const MARKET_SOURCE_NAMES: Record<string, string> = { chotot: 'Chợ Tốt', alonhadat: 'AlonNhaDat', batdongsan: 'BatDongSan', muaban: 'Muaban' };
const TX_LABEL_KEYS: Record<string, string> = { 'Bán': 'scraper.v2_tx_sale', 'Cho thuê': 'scraper.v2_tx_rent' };
// Sale price buckets in VND (upper bound exclusive).
const PRICE_BUCKETS: Array<{ labelKey: string; max: number }> = [
  { labelKey: 'scraper.v2_bucket_lt1', max: 1e9 },
  { labelKey: 'scraper.v2_bucket_1_2', max: 2e9 },
  { labelKey: 'scraper.v2_bucket_2_3', max: 3e9 },
  { labelKey: 'scraper.v2_bucket_3_5', max: 5e9 },
  { labelKey: 'scraper.v2_bucket_5_10', max: 10e9 },
  { labelKey: 'scraper.v2_bucket_gt10', max: Infinity },
];
const TOP_AREAS = 8;

function MarketTab() {
  const { t, language, formatTime } = useTranslation();
  const locale = language === 'vn' ? 'vi-VN' : 'en-US';
  const [status,    setStatus]    = useState<StatusResponse | null>(null);
  const [results,   setResults]   = useState<ScrapeResult[]>([]);
  const [listings,  setListings]  = useState<ExternalListing[]>([]);
  const [scrapedAt, setScrapedAt] = useState<string | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [running,   setRunning]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [selected,  setSelected]  = useState<string[]>(['chotot', 'alonhadat']);
  const [pages,     setPages]     = useState(3);
  const [filter,    setFilter]    = useState('');
  const [txFilter,  setTxFilter]  = useState('all');
  const [sortKey,   setSortKey]   = useState('price');
  const queryClient = useQueryClient();
  const { data: scraperStatusData, isLoading: scraperStatusLoading } = useQuery<any>({
    queryKey: ['scraperStatus'],
    queryFn: () => scraperApi.getStatus(),
    refetchInterval: 5000,
    staleTime: 4000,
  });
  const { data: scraperResultsData, isLoading: scraperResultsLoading } = useQuery<any>({
    queryKey: ['scraperResults'],
    queryFn: () => scraperApi.getMarketResults(),
    staleTime: 10_000,
  });
  useEffect(() => {
    if (scraperStatusData) setStatus(scraperStatusData);
    setLoading(scraperStatusLoading || scraperResultsLoading);
  }, [scraperStatusData, scraperStatusLoading, scraperResultsLoading]);
  useEffect(() => {
    if (scraperResultsData) {
      setResults(scraperResultsData.results ?? []);
      setListings(scraperResultsData.listings ?? []);
      setScrapedAt(scraperResultsData.scrapedAt ?? null);
    }
  }, [scraperResultsData]);
  const handleRun = async () => {
    if (running || !selected.length) return;
    setRunning(true); setError(null);
    try {
      const res  = await fetch('/api/scraper/run', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sources: selected, pages }),
      });
      const data: RunResponse = await res.json();
      if (!res.ok) throw new Error((data as any).error ?? t('scraper.v2_unknown_error'));
      setResults(data.results ?? []);
      setListings(data.listings ?? []);
      setScrapedAt(data.scrapedAt ?? null);
      queryClient.setQueryData(['scraperResults'], data);
      queryClient.invalidateQueries({ queryKey: ['scraperStatus'] });
    } catch (err) { setError(String(err)); }
    setRunning(false);
  };
  const toggleSource = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);

  const displayed = listings
    .filter(l => txFilter === 'all' || l.transaction === txFilter)
    .filter(l => !filter || l.title.toLowerCase().includes(filter.toLowerCase()) || l.location.toLowerCase().includes(filter.toLowerCase()))
    .sort((a: any, b: any) => b[sortKey] - a[sortKey]);
  const totalListings = results.reduce((s, r) => s + r.count, 0);
  const okSources = results.filter(r => r.ok).length;
  const txLabel = (tx: string) => (TX_LABEL_KEYS[tx] ? t(TX_LABEL_KEYS[tx]) : tx);

  // Visual summaries, derived only from the loaded run results / listings.
  const sourceSegments: Segment[] = results.filter(r => r.ok).map((r, i) => ({ label: r.source, value: r.count, color: SERIES_COLORS[i % SERIES_COLORS.length] }));
  const medianPpm2 = useMemo(() => median(listings.map(l => l.pricePerM2).filter(v => v > 0)), [listings]);
  const priceStats = useMemo(() => {
    const sale = listings.filter(l => l.transaction === 'Bán');
    const priced = sale.filter(l => l.price > 0);
    const counts = PRICE_BUCKETS.map(() => 0);
    for (const l of priced) {
      const idx = PRICE_BUCKETS.findIndex(b => l.price < b.max);
      counts[idx] += 1;
    }
    return { saleCount: sale.length, unpriced: sale.length - priced.length, counts, pricedCount: priced.length };
  }, [listings]);
  const priceItems: DashboardBarItem[] = priceStats.pricedCount
    ? PRICE_BUCKETS.map((b, i) => ({ label: t(b.labelKey), value: priceStats.counts[i] }))
    : [];
  const areaCounts = useMemo(() => countBy(listings, areaOf), [listings]);
  const areaItems: DashboardBarItem[] = areaCounts.slice(0, TOP_AREAS).map(([label, value]) => ({ label, value }));

  return (
    <div className="space-y-5">
      {/* Source status */}
      {status && (
        <SettingsCard
          title={t('scraper.v2_sources_title')}
          description={t(status.cacheValid ? 'scraper.v2_cache_valid' : 'scraper.v2_cache_expired', { n: status.cacheTtlMin })}
          actions={status.scraperApiConfigured
            ? <StatusBadge tone="success">{t('scraper.v2_scraperapi_on')}</StatusBadge>
            : <StatusBadge tone="warning">{t('scraper.v2_scraperapi_off')}</StatusBadge>}
        >
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {status.sources.map(src => (
              <li key={src.id} className="flex flex-col gap-2 rounded-xl border border-[var(--glass-border)] p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold text-[var(--text-primary)]">{src.name}</span>
                  {src.status === 'active'
                    ? <StatusBadge tone="success"><Check size={12} className="mr-1 inline" aria-hidden="true" />{t('scraper.v2_source_active')}</StatusBadge>
                    : <StatusBadge tone="danger"><Lock size={12} className="mr-1 inline" aria-hidden="true" />{t('scraper.v2_source_blocked')}</StatusBadge>}
                </div>
                <p className="text-xs leading-relaxed text-[var(--text-tertiary)]">{src.note}</p>
                <div className="mt-auto flex items-center justify-between gap-2 border-t border-[var(--glass-border)] pt-2 text-xs">
                  <span className="text-[var(--text-secondary)]">{t('scraper.v2_source_volume')}</span>
                  <span className="font-semibold tabular-nums text-[var(--text-primary)]">
                    {src.status === 'active' && src.listings ? t('scraper.v2_listings_count', { n: src.listings }) : '—'}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </SettingsCard>
      )}

      {/* Run panel */}
      <SettingsCard title={t('scraper.v2_run_title')} description={t('scraper.v2_run_desc')}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <fieldset className="min-w-0 flex-1">
            <legend className="mb-1.5 text-xs font-semibold text-[var(--text-secondary)]">{t('scraper.v2_sources_label')}</legend>
            <div className="flex flex-wrap gap-2">
              {MARKET_SOURCES.map(id => {
                const blocked = !status?.scraperApiConfigured && ['batdongsan', 'muaban'].includes(id);
                const active  = selected.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => !blocked && toggleSource(id)}
                    disabled={blocked}
                    aria-pressed={active}
                    title={blocked ? t('scraper.v2_source_needs_key') : undefined}
                    aria-label={blocked ? `${MARKET_SOURCE_NAMES[id]} — ${t('scraper.v2_source_needs_key')}` : undefined}
                    className={[
                      'inline-flex min-h-10 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium transition-colors',
                      FOCUS,
                      blocked ? 'cursor-not-allowed border-[var(--glass-border)] text-[var(--text-tertiary)] opacity-60'
                        : active ? 'border-[var(--sgs-primary)] bg-[var(--sgs-primary)] text-white'
                        : 'border-[var(--glass-border)] text-[var(--text-secondary)] hover:border-[var(--sgs-primary)] hover:text-[var(--sgs-primary)]',
                    ].join(' ')}
                  >
                    {active && !blocked && <Check size={14} aria-hidden="true" />}
                    {blocked && <Lock size={14} aria-hidden="true" />}
                    {MARKET_SOURCE_NAMES[id]}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <div className="w-full sm:w-56">
            <Dropdown
              label={t('scraper.v2_pages_label')}
              value={pages}
              onChange={(v) => setPages(Number(v))}
              options={[1, 2, 3, 5, 10].map(v => ({ value: v, label: t('scraper.v2_pages_option', { n: v }) }))}
            />
          </div>
          <button type="button" onClick={handleRun} disabled={running || !selected.length} className="ui-button ui-button-primary ui-button-md min-h-11 w-full sm:w-auto">
            {running ? <><Spinner />{t('scraper.v2_running')}</> : <><Play size={16} aria-hidden="true" />{t('scraper.v2_run_button')}</>}
          </button>
        </div>
        {error && <ErrorAlert message={error} />}
      </SettingsCard>

      {/* Summary + visuals */}
      {results.length > 0 && (
        <>
          <StatGrid>
            <StatTile label={t('scraper.v2_kpi_total_listings')} value={totalListings.toLocaleString(locale)} tone="brand" />
            <StatTile
              label={t('scraper.v2_kpi_sources_ok')}
              value={`${okSources}/${results.length}`}
              tone={okSources === results.length ? 'success' : okSources === 0 ? 'danger' : 'warning'}
            />
            <StatTile
              label={t('scraper.v2_kpi_median_ppm2')}
              value={medianPpm2 != null ? fmtPpm2(medianPpm2, t) : '—'}
              hint={medianPpm2 != null ? t('scraper.v2_kpi_median_ppm2_hint') : undefined}
            />
            <StatTile label={t('scraper.v2_kpi_updated')} value={scrapedAt ? formatTime(scrapedAt) : '—'} />
          </StatGrid>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <SettingsCard title={t('scraper.v2_by_source_title')} description={t('scraper.v2_by_source_desc')}>
              <DistributionBar segments={sourceSegments} ariaLabel={t('scraper.v2_by_source_title')} emptyText={t('scraper.v2_no_chart_data')} formatValue={n => n.toLocaleString(locale)} />
              <ul className="mt-4 space-y-2">
                {results.map(r => (
                  <li key={r.source} className="rounded-xl border border-[var(--glass-border)] px-3 py-2">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="min-w-0 truncate font-semibold text-[var(--text-primary)]">{r.source}</span>
                      <StatusBadge tone={r.ok ? 'success' : 'danger'}>{t(r.ok ? 'scraper.v2_result_ok' : 'scraper.v2_result_failed')}</StatusBadge>
                    </div>
                    <div className="mt-1 text-xs tabular-nums text-[var(--text-tertiary)]">
                      {t('scraper.v2_result_meta', { n: r.count.toLocaleString(locale), d: fmtDuration(r.durationMs) })}
                    </div>
                    {r.error && <p className="mt-1 break-words text-xs" style={{ color: TONE_COLOR.danger }}>{r.error}</p>}
                    {r.warning && <p className="mt-1 break-words text-xs" style={{ color: TONE_COLOR.warning }}>{r.warning}</p>}
                  </li>
                ))}
              </ul>
            </SettingsCard>
            <SettingsCard title={t('scraper.v2_price_dist_title')} description={t('scraper.v2_price_dist_desc', { n: priceStats.pricedCount.toLocaleString(locale) })}>
              <DashboardValueBars items={priceItems} locale={locale} ariaLabel={t('scraper.v2_price_dist_title')} emptyText={t('scraper.v2_no_chart_data')} />
              {priceStats.unpriced > 0 && (
                <p className="mt-3 text-xs text-[var(--text-tertiary)]">{t('scraper.v2_price_unpriced', { n: priceStats.unpriced.toLocaleString(locale) })}</p>
              )}
            </SettingsCard>
            <SettingsCard title={t('scraper.v2_area_title', { n: TOP_AREAS })} description={t('scraper.v2_area_desc')}>
              <DashboardValueBars items={areaItems} locale={locale} ariaLabel={t('scraper.v2_area_title', { n: TOP_AREAS })} emptyText={t('scraper.v2_no_chart_data')} />
              {areaCounts.length > TOP_AREAS && (
                <p className="mt-3 text-xs text-[var(--text-tertiary)]">{t('scraper.v2_area_more', { n: areaCounts.length - TOP_AREAS })}</p>
              )}
            </SettingsCard>
          </div>
        </>
      )}

      {/* Listings table */}
      {listings.length > 0 && (
        <SettingsCard
          title={t('scraper.v2_listings_title')}
          actions={<span className="text-xs tabular-nums text-[var(--text-tertiary)]">{t('scraper.v2_listings_count', { n: displayed.length.toLocaleString(locale) })}</span>}
          bodyClassName="p-0"
        >
          <div className="grid grid-cols-1 gap-3 border-b border-[var(--glass-border)] p-4 sm:grid-cols-3 sm:px-5">
            <SearchInput value={filter} onChange={setFilter} placeholder={t('scraper.v2_search_listings')} />
            <Dropdown
              value={txFilter}
              placeholder={t('scraper.v2_filter_tx')}
              onChange={(v) => setTxFilter(v as string)}
              options={[
                { value: 'all',      label: t('scraper.v2_tx_all') },
                { value: 'Bán',      label: t('scraper.v2_tx_sale') },
                { value: 'Cho thuê', label: t('scraper.v2_tx_rent') },
              ]}
            />
            <Dropdown
              value={sortKey}
              placeholder={t('scraper.v2_sort_label')}
              onChange={(v) => setSortKey(v as string)}
              options={SORT_OPTIONS.map(o => ({ value: o.value, label: t(o.labelKey) }))}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label={t('scraper.v2_listings_title')}>
              <thead>
                <tr className="bg-[var(--glass-surface)]">
                  <th scope="col" className={`${TH} pl-4`}>{t('scraper.v2_col_listing')}</th>
                  <th scope="col" className={TH}>{t('scraper.v2_col_price')}</th>
                  <th scope="col" className={TH}>{t('scraper.v2_col_area')}</th>
                  <th scope="col" className={`${TH} hidden md:table-cell`}>{t('scraper.v2_col_ppm2')}</th>
                  <th scope="col" className={`${TH} hidden sm:table-cell`}>{t('scraper.v2_col_source')}</th>
                  <th scope="col" className={`${TH} hidden lg:table-cell`}>{t('scraper.v2_col_posted')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--glass-border)]">
                {displayed.slice(0, 100).map((l: ExternalListing) => (
                  <tr key={l.id} className="transition-colors hover:bg-[var(--glass-surface-hover)]">
                    <td className={`${TD} min-w-[200px] max-w-sm pl-4`}>
                      <a href={l.url} target="_blank" rel="noopener noreferrer" className={`flex items-start gap-1 font-medium text-[var(--text-primary)] hover:text-[var(--sgs-primary)] hover:underline ${FOCUS} rounded`}>
                        <span className="line-clamp-2 flex-1">{l.title}</span>
                        <ExternalLink size={12} className="mt-1 shrink-0 text-[var(--text-tertiary)]" aria-hidden="true" />
                      </a>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <StatusBadge tone={l.transaction === 'Bán' ? 'success' : 'info'}>{txLabel(l.transaction)}</StatusBadge>
                        <span className={`${CHIP} sm:hidden`}>{l.source}</span>
                        {l.location && <span className="max-w-[200px] truncate text-xs text-[var(--text-tertiary)]">{l.location}</span>}
                      </div>
                    </td>
                    <td className={`${TD} whitespace-nowrap font-semibold text-[var(--text-primary)]`}>{fmtPrice(l.price, l.priceDisplay, t)}</td>
                    <td className={`${TD} tabular-nums text-[var(--text-secondary)]`}>{l.area > 0 ? l.area.toFixed(0) : '—'}</td>
                    <td className={`${TD} hidden whitespace-nowrap tabular-nums text-[var(--text-secondary)] md:table-cell`}>{l.pricePerM2 > 0 ? fmtPpm2(l.pricePerM2, t) : '—'}</td>
                    <td className={`${TD} hidden sm:table-cell`}><span className={CHIP}>{l.source}</span></td>
                    <td className={`${TD} hidden whitespace-nowrap text-xs text-[var(--text-tertiary)] lg:table-cell`}>{l.postedAt ? formatTime(l.postedAt) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {displayed.length > 100 && <TruncationNote>{t('scraper.v2_truncated_listings', { n: 100, total: displayed.length })}</TruncationNote>}
        </SettingsCard>
      )}
      {!loading && listings.length === 0 && (
        <SettingsCard as="div">
          <EmptyState icon={<Globe size={20} />} title={t('scraper.v2_empty_title')} description={t('scraper.v2_empty_desc')} />
        </SettingsCard>
      )}
    </div>
  );
}

// ── PROJECTS TAB ──────────────────────────────────────────────────────────────
function ProjectsTab() {
  const { t, language, formatTime } = useTranslation();
  const locale = language === 'vn' ? 'vi-VN' : 'en-US';
  const [catalog,    setCatalog]    = useState<ProjectCatalog[]>([]);
  const [results,    setResults]    = useState<ProjectResultSummary[]>([]);
  const [units,      setUnits]      = useState<ProjectUnit[]>([]);
  const [scrapedAt,  setScrapedAt]  = useState<string | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [running,    setRunning]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [selected,   setSelected]   = useState<string[]>([]);
  const [filter,     setFilter]     = useState('');
  const [projFilter, setProjFilter] = useState('all');
  const [sortKey,    setSortKey]    = useState('price');
  const [statusFilter, setStatusFilter] = useState('all');
  const loadCatalog = useCallback(async () => {
    try {
      const res = await fetch('/api/scraper/projects/catalog', { credentials: 'include' });
      if (res.ok) {
        const data: CatalogResponse = await res.json();
        setCatalog(data.projects ?? []);
        if (selected.length === 0) setSelected(data.projects.map(p => p.id));
      }
    } catch { /* ignore */ }
  }, []); // eslint-disable-line

  const loadResults = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/scraper/projects/results', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setResults(data.results ?? []);
        setUnits(data.units ?? []);
        setScrapedAt(data.scrapedAt ?? null);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);
  useEffect(() => { loadCatalog(); loadResults(); }, [loadCatalog, loadResults]);
  const handleRun = async () => {
    if (running || !selected.length) return;
    setRunning(true); setError(null);
    try {
      const res  = await fetch('/api/scraper/projects/run', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projects: selected }),
      });
      const data: ProjectRunResponse = await res.json();
      if (!res.ok) throw new Error((data as any).error ?? t('scraper.v2_unknown_error'));
      setResults(data.results ?? []);
      setUnits(data.units ?? []);
      setScrapedAt(data.scrapedAt ?? null);
      loadCatalog();
    } catch (err) { setError(String(err)); }
    setRunning(false);
  };
  const toggleProject = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  const projOptions = [{ value: 'all', label: t('scraper.v2_all_projects') }, ...catalog.map(p => ({ value: p.id, label: p.name }))];
  const displayed = units
    .filter(u => projFilter === 'all' || u.projectId === projFilter)
    .filter(u => statusFilter === 'all' || u.status === statusFilter)
    .filter(u => !filter || u.type.toLowerCase().includes(filter.toLowerCase()) || u.block.toLowerCase().includes(filter.toLowerCase()))
    .sort((a: any, b: any) => sortKey === 'price' ? b.price - a.price : sortKey === 'area' ? b.area - a.area : b.pricePerM2 - a.pricePerM2);

  // Visual summaries from the loaded units / results.
  const okProjects = results.filter(r => r.ok).length;
  const availableUnits = units.filter(u => u.status === 'available').length;
  const medianPpm2 = useMemo(() => median(units.map(u => u.pricePerM2).filter(v => v > 0)), [units]);
  const projectSegments: Segment[] = countBy(units, u => u.project || null).map(([label, value], i) => ({ label, value, color: SERIES_COLORS[i % SERIES_COLORS.length] }));
  const statusSegments: Segment[] = UNIT_STATUS_ORDER.map(s => ({
    label: t(UNIT_STATUS[s].labelKey),
    value: units.filter(u => (UNIT_STATUS[u.status] ? u.status : 'unknown') === s).length,
    color: TONE_COLOR[UNIT_STATUS[s].tone],
  }));

  return (
    <div className="space-y-5">
      {/* Project picker */}
      {catalog.length > 0 && (
        <SettingsCard title={t('scraper.v2_projects_pick_title')} description={t('scraper.v2_selected_of', { n: selected.length, total: catalog.length })}>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {catalog.map(proj => {
              const resultInfo = results.find(r => r.projectId === proj.id);
              const isSelected = selected.includes(proj.id);
              return (
                <li
                  key={proj.id}
                  className={[
                    'flex flex-col gap-2 rounded-xl border p-3 transition-colors',
                    isSelected ? 'border-[var(--sgs-primary)] ring-1 ring-[var(--sgs-primary)]' : 'border-[var(--glass-border)] hover:border-[var(--ui-border-strong)]',
                  ].join(' ')}
                >
                  <button type="button" onClick={() => toggleProject(proj.id)} aria-pressed={isSelected} className={`flex min-h-10 w-full items-start gap-3 rounded-lg text-left ${FOCUS}`}>
                    <ProjectLogo proj={proj} size="md" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold leading-tight text-[var(--text-primary)]">{proj.name}</span>
                      <span className="mt-1 block text-xs leading-relaxed text-[var(--text-tertiary)]">{proj.note}</span>
                    </span>
                    <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${isSelected ? 'border-[var(--sgs-primary)] bg-[var(--sgs-primary)] text-white' : 'border-[var(--glass-border)]'}`} aria-hidden="true">
                      {isSelected && <Check size={12} strokeWidth={3} />}
                    </span>
                  </button>
                  <a href={proj.siteUrl} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1 self-start text-xs ${LINK}`}>
                    <span className="truncate">{proj.siteUrl.replace('https://', '')}</span>
                    <ExternalLink size={12} aria-hidden="true" />
                  </a>
                  <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-[var(--glass-border)] pt-2">
                    {resultInfo
                      ? <StatusBadge tone={resultInfo.ok ? 'success' : 'danger'}>{resultInfo.ok ? t('scraper.v2_units_count', { n: resultInfo.count }) : t('scraper.v2_result_error')}</StatusBadge>
                      : <span className="text-xs text-[var(--text-tertiary)]">{t('scraper.v2_not_scraped')}</span>}
                    {!proj.apiReady && <StatusBadge tone="warning"><Lock size={12} className="mr-1 inline" aria-hidden="true" />{t('scraper.v2_no_api')}</StatusBadge>}
                  </div>
                  {resultInfo?.error && <p className="line-clamp-2 break-words text-xs" style={{ color: TONE_COLOR.danger }}>{resultInfo.error}</p>}
                  {resultInfo?.warning && <p className="line-clamp-2 break-words text-xs" style={{ color: TONE_COLOR.warning }}>{resultInfo.warning}</p>}
                </li>
              );
            })}
          </ul>
        </SettingsCard>
      )}

      {/* Run panel */}
      <SettingsCard>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              {selected.length === 0 ? t('scraper.v2_projects_pick_hint') : t('scraper.v2_selected_of', { n: selected.length, total: catalog.length })}
            </p>
            <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">
              {scrapedAt ? t('scraper.v2_updated_at', { time: formatTime(scrapedAt) }) : t('scraper.v2_projects_run_hint')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <RefreshButton onClick={loadResults} loading={loading} label={t('scraper.v2_refresh_results')} />
            <button type="button" onClick={handleRun} disabled={running || !selected.length} className="ui-button ui-button-primary ui-button-md min-h-10 flex-1 sm:flex-none">
              {running ? <><Spinner />{t('scraper.v2_running')}</> : <><Play size={16} aria-hidden="true" />{t('scraper.v2_run_button')}</>}
            </button>
          </div>
        </div>
        {error && <ErrorAlert message={error} />}
      </SettingsCard>

      {/* Summary + visuals */}
      {units.length > 0 && (
        <>
          <StatGrid>
            <StatTile label={t('scraper.v2_kpi_total_units')} value={units.length.toLocaleString(locale)} tone="brand" />
            <StatTile
              label={t('scraper.v2_kpi_available')}
              value={availableUnits.toLocaleString(locale)}
              tone="success"
              hint={t('scraper.v2_kpi_share', { n: Math.round((availableUnits / units.length) * 100) })}
            />
            <StatTile
              label={t('scraper.v2_kpi_projects_ok')}
              value={results.length ? `${okProjects}/${results.length}` : '—'}
              tone={!results.length ? 'neutral' : okProjects === results.length ? 'success' : okProjects === 0 ? 'danger' : 'warning'}
            />
            <StatTile label={t('scraper.v2_kpi_median_ppm2')} value={medianPpm2 != null ? fmtPpm2(medianPpm2, t) : '—'} />
          </StatGrid>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SettingsCard title={t('scraper.v2_units_by_project')}>
              <DistributionBar segments={projectSegments} ariaLabel={t('scraper.v2_units_by_project')} emptyText={t('scraper.v2_no_chart_data')} formatValue={n => n.toLocaleString(locale)} />
            </SettingsCard>
            <SettingsCard title={t('scraper.v2_units_by_status')}>
              <DistributionBar segments={statusSegments} ariaLabel={t('scraper.v2_units_by_status')} emptyText={t('scraper.v2_no_chart_data')} formatValue={n => n.toLocaleString(locale)} />
            </SettingsCard>
          </div>
        </>
      )}

      {/* Units table */}
      {units.length > 0 && (
        <SettingsCard
          title={t('scraper.v2_units_title')}
          actions={<span className="text-xs tabular-nums text-[var(--text-tertiary)]">{t('scraper.v2_units_count', { n: displayed.length.toLocaleString(locale) })}</span>}
          bodyClassName="p-0"
        >
          <div className={`grid grid-cols-1 gap-3 border-b border-[var(--glass-border)] p-4 sm:grid-cols-2 sm:px-5 ${catalog.length > 0 ? 'xl:grid-cols-4' : 'xl:grid-cols-3'}`}>
            <SearchInput value={filter} onChange={setFilter} placeholder={t('scraper.v2_search_units')} />
            {catalog.length > 0 && (
              <Dropdown value={projFilter} placeholder={t('scraper.v2_filter_project')} onChange={(v) => setProjFilter(v as string)} options={projOptions} />
            )}
            <Dropdown
              value={statusFilter}
              placeholder={t('scraper.v2_filter_status')}
              onChange={(v) => setStatusFilter(v as string)}
              options={[
                { value: 'all', label: t('scraper.v2_status_all') },
                ...UNIT_STATUS_ORDER.map(s => ({ value: s, label: t(UNIT_STATUS[s].labelKey) })),
              ]}
            />
            <Dropdown
              value={sortKey}
              placeholder={t('scraper.v2_sort_label')}
              onChange={(v) => setSortKey(v as string)}
              options={SORT_OPTIONS.map(o => ({ value: o.value, label: t(o.labelKey) }))}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label={t('scraper.v2_units_title')}>
              <thead>
                <tr className="bg-[var(--glass-surface)]">
                  <th scope="col" className={`${TH} pl-4`}>{t('scraper.v2_col_project')}</th>
                  <th scope="col" className={TH}>{t('scraper.v2_col_type')}</th>
                  <th scope="col" className={`${TH} hidden md:table-cell`}>{t('scraper.v2_col_block_floor')}</th>
                  <th scope="col" className={TH}>{t('scraper.v2_col_area')}</th>
                  <th scope="col" className={TH}>{t('scraper.v2_col_price')}</th>
                  <th scope="col" className={TH}>{t('scraper.v2_col_status')}</th>
                  <th scope="col" className={TH}><span className="sr-only">{t('scraper.v2_col_link')}</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--glass-border)]">
                {displayed.slice(0, 150).map((u: ProjectUnit) => {
                  const proj = catalog.find(p => p.id === u.projectId);
                  const st   = UNIT_STATUS[u.status] ?? UNIT_STATUS.unknown;
                  return (
                    <tr key={u.id} className="transition-colors hover:bg-[var(--glass-surface-hover)]">
                      <td className={`${TD} pl-4`}>
                        <div className="flex items-center gap-2">
                          {proj && <ProjectLogo proj={proj} />}
                          <span className="whitespace-nowrap text-xs font-medium text-[var(--text-primary)]">{u.project}</span>
                        </div>
                      </td>
                      <td className={`${TD} whitespace-nowrap text-xs text-[var(--text-secondary)]`}>{u.type || '—'}</td>
                      <td className={`${TD} hidden text-xs text-[var(--text-secondary)] md:table-cell`}>{[u.block, u.floor].filter(Boolean).join(' / ') || '—'}</td>
                      <td className={`${TD} whitespace-nowrap tabular-nums text-[var(--text-secondary)]`}>{u.area > 0 ? `${u.area.toFixed(0)} m²` : '—'}</td>
                      <td className={`${TD} whitespace-nowrap font-semibold text-[var(--text-primary)]`}>{u.priceDisplay || t('scraper.v2_price_contact')}</td>
                      <td className={TD}><StatusBadge tone={st.tone}>{t(st.labelKey)}</StatusBadge></td>
                      <td className={TD}>
                        <a href={u.url} target="_blank" rel="noopener noreferrer" aria-label={t('scraper.v2_open_unit', { name: [u.project, u.type].filter(Boolean).join(' · ') })} className={`inline-flex min-h-10 items-center gap-1 whitespace-nowrap px-1 text-xs ${LINK}`}>
                          {t('scraper.v2_view')}<ExternalLink size={12} aria-hidden="true" />
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {displayed.length > 150 && <TruncationNote>{t('scraper.v2_truncated_units', { n: 150, total: displayed.length })}</TruncationNote>}
        </SettingsCard>
      )}
      {!loading && !running && units.length === 0 && (
        <SettingsCard as="div">
          <EmptyState icon={<Building2 size={20} />} title={t('scraper.v2_projects_empty_title')} description={t('scraper.v2_projects_empty_desc')} />
        </SettingsCard>
      )}
    </div>
  );
}

// ── LEADS TAB ─────────────────────────────────────────────────────────────────
type LeadInterest = 'seller' | 'buyer' | 'renter' | 'investor' | 'unknown';

interface ProjectLead {
  id: string; projectId: string; project: string;
  name: string; phone: string; email: string;
  source: string; sourceUrl: string; listing: string; price: string;
  interest: LeadInterest; notes: string;
  scrapedAt: string; importedAt: string | null;
}

interface LeadResultSummary {
  projectId: string; project: string;
  ok: boolean; count: number; error?: string; durationMs: number;
}
interface LeadRunResponse {
  ok: boolean; results: LeadResultSummary[];
  leads: ProjectLead[]; totalLeads: number; scrapedAt: string;
}
const INTEREST_ORDER: LeadInterest[] = ['buyer', 'seller', 'renter', 'investor', 'unknown'];
const INTEREST: Record<LeadInterest, { labelKey: string; tone: Tone }> = {
  seller:   { labelKey: 'scraper.v2_interest_seller',   tone: 'accent' },
  buyer:    { labelKey: 'scraper.v2_interest_buyer',    tone: 'success' },
  renter:   { labelKey: 'scraper.v2_interest_renter',   tone: 'info' },
  investor: { labelKey: 'scraper.v2_interest_investor', tone: 'brand' },
  unknown:  { labelKey: 'scraper.v2_interest_unknown',  tone: 'neutral' },
};
// Lead sources: brand names are shown as-is, generic ones are translated.
const LEAD_SOURCES: Record<string, { name?: string; labelKey?: string }> = {
  sgsland_db:   { labelKey: 'scraper.v2_src_internal_db' },
  batdongsan:   { name: 'BatDongSan' },
  muaban:       { name: 'Muaban' },
  homedy:       { name: 'Homedy' },
  homedy_forum: { labelKey: 'scraper.v2_src_homedy_forum' },
  alonhadat:    { name: 'AlonNhaDat' },
  mogi:         { name: 'Mogi' },
  nhatot:       { name: 'NhaTot' },
  cafeland:     { name: 'Cafeland' },
  website:      { labelKey: 'scraper.v2_src_project_site' },
  chotot:       { name: 'Chợ Tốt' },
  facebook:     { name: 'Facebook Ads' },
  tiktok:       { name: 'TikTok' },
  zalo:         { name: 'Zalo OA' },
};
const leadSourceLabel = (id: string, t: TFn) => {
  const s = LEAD_SOURCES[id];
  return s?.labelKey ? t(s.labelKey) : s?.name ?? id;
};
interface SocialCfg { fbToken: string; fbPage: string; ttToken: string; ttAdv: string; zlToken: string; }
const SOCIAL_FIELDS: Array<{ key: keyof SocialCfg; labelKey: string; placeholder: string; wide?: boolean }> = [
  { key: 'fbToken', labelKey: 'scraper.v2_cfg_fb_token', placeholder: 'EAAxxxxxx...' },
  { key: 'fbPage',  labelKey: 'scraper.v2_cfg_fb_page',  placeholder: '123456789:987654321' },
  { key: 'ttToken', labelKey: 'scraper.v2_cfg_tt_token', placeholder: 'tt_xxxxxxxxxx...' },
  { key: 'ttAdv',   labelKey: 'scraper.v2_cfg_tt_adv',   placeholder: '7123456789...' },
  { key: 'zlToken', labelKey: 'scraper.v2_cfg_zl_token', placeholder: 'zoa_xxxxxxxxxx...', wide: true },
];

/** Import control shared by the table and card views. */
const ImportControl: React.FC<{ imported: boolean; importing: boolean; hasContact: boolean; onImport: () => void; full?: boolean; name: string }> = ({ imported, importing, hasContact, onImport, full, name }) => {
  const { t } = useTranslation();
  if (imported) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: TONE_COLOR.success }}>
        <Check size={14} aria-hidden="true" />{t('scraper.v2_saved_crm')}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onImport}
      disabled={importing || !hasContact}
      aria-label={t('scraper.v2_import_one', { name })}
      title={!hasContact ? t('scraper.v2_no_contact') : undefined}
      className={`ui-button ui-button-primary ui-button-sm min-h-10 ${full ? 'w-full' : ''}`}
    >
      {importing ? <Spinner small /> : <Upload size={14} aria-hidden="true" />}
      {t('scraper.v2_import_crm')}
    </button>
  );
};

/** Card for one lead (card view and extended sources). */
const LeadCard: React.FC<{
  lead: ProjectLead; proj?: ProjectCatalog; showProject?: boolean; showListing?: boolean;
  imported: boolean; importing: boolean; onImport: () => void;
}> = ({ lead, proj, showProject, showListing, imported, importing, onImport }) => {
  const { t } = useTranslation();
  const name = lead.name || t('scraper.v2_unknown_name');
  return (
    <li className={`flex flex-col gap-2 rounded-xl border border-[var(--glass-border)] p-3 ${imported ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="line-clamp-1 text-sm font-semibold leading-tight text-[var(--text-primary)]">{name}</span>
        <span className={CHIP}>{leadSourceLabel(lead.source, t)}</span>
      </div>
      {lead.phone && <a href={`tel:${lead.phone}`} className={`self-start text-base font-bold tabular-nums ${LINK}`}>{lead.phone}</a>}
      {lead.email && <a href={`mailto:${lead.email}`} className={`truncate text-xs ${LINK}`}>{lead.email}</a>}
      {showProject && proj && (
        <div className="flex items-center gap-1.5">
          <ProjectLogo proj={proj} />
          <span className="truncate text-xs text-[var(--text-tertiary)]">{lead.project}</span>
        </div>
      )}
      {showListing && lead.listing && <div className="line-clamp-2 text-xs text-[var(--text-secondary)]">{lead.listing}</div>}
      {lead.price && <span className="text-xs font-semibold" style={{ color: TONE_COLOR.success }}>{lead.price}</span>}
      <div className="mt-auto pt-1">
        <ImportControl imported={imported} importing={importing} hasContact={!!(lead.phone || lead.email)} onImport={onImport} full name={name} />
      </div>
    </li>
  );
};

function LeadsTab() {
  const { t, language, formatTime } = useTranslation();
  const locale = language === 'vn' ? 'vi-VN' : 'en-US';
  const [catalog,        setCatalog]        = useState<ProjectCatalog[]>([]);
  const [results,        setResults]        = useState<LeadResultSummary[]>([]);
  const [leads,          setLeads]          = useState<ProjectLead[]>([]);
  const [scrapedAt,      setScrapedAt]      = useState<string | null>(null);
  const [loading,        setLoading]        = useState(false);
  const [running,        setRunning]        = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  const [selected,       setSelected]       = useState<string[]>([]);
  const [filter,         setFilter]         = useState('');
  const [projFilter,     setProjFilter]     = useState('all');
  const [interFilter,    setInterFilter]    = useState('all');
  const [importing,      setImporting]      = useState<Set<string>>(new Set());
  const [imported,       setImported]       = useState<Set<string>>(new Set());
  const [viewMode,       setViewMode]       = useState<'table' | 'cards'>('table');
  const [extLeads,       setExtLeads]       = useState<ProjectLead[]>([]);
  const [extRunning,     setExtRunning]     = useState<string | null>(null);
  const [extError,       setExtError]       = useState<string | null>(null);
  const [socialCfg,      setSocialCfg]      = useState<SocialCfg>({ fbToken: '', fbPage: '', ttToken: '', ttAdv: '', zlToken: '' });
  const [showCfg,        setShowCfg]        = useState(false);
  const loadCatalog = useCallback(async () => {
    try {
      const res = await fetch('/api/scraper/projects/catalog', { credentials: 'include' });
      if (res.ok) {
        const data: CatalogResponse = await res.json();
        setCatalog(data.projects ?? []);
        if (selected.length === 0) setSelected(data.projects.map(p => p.id));
      }
    } catch { /* ignore */ }
  }, []); // eslint-disable-line

  const loadResults = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/scraper/projects/leads/results', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setResults(data.results ?? []);
        setLeads(data.leads ?? []);
        setScrapedAt(data.scrapedAt ?? null);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);
  useEffect(() => { loadCatalog(); loadResults(); }, [loadCatalog, loadResults]);
  const handleRun = async () => {
    if (running || !selected.length) return;
    setRunning(true); setError(null);
    try {
      const res  = await fetch('/api/scraper/projects/leads/run', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projects: selected }),
      });
      const data: LeadRunResponse = await res.json();
      if (!res.ok) throw new Error((data as any).error ?? t('scraper.v2_unknown_error'));
      setResults(data.results ?? []);
      setLeads(data.leads ?? []);
      setScrapedAt(data.scrapedAt ?? null);
    } catch (err) { setError(String(err)); }
    setRunning(false);
  };
  const handleImport = async (lead: ProjectLead) => {
    setImporting(prev => new Set(prev).add(lead.id));
    try {
      const res = await fetch('/api/scraper/projects/leads/import', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lead),
      });
      if (res.ok || res.status === 409) {
        setImported(prev => new Set(prev).add(lead.id));
      }
    } catch { /* ignore */ }
    setImporting(prev => { const n = new Set(prev); n.delete(lead.id); return n; });
  };
  const handleBulkImport = async () => {
    const toImport = displayed.filter(l => !imported.has(l.id));
    if (!toImport.length) return;
    const res = await fetch('/api/scraper/projects/leads/import-bulk', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leads: toImport }),
    });
    if (res.ok) {
      const data = await res.json();
      setImported(prev => { const n = new Set(prev); toImport.forEach(l => n.add(l.id)); return n; });
      uiNotify(t('scraper.v2_bulk_import_done', { imported: data.imported, skipped: data.skipped }), 'success');
    }
  };
  const handleRunChotot = async () => {
    setExtRunning('chotot'); setExtError(null);
    try {
      const res = await fetch('/api/scraper/projects/leads/chotot', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t('scraper.v2_unknown_error'));
      setExtLeads(prev => [...prev.filter(l => l.source !== 'chotot'), ...(data.leads ?? [])]);
    } catch (err) { setExtError(String(err)); }
    setExtRunning(null);
  };
  const handleRunSocial = async (source: string) => {
    setExtRunning(source); setExtError(null);
    try {
      const res = await fetch('/api/scraper/projects/leads/social', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, ...socialCfg }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t('scraper.v2_unknown_error'));
      setExtLeads(prev => [...prev.filter(l => l.source !== source), ...(data.leads ?? [])]);
    } catch (err) { setExtError(String(err)); }
    setExtRunning(null);
  };
  const handleExportCSV = () => {
    const all = [...displayed, ...extDisplayed];
    if (!all.length) return;
    const header = t('scraper.v2_csv_header');
    const rows = all.map(l => [
      l.name, l.phone, l.email, l.project,
      INTEREST[l.interest] ? t(INTEREST[l.interest].labelKey) : l.interest,
      leadSourceLabel(l.source, t),
      l.listing?.replace(/,/g, ' '), l.price,
      l.notes?.replace(/,/g, ' '), l.scrapedAt,
    ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
    const csv  = [header, ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href = url; a.download = `leads_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };
  const toggleProject = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);

  const projOptions = [{ value: 'all', label: t('scraper.v2_all_projects') }, ...catalog.map(p => ({ value: p.id, label: p.name }))];
  const matchFilter = (l: ProjectLead) => !filter
    || l.name.toLowerCase().includes(filter.toLowerCase())
    || l.phone.includes(filter)
    || l.listing.toLowerCase().includes(filter.toLowerCase());

  const displayed = leads
    .filter(l => projFilter  === 'all' || l.projectId === projFilter)
    .filter(l => interFilter === 'all' || l.interest   === interFilter)
    .filter(matchFilter);
  const extDisplayed = extLeads.filter(matchFilter);

  // Visual summaries from the loaded leads.
  const importedLeads = leads.filter(l => imported.has(l.id)).length;
  const withPhone = leads.filter(l => l.phone).length;
  const okProjects = results.filter(r => r.ok).length;
  const interestSegments: Segment[] = INTEREST_ORDER.map(k => ({
    label: t(INTEREST[k].labelKey),
    value: leads.filter(l => (INTEREST[l.interest] ? l.interest : 'unknown') === k).length,
    color: TONE_COLOR[INTEREST[k].tone],
  }));
  const sourceSegments: Segment[] = countBy(leads, l => l.source || null).map(([id, value], i) => ({ label: leadSourceLabel(id, t), value, color: SERIES_COLORS[i % SERIES_COLORS.length] }));

  const extSources = [
    { id: 'chotot',   onRun: handleRunChotot,                  hasToken: true },
    { id: 'facebook', onRun: () => handleRunSocial('facebook'), hasToken: !!(socialCfg.fbToken && socialCfg.fbPage) },
    { id: 'tiktok',   onRun: () => handleRunSocial('tiktok'),   hasToken: !!(socialCfg.ttToken && socialCfg.ttAdv) },
    { id: 'zalo',     onRun: () => handleRunSocial('zalo'),     hasToken: !!socialCfg.zlToken },
  ];

  return (
    <div className="space-y-5">
      {/* Project selector */}
      {catalog.length > 0 && (
        <SettingsCard title={t('scraper.v2_leads_pick_title')} description={t('scraper.v2_selected_of', { n: selected.length, total: catalog.length })}>
          <div className="flex flex-wrap gap-2">
            {catalog.map(proj => {
              const isSelected = selected.includes(proj.id);
              const resultInfo = results.find(r => r.projectId === proj.id);
              return (
                <button
                  key={proj.id}
                  type="button"
                  onClick={() => toggleProject(proj.id)}
                  aria-pressed={isSelected}
                  className={[
                    'inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors',
                    FOCUS,
                    isSelected
                      ? 'border-[var(--sgs-primary)] bg-[var(--sgs-primary)]/10 text-[var(--sgs-primary)]'
                      : 'border-[var(--glass-border)] text-[var(--text-secondary)] hover:border-[var(--sgs-primary)]',
                  ].join(' ')}
                >
                  <ProjectLogo proj={proj} />
                  <span>{proj.name}</span>
                  {resultInfo && <StatusBadge tone={resultInfo.ok ? 'success' : 'danger'}>{resultInfo.count}</StatusBadge>}
                </button>
              );
            })}
          </div>
        </SettingsCard>
      )}

      {/* Extended / social sources */}
      <SettingsCard
        title={t('scraper.v2_ext_title')}
        description={t('scraper.v2_ext_desc')}
        actions={
          <button type="button" onClick={() => setShowCfg(c => !c)} aria-expanded={showCfg} aria-controls="scraper-social-cfg" className="ui-button ui-button-ghost ui-button-sm min-h-10">
            <Settings2 size={14} aria-hidden="true" />{t('scraper.v2_api_config')}
          </button>
        }
      >
        {showCfg && (
          <div id="scraper-social-cfg" className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)] p-4 md:grid-cols-2">
            {SOCIAL_FIELDS.map(f => (
              <label key={f.key} className={f.wide ? 'md:col-span-2' : undefined}>
                <span className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">{t(f.labelKey)}</span>
                <input
                  value={socialCfg[f.key]}
                  onChange={e => setSocialCfg(c => ({ ...c, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  autoComplete="off"
                  spellCheck={false}
                  className="ui-input h-10 w-full text-sm"
                />
              </label>
            ))}
          </div>
        )}
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {extSources.map(src => {
            const count  = extLeads.filter(l => l.source === src.id).length;
            const busy   = extRunning === src.id;
            const locked = !src.hasToken;
            const label  = leadSourceLabel(src.id, t);
            return (
              <li key={src.id} className="flex items-center justify-between gap-2 rounded-xl border border-[var(--glass-border)] px-3 py-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-medium text-[var(--text-primary)]">{label}</span>
                  {count > 0 && <StatusBadge tone="success">{count}</StatusBadge>}
                </span>
                <button
                  type="button"
                  onClick={locked ? () => setShowCfg(true) : src.onRun}
                  disabled={busy || !!extRunning}
                  title={locked ? t('scraper.v2_token_needed') : undefined}
                  aria-label={locked ? `${label}: ${t('scraper.v2_token_needed')}` : t('scraper.v2_run_source', { name: label })}
                  className={`ui-button ui-button-sm min-h-10 shrink-0 ${locked ? 'ui-button-secondary' : 'ui-button-primary'}`}
                >
                  {busy ? <><Spinner small />{t('scraper.v2_running')}</>
                    : locked ? <><Lock size={14} aria-hidden="true" />{t('scraper.v2_token')}</>
                    : <><Play size={14} aria-hidden="true" />{t('scraper.v2_run_short')}</>}
                </button>
              </li>
            );
          })}
        </ul>
        {extError && <ErrorAlert message={extError} />}
      </SettingsCard>

      {/* Run panel */}
      <SettingsCard>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              {selected.length === 0 ? t('scraper.v2_leads_pick_hint') : t('scraper.v2_leads_selected', { n: selected.length })}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-tertiary)]">
              {t('scraper.v2_leads_run_desc')}
              {scrapedAt ? ` · ${t('scraper.v2_updated_at', { time: formatTime(scrapedAt) })}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <RefreshButton onClick={loadResults} loading={loading} label={t('scraper.v2_refresh_results')} />
            {leads.length > 0 && (
              <button type="button" onClick={handleBulkImport} className="ui-button ui-button-secondary ui-button-md min-h-10">
                <Upload size={16} aria-hidden="true" />{t('scraper.v2_bulk_import')}
              </button>
            )}
            <button type="button" onClick={handleRun} disabled={running || !selected.length} className="ui-button ui-button-primary ui-button-md min-h-10">
              {running ? <><Spinner />{t('scraper.v2_searching')}</> : <><Play size={16} aria-hidden="true" />{t('scraper.v2_find_leads')}</>}
            </button>
          </div>
        </div>
        {error && <ErrorAlert message={error} />}
      </SettingsCard>

      {/* Summary + visuals */}
      {leads.length > 0 && (
        <>
          <StatGrid>
            <StatTile label={t('scraper.v2_kpi_total_leads')} value={leads.length.toLocaleString(locale)} tone="brand" />
            <StatTile label={t('scraper.v2_kpi_with_phone')} value={withPhone.toLocaleString(locale)} hint={t('scraper.v2_kpi_share', { n: Math.round((withPhone / leads.length) * 100) })} />
            <StatTile label={t('scraper.v2_kpi_imported')} value={importedLeads.toLocaleString(locale)} tone={importedLeads > 0 ? 'success' : 'neutral'} />
            <StatTile
              label={t('scraper.v2_kpi_projects_ok')}
              value={results.length ? `${okProjects}/${results.length}` : '—'}
              tone={!results.length ? 'neutral' : okProjects === results.length ? 'success' : okProjects === 0 ? 'danger' : 'warning'}
            />
          </StatGrid>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <SettingsCard title={t('scraper.v2_leads_by_interest')}>
              <DistributionBar segments={interestSegments} ariaLabel={t('scraper.v2_leads_by_interest')} emptyText={t('scraper.v2_no_chart_data')} formatValue={n => n.toLocaleString(locale)} />
            </SettingsCard>
            <SettingsCard title={t('scraper.v2_leads_by_source')}>
              <DistributionBar segments={sourceSegments} ariaLabel={t('scraper.v2_leads_by_source')} emptyText={t('scraper.v2_no_chart_data')} formatValue={n => n.toLocaleString(locale)} />
            </SettingsCard>
            <SettingsCard title={t('scraper.v2_leads_by_project')}>
              <UsageMeter label={t('scraper.v2_import_progress')} used={importedLeads} limit={leads.length} formatValue={n => n.toLocaleString(locale)} />
              {results.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {results.map(r => (
                    <li key={r.projectId} className="flex items-center justify-between gap-2 text-xs">
                      <span className="min-w-0 truncate text-[var(--text-secondary)]" title={r.error}>{r.project}</span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        <span className="font-semibold tabular-nums text-[var(--text-primary)]">{t('scraper.v2_leads_count', { n: r.count })}</span>
                        <StatusBadge tone={r.ok ? 'success' : 'danger'}>{t(r.ok ? 'scraper.v2_result_ok' : 'scraper.v2_result_error')}</StatusBadge>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </SettingsCard>
          </div>
        </>
      )}

      {/* Leads list */}
      {leads.length > 0 && (
        <SettingsCard
          title={t('scraper.v2_leads_title')}
          description={t('scraper.v2_leads_counts', { n: displayed.length, imported: imported.size })}
          bodyClassName="p-0"
          actions={
            <div className="flex items-center gap-1" role="group" aria-label={t('scraper.v2_view_mode')}>
              <button type="button" onClick={() => setViewMode('table')} aria-pressed={viewMode === 'table'} aria-label={t('scraper.v2_view_table')} title={t('scraper.v2_view_table')}
                className={`ui-button ui-button-sm min-h-10 min-w-10 ${viewMode === 'table' ? 'ui-button-secondary' : 'ui-button-ghost'}`}>
                <Table2 size={16} aria-hidden="true" />
              </button>
              <button type="button" onClick={() => setViewMode('cards')} aria-pressed={viewMode === 'cards'} aria-label={t('scraper.v2_view_cards')} title={t('scraper.v2_view_cards')}
                className={`ui-button ui-button-sm min-h-10 min-w-10 ${viewMode === 'cards' ? 'ui-button-secondary' : 'ui-button-ghost'}`}>
                <LayoutGrid size={16} aria-hidden="true" />
              </button>
              <button type="button" onClick={handleExportCSV} aria-label={t('scraper.v2_export_csv')} title={t('scraper.v2_export_csv')} className="ui-button ui-button-ghost ui-button-sm min-h-10 min-w-10">
                <Download size={16} aria-hidden="true" />
              </button>
            </div>
          }
        >
          <div className={`grid grid-cols-1 gap-3 border-b border-[var(--glass-border)] p-4 sm:px-5 ${catalog.length > 0 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
            <SearchInput value={filter} onChange={setFilter} placeholder={t('scraper.v2_search_leads')} />
            {catalog.length > 0 && (
              <Dropdown value={projFilter} placeholder={t('scraper.v2_filter_project')} onChange={(v) => setProjFilter(v as string)} options={projOptions} />
            )}
            <Dropdown
              value={interFilter}
              placeholder={t('scraper.v2_filter_interest')}
              onChange={(v) => setInterFilter(v as string)}
              options={[
                { value: 'all', label: t('scraper.v2_interest_all') },
                ...(['seller', 'buyer', 'renter', 'investor', 'unknown'] as LeadInterest[]).map(k => ({ value: k, label: t(INTEREST[k].labelKey) })),
              ]}
            />
          </div>
          {/* Card view */}
          {viewMode === 'cards' && (
            <ul className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 sm:px-5 lg:grid-cols-3 xl:grid-cols-4">
              {displayed.slice(0, 200).map((lead: ProjectLead) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  proj={catalog.find(p => p.id === lead.projectId)}
                  showProject
                  imported={imported.has(lead.id)}
                  importing={importing.has(lead.id)}
                  onImport={() => handleImport(lead)}
                />
              ))}
            </ul>
          )}
          {/* Table view */}
          {viewMode === 'table' && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" aria-label={t('scraper.v2_leads_title')}>
                <thead>
                  <tr className="bg-[var(--glass-surface)]">
                    <th scope="col" className={`${TH} pl-4`}>{t('scraper.v2_col_contact')}</th>
                    <th scope="col" className={TH}>{t('scraper.v2_col_phone_email')}</th>
                    <th scope="col" className={`${TH} hidden md:table-cell`}>{t('scraper.v2_col_project')}</th>
                    <th scope="col" className={TH}>{t('scraper.v2_col_interest')}</th>
                    <th scope="col" className={`${TH} hidden sm:table-cell`}>{t('scraper.v2_col_source')}</th>
                    <th scope="col" className={`${TH} hidden lg:table-cell`}>{t('scraper.v2_col_listing_notes')}</th>
                    <th scope="col" className={TH}>{t('scraper.v2_col_crm')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--glass-border)]">
                  {displayed.slice(0, 200).map((lead: ProjectLead) => {
                    const proj  = catalog.find(p => p.id === lead.projectId);
                    const inter = INTEREST[lead.interest] ?? INTEREST.unknown;
                    const isImported = imported.has(lead.id);
                    const hasContact = !!(lead.phone || lead.email);
                    const name = lead.name || t('scraper.v2_unknown_name');
                    return (
                      <tr key={lead.id} className={`transition-colors hover:bg-[var(--glass-surface-hover)] ${isImported ? 'opacity-60' : ''}`}>
                        <td className={`${TD} pl-4`}>
                          <span className="text-sm font-medium text-[var(--text-primary)]">{name}</span>
                          <span className="mt-0.5 block text-xs text-[var(--text-tertiary)] md:hidden">{lead.project}</span>
                        </td>
                        <td className={`${TD} whitespace-nowrap`}>
                          {lead.phone && <a href={`tel:${lead.phone}`} className={`block text-sm font-bold tabular-nums ${LINK}`}>{lead.phone}</a>}
                          {lead.email && <a href={`mailto:${lead.email}`} className={`mt-0.5 block max-w-[180px] truncate text-xs ${LINK}`}>{lead.email}</a>}
                          {!hasContact && <span className="text-xs text-[var(--text-tertiary)]">—</span>}
                        </td>
                        <td className={`${TD} hidden md:table-cell`}>
                          <div className="flex items-center gap-1.5">
                            {proj && <ProjectLogo proj={proj} />}
                            <span className="whitespace-nowrap text-xs text-[var(--text-secondary)]">{lead.project}</span>
                          </div>
                        </td>
                        <td className={TD}><StatusBadge tone={inter.tone}>{t(inter.labelKey)}</StatusBadge></td>
                        <td className={`${TD} hidden sm:table-cell`}>
                          <div className="flex items-center gap-1">
                            <span className={CHIP}>{leadSourceLabel(lead.source, t)}</span>
                            {lead.sourceUrl && (
                              <a href={lead.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={t('scraper.v2_open_source')} className={`inline-flex h-10 w-8 items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--sgs-primary)] ${FOCUS} rounded`}>
                                <ExternalLink size={12} aria-hidden="true" />
                              </a>
                            )}
                          </div>
                        </td>
                        <td className={`${TD} hidden max-w-[240px] lg:table-cell`}>
                          <div className="line-clamp-2 text-xs text-[var(--text-secondary)]">{lead.listing || lead.notes || '—'}</div>
                          {lead.price && <div className="mt-0.5 text-xs font-semibold" style={{ color: TONE_COLOR.success }}>{lead.price}</div>}
                        </td>
                        <td className={`${TD} whitespace-nowrap`}>
                          <ImportControl imported={isImported} importing={importing.has(lead.id)} hasContact={hasContact} onImport={() => handleImport(lead)} name={name} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {displayed.length > 200 && <TruncationNote>{t('scraper.v2_truncated_leads', { n: 200, total: displayed.length })}</TruncationNote>}
        </SettingsCard>
      )}

      {/* External leads (Chợ Tốt / social) */}
      {extDisplayed.length > 0 && (
        <SettingsCard
          title={t('scraper.v2_ext_title')}
          description={t('scraper.v2_contacts_count', { n: extDisplayed.length })}
          actions={
            <button type="button" onClick={handleExportCSV} className="ui-button ui-button-ghost ui-button-sm min-h-10">
              <Download size={14} aria-hidden="true" />{t('scraper.v2_export_csv')}
            </button>
          }
        >
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {extDisplayed.slice(0, 200).map((lead: ProjectLead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                showListing
                imported={imported.has(lead.id)}
                importing={importing.has(lead.id)}
                onImport={() => handleImport(lead)}
              />
            ))}
          </ul>
        </SettingsCard>
      )}
      {!loading && !running && leads.length === 0 && (
        <SettingsCard as="div">
          <EmptyState icon={<Users size={20} />} title={t('scraper.v2_leads_empty_title')} description={t('scraper.v2_leads_empty_desc')} />
        </SettingsCard>
      )}
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function ScraperDashboard() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('market');

  const tabs: { id: Tab; labelKey: string; icon: React.ReactNode }[] = [
    { id: 'market',   labelKey: 'scraper.v2_tab_market',   icon: <Globe size={16} aria-hidden="true" /> },
    { id: 'projects', labelKey: 'scraper.v2_tab_projects', icon: <Building2 size={16} aria-hidden="true" /> },
    { id: 'leads',    labelKey: 'scraper.v2_tab_leads',    icon: <Users size={16} aria-hidden="true" /> },
  ];
  return (
    <SettingsPage>
      <SeoHead
        title={t('scraper.v2_seo_title')}
        description={t('scraper.v2_seo_desc')}
        canonicalPath="/scraper-dashboard"
      />
      <SettingsHeader icon={<Globe size={20} />} title={t('scraper.v2_title')} description={t('scraper.v2_subtitle')} />

      <div role="tablist" aria-label={t('scraper.v2_tabs_label')} className="-mx-4 flex gap-1 overflow-x-auto border-b border-[var(--glass-border)] px-4 sm:mx-0 sm:px-0">
        {tabs.map(item => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`scraper-tab-${item.id}`}
              aria-selected={active}
              aria-controls={`scraper-panel-${item.id}`}
              onClick={() => setTab(item.id)}
              className={[
                '-mb-px inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-t-lg border-b-2 px-4 text-sm font-semibold transition-colors',
                FOCUS,
                active ? 'border-[var(--sgs-primary)] text-[var(--sgs-primary)]' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
              ].join(' ')}
            >
              {item.icon}{t(item.labelKey)}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`scraper-panel-${tab}`} aria-labelledby={`scraper-tab-${tab}`}>
        {tab === 'market'   && <MarketTab />}
        {tab === 'projects' && <ProjectsTab />}
        {tab === 'leads'    && <LeadsTab />}
      </div>
    </SettingsPage>
  );
}
