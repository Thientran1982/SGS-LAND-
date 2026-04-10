import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from '../services/i18n';
import { Dropdown } from '../components/Dropdown';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SourceStatus { id: string; name: string; status: 'active' | 'blocked'; note: string; listings: string; }
interface ScrapeResult { source: string; ok: boolean; count: number; error?: string; warning?: string; durationMs: number; }
interface ExternalListing {
  id: string; source: string; title: string; type: string; transaction: string;
  price: number; priceDisplay: string; area: number; pricePerM2: number;
  location: string; province: string; bedrooms: number | null;
  imageUrl: string | null; url: string; postedAt: string | null; scrapedAt: string;
}
interface StatusResponse { sources: SourceStatus[]; cacheValid: boolean; cacheAge: number | null; cacheTtlMin: number; }
interface RunResponse { ok: boolean; results: ScrapeResult[]; listings: ExternalListing[]; totalListings: number; scrapedAt: string; }

// ── Icons (SVG inline) ────────────────────────────────────────────────────────

const ICONS = {
  SPIDER: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="3"/>
      <line x1="12" y1="11" x2="12" y2="21"/>
      <line x1="12" y1="15" x2="6" y2="18"/>
      <line x1="12" y1="15" x2="18" y2="18"/>
      <line x1="12" y1="13" x2="4" y2="10"/>
      <line x1="12" y1="13" x2="20" y2="10"/>
      <line x1="9" y1="5.5" x2="4" y2="3"/>
      <line x1="15" y1="5.5" x2="20" y2="3"/>
    </svg>
  ),
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

function fmtPrice(price: number, display: string): string {
  if (display) return display;
  if (!price) return '—';
  if (price >= 1e9) return `${(price / 1e9).toFixed(1)} tỷ`;
  if (price >= 1e6) return `${(price / 1e6).toFixed(0)} triệu`;
  return price.toLocaleString('vi-VN');
}

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

function Badge({ ok, label }: { ok: boolean; label?: string }) {
  const base = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold';
  return ok
    ? <span className={`${base} bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400`}><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />{label ?? 'Hoạt động'}</span>
    : <span className={`${base} bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400`}><span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block" />{label ?? 'Bị chặn'}</span>;
}

const SOURCE_COLORS: Record<string, string> = {
  'Chợ Tốt':    'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
  'AlonNhaDat': 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function ScraperDashboard() {
  const { t } = useTranslation();

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
  const [txFilter,  setTxFilter]  = useState<'all' | 'Bán' | 'Cho thuê'>('all');
  const [sortKey,   setSortKey]   = useState<'price' | 'area' | 'pricePerM2'>('price');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const res  = await fetch('/api/scraper/status', { credentials: 'include' });
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

  useEffect(() => {
    loadStatus();
    loadResults();
  }, [loadStatus, loadResults]);

  const handleRun = async () => {
    if (running || !selected.length) return;
    setRunning(true);
    setError(null);
    try {
      const res  = await fetch('/api/scraper/run', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sources: selected, pages }),
      });
      const data: RunResponse = await res.json();
      if (!res.ok) throw new Error((data as any).error ?? 'Lỗi không xác định');
      setResults(data.results ?? []);
      setListings(data.listings ?? []);
      setScrapedAt(data.scrapedAt ?? null);
      loadStatus();
    } catch (err) {
      setError(String(err));
    }
    setRunning(false);
  };

  // Relative-time refresh
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setScrapedAt(s => s), 30_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const displayed = listings
    .filter(l => txFilter === 'all' || l.transaction === txFilter)
    .filter(l => !filter || l.title.toLowerCase().includes(filter.toLowerCase()) || l.location.toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => b[sortKey] - a[sortKey]);

  const toggleSource = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);

  const totalListings = results.reduce((s, r) => s + r.count, 0);

  return (
    <div className="flex flex-col h-full overflow-auto bg-[var(--bg-base)]">
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              {ICONS.GLOBE}
            </div>
            <div>
              <h1 className="text-xl font-bold text-[var(--text-primary)]">Scraper Thị Trường</h1>
              <p className="text-xs text-[var(--text-tertiary)] mt-0.5">Thu thập tin đăng từ các sàn BĐS bên ngoài</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {scrapedAt && (
              <span className="text-xs text-[var(--text-tertiary)]">
                Cập nhật {fmtRelative(scrapedAt)}
              </span>
            )}
            <button
              onClick={loadResults}
              disabled={loading}
              className="p-2 rounded-xl bg-[var(--glass-surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
              title="Làm mới kết quả"
            >
              <span className={loading ? 'animate-spin inline-block' : ''}>{ICONS.REFRESH}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 px-6 pb-6 space-y-4 overflow-auto min-h-0">
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
            {/* Source selector */}
            <div>
              <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider block mb-2">Nguồn dữ liệu</label>
              <div className="flex flex-wrap gap-2">
                {['chotot', 'alonhadat', 'batdongsan', 'muaban'].map(id => {
                  const labels: Record<string, string> = { chotot: 'Chợ Tốt', alonhadat: 'AlonNhaDat', batdongsan: 'BatDongSan', muaban: 'Muaban' };
                  const blocked = ['batdongsan', 'muaban'].includes(id);
                  const active  = selected.includes(id);
                  return (
                    <button
                      key={id}
                      onClick={() => !blocked && toggleSource(id)}
                      disabled={blocked}
                      title={blocked ? 'Bị Cloudflare chặn — cần proxy' : ''}
                      className={[
                        'px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all',
                        blocked
                          ? 'border-[var(--glass-border)] text-[var(--text-tertiary)] opacity-50 cursor-not-allowed'
                          : active
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow'
                            : 'border-[var(--glass-border)] text-[var(--text-secondary)] hover:border-indigo-400 hover:text-indigo-600',
                      ].join(' ')}
                    >
                      {labels[id]}{blocked && ' 🔒'}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Pages */}
            <div className="min-w-[140px]">
              <Dropdown
                label="Số trang"
                value={pages}
                onChange={(v) => setPages(Number(v))}
                options={[1, 2, 3, 5, 10].map(v => ({ value: v, label: `${v} trang / nguồn` }))}
              />
            </div>

            {/* Run button */}
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

          {/* Error */}
          {error && (
            <div className="mt-3 flex items-start gap-2 p-3 bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 rounded-xl text-sm">
              {ICONS.WARN}<span>{error}</span>
            </div>
          )}
        </div>

        {/* Run results summary */}
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
            {/* Table toolbar */}
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
                  onChange={(v) => setTxFilter(v as 'all' | 'Bán' | 'Cho thuê')}
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
                  onChange={(v) => setSortKey(v as 'price' | 'area' | 'pricePerM2')}
                  options={[
                    { value: 'price',      label: 'Sắp theo giá' },
                    { value: 'area',       label: 'Sắp theo diện tích' },
                    { value: 'pricePerM2', label: 'Sắp theo giá / m²' },
                  ]}
                />
              </div>
              <span className="text-xs text-[var(--text-tertiary)] ml-auto">{displayed.length} tin</span>
            </div>

            {/* Table */}
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
                  {displayed.slice(0, 100).map(l => (
                    <tr key={l.id} className="hover:bg-[var(--glass-surface-hover)] transition-colors group">
                      <td className="px-4 py-3 max-w-xs">
                        <a
                          href={l.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-[var(--text-primary)] hover:text-indigo-600 dark:hover:text-indigo-400 line-clamp-2 flex items-start gap-1 group-hover:underline"
                        >
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
                      <td className="px-3 py-3 whitespace-nowrap font-semibold text-[var(--text-primary)]">
                        {fmtPrice(l.price, l.priceDisplay)}
                      </td>
                      <td className="px-3 py-3 text-[var(--text-secondary)]">
                        {l.area > 0 ? l.area.toFixed(0) : '—'}
                      </td>
                      <td className="px-3 py-3 text-[var(--text-secondary)] whitespace-nowrap">
                        {l.pricePerM2 > 0 ? `${(l.pricePerM2 / 1e6).toFixed(1)}tr` : '—'}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${SOURCE_COLORS[l.source] ?? 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                          {l.source}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-[var(--text-tertiary)] whitespace-nowrap">
                        {fmtRelative(l.postedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {displayed.length > 100 && (
                <div className="px-4 py-2 text-xs text-center text-[var(--text-tertiary)] border-t border-[var(--glass-border)]">
                  Hiển thị 100/{displayed.length} tin. Dùng bộ lọc để thu hẹp kết quả.
                </div>
              )}
              {displayed.length === 0 && listings.length > 0 && (
                <div className="px-4 py-8 text-center text-[var(--text-tertiary)] text-sm">
                  Không tìm thấy tin phù hợp với bộ lọc hiện tại.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && !running && listings.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-400 flex items-center justify-center mb-4 text-2xl">
              {ICONS.GLOBE}
            </div>
            <h3 className="text-base font-bold text-[var(--text-primary)] mb-1">Chưa có dữ liệu</h3>
            <p className="text-sm text-[var(--text-tertiary)] max-w-xs">Chọn nguồn dữ liệu và nhấn "Chạy scraper" để bắt đầu thu thập tin đăng từ thị trường.</p>
          </div>
        )}
      </div>
    </div>
  );
}
