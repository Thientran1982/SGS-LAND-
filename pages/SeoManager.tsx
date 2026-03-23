
import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../services/dbApi';
import { UserRole } from '../types';
import { useTranslation } from '../services/i18n';
import { ROUTE_SEO, SEOConfig, getSEOOverrides, saveSEOOverride, clearSEOOverride, updatePageSEO } from '../utils/seo';
import { copyToClipboard } from '../utils/clipboard';

// ── Icons ──────────────────────────────────────────────────────────────────────
const ICONS = {
    GLOBE:    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 004 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    CHECK:    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>,
    WARN:     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
    ERROR:    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
    COPY:     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
    RESET:    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
    EXT:      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>,
    SAVE:     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>,
};

// ── Types ──────────────────────────────────────────────────────────────────────
type TabId = 'SERP' | 'META' | 'HEALTH' | 'SCHEMA';

interface HealthResult {
    id: string;
    label: string;
    status: 'pass' | 'warn' | 'fail';
    detail: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

// Human-readable labels for each ROUTE_SEO key.
// Falls back to the key itself if not listed here.
const ROUTE_LABELS: Record<string, string> = {
    '':               'Root (Trang chủ mặc định)',
    home:             'Trang chủ (Landing)',
    marketplace:      'Tìm kiếm BĐS',
    'ai-valuation':   'Định giá AI',
    'crm-platform':   'CRM Platform',
    'about-us':       'Về chúng tôi',
    news:             'Tin tức BĐS',
    contact:          'Liên hệ',
    careers:          'Tuyển dụng',
    'help-center':    'Trung tâm hỗ trợ',
    developers:       'API Docs',
    status:           'Trạng thái hệ thống',
    'privacy-policy': 'Chính sách bảo mật',
    'terms-of-service': 'Điều khoản sử dụng',
    'cookie-settings': 'Cài đặt Cookie',
    login:            'Đăng nhập',
    register:         'Đăng ký',
    inventory:        'Kho hàng (nội bộ)',
    leads:            'CRM Leads (nội bộ)',
    billing:          'Thanh toán',
    'seo-manager':    'SEO Manager (admin)',
};

// Derived from ROUTE_SEO so it's always in sync — no hardcoding.
const ALL_ROUTES: { key: string; label: string }[] = Object.keys(ROUTE_SEO).map(key => ({
    key,
    label: ROUTE_LABELS[key] ?? key,
}));

function getEffectiveCfg(routeKey: string, overrides: Record<string, { title: string; description: string }>): SEOConfig & { title: string; description: string } {
    const base = ROUTE_SEO[routeKey] ?? ROUTE_SEO[''];
    const ov = overrides[routeKey];
    return { ...base, title: ov?.title ?? base.title, description: ov?.description ?? base.description };
}

function charStatus(len: number, min: number, max: number): 'green' | 'amber' | 'red' {
    if (len >= min && len <= max) return 'green';
    if (len > max) return 'amber';
    return 'red';
}

const CharCount: React.FC<{ value: string; min: number; max: number }> = ({ value, min, max }) => {
    const len = value.length;
    const st = charStatus(len, min, max);
    const cls = st === 'green' ? 'text-emerald-600' : st === 'amber' ? 'text-amber-500' : 'text-rose-500';
    return <span className={`text-2xs font-bold tabular-nums ${cls}`}>{len}/{max}</span>;
};

// ── Tab: SERP Preview ──────────────────────────────────────────────────────────
const SerpPreview: React.FC = () => {
    const [selectedKey, setSelectedKey] = useState('');
    const [overrides] = useState(getSEOOverrides);
    const cfg = getEffectiveCfg(selectedKey, overrides);
    const titleLen = cfg.title.length;
    const descLen = cfg.description.length;
    const titleTrunc = cfg.title.slice(0, 60);
    const descTrunc = cfg.description.slice(0, 160);
    const pathDisplay = `sgsland.vn${cfg.path || '/'}`;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="flex-1">
                    <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wide block mb-1.5">Chọn trang</label>
                    <select
                        value={selectedKey}
                        onChange={e => setSelectedKey(e.target.value)}
                        className="w-full border border-[var(--glass-border)] rounded-xl px-4 py-2.5 text-sm bg-[var(--bg-surface)] text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                    >
                        {ALL_ROUTES.map(r => (
                            <option key={r.key} value={r.key}>{r.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Google SERP Mockup */}
            <div className="bg-white dark:bg-slate-900 border border-[var(--glass-border)] rounded-2xl p-6 shadow-sm font-sans">
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center">
                        <span className="text-white text-2xs font-bold">G</span>
                    </div>
                    <span className="text-sm text-slate-500">Google Search</span>
                </div>
                <div className="border-b border-slate-100 dark:border-slate-700 mb-4 pb-3">
                    <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 rounded-full px-4 py-2 max-w-lg text-sm text-slate-500 border border-slate-200 dark:border-slate-700">
                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        phần mềm quản lý bất động sản ai việt nam
                    </div>
                </div>

                {/* Search Result Card */}
                <div className="max-w-2xl">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-5 h-5 bg-indigo-100 rounded-full flex items-center justify-center">
                            {ICONS.GLOBE}
                        </div>
                        <div>
                            <div className="text-sm font-medium text-[#202124] dark:text-slate-200">SGS LAND</div>
                            <div className="text-xs text-[#4d5156] dark:text-slate-400 flex items-center gap-1">
                                <span>{pathDisplay}</span>
                            </div>
                        </div>
                    </div>
                    <h3 className="text-xl text-[#1a0dab] dark:text-blue-400 font-normal hover:underline cursor-pointer leading-tight mb-1">
                        {titleTrunc}{cfg.title.length > 60 ? '...' : ''}
                    </h3>
                    <p className="text-sm text-[#4d5156] dark:text-slate-400 leading-snug">
                        {descTrunc}{cfg.description.length > 160 ? '...' : ''}
                    </p>
                </div>
            </div>

            {/* Character Counters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-[var(--glass-surface-hover)] rounded-xl p-4 border border-[var(--glass-border)]">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-[var(--text-tertiary)] uppercase">Title</span>
                        <CharCount value={cfg.title} min={30} max={60} />
                    </div>
                    <div className="h-2 bg-[var(--glass-border)] rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all ${titleLen > 60 ? 'bg-amber-400' : titleLen < 30 ? 'bg-rose-400' : 'bg-emerald-500'}`}
                            style={{ width: `${Math.min(100, (titleLen / 60) * 100)}%` }}
                        />
                    </div>
                    <div className="flex justify-between text-2xs text-[var(--text-muted)] mt-1">
                        <span>30 (min)</span><span>60 (max)</span>
                    </div>
                </div>
                <div className="bg-[var(--glass-surface-hover)] rounded-xl p-4 border border-[var(--glass-border)]">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-[var(--text-tertiary)] uppercase">Description</span>
                        <CharCount value={cfg.description} min={120} max={160} />
                    </div>
                    <div className="h-2 bg-[var(--glass-border)] rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all ${descLen > 160 ? 'bg-amber-400' : descLen < 120 ? 'bg-rose-400' : 'bg-emerald-500'}`}
                            style={{ width: `${Math.min(100, (descLen / 160) * 100)}%` }}
                        />
                    </div>
                    <div className="flex justify-between text-2xs text-[var(--text-muted)] mt-1">
                        <span>120 (min)</span><span>160 (max)</span>
                    </div>
                </div>
            </div>

            {/* Tips */}
            <div className="bg-indigo-50/60 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-xl p-4 text-xs text-indigo-700 dark:text-indigo-300 space-y-1">
                <p className="font-bold mb-1">💡 Hướng dẫn tối ưu</p>
                <p>• <strong>Title:</strong> 30–60 ký tự. Đặt từ khóa chính ở đầu. Kết thúc bằng "- SGS LAND".</p>
                <p>• <strong>Description:</strong> 120–160 ký tự. Chứa từ khóa chính và kêu gọi hành động.</p>
                <p>• <strong>URL:</strong> Ngắn, dùng dấu gạch ngang, không ký tự đặc biệt.</p>
            </div>
        </div>
    );
};

// ── Tab: Meta Editor ───────────────────────────────────────────────────────────
const MetaEditor: React.FC = () => {
    const [overrides, setOverrides] = useState<Record<string, { title: string; description: string }>>(getSEOOverrides);
    const [edits, setEdits] = useState<Record<string, { title: string; description: string }>>({});
    const [saved, setSaved] = useState<string | null>(null);

    const getTitle = (key: string) => edits[key]?.title ?? overrides[key]?.title ?? ROUTE_SEO[key]?.title ?? ROUTE_SEO[''].title;
    const getDesc  = (key: string) => edits[key]?.description ?? overrides[key]?.description ?? ROUTE_SEO[key]?.description ?? ROUTE_SEO[''].description;

    const handleChange = (key: string, field: 'title' | 'description', val: string) => {
        setEdits(prev => ({ ...prev, [key]: { ...(prev[key] ?? { title: getTitle(key), description: getDesc(key) }), [field]: val } }));
    };

    const handleSave = (key: string) => {
        const t = getTitle(key);
        const d = getDesc(key);
        saveSEOOverride(key, t, d);
        setOverrides(getSEOOverrides());
        setEdits(prev => { const next = { ...prev }; delete next[key]; return next; });
        // Restore admin page SEO to preserve noindex — do NOT apply the edited route's SEO to the DOM
        updatePageSEO('seo-manager');
        setSaved(key);
        setTimeout(() => setSaved(null), 2000);
    };

    const handleReset = (key: string) => {
        clearSEOOverride(key);
        setOverrides(getSEOOverrides());
        setEdits(prev => { const next = { ...prev }; delete next[key]; return next; });
        // Restore admin page SEO to preserve noindex
        updatePageSEO('seo-manager');
    };

    const isDirty = (key: string) => !!edits[key];
    const isOverridden = (key: string) => !!overrides[key];

    return (
        <div className="space-y-4">
            <p className="text-xs text-[var(--text-tertiary)]">Chỉnh sửa title và description cho từng trang. Thay đổi được lưu trong trình duyệt và có hiệu lực lần sau khi người dùng truy cập trang đó.</p>

            {ALL_ROUTES.map(({ key, label }) => {
                const dirty = isDirty(key);
                const overridden = isOverridden(key);
                const title = getTitle(key);
                const desc = getDesc(key);
                const cfg = ROUTE_SEO[key];

                return (
                    <div key={key} className={`bg-[var(--bg-surface)] border rounded-2xl p-4 shadow-sm transition-all ${dirty ? 'border-indigo-300 shadow-indigo-100/50 dark:shadow-indigo-900/20' : 'border-[var(--glass-border)]'}`}>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-[var(--text-primary)]">{label}</span>
                                {cfg.noIndex && <span className="text-2xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full border border-[var(--glass-border)]">noindex</span>}
                                {overridden && !dirty && <span className="text-2xs font-bold bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 px-2 py-0.5 rounded-full border border-indigo-100">override</span>}
                            </div>
                            <span className="text-2xs font-mono text-[var(--text-muted)]">/{key}</span>
                        </div>

                        <div className="space-y-2.5">
                            <div>
                                <div className="flex justify-between mb-1">
                                    <label className="text-2xs font-bold text-[var(--text-tertiary)] uppercase">Title</label>
                                    <CharCount value={title} min={30} max={60} />
                                </div>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={e => handleChange(key, 'title', e.target.value)}
                                    className="w-full border border-[var(--glass-border)] rounded-lg px-3 py-2 text-xs bg-[var(--glass-surface-hover)] text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between mb-1">
                                    <label className="text-2xs font-bold text-[var(--text-tertiary)] uppercase">Description</label>
                                    <CharCount value={desc} min={120} max={160} />
                                </div>
                                <textarea
                                    value={desc}
                                    rows={2}
                                    onChange={e => handleChange(key, 'description', e.target.value)}
                                    className="w-full border border-[var(--glass-border)] rounded-lg px-3 py-2 text-xs bg-[var(--glass-surface-hover)] text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all resize-none"
                                />
                            </div>
                        </div>

                        <div className="flex gap-2 mt-3">
                            {dirty && (
                                <button
                                    onClick={() => handleSave(key)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-2xs font-bold rounded-lg hover:bg-indigo-700 transition-colors active:scale-95"
                                >
                                    {saved === key ? ICONS.CHECK : ICONS.SAVE}
                                    {saved === key ? 'Đã lưu' : 'Lưu'}
                                </button>
                            )}
                            {overridden && (
                                <button
                                    onClick={() => handleReset(key)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--glass-surface-hover)] text-[var(--text-secondary)] text-2xs font-bold rounded-lg hover:bg-[var(--glass-border)] transition-colors border border-[var(--glass-border)]"
                                >
                                    {ICONS.RESET} Reset
                                </button>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

// ── Tab: SEO Health ────────────────────────────────────────────────────────────
const HealthChecklist: React.FC = () => {
    const [results, setResults] = useState<HealthResult[]>([]);
    const [loading, setLoading] = useState(true);

    const run = useCallback(async () => {
        setLoading(true);
        const checks: HealthResult[] = [];

        const check = (id: string, label: string, pass: boolean, warn?: boolean, detail?: string): HealthResult => ({
            id, label,
            status: pass ? 'pass' : warn ? 'warn' : 'fail',
            detail: detail ?? (pass ? 'OK' : 'Cần kiểm tra'),
        });

        // 1. Canonical present
        const canonical = document.getElementById('canonical-url') as HTMLLinkElement | null;
        const hasCanonical = !!canonical?.href && canonical.href !== window.location.origin + '/';
        checks.push(check('canonical', 'Canonical URL', hasCanonical, false,
            hasCanonical ? canonical!.href : 'Thẻ canonical không có href'));

        // 2. OG image is hosted HTTPS URL
        const ogImg = document.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content ?? '';
        const ogImgOk = ogImg.startsWith('https://') && !ogImg.startsWith('data:');
        checks.push(check('og-image', 'OG Image (HTTPS URL)', ogImgOk, false,
            ogImgOk ? ogImg.slice(0, 60) + '...' : `Giá trị: ${ogImg.slice(0, 40)}...`));

        // 3. Hreflang declared
        const hreflangs = document.querySelectorAll('link[rel="alternate"][hreflang]');
        const hreflangOk = hreflangs.length >= 2;
        checks.push(check('hreflang', 'Hreflang Alternate Links', hreflangOk, false,
            `${hreflangs.length} link(s) tìm thấy (cần ≥ 2)`));

        // 4. Robots meta
        const robotsMeta = document.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content ?? '';
        const robotsOk = robotsMeta.includes('index');
        checks.push(check('robots', 'Robots Meta (index)', robotsOk, false, robotsMeta || 'Không tìm thấy'));

        // 5. Structured data count
        const jsonLdCount = document.querySelectorAll('script[type="application/ld+json"]').length;
        const jsonLdOk = jsonLdCount >= 5;
        checks.push(check('jsonld', 'Structured Data Schemas', jsonLdOk, jsonLdCount >= 3,
            `${jsonLdCount} schema(s) (khuyến nghị ≥ 5)`));

        // 6. Page title length
        const titleLen = document.title.length;
        const titleOk = titleLen >= 30 && titleLen <= 60;
        checks.push(check('title-len', 'Title Length (30–60 ký tự)', titleOk, titleLen <= 70,
            `${titleLen} ký tự: "${document.title.slice(0, 50)}..."`));

        // 7. Meta description length
        const descContent = document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ?? '';
        const descLen = descContent.length;
        const descOk = descLen >= 120 && descLen <= 160;
        checks.push(check('desc-len', 'Description Length (120–160 ký tự)', descOk, descLen >= 80,
            `${descLen} ký tự`));

        // 8. Manifest reachable
        try {
            const r = await fetch('/manifest.json', { method: 'HEAD' });
            checks.push(check('manifest', 'manifest.json Reachable', r.ok, false, r.ok ? `HTTP ${r.status}` : `HTTP ${r.status}`));
        } catch {
            checks.push({ id: 'manifest', label: 'manifest.json Reachable', status: 'fail', detail: 'Fetch failed' });
        }

        // 9. Sitemap reachable
        try {
            const r = await fetch('/sitemap.xml', { method: 'HEAD' });
            checks.push(check('sitemap', 'sitemap.xml Reachable', r.ok, false, r.ok ? `HTTP ${r.status}` : `HTTP ${r.status}`));
        } catch {
            checks.push({ id: 'sitemap', label: 'sitemap.xml Reachable', status: 'fail', detail: 'Fetch failed' });
        }

        // 10. apple-touch-icon
        const ati = document.querySelector('link[rel="apple-touch-icon"]');
        checks.push(check('ati', 'Apple Touch Icon', !!ati, false, ati ? 'Khai báo trong <head>' : 'Thiếu <link rel="apple-touch-icon">'));

        // 11. theme-color
        const tc = document.querySelector('meta[name="theme-color"]');
        checks.push(check('theme-color', 'Theme Color Meta', !!tc, false, tc ? (tc as HTMLMetaElement).content : 'Thiếu theme-color'));

        // 12. noindex not set on index.html base
        const robotsContent = document.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content ?? '';
        const noIndexOnPublic = robotsContent.includes('noindex');
        checks.push(check('noindex-pub', 'Trang công khai không bị noindex', !noIndexOnPublic, false,
            noIndexOnPublic ? '⚠ Trang hiện tại bị noindex!' : 'OK'));

        setResults(checks);
        setLoading(false);
    }, []);

    useEffect(() => { run(); }, [run]);

    const passCount = results.filter(r => r.status === 'pass').length;
    const score = results.length ? Math.round((passCount / results.length) * 100) : 0;
    const scoreColor = score >= 90 ? 'text-emerald-600' : score >= 70 ? 'text-amber-500' : 'text-rose-500';

    const statusIcon = (s: 'pass' | 'warn' | 'fail') =>
        s === 'pass' ? <span className="text-emerald-500">{ICONS.CHECK}</span>
        : s === 'warn' ? <span className="text-amber-500">{ICONS.WARN}</span>
        : <span className="text-rose-500">{ICONS.ERROR}</span>;

    const statusBg = (s: 'pass' | 'warn' | 'fail') =>
        s === 'pass' ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30'
        : s === 'warn' ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30'
        : 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-900/30';

    if (loading) return (
        <div className="flex items-center justify-center py-16 gap-3 text-[var(--text-secondary)]">
            <div className="w-5 h-5 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
            <span className="text-sm font-medium">Đang kiểm tra 12 tín hiệu SEO...</span>
        </div>
    );

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`text-4xl font-black ${scoreColor}`}>{score}</div>
                    <div>
                        <div className="text-sm font-bold text-[var(--text-primary)]">SEO Score</div>
                        <div className="text-xs text-[var(--text-tertiary)]">{passCount}/{results.length} kiểm tra pass</div>
                    </div>
                </div>
                <button onClick={run} className="flex items-center gap-2 px-4 py-2 bg-[var(--glass-surface-hover)] border border-[var(--glass-border)] rounded-xl text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--glass-border)] transition-colors">
                    {ICONS.RESET} Kiểm tra lại
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {results.map(r => (
                    <div key={r.id} className={`flex items-start gap-3 p-3 rounded-xl border ${statusBg(r.status)}`}>
                        <div className="shrink-0 mt-0.5">{statusIcon(r.status)}</div>
                        <div className="min-w-0">
                            <div className="text-xs font-bold text-[var(--text-primary)] leading-tight">{r.label}</div>
                            <div className="text-2xs text-[var(--text-secondary)] mt-0.5 truncate" title={r.detail}>{r.detail}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ── JSON Syntax Highlighter ────────────────────────────────────────────────────
const highlightJson = (json: string): string => {
    return json.replace(
        /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?|[{}\[\]:,])/g,
        (match) => {
            let cls = 'color:#a8b1c2'; // default
            if (/^"/.test(match)) {
                if (/:$/.test(match)) {
                    cls = 'color:#79b8ff'; // key
                } else {
                    cls = 'color:#9ecbff'; // string value
                }
            } else if (/true|false/.test(match)) {
                cls = 'color:#85e89d'; // boolean
            } else if (/null/.test(match)) {
                cls = 'color:#f97583'; // null
            } else if (/[{}\[\]]/.test(match)) {
                cls = 'color:#e1e4e8'; // brackets
            } else if (/[:,]/.test(match)) {
                cls = 'color:#6a737d'; // punctuation
            } else {
                cls = 'color:#f8c555'; // number
            }
            return `<span style="${cls}">${match.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>`;
        }
    );
};

const StructuredData: React.FC = () => {
    const [schemas, setSchemas] = useState<{ type: string; json: string }[]>([]);
    const [copied, setCopied] = useState<number | null>(null);

    useEffect(() => {
        const scripts = Array.from(document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]'));
        const parsed = scripts.map((s, i) => {
            try {
                const obj = JSON.parse(s.textContent ?? '{}');
                const type = obj['@type'] ?? `Schema ${i + 1}`;
                return { type, json: JSON.stringify(obj, null, 2) };
            } catch {
                return { type: `Schema ${i + 1}`, json: s.textContent ?? '' };
            }
        });
        setSchemas(parsed);
    }, []);

    const handleCopy = async (json: string, idx: number) => {
        await copyToClipboard(json);
        setCopied(idx);
        setTimeout(() => setCopied(null), 2000);
    };

    const typeColor = (type: string) => {
        if (type.includes('Organization')) return 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border-indigo-100';
        if (type.includes('WebSite')) return 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 border-violet-100';
        if (type.includes('Software')) return 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-100';
        if (type.includes('FAQ')) return 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-100';
        if (type.includes('Breadcrumb')) return 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-100';
        if (type.includes('Service')) return 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 border-teal-100';
        return 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200';
    };

    if (schemas.length === 0) return (
        <div className="py-12 text-center text-[var(--text-secondary)] text-sm">
            Không tìm thấy JSON-LD schemas trong &lt;head&gt;
        </div>
    );

    return (
        <div className="space-y-4">
            <p className="text-xs text-[var(--text-tertiary)]">{schemas.length} JSON-LD schema(s) được tìm thấy trong document head.</p>

            {schemas.map((s, idx) => (
                <div key={idx} className="bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-2xl overflow-hidden shadow-sm">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--glass-border)] bg-[var(--glass-surface-hover)]">
                        <span className={`text-2xs font-bold px-2.5 py-1 rounded-full border ${typeColor(s.type)}`}>{s.type}</span>
                        <button
                            onClick={() => handleCopy(s.json, idx)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-2xs font-bold text-[var(--text-secondary)] hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                        >
                            {copied === idx ? ICONS.CHECK : ICONS.COPY}
                            {copied === idx ? 'Đã copy' : 'Copy'}
                        </button>
                    </div>
                    <pre
                        className="p-4 text-2xs font-mono overflow-x-auto no-scrollbar leading-relaxed bg-slate-900 dark:bg-slate-950 rounded-b-2xl"
                        dangerouslySetInnerHTML={{ __html: highlightJson(s.json) }}
                    />
                </div>
            ))}
        </div>
    );
};

// ── External Tool Links ────────────────────────────────────────────────────────
const EXTERNAL_TOOLS = [
    { label: 'Google Search Console', url: 'https://search.google.com/search-console', color: 'text-blue-600' },
    { label: 'PageSpeed Insights', url: 'https://pagespeed.web.dev/?url=https%3A%2F%2Fsgsland.vn', color: 'text-orange-600' },
    { label: 'Rich Results Test', url: 'https://search.google.com/test/rich-results?url=https%3A%2F%2Fsgsland.vn', color: 'text-green-600' },
    { label: 'Schema Markup Validator', url: 'https://validator.schema.org/', color: 'text-purple-600' },
];

// ── Main Component ─────────────────────────────────────────────────────────────
export const SeoManager: React.FC = () => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [activeTab, setActiveTab] = useState<TabId>('SERP');

    useEffect(() => {
        db.getCurrentUser().then(u => {
            setIsAdmin(u?.role === UserRole.ADMIN || u?.role === UserRole.TEAM_LEAD);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    const TABS: { id: TabId; label: string }[] = [
        { id: 'SERP',   label: 'SERP Preview' },
        { id: 'META',   label: 'Meta Editor' },
        { id: 'HEALTH', label: 'Sức khoẻ SEO' },
        { id: 'SCHEMA', label: 'Structured Data' },
    ];

    if (loading) return (
        <div className="p-10 text-center text-[var(--text-secondary)] font-mono animate-pulse">{t('common.loading')}</div>
    );

    if (!isAdmin) return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center animate-enter">
            <div className="w-16 h-16 bg-rose-50 dark:bg-rose-900/20 text-rose-500 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                {ICONS.ERROR}
            </div>
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">{t('common.access_denied')}</h2>
            <p className="text-sm text-[var(--text-secondary)]">{t('common.admin_only')}</p>
        </div>
    );

    return (
        <div className="space-y-5 pb-20 animate-enter p-4 sm:p-6">

            {/* ── Header ──────────────────────────────────────────────────── */}
            <div className="bg-[var(--bg-surface)] px-5 py-4 sm:px-6 sm:py-5 rounded-[20px] border border-[var(--glass-border)] shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-9 h-9 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                                {ICONS.GLOBE}
                            </div>
                            <h2 className="text-lg sm:text-xl font-bold text-[var(--text-primary)]">SEO Manager</h2>
                        </div>
                        <p className="text-sm text-[var(--text-tertiary)] ml-12">Kiểm tra và quản lý toàn bộ tín hiệu SEO của nền tảng SGS LAND.</p>
                    </div>
                    {/* External Tools */}
                    <div className="flex flex-wrap gap-2">
                        {EXTERNAL_TOOLS.map(tool => (
                            <a
                                key={tool.url}
                                href={tool.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`flex items-center gap-1.5 px-3 py-1.5 bg-[var(--glass-surface-hover)] border border-[var(--glass-border)] rounded-xl text-2xs font-bold hover:border-indigo-300 hover:shadow-sm transition-all ${tool.color}`}
                            >
                                {tool.label} {ICONS.EXT}
                            </a>
                        ))}
                    </div>
                </div>

                {/* Tab Bar */}
                <div className="flex gap-1 mt-4 bg-[var(--glass-surface-hover)] p-1 rounded-xl w-full sm:w-auto sm:inline-flex">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                                activeTab === tab.id
                                    ? 'bg-[var(--bg-surface)] shadow text-indigo-600 dark:text-indigo-400'
                                    : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Tab Content ─────────────────────────────────────────────── */}
            <div className="bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-[20px] shadow-sm p-4 sm:p-6">
                {activeTab === 'SERP'   && <SerpPreview />}
                {activeTab === 'META'   && <MetaEditor />}
                {activeTab === 'HEALTH' && <HealthChecklist />}
                {activeTab === 'SCHEMA' && <StructuredData />}
            </div>

        </div>
    );
};
