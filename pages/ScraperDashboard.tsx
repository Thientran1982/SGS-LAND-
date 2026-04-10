import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from '../services/i18n';
import { Dropdown } from '../components/Dropdown';

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'market' | 'projects';

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

// ── Icons (SVG inline) ────────────────────────────────────────────────────────

const ICONS = {
  PLAY: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>
  ),
  REFRESH: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg>
  ),
  CHECK: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  WARN: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  GLOBE: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  ),
  BUILDING: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 22V12h6v10"/>
      <path d="M9 7h1"/><path d="M14 7h1"/><path d="M9 11h1"/><path d="M14 11h1"/>
    </svg>
  ),
  EXTERNAL: (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
      <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
    </svg>
  ),
  LOCK: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  ),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDuration(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

function fmtRelative(ts: string | null): string {
  if (!ts) return '—';
  const diff = Math.round((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60) return `${diff}s trước`;
  if (diff < 3600) return `${Math.round(diff / 60)} phút trước`;
  return `${Math.round(diff / 3600)} giờ trước`;
}

function fmtPrice(price: number, display: string): string {
  if (display && display !== '0') return display;
  if (!price) return 'Liên hệ';
  if (price >= 1e9) return `${(price / 1e9).toFixed(1)} tỷ`;
  if (price >= 1e6) return `${(price / 1e6).toFixed(0)} triệu`;
  return price.toLocaleString('vi-VN');
}

function Badge({ ok, label }: { ok: boolean; label?: string }) {
  const base = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold';
  return ok
    ? <span className={`${base} bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400`}><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"/>OK</span>
    : <span className={`${base} bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400`}><span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block"/>{label ?? 'Lỗi'}</span>;
}

const PROJECT_COLOR_MAP: Record<string, string> = {
  indigo:  'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-700',
  emerald: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700',
  blue:    'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700',
  sky:     'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-700',
  cyan:    'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-700',
  amber:   'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700',
  rose:    'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-700',
};

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  available: { label: 'Còn hàng',  cls: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' },
  sold:      { label: 'Đã bán',    cls: 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 line-through' },
  reserved:  { label: 'Đang giữ',  cls: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' },
  unknown:   { label: 'Liên hệ',   cls: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' },
};

// ── ─────────────── MARKET TAB ──────────────────────────────────────────────

const SOURCE_COLORS: Record<string, string> = {
  'Chợ Tốt':   'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
  'AlonNhaDat':'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  'BatDongSan':'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400',
  'Muaban':    'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400',
};

function MarketTab() {
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

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/scraper/status', { credentials: 'include' });
      if (res.ok) setStatus(await res.json());
    } catch { /* ignore */ }
  }, []);

  const loadResults = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/scraper/results', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setResults(data.results ?? []);
        setListings(data.listings ?? []);
        setScrapedAt(data.scrapedAt ?? null);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadStatus(); loadResults(); }, [loadStatus, loadResults]);

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
      if (!res.ok) throw new Error((data as any).error ?? 'Lỗi không xác định');
      setResults(data.results ?? []);
      setListings(data.listings ?? []);
      setScrapedAt(data.scrapedAt ?? null);
      loadStatus();
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

  return (
    <div className="space-y-4">
      {/* Source status cards */}
      {status && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {status.sources.map(src => (
            <div key={src.id} className="bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-2xl p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-[var(--text-primary)]">{src.name}</span>
                {src.status === 'active'
                  ? <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">{ICONS.CHECK} OK</span>
                  : <span className="flex items-center gap-1 text-xs font-medium text-rose-500">{ICONS.LOCK} CF</span>}
              </div>
              <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">{src.note}</p>
              {src.status === 'active' && (
                <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">{src.listings} tin</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Run panel */}
      <div className="bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-2xl p-5">
        <h2 className="text-sm font-bold text-[var(--text-primary)] mb-4">Chạy Scraper</h2>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider block mb-2">Nguồn dữ liệu</label>
            <div className="flex flex-wrap gap-2">
              {['chotot', 'alonhadat', 'batdongsan', 'muaban'].map(id => {
                const labels: Record<string, string> = { chotot: 'Chợ Tốt', alonhadat: 'AlonNhaDat', batdongsan: 'BatDongSan', muaban: 'Muaban' };
                const blocked = !status?.scraperApiConfigured && ['batdongsan', 'muaban'].includes(id);
                const active  = selected.includes(id);
                return (
                  <button
                    key={id}
                    onClick={() => !blocked && toggleSource(id)}
                    disabled={blocked}
                    title={blocked ? 'Cần SCRAPERAPI_KEY để unlock' : ''}
                    className={[
                      'px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all',
                      blocked ? 'border-[var(--glass-border)] text-[var(--text-tertiary)] opacity-50 cursor-not-allowed'
                        : active ? 'bg-indigo-600 border-indigo-600 text-white shadow'
                        : 'border-[var(--glass-border)] text-[var(--text-secondary)] hover:border-indigo-400 hover:text-indigo-600',
                    ].join(' ')}
                  >
                    {labels[id]}{blocked && ' 🔒'}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="min-w-[150px]">
            <Dropdown
              label="Số trang"
              value={pages}
              onChange={(v) => setPages(Number(v))}
              options={[1, 2, 3, 5, 10].map(v => ({ value: v, label: `${v} trang / nguồn` }))}
            />
          </div>
          <button
            onClick={handleRun}
            disabled={running || !selected.length}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white font-bold rounded-xl text-sm shadow hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {running
              ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Đang chạy...</>
              : <>{ICONS.PLAY}Chạy scraper</>}
          </button>
        </div>
        {error && (
          <div className="mt-3 flex items-start gap-2 p-3 bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 rounded-xl text-sm">
            {ICONS.WARN}<span>{error}</span>
          </div>
        )}
      </div>

      {/* Summary */}
      {results.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-2xl p-4">
            <div className="text-2xl font-bold text-[var(--text-primary)]">{totalListings.toLocaleString()}</div>
            <div className="text-xs text-[var(--text-tertiary)] mt-1">Tổng tin đăng thu thập</div>
          </div>
          {results.filter(r => r.ok).map(r => (
            <div key={r.source} className="bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-2xl p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-[var(--text-tertiary)] uppercase">{r.source}</span>
                <Badge ok={r.ok} />
              </div>
              <div className="text-2xl font-bold text-[var(--text-primary)]">{r.count}</div>
              <div className="text-xs text-[var(--text-tertiary)]">tin · {fmtDuration(r.durationMs)}</div>
            </div>
          ))}
          {results.filter(r => !r.ok).map(r => (
            <div key={r.source} className="bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-2xl p-4 opacity-70">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-[var(--text-tertiary)] uppercase">{r.source}</span>
                <Badge ok={false} label="Thất bại" />
              </div>
              <p className="text-xs text-rose-600 dark:text-rose-400 leading-relaxed">{r.error}</p>
            </div>
          ))}
        </div>
      )}

      {/* Listings table */}
      {listings.length > 0 && (
        <div className="bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-2xl overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-[var(--glass-border)]">
            <h2 className="text-sm font-bold text-[var(--text-primary)] mr-2">Danh sách tin đăng</h2>
            <input
              type="text"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Tìm theo tên, địa điểm..."
              className="flex-1 min-w-[160px] bg-[var(--glass-surface-hover)] border border-[var(--glass-border)] rounded-xl px-3 py-1.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-indigo-500"
            />
            <div className="min-w-[160px]">
              <Dropdown
                value={txFilter}
                onChange={(v) => setTxFilter(v as string)}
                options={[
                  { value: 'all',      label: 'Tất cả giao dịch' },
                  { value: 'Bán',      label: 'Mua bán' },
                  { value: 'Cho thuê', label: 'Cho thuê' },
                ]}
              />
            </div>
            <div className="min-w-[180px]">
              <Dropdown
                value={sortKey}
                onChange={(v) => setSortKey(v as string)}
                options={[
                  { value: 'price',      label: 'Sắp theo giá' },
                  { value: 'area',       label: 'Sắp theo diện tích' },
                  { value: 'pricePerM2', label: 'Sắp theo giá / m²' },
                ]}
              />
            </div>
            <span className="text-xs text-[var(--text-tertiary)] ml-auto">{displayed.length} tin</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--glass-surface-hover)]">
                  <th className="text-left px-4 py-2.5 text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider">Tin đăng</th>
                  <th className="text-left px-3 py-2.5 text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider whitespace-nowrap">Giá</th>
                  <th className="text-left px-3 py-2.5 text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider">DT (m²)</th>
                  <th className="text-left px-3 py-2.5 text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider whitespace-nowrap">Giá/m²</th>
                  <th className="text-left px-3 py-2.5 text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider">Nguồn</th>
                  <th className="text-left px-3 py-2.5 text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider">Đăng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--glass-border)]">
                {displayed.slice(0, 100).map((l: ExternalListing) => (
                  <tr key={l.id} className="hover:bg-[var(--glass-surface-hover)] transition-colors group">
                    <td className="px-4 py-3 max-w-xs">
                      <a href={l.url} target="_blank" rel="noopener noreferrer"
                        className="font-medium text-[var(--text-primary)] hover:text-indigo-600 dark:hover:text-indigo-400 flex items-start gap-1 group-hover:underline">
                        <span className="flex-1 line-clamp-2">{l.title}</span>
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5">{ICONS.EXTERNAL}</span>
                      </a>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${l.transaction === 'Bán' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'}`}>
                          {l.transaction}
                        </span>
                        {l.location && <span className="text-xs text-[var(--text-tertiary)] truncate max-w-[180px]">{l.location}</span>}
                      </div>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap font-semibold text-[var(--text-primary)]">{fmtPrice(l.price, l.priceDisplay)}</td>
                    <td className="px-3 py-3 text-[var(--text-secondary)]">{l.area > 0 ? l.area.toFixed(0) : '—'}</td>
                    <td className="px-3 py-3 text-[var(--text-secondary)] whitespace-nowrap">{l.pricePerM2 > 0 ? `${(l.pricePerM2 / 1e6).toFixed(1)}tr` : '—'}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${SOURCE_COLORS[l.source] ?? 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>{l.source}</span>
                    </td>
                    <td className="px-3 py-3 text-xs text-[var(--text-tertiary)] whitespace-nowrap">{fmtRelative(l.postedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {displayed.length > 100 && (
              <div className="px-4 py-2 text-xs text-center text-[var(--text-tertiary)] border-t border-[var(--glass-border)]">
                Hiển thị 100/{displayed.length} tin. Dùng bộ lọc để thu hẹp kết quả.
              </div>
            )}
          </div>
        </div>
      )}

      {!loading && listings.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-400 flex items-center justify-center mb-4">{ICONS.GLOBE}</div>
          <h3 className="text-base font-bold text-[var(--text-primary)] mb-1">Chưa có dữ liệu</h3>
          <p className="text-sm text-[var(--text-tertiary)] max-w-xs">Chọn nguồn dữ liệu và nhấn "Chạy scraper" để bắt đầu thu thập tin đăng từ thị trường.</p>
        </div>
      )}
    </div>
  );
}

// ── ──────────────── PROJECTS TAB ───────────────────────────────────────────

function ProjectsTab() {
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
      if (!res.ok) throw new Error((data as any).error ?? 'Lỗi không xác định');
      setResults(data.results ?? []);
      setUnits(data.units ?? []);
      setScrapedAt(data.scrapedAt ?? null);
      loadCatalog();
    } catch (err) { setError(String(err)); }
    setRunning(false);
  };

  const toggleProject = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);

  const projOptions = [{ value: 'all', label: 'Tất cả dự án' }, ...catalog.map(p => ({ value: p.id, label: p.name }))];

  const displayed = units
    .filter(u => projFilter === 'all' || u.projectId === projFilter)
    .filter(u => statusFilter === 'all' || u.status === statusFilter)
    .filter(u => !filter || u.type.toLowerCase().includes(filter.toLowerCase()) || u.block.toLowerCase().includes(filter.toLowerCase()))
    .sort((a: any, b: any) => sortKey === 'price' ? b.price - a.price : sortKey === 'area' ? b.area - a.area : b.pricePerM2 - a.pricePerM2);

  return (
    <div className="space-y-4">
      {/* Project cards */}
      {catalog.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {catalog.map(proj => {
            const resultInfo = results.find(r => r.projectId === proj.id);
            const colorCls   = PROJECT_COLOR_MAP[proj.color] ?? PROJECT_COLOR_MAP['indigo'];
            const isSelected = selected.includes(proj.id);
            return (
              <div
                key={proj.id}
                onClick={() => toggleProject(proj.id)}
                className={[
                  'relative bg-[var(--bg-surface)] border rounded-2xl p-4 cursor-pointer transition-all group',
                  isSelected
                    ? 'border-indigo-400 dark:border-indigo-500 shadow-md shadow-indigo-100 dark:shadow-indigo-900/30 ring-2 ring-indigo-200 dark:ring-indigo-800'
                    : 'border-[var(--glass-border)] hover:border-indigo-300',
                ].join(' ')}
              >
                {/* Selection indicator */}
                <div className={`absolute top-3 right-3 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-[var(--glass-border)]'}`}>
                  {isSelected && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><polyline points="20 6 9 17 4 12"/></svg>}
                </div>

                <div className="flex items-start gap-3 pr-5 mb-3">
                  <span className={`text-2xl w-10 h-10 rounded-xl flex items-center justify-center border flex-shrink-0 ${colorCls}`}>{proj.logo}</span>
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-[var(--text-primary)] leading-tight">{proj.name}</p>
                    <a
                      href={proj.siteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5 mt-0.5"
                    >
                      {proj.siteUrl.replace('https://', '')} {ICONS.EXTERNAL}
                    </a>
                  </div>
                </div>

                <p className="text-xs text-[var(--text-tertiary)] leading-relaxed mb-3">{proj.note}</p>

                <div className="flex items-center justify-between">
                  {resultInfo
                    ? <Badge ok={resultInfo.ok} label={resultInfo.ok ? `${resultInfo.count} căn` : 'Lỗi'} />
                    : <span className="text-xs text-[var(--text-tertiary)]">Chưa scrape</span>}
                  {!proj.apiReady && (
                    <span className="flex items-center gap-1 text-xs text-rose-500">{ICONS.LOCK} API</span>
                  )}
                </div>

                {resultInfo?.error && (
                  <p className="text-xs text-rose-500 mt-2 leading-relaxed line-clamp-2">{resultInfo.error}</p>
                )}
                {resultInfo?.warning && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 leading-relaxed line-clamp-2">{resultInfo.warning}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Run panel */}
      <div className="bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-2xl p-5">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <p className="text-sm font-bold text-[var(--text-primary)]">
              {selected.length === 0
                ? 'Chọn dự án bên trên để scrape'
                : `${selected.length}/${catalog.length} dự án được chọn`}
            </p>
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
              {scrapedAt ? `Cập nhật ${fmtRelative(scrapedAt)}` : 'Nhấn "Chạy" để bắt đầu thu thập dữ liệu'}
            </p>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={loadResults}
              disabled={loading}
              className="p-2 rounded-xl bg-[var(--glass-surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
              title="Làm mới kết quả"
            >
              <span className={loading ? 'animate-spin inline-block' : ''}>{ICONS.REFRESH}</span>
            </button>
            <button
              onClick={handleRun}
              disabled={running || !selected.length}
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white font-bold rounded-xl text-sm shadow hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {running
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Đang chạy...</>
                : <>{ICONS.PLAY}Chạy scraper</>}
            </button>
          </div>
        </div>
        {error && (
          <div className="mt-3 flex items-start gap-2 p-3 bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 rounded-xl text-sm">
            {ICONS.WARN}<span>{error}</span>
          </div>
        )}
      </div>

      {/* Units table */}
      {units.length > 0 && (
        <div className="bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-2xl overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-[var(--glass-border)]">
            <h2 className="text-sm font-bold text-[var(--text-primary)]">Sản phẩm thu thập</h2>
            <input
              type="text"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Tìm loại, tòa..."
              className="flex-1 min-w-[140px] bg-[var(--glass-surface-hover)] border border-[var(--glass-border)] rounded-xl px-3 py-1.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-indigo-500"
            />
            {catalog.length > 0 && (
              <div className="min-w-[160px]">
                <Dropdown
                  value={projFilter}
                  onChange={(v) => setProjFilter(v as string)}
                  options={projOptions}
                />
              </div>
            )}
            <div className="min-w-[140px]">
              <Dropdown
                value={statusFilter}
                onChange={(v) => setStatusFilter(v as string)}
                options={[
                  { value: 'all',       label: 'Mọi trạng thái' },
                  { value: 'available', label: 'Còn hàng' },
                  { value: 'reserved',  label: 'Đang giữ' },
                  { value: 'sold',      label: 'Đã bán' },
                  { value: 'unknown',   label: 'Liên hệ' },
                ]}
              />
            </div>
            <div className="min-w-[180px]">
              <Dropdown
                value={sortKey}
                onChange={(v) => setSortKey(v as string)}
                options={[
                  { value: 'price',      label: 'Sắp theo giá' },
                  { value: 'area',       label: 'Sắp theo diện tích' },
                  { value: 'pricePerM2', label: 'Sắp theo giá / m²' },
                ]}
              />
            </div>
            <span className="text-xs text-[var(--text-tertiary)] ml-auto">{displayed.length} sản phẩm</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--glass-surface-hover)]">
                  <th className="text-left px-4 py-2.5 text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider">Dự án</th>
                  <th className="text-left px-3 py-2.5 text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider">Loại</th>
                  <th className="text-left px-3 py-2.5 text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider">Tòa / Tầng</th>
                  <th className="text-left px-3 py-2.5 text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider whitespace-nowrap">DT (m²)</th>
                  <th className="text-left px-3 py-2.5 text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider whitespace-nowrap">Giá</th>
                  <th className="text-left px-3 py-2.5 text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider">Trạng thái</th>
                  <th className="text-left px-3 py-2.5 text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider">Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--glass-border)]">
                {displayed.slice(0, 150).map((u: ProjectUnit) => {
                  const proj     = catalog.find(p => p.id === u.projectId);
                  const colorCls = proj ? PROJECT_COLOR_MAP[proj.color] : PROJECT_COLOR_MAP['indigo'];
                  const st       = STATUS_LABELS[u.status] ?? STATUS_LABELS['unknown'];
                  return (
                    <tr key={u.id} className="hover:bg-[var(--glass-surface-hover)] transition-colors group">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {proj && <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-sm border flex-shrink-0 ${colorCls}`}>{proj.logo}</span>}
                          <span className="font-medium text-xs text-[var(--text-primary)] whitespace-nowrap">{u.project}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs text-[var(--text-secondary)] whitespace-nowrap">{u.type || '—'}</td>
                      <td className="px-3 py-3 text-xs text-[var(--text-secondary)]">
                        {[u.block, u.floor].filter(Boolean).join(' / ') || '—'}
                      </td>
                      <td className="px-3 py-3 text-[var(--text-secondary)] whitespace-nowrap">{u.area > 0 ? `${u.area.toFixed(0)} m²` : '—'}</td>
                      <td className="px-3 py-3 font-semibold text-[var(--text-primary)] whitespace-nowrap">{u.priceDisplay || 'Liên hệ'}</td>
                      <td className="px-3 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${st.cls}`}>{st.label}</span>
                      </td>
                      <td className="px-3 py-3">
                        <a
                          href={u.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          Xem {ICONS.EXTERNAL}
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {displayed.length > 150 && (
              <div className="px-4 py-2 text-xs text-center text-[var(--text-tertiary)] border-t border-[var(--glass-border)]">
                Hiển thị 150/{displayed.length} sản phẩm. Dùng bộ lọc để thu hẹp.
              </div>
            )}
          </div>
        </div>
      )}

      {!loading && !running && units.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-400 flex items-center justify-center mb-4 text-3xl">🏗️</div>
          <h3 className="text-base font-bold text-[var(--text-primary)] mb-1">Chưa có dữ liệu dự án</h3>
          <p className="text-sm text-[var(--text-tertiary)] max-w-xs">Chọn các dự án bên trên rồi nhấn "Chạy scraper" để thu thập thông tin sản phẩm.</p>
        </div>
      )}
    </div>
  );
}

// ── ─────────────── MAIN PAGE ────────────────────────────────────────────────

export default function ScraperDashboard() {
  const [tab, setTab] = useState<Tab>('market');

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'market',   label: 'Sàn thị trường', icon: ICONS.GLOBE },
    { id: 'projects', label: 'Dự án BĐS',      icon: ICONS.BUILDING },
  ];

  return (
    <div className="flex flex-col h-full overflow-auto bg-[var(--bg-base)]">
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-6 pb-0">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            {ICONS.GLOBE}
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Scraper Thị Trường</h1>
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">Thu thập dữ liệu từ các sàn BĐS & dự án ngoài thị trường</p>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 border-b border-[var(--glass-border)]">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={[
                'flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all -mb-px',
                tab === t.id
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
              ].join(' ')}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 px-6 py-5 overflow-auto min-h-0">
        {tab === 'market'   && <MarketTab />}
        {tab === 'projects' && <ProjectsTab />}
      </div>
    </div>
  );
}
