import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../services/dbApi';
import { UserRole } from '../types';
import { useTranslation } from '../services/i18n';
import { ROUTE_SEO, SEOConfig, getSEOOverrides, saveSEOOverride, clearSEOOverride, updatePageSEO } from '../utils/seo';
import { copyToClipboard } from '../utils/clipboard';
import seoApi, { SeoOverride, TargetKeyword, AiVisibilityStatus, SeoAuditItem } from '../services/api/seoApi';
import { Dropdown } from '../components/Dropdown';
import {
    LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { SeoHead } from '../components/SeoHead';
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
type TabId = 'SERP' | 'META' | 'HEALTH' | 'SCHEMA' | 'GEO';

interface HealthResult {
    id: string;
    label: string;
    status: 'pass' | 'warn' | 'fail' | 'unavailable';
    detail: string;
    severity?: 'critical' | 'high' | 'medium' | 'low' | 'info';
    source?: string;
    checkedAt?: string;
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
    'seo-manager':    'Quản Lý SEO (admin)',
    livechat:         'Live Chat (trang chat công khai)',
};
// Derived from ROUTE_SEO so it's always in sync — no hardcoding.
const ALL_ROUTES: { key: string; label: string }[] = Object.keys(ROUTE_SEO).map(key => ({
    key,
    label: ROUTE_LABELS[key] ?? key,
}));
// Public-facing routes only (exclude noIndex routes and auth pages like login/register/root).
const PUBLIC_ROUTES: { key: string; label: string }[] = ALL_ROUTES.filter(({ key }) => {
    const cfg = ROUTE_SEO[key];
    return !cfg.noIndex && key !== '' && key !== 'login' && key !== 'register';
});

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
// ── SERP Status Helpers ────────────────────────────────────────────────────────
function getSerpStatus(title: string, desc: string): 'green' | 'amber' | 'red' {
    const tLen = title.length;
    const dLen = desc.length;
    if (tLen >= 30 && tLen <= 60 && dLen >= 120 && dLen <= 160) return 'green';
    if (tLen > 0 && dLen > 0) return 'amber';
    return 'red';
}
function statusDotClass(status: 'green' | 'amber' | 'red') {
    return status === 'green' ? 'bg-emerald-500' : status === 'amber' ? 'bg-amber-400' : 'bg-rose-500';
}
function statusRingClass(status: 'green' | 'amber' | 'red') {
    return status === 'green' ? 'ring-emerald-200 dark:ring-emerald-800' : status === 'amber' ? 'ring-amber-200 dark:ring-amber-800' : 'ring-rose-200 dark:ring-rose-800';
}
// ── SerpPageDropdown ────────────────────────────────────────────────────────────
const SerpPageDropdown: React.FC<{
    value: string;
    onChange: (key: string) => void;
    routes: { key: string; label: string }[];
    overrides: Record<string, { title: string; description: string }>;
}> = ({ value, onChange, routes, overrides }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [coords, setCoords] = useState<{
        top?: number;
        bottom?: number;
        left: number;
        width: number;
        maxH: number;
        openUp: boolean;
    }>({ left: 0, width: 0, maxH: 400, openUp: false });
    const btnRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const selected = routes.find(r => r.key === value) ?? routes[0];
    const selectedCfg = getEffectiveCfg(value, overrides);
    const selectedStatus = getSerpStatus(selectedCfg.title, selectedCfg.description);
    const openMenu = () => {
        if (btnRef.current) {
            const rect = btnRef.current.getBoundingClientRect();
            const GAP = 6;
            const IDEAL_H = 400;
            const menuW = Math.max(rect.width, 380);
            const safeLeft = Math.min(rect.left, window.innerWidth - menuW - 12);

            const spaceBelow = window.innerHeight - rect.bottom - GAP - 8;
            const spaceAbove = rect.top - GAP - 8;
            const openUp = spaceBelow < 220 && spaceAbove > spaceBelow;
            if (openUp) {
                setCoords({
                    bottom: window.innerHeight - rect.top + GAP,
                    top: undefined,
                    left: safeLeft,
                    width: menuW,
                    maxH: Math.min(IDEAL_H, spaceAbove),
                    openUp: true,
                });
            } else {
                setCoords({
                    top: rect.bottom + GAP,
                    bottom: undefined,
                    left: safeLeft,
                    width: menuW,
                    maxH: Math.min(IDEAL_H, spaceBelow),
                    openUp: false,
                });
            }
        }
        setIsOpen(true);
    };
    useEffect(() => {
        if (!isOpen) return;
        const handle = (e: MouseEvent) => {
            const t = e.target as Node;
            if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
            // Scrollbar clicks in WebKit don't report target inside menuRef — check bounding rect
            if (menuRef.current) {
                const r = menuRef.current.getBoundingClientRect();
                if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) return;
            }
            setIsOpen(false);
        };
        const handleScroll = (e: Event) => {
            // Ignore scroll events that originate inside the dropdown itself (e.g. scrollbar drag)
            if (menuRef.current && menuRef.current.contains(e.target as Node)) return;
            setIsOpen(false);
        };
        const handleResize = () => setIsOpen(false);
        document.addEventListener('mousedown', handle);
        window.addEventListener('scroll', handleScroll, true);
        window.addEventListener('resize', handleResize);
        return () => {
            document.removeEventListener('mousedown', handle);
            window.removeEventListener('scroll', handleScroll, true);
            window.removeEventListener('resize', handleResize);
        };
    }, [isOpen]);
    return (
                <div className="relative">
            <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wide block mb-1.5">Chọn trang</label>
            <button
                ref={btnRef}
                type="button"
                onClick={() => (isOpen ? setIsOpen(false) : openMenu())}
                className={`w-full flex items-center gap-3 px-4 py-3 border rounded-xl bg-[var(--bg-surface)] transition-all outline-none text-left ${isOpen ? 'border-[var(--sgs-primary)] ring-2 ring-[var(--sgs-primary)]/20' : 'border-[var(--glass-border)] hover:border-[var(--sgs-primary)] hover:shadow-sm'}`}
            >
                {/* Status dot */}
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ring-2 ${statusDotClass(selectedStatus)} ${statusRingClass(selectedStatus)}`} />

                {/* Selected SERP tag */}
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-[var(--text-primary)] truncate">{selected?.label ?? '—'}</div>
                    <div className="text-xs font-mono text-[#4d5156] dark:text-slate-400 truncate">
                        sgsland.vn{selectedCfg.path || '/'}
                    </div>
                </div>
                {/* Chevron */}
                <svg
                    className={`w-4 h-4 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[var(--sgs-primary)]' : 'text-[var(--text-secondary)]'}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            {isOpen && createPortal(
                <div
                    ref={menuRef}
                    className="fixed z-[10002] bg-[var(--bg-surface)] rounded-2xl shadow-2xl border border-[var(--glass-border)] animate-scale-up thin-scrollbar"
                    style={{
                        ...(coords.openUp ? { bottom: coords.bottom } : { top: coords.top }),
                        left: coords.left,
                        width: coords.width,
                        maxHeight: coords.maxH,
                        overflowY: 'auto',
                        overflowX: 'hidden',
                        transformOrigin: coords.openUp ? 'bottom center' : 'top center',
                    }}
                >
                    <div className="divide-y divide-[var(--glass-border)] overscroll-contain pb-2">
                        {routes.map(route => {
                            const cfg = getEffectiveCfg(route.key, overrides);
                            const status = getSerpStatus(cfg.title, cfg.description);
                            const isSelected = route.key === value;
                            return (
                                <button
                                    key={route.key}
                                    type="button"
                                    onClick={() => { onChange(route.key); setIsOpen(false); }}
                                    className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors ${isSelected ? 'bg-[var(--sgs-primary)]/10 dark:bg-[var(--sgs-primary)]/25' : 'hover:bg-[var(--glass-surface)]'}`}
                                >
                                    {/* Status dot */}
                                    <span className={`w-2 h-2 rounded-full shrink-0 mt-[7px] ring-2 ${statusDotClass(status)} ${statusRingClass(status)}`} />

                                    {/* Mini SERP snippet */}
                                    <div className="flex-1 min-w-0">
                                        {/* Row 1: page name + route badge + checkmark — NO flex-wrap so label truncates correctly */}
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <span className={`text-xs font-bold flex-1 min-w-0 truncate ${isSelected ? 'text-[var(--sgs-primary)] dark:text-[var(--sgs-primary)]' : 'text-[var(--text-primary)]'}`}>
                                                {route.label}
                                            </span>
                                            <span className="text-[10px] font-mono text-[var(--text-muted)] bg-[var(--glass-surface)] px-1.5 py-0.5 rounded shrink-0">
                                                /{route.key || ''}
                                            </span>
                                            {isSelected && (
                                                <svg className="w-3.5 h-3.5 text-sgs-primary dark:text-sgs-text-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                </svg>
                                            )}
                                        </div>
                                        {/* Row 2: SERP title — CSS truncate đủ, không cần JS slice */}
                                        <div className="text-xs text-[#1a0dab] dark:text-blue-400 truncate mt-0.5 leading-tight">
                                            {cfg.title}
                                        </div>
                                        {/* Row 3: SERP description */}
                                        <div className="text-[11px] text-[#4d5156] dark:text-slate-400 truncate leading-snug">
                                            {cfg.description}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
// ── Derive a relevant search query from the effective page title ─────────────────
// Always reflects the CURRENT title (including admin overrides) so the Google
// SERP mockup search bar stays in sync after each meta edit + save.
function deriveSearchQuery(title: string): string {
    let q = title
        // Strip leading "SGS LAND | " or "SGS LAND - " (homepage format)
        .replace(/^SGS\s+LAND\s*[|–\-]\s*/i, '')
        // Strip trailing " | SGS LAND" or " - SGS LAND" (other pages format)
        .replace(/\s*[|–\-]\s*SGS\s+LAND\s*$/i, '')
        .trim();
    // If there's still a "|" separator, take only the first segment (the main topic)
    const pipe = q.indexOf('|');
    if (pipe > 15) q = q.slice(0, pipe).trim();

    // Lowercase, collapse spaces, cap at 55 chars
    return q.toLowerCase().replace(/\s+/g, ' ').slice(0, 55).trim();
}
// ── Tab: SERP Preview ──────────────────────────────────────────────────────────
const SerpPreview: React.FC<{
    selectedKey: string;
    onSelect: (k: string) => void;
    overrides: Record<string, { title: string; description: string }>;
}> = ({ selectedKey, onSelect, overrides }) => {
    const cfg = getEffectiveCfg(selectedKey, overrides);
    const titleLen = cfg.title.length;
    const descLen = cfg.description.length;
    const titleTrunc = cfg.title.slice(0, 60);
    const descTrunc = cfg.description.slice(0, 160);
    const pathDisplay = `sgsland.vn${cfg.path || '/'}`;
    const searchQuery = deriveSearchQuery(cfg.title);
    // Use window.location.origin so the link works in dev preview AND on the live domain
    const pageHref = `${window.location.origin}${cfg.path || '/'}`;
    return (
        <div className="space-y-6">
            <SerpPageDropdown
                value={selectedKey}
                onChange={onSelect}
                routes={PUBLIC_ROUTES}
                overrides={overrides}
            />
            {/* Google SERP Mockup */}
            <div className="bg-[var(--bg-surface)] dark:bg-sgs-primary-deep border border-[var(--glass-border)] rounded-2xl p-6 shadow-sm font-sans">
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 bg-sgs-primary rounded-full flex items-center justify-center">
                        <span className="text-white text-2xs font-bold">G</span>
                    </div>
                    <span className="text-sm text-sgs-text-muted">Google Search</span>
                </div>
                <div className="border-b border-slate-100 dark:border-slate-700 mb-4 pb-3">
                    <div className="flex items-center gap-2 bg-sgs-bg dark:bg-slate-800 rounded-full px-4 py-2 max-w-lg text-sm text-sgs-text-muted border border-slate-200 dark:border-slate-700">
                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        {searchQuery}
                    </div>
                </div>
                {/* Search Result Card */}
                <div className="max-w-2xl">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-5 h-5 bg-sgs-champagne rounded-full flex items-center justify-center">
                            {ICONS.GLOBE}
                        </div>
                        <div>
                            <div className="text-sm font-medium text-[#202124] dark:text-slate-200">SGS LAND</div>
                            <a
                                href={pageHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-[#4d5156] dark:text-slate-400 hover:underline flex items-center gap-1 group"
                                title={`Mở trang: ${pageHref}`}
                            >
                                <span>{pathDisplay}</span>
                                <svg className="w-3 h-3 opacity-0 group-hover:opacity-70 transition-opacity shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                            </a>
                        </div>
                    </div>
                    <a
                        href={pageHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-xl text-[#1a0dab] dark:text-blue-400 font-normal hover:underline leading-tight mb-1"
                        title={`Mở trang: ${pageHref}`}
                    >
                        {titleTrunc}{cfg.title.length > 60 ? '...' : ''}
                    </a>
                    <p className="text-sm text-[#4d5156] dark:text-slate-400 leading-snug">
                        {descTrunc}{cfg.description.length > 160 ? '...' : ''}
                    </p>
                </div>
            </div>
            {/* Character Counters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-[var(--glass-surface-hover)] rounded-xl p-4 border border-[var(--glass-border)]">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-[var(--text-tertiary)] uppercase">Tiêu đề</span>
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
                        <span className="text-xs font-bold text-[var(--text-tertiary)] uppercase">Mô tả</span>
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
            <div className="bg-[var(--sgs-primary)]/10 dark:bg-sgs-primary/10 border border-sgs-border dark:border-[var(--sgs-primary)]/30 rounded-xl p-4 text-xs text-sgs-primary dark:text-sgs-on-dark-muted space-y-1">
                <p className="font-bold mb-1">💡 Hướng dẫn tối ưu</p>
                <p>• <strong>Title:</strong> 30–60 ký tự. Đặt từ khóa chính ở đầu. Kết thúc bằng "- SGS LAND".</p>
                <p>• <strong>Description:</strong> 120–160 ký tự. Chứa từ khóa chính và kêu gọi hành động.</p>
                <p>• <strong>URL:</strong> Ngắn, dùng dấu gạch ngang, không ký tự đặc biệt.</p>
            </div>
        </div>
    );
};
// ── Tab: Meta Editor ───────────────────────────────────────────────────────────
const MetaEditor: React.FC<{
    overrides: Record<string, { title: string; description: string }>;
    onOverridesChange: (next: Record<string, { title: string; description: string }>) => void;
    onAfterSave?: (key: string) => void;
}> = ({ overrides, onOverridesChange, onAfterSave }) => {
    const [edits, setEdits] = useState<Record<string, { title: string; description: string }>>({});
    const [saved, setSaved] = useState<string | null>(null);
    const [previewing, setPreviewing] = useState<string | null>(null);
    const [serverSaving, setServerSaving] = useState<string | null>(null);
    const [serverError, setServerError] = useState<string | null>(null);
    const getTitle = (key: string) => edits[key]?.title ?? overrides[key]?.title ?? ROUTE_SEO[key]?.title ?? ROUTE_SEO[''].title;
    const getDesc  = (key: string) => edits[key]?.description ?? overrides[key]?.description ?? ROUTE_SEO[key]?.description ?? ROUTE_SEO[''].description;
    const handleChange = (key: string, field: 'title' | 'description', val: string) => {
        setEdits(prev => ({ ...prev, [key]: { ...(prev[key] ?? { title: getTitle(key), description: getDesc(key) }), [field]: val } }));
    };
    const handleSave = async (key: string) => {
        const t = getTitle(key);
        const d = getDesc(key);
        setServerSaving(key);
        setServerError(null);
        try {
            await seoApi.upsert(key, t, d);
        } catch {
            setServerError(`Không thể lưu lên server. Đã lưu tạm trong trình duyệt.`);
        } finally {
            setServerSaving(null);
        }
        saveSEOOverride(key, t, d);
        onOverridesChange(getSEOOverrides());
        setEdits(prev => { const next = { ...prev }; delete next[key]; return next; });
        setPreviewing(key);
        updatePageSEO(key);
        setSaved(key);
        onAfterSave?.(key);
        setTimeout(() => {
            updatePageSEO('seo-manager');
            setPreviewing(null);
            setSaved(null);
        }, 3000);
    };
    const handleReset = async (key: string) => {
        try {
            await seoApi.remove(key);
        } catch { /* silent — still clear locally */ }
        clearSEOOverride(key);
        onOverridesChange(getSEOOverrides());
        setEdits(prev => { const next = { ...prev }; delete next[key]; return next; });
        updatePageSEO('seo-manager');
    };
    const handlePreview = useCallback((key: string) => {
        setPreviewing(key);
        // Apply the edited route's SEO to the DOM for 3s so the admin can verify the title/description in the browser tab
        updatePageSEO(key);
        setTimeout(() => {
            // Restore admin page SEO after preview window
            updatePageSEO('seo-manager');
            setPreviewing(null);
        }, 3000);
    }, []);
    const isDirty = (key: string) => !!edits[key];
    const isOverridden = (key: string) => !!overrides[key];
    return (
        <div className="space-y-4">
            <p className="text-xs text-[var(--text-tertiary)]">Chỉnh sửa title và description cho các trang công khai. Thay đổi được <strong className="font-semibold text-sgs-verified">lưu lên server</strong> — Google và mạng xã hội sẽ thấy meta mới khi crawl lại.</p>
            {serverError && (
                <div className="text-xs text-sgs-accent-text bg-amber-50 dark:bg-amber-900/20 border border-amber-200 rounded-xl px-3 py-2">{serverError}</div>
            )}
            {PUBLIC_ROUTES.map(({ key, label }) => {
                const dirty = isDirty(key);
                const overridden = isOverridden(key);
                const title = getTitle(key);
                const desc = getDesc(key);
                const cfg = ROUTE_SEO[key];
                return (
                    <div key={key} className={`bg-[var(--bg-surface)] border rounded-2xl p-4 shadow-sm transition-all ${dirty ? 'border-[var(--sgs-primary)] shadow-[var(--sgs-primary)]/50 dark:shadow-[var(--sgs-primary)]/20' : 'border-[var(--glass-border)]'}`}>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-[var(--text-primary)]">{label}</span>
                                {cfg.noIndex && <span className="text-2xs font-bold bg-slate-100 dark:bg-slate-800 text-sgs-text-muted px-2 py-0.5 rounded-full border border-[var(--glass-border)]">noindex</span>}
                                {overridden && !dirty && <span className="text-2xs font-bold bg-sgs-champagne dark:bg-sgs-primary/20 text-sgs-primary px-2 py-0.5 rounded-full border border-sgs-border">đã chỉnh</span>}
                            </div>
                            <span className="text-2xs font-mono text-[var(--text-muted)]">/{key}</span>
                        </div>
                        <div className="space-y-2.5">
                            <div>
                                <div className="flex justify-between mb-1">
                                    <label className="text-2xs font-bold text-[var(--text-tertiary)] uppercase">Tiêu đề</label>
                                    <CharCount value={title} min={30} max={60} />
                                </div>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={e => handleChange(key, 'title', e.target.value)}
                                    className="w-full border border-[var(--glass-border)] rounded-lg px-3 py-2 text-xs bg-[var(--glass-surface-hover)] text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--sgs-primary)]/20 focus:border-[var(--sgs-primary)] transition-all"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between mb-1">
                                    <label className="text-2xs font-bold text-[var(--text-tertiary)] uppercase">Mô tả</label>
                                    <CharCount value={desc} min={120} max={160} />
                                </div>
                                <textarea
                                    value={desc}
                                    rows={2}
                                    onChange={e => handleChange(key, 'description', e.target.value)}
                                    className="w-full border border-[var(--glass-border)] rounded-lg px-3 py-2 text-xs bg-[var(--glass-surface-hover)] text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--sgs-primary)]/20 focus:border-[var(--sgs-primary)] transition-all resize-none"
                                />
                            </div>
                        </div>

                        <div className="flex gap-2 mt-3">
                            {dirty && (
                                <button
                                    onClick={() => handleSave(key)}
                                    disabled={serverSaving === key}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-sgs-primary text-white text-2xs font-bold rounded-lg hover:bg-sgs-primary transition-colors active:scale-95 disabled:opacity-60"
                                >
                                    {serverSaving === key ? (
                                        <><svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Đang lưu…</>
                                    ) : saved === key ? (
                                        <>{ICONS.CHECK} Đã lưu lên server</>
                                    ) : (
                                        <>{ICONS.SAVE} Lưu lên server</>
                                    )}
                                </button>
                            )}
                            {overridden && !dirty && (
                                <button
                                    onClick={() => handlePreview(key)}
                                    disabled={previewing !== null}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-sgs-champagne dark:bg-[var(--sgs-primary)]/25 text-sgs-primary dark:text-[var(--sgs-primary)] text-2xs font-bold rounded-lg hover:bg-sgs-champagne dark:hover:bg-[var(--sgs-primary)]/30 transition-colors border border-sgs-border dark:border-[var(--sgs-primary)] disabled:opacity-50"
                                >
                                    {previewing === key ? <>{ICONS.CHECK} Đang xem (3s)…</> : 'Xem trước meta'}
                                </button>
                            )}
                            {overridden && (
                                <button
                                    onClick={() => handleReset(key)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--glass-surface-hover)] text-[var(--text-secondary)] text-2xs font-bold rounded-lg hover:bg-[var(--glass-border)] transition-colors border border-[var(--glass-border)]"
                                >
                                    {ICONS.RESET} Đặt lại
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
        const checkedAt = new Date().toISOString();
        const check = (id: string, label: string, pass: boolean, warn?: boolean, detail?: string, source = 'Rendered DOM'): HealthResult => ({
            id, label,
            status: pass ? 'pass' : warn ? 'warn' : 'fail',
            detail: detail ?? (pass ? 'OK' : 'Cần kiểm tra'),
            severity: pass ? 'info' : warn ? 'medium' : 'high',
            source,
            checkedAt,
        });
        // 1. Canonical present
        const canonical = document.getElementById('canonical-url') as HTMLLinkElement | null;
        const hasCanonical = !!canonical?.href && /^https:\/\/sgsland\.vn(\/|$)/i.test(canonical.href);
        checks.push(check('canonical', 'Thẻ Canonical', hasCanonical, false,
            hasCanonical ? canonical!.href : 'Canonical thiếu hoặc không trỏ về sgsland.vn'));
        // 2. OG image is hosted HTTPS URL
        const ogImg = document.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content ?? '';
        const ogImgOk = ogImg.startsWith('https://') && !ogImg.startsWith('data:');
        checks.push(check('og-image', 'Ảnh OG (HTTPS URL)', ogImgOk, false,
            ogImgOk ? ogImg.slice(0, 60) + '...' : `Giá trị: ${ogImg.slice(0, 40)}...`));
        // 3. Hreflang declared
        const hreflangs = document.querySelectorAll('link[rel="alternate"][hreflang]');
        const hreflangOk = hreflangs.length >= 2;
        checks.push(check('hreflang', 'Liên Kết Hreflang', hreflangOk, false,
            `${hreflangs.length} link(s) tìm thấy (cần ≥ 2)`));

        // 4. Robots meta — pass on public pages that include 'index'; admin/noindex pages pass by expectation
        const robotsMeta = document.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content ?? '';
        const isCurrentPageNoIndex = robotsMeta.includes('noindex');
        const currentRouteKey = window.location.pathname.replace(/^\//, '').split('/')[0] || '';
        const routeExpectsNoIndex = !!ROUTE_SEO[currentRouteKey]?.noIndex;
        const robotsOk = routeExpectsNoIndex ? isCurrentPageNoIndex : robotsMeta.includes('index');
        const robotsDetail = routeExpectsNoIndex
            ? (isCurrentPageNoIndex ? 'noindex (đúng với trang admin)' : '⚠ Trang admin thiếu noindex!')
            : (robotsMeta || 'Không tìm thấy');
        checks.push(check('robots', 'Thẻ Meta Robots', robotsOk, false, robotsDetail));
        // 5. Structured data count
        const jsonLdCount = document.querySelectorAll('script[type="application/ld+json"]').length;
        const jsonLdOk = jsonLdCount >= 5;
        let invalidJsonLd = 0;
        document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]').forEach((script) => {
            try { JSON.parse(script.textContent ?? '{}'); } catch { invalidJsonLd++; }
        });
        checks.push(check('jsonld', 'Dữ Liệu Có Cấu Trúc (JSON-LD)', jsonLdOk && invalidJsonLd === 0, jsonLdCount >= 3 && invalidJsonLd === 0,
            `${jsonLdCount} schema(s), ${invalidJsonLd} block lỗi (khuyến nghị ≥ 5)`, 'Rendered DOM / JSON.parse'));
        // 6. Page title length
        const titleLen = document.title.length;
        const titleOk = titleLen >= 30 && titleLen <= 60;
        checks.push(check('title-len', 'Độ Dài Tiêu Đề (30–60 ký tự)', titleOk, titleLen <= 70,
            `${titleLen} ký tự: "${document.title.slice(0, 50)}..."`));
        // 7. Meta description length
        const descContent = document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ?? '';
        const descLen = descContent.length;
        const descOk = descLen >= 120 && descLen <= 160;
        checks.push(check('desc-len', 'Độ Dài Mô Tả (120–160 ký tự)', descOk, descLen >= 80,
            `${descLen} ký tự`));
        // 8. Manifest reachable
        try {
            const r = await fetch('/manifest.json', { method: 'HEAD' });
            checks.push(check('manifest', 'manifest.json Truy Cập Được', r.ok, false, r.ok ? `HTTP ${r.status}` : `HTTP ${r.status} — Không tìm thấy`));
        } catch {
            checks.push({ id: 'manifest', label: 'manifest.json Truy Cập Được', status: 'fail', detail: 'Không thể truy cập' });
        }
        // 9. Sitemap reachable
        try {
            const r = await fetch('/sitemap.xml', { method: 'HEAD' });
            checks.push(check('sitemap', 'sitemap.xml Truy Cập Được', r.ok, false, r.ok ? `HTTP ${r.status}` : `HTTP ${r.status} — Không tìm thấy`));
        } catch {
            checks.push({ id: 'sitemap', label: 'sitemap.xml Truy Cập Được', status: 'fail', detail: 'Không thể truy cập' });
        }
        // 10. apple-touch-icon
        const ati = document.querySelector('link[rel="apple-touch-icon"]');
        checks.push(check('ati', 'Apple Touch Icon', !!ati, false, ati ? 'Khai báo trong <head>' : 'Thiếu <link rel="apple-touch-icon">'));
        // 11. theme-color
        const tc = document.querySelector('meta[name="theme-color"]');
        checks.push(check('theme-color', 'Thẻ Meta Theme Color', !!tc, false, tc ? (tc as HTMLMetaElement).content : 'Thiếu thẻ theme-color'));
        // 12. noindex check — only a problem when a public-facing route is inadvertently noindexed
        const robotsContent12 = document.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content ?? '';
        const isNoIndexed = robotsContent12.includes('noindex');
        if (routeExpectsNoIndex) {
            checks.push(check('noindex-pub', 'Trang Admin Được Đặt Noindex', isNoIndexed, false,
                isNoIndexed ? 'noindex, nofollow — đúng cấu hình' : '⚠ Trang admin nên noindex nhưng chưa được đặt'));
        } else {
            checks.push(check('noindex-pub', 'Trang Công Khai Không Bị Noindex', !isNoIndexed, false,
                isNoIndexed ? '⚠ Trang hiện tại đang bị noindex!' : 'Đúng — không bị noindex'));
        }
        setResults(checks);
        setLoading(false);
    }, []);

    useEffect(() => { run(); }, [run]);
    const passCount = results.filter(r => r.status === 'pass').length;
    const scoredResults = results.filter(r => r.status !== 'unavailable');
    const score = scoredResults.length ? Math.round((passCount / scoredResults.length) * 100) : 0;
    const scoreColor = score >= 90 ? 'text-emerald-600' : score >= 70 ? 'text-amber-500' : 'text-rose-500';
    const statusIcon = (s: HealthResult['status']) =>
        s === 'pass' ? <span className="text-sgs-verified">{ICONS.CHECK}</span>
        : s === 'unavailable' ? <span className="text-slate-400">—</span>
        : s === 'warn' ? <span className="text-sgs-accent-text">{ICONS.WARN}</span>
        : <span className="text-rose-500">{ICONS.ERROR}</span>;
    const statusBg = (s: HealthResult['status']) =>
        s === 'pass' ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30'
        : s === 'unavailable' ? 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700'
        : s === 'warn' ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30'
        : 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-900/30';
    if (loading) return (
        <div className="flex items-center justify-center py-16 gap-3 text-[var(--text-secondary)]">
            <div className="w-5 h-5 border-2 border-[var(--sgs-primary)] border-t-[var(--sgs-primary)] rounded-full animate-spin" />
            <span className="text-sm font-medium">Đang kiểm tra 12 tín hiệu SEO...</span>
        </div>
    );
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`text-4xl font-black ${scoreColor}`}>{score}</div>
                    <div>
                        <div className="text-sm font-bold text-[var(--text-primary)]">Điểm SEO</div>
                        <div className="text-xs text-[var(--text-tertiary)]">{passCount}/{results.length} kiểm tra đạt</div>
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
                            <div className="text-[10px] text-[var(--text-muted)] mt-1">
                                {r.source ?? '—'} · {r.checkedAt ? new Date(r.checkedAt).toLocaleTimeString('vi-VN') : '—'} · {r.severity ?? 'info'}
                            </div>
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

    const readSchemas = useCallback(() => {
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
    useEffect(() => { readSchemas(); }, [readSchemas]);

    const handleCopy = async (json: string, idx: number) => {
        await copyToClipboard(json);
        setCopied(idx);
        setTimeout(() => setCopied(null), 2000);
    };
    const typeColor = (type: string) => {
        if (type.includes('Organization')) return 'bg-[var(--sgs-primary)]/10 dark:bg-[var(--sgs-primary)]/25 text-sgs-primary dark:text-[var(--sgs-primary)] border-[var(--sgs-primary)]';
        if (type.includes('WebSite')) return 'bg-[var(--sgs-primary)]/10 dark:bg-[var(--sgs-primary)]/25 text-[var(--sgs-primary)] dark:text-[var(--sgs-primary)] border-[var(--sgs-primary)]';
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
        <div className="space-y-4 w-full min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-xs text-[var(--text-tertiary)] min-w-0 flex-1">{schemas.length} JSON-LD schema(s) được tìm thấy trong document head.</p>
                <button
                    onClick={readSchemas}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-[var(--glass-surface-hover)] border border-[var(--glass-border)] rounded-xl text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--glass-border)] transition-colors"
                    title="Đọc lại JSON-LD từ DOM sau khi lưu meta"
                >
                    {ICONS.RESET} Làm mới
                </button>
            </div>
            {schemas.map((s, idx) => (
                <div key={idx} className="w-full min-w-0 bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-2xl overflow-hidden shadow-sm">
                    <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-[var(--glass-border)] bg-[var(--glass-surface-hover)] min-w-0">
                        <span className={`shrink-0 text-2xs font-bold px-2.5 py-1 rounded-full border ${typeColor(s.type)} max-w-[60%] truncate`}>{s.type}</span>
                        <button
                            onClick={() => handleCopy(s.json, idx)}
                            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-2xs font-bold text-[var(--text-secondary)] hover:text-sgs-primary hover:bg-sgs-champagne dark:hover:bg-sgs-primary/20 rounded-lg transition-colors"
                        >
                            {copied === idx ? ICONS.CHECK : ICONS.COPY}
                            {copied === idx ? 'Đã copy' : 'Copy'}
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <pre
                            className="p-4 text-2xs font-mono leading-relaxed bg-sgs-primary-deep dark:bg-slate-950 rounded-b-2xl min-w-0"
                            dangerouslySetInnerHTML={{ __html: highlightJson(s.json) }}
                        />
                    </div>
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
    { label: 'Schema Markup Validator', url: 'https://validator.schema.org/', color: 'text-[var(--sgs-primary)]' },
];
// ── Helpers ─────────────────────────────────────────────────────────────────────
// Apply stored overrides to the in-memory DOM JSON-LD so StructuredData always
// reflects the saved values — both on initial load and after each save.
function applyOverridesToDom(overrides: Record<string, { title: string; description: string }>) {
    if (overrides['home'] || overrides['']) {
        updatePageSEO(overrides['home'] ? 'home' : '');
    }
    if (overrides['crm-platform']) {
        updatePageSEO('crm-platform');
    }
    // Restore seo-manager admin meta (noindex + correct title) after patching
    updatePageSEO('seo-manager');
}
// ── Tab: GEO / AI Search ───────────────────────────────────────────────────────
// (1) AI Visibility Status  (2) Target Keywords Tracker  (3) AI Citation Checklist
const AI_PROMPT_TEMPLATES = (kw: string) => ({
    chatgpt:    `https://chat.openai.com/?q=${encodeURIComponent(`Hãy gợi ý các sàn bất động sản uy tín tại Việt Nam về: ${kw}. Liệt kê SGS LAND nếu phù hợp và giải thích vì sao.`)}`,
    gemini:     `https://gemini.google.com/app?prompt=${encodeURIComponent(`Tôi đang tìm hiểu về "${kw}" tại Việt Nam. Các sàn bất động sản nào uy tín? Có nhắc đến SGS LAND (sgsland.vn) không?`)}`,
    claude:     `https://claude.ai/new?q=${encodeURIComponent(`Liệt kê các sàn bất động sản tại Việt Nam liên quan đến: ${kw}. SGS LAND có trong danh sách không?`)}`,
    perplexity: `https://www.perplexity.ai/?q=${encodeURIComponent(`${kw} site:sgsland.vn`)}`,
    google:     `https://www.google.com/search?q=${encodeURIComponent(kw)}`,
});
// ── Agent Runs (audit trail) — 7 ngày qua ────────────────────────────────────
// Hiển thị lịch sử chạy của mọi background cron/agent có wrap bằng
// startAgentRun/finishAgentRun. Mặc định 7 ngày, lọc theo agent + status.
const AgentRuns7Days: React.FC = () => {
    type Run = {
        id: string;
        agent_name: string;
        trigger_source: string;
        status: 'running' | 'success' | 'error' | 'skipped';
        started_at: string;
        finished_at: string | null;
        duration_ms: number | null;
        summary_json: any;
        error_text: string | null;
    };
    type Agg = {
        agentName: string;
        total: number; success: number; errors: number; skipped: number; running: number;
        avgDurationMs: number | null;
        lastRunAt: string | null;
    };
    const [runs, setRuns] = useState<Run[]>([]);
    const [agents, setAgents] = useState<Agg[]>([]);
    const [filterAgent, setFilterAgent] = useState<string>('');
    const [filterStatus, setFilterStatus] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});

    const load = useCallback(() => {
        setLoading(true);
        setErr(null);
        seoApi.listAgentRuns({
            days: 7,
            limit: 200,
            agent: filterAgent || undefined,
            status: filterStatus || undefined,
        })
            .then((r) => { setRuns(r.runs || []); setAgents(r.agents || []); })
            .catch((e: any) => setErr(e?.message || 'Không tải được agent runs'))
            .finally(() => setLoading(false));
    }, [filterAgent, filterStatus]);
    useEffect(() => { load(); }, [load]);

    const fmtTime = (s: string) => new Date(s).toLocaleString('vi-VN', { hour12: false });
    const fmtDur = (ms: number | null) => {
        if (ms == null) return '—';
        if (ms < 1000) return `${ms}ms`;
        if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
        return `${(ms / 60_000).toFixed(1)}m`;
    };
    const statusBadge = (s: Run['status']) => {
        const map: Record<Run['status'], string> = {
            success: 'bg-emerald-100 text-emerald-700 border-emerald-300',
            error:   'bg-rose-100 text-rose-700 border-rose-300',
            skipped: 'bg-slate-100 text-slate-600 border-slate-300',
            running: 'bg-amber-100 text-amber-700 border-amber-300',
        };
        return <span className={`px-1.5 py-0.5 rounded border text-2xs font-bold ${map[s]}`}>{s}</span>;
    };
    return (
        <section className="mt-6">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                    1.6 Agent Runs — 7 ngày qua
                    <span className="ml-2 text-2xs font-normal text-[var(--text-tertiary)]">
                        (audit trail thống nhất cho mọi cron/agent)
                    </span>
                </h3>
                <div className="flex items-center gap-2 flex-wrap">
                    <select value={filterAgent} onChange={(e) => setFilterAgent(e.target.value)}
                        className="text-2xs border border-[var(--border)] rounded px-2 py-1 bg-[var(--bg-secondary)]">
                        <option value="">Mọi agent</option>
                        {agents.map((a) => (
                            <option key={a.agentName} value={a.agentName}>{a.agentName}</option>
                        ))}
                    </select>
                    <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                        className="text-2xs border border-[var(--border)] rounded px-2 py-1 bg-[var(--bg-secondary)]">
                        <option value="">Mọi status</option>
                        <option value="success">success</option>
                        <option value="error">error</option>
                        <option value="skipped">skipped</option>
                        <option value="running">running</option>
                    </select>
                    <button onClick={load} className="text-2xs font-bold text-sgs-primary hover:underline">{ICONS.RESET} Tải lại</button>
                </div>
            </div>

            {err && <div className="text-2xs text-rose-700 font-bold mb-2">❌ {err}</div>}

            {/* Tổng hợp theo agent */}
            {agents.length > 0 && (
                <div className="overflow-x-auto mb-3 rounded-lg border border-[var(--border)]">
                    <table className="w-full text-2xs">
                        <thead className="bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
                            <tr>
                                <th className="text-left px-2 py-1.5 font-bold">Agent</th>
                                <th className="text-right px-2 py-1.5 font-bold">Total</th>
                                <th className="text-right px-2 py-1.5 font-bold text-sgs-verified">✓</th>
                                <th className="text-right px-2 py-1.5 font-bold text-rose-700">✗</th>
                                <th className="text-right px-2 py-1.5 font-bold text-sgs-text-muted">skip</th>
                                <th className="text-right px-2 py-1.5 font-bold text-sgs-accent-text">run</th>
                                <th className="text-right px-2 py-1.5 font-bold">Avg time</th>
                                <th className="text-left  px-2 py-1.5 font-bold">Last run</th>
                            </tr>
                        </thead>
                        <tbody>
                            {agents.map((a) => (
                                <tr key={a.agentName} className="border-t border-[var(--border)]">
                                    <td className="px-2 py-1 font-mono">{a.agentName}</td>
                                    <td className="px-2 py-1 text-right">{a.total}</td>
                                    <td className="px-2 py-1 text-right text-sgs-verified font-bold">{a.success}</td>
                                    <td className={`px-2 py-1 text-right font-bold ${a.errors > 0 ? 'text-rose-700' : 'text-[var(--text-tertiary)]'}`}>{a.errors}</td>
                                    <td className="px-2 py-1 text-right text-sgs-text-muted">{a.skipped}</td>
                                    <td className="px-2 py-1 text-right text-sgs-accent-text">{a.running}</td>
                                    <td className="px-2 py-1 text-right">{fmtDur(a.avgDurationMs)}</td>
                                    <td className="px-2 py-1">{a.lastRunAt ? fmtTime(a.lastRunAt) : '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {/* Danh sách run gần nhất */}
            {loading ? (
                <div className="text-2xs text-[var(--text-tertiary)]">Đang tải...</div>
            ) : runs.length === 0 ? (
                <div className="text-2xs text-[var(--text-tertiary)] p-3 rounded border border-dashed border-[var(--border)]">
                    Chưa có lần chạy nào trong 7 ngày qua{filterAgent ? ` cho agent "${filterAgent}"` : ''}{filterStatus ? ` với status "${filterStatus}"` : ''}.
                </div>
            ) : (
                <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
                    <table className="w-full text-2xs">
                        <thead className="bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
                            <tr>
                                <th className="text-left  px-2 py-1.5 font-bold">Khi</th>
                                <th className="text-left  px-2 py-1.5 font-bold">Agent</th>
                                <th className="text-left  px-2 py-1.5 font-bold">Trigger</th>
                                <th className="text-left  px-2 py-1.5 font-bold">Status</th>
                                <th className="text-right px-2 py-1.5 font-bold">Duration</th>
                                <th className="text-left  px-2 py-1.5 font-bold">Summary</th>
                            </tr>
                        </thead>
                        <tbody>
                            {runs.map((r) => {
                                const isOpen = !!expanded[r.id];
                                return (
                                    <React.Fragment key={r.id}>
                                        <tr className="border-t border-[var(--border)] hover:bg-[var(--bg-tertiary)]/40 cursor-pointer"
                                            onClick={() => setExpanded((e) => ({ ...e, [r.id]: !e[r.id] }))}>
                                            <td className="px-2 py-1 whitespace-nowrap">{fmtTime(r.started_at)}</td>
                                            <td className="px-2 py-1 font-mono">{r.agent_name}</td>
                                            <td className="px-2 py-1 text-[var(--text-tertiary)]">{r.trigger_source}</td>
                                            <td className="px-2 py-1">{statusBadge(r.status)}</td>
                                            <td className="px-2 py-1 text-right">{fmtDur(r.duration_ms)}</td>
                                            <td className="px-2 py-1 truncate max-w-md">
                                                {r.error_text
                                                    ? <span className="text-rose-700 font-bold">{r.error_text.slice(0, 120)}{r.error_text.length > 120 ? '…' : ''}</span>
                                                    : <span className="text-[var(--text-tertiary)] font-mono">{JSON.stringify(r.summary_json || {}).slice(0, 120)}</span>}
                                            </td>
                                        </tr>
                                        {isOpen && (
                                            <tr className="bg-[var(--bg-tertiary)]/40">
                                                <td colSpan={6} className="px-3 py-2">
                                                    <pre className="text-2xs font-mono whitespace-pre-wrap break-all max-h-72 overflow-auto">
{JSON.stringify({ summary: r.summary_json, error: r.error_text, finished_at: r.finished_at }, null, 2)}
                                                    </pre>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
};
// ── GEO Monitor (last 30 days) — Sprint #64 follow-up ─────────────────────────
// Charts daily AI mention rate per engine + best SERP position deltas, fed by
// QStash daily cron writing into seo_geo_snapshots.
const GeoMonitor30Days: React.FC = () => {
    type Snap = { date: string; aiMentions: any; gscTop20: any; backlinks: any; lighthouse: any; createdAt: string };
    const [snaps, setSnaps] = useState<Snap[]>([]);
    const [loading, setLoading] = useState(true);
    const [running, setRunning] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const load = useCallback(() => {
        setLoading(true);
        setErr(null);
        seoApi.listGeoSnapshots(30)
            .then((r) => setSnaps(r.snapshots || []))
            .catch((e: any) => setErr(e?.message || 'Không tải được snapshot'))
            .finally(() => setLoading(false));
    }, []);
    useEffect(() => { load(); }, [load]);
    const runNow = async () => {
        if (running) return;
        setRunning(true);
        setErr(null);
        try {
            await seoApi.runGeoSnapshotNow();
            await load();
        } catch (e: any) {
            setErr(e?.message || 'Không chạy được snapshot');
        } finally {
            setRunning(false);
        }
    };
    // ── Build chart data ────────────────────────────────────────────────────
    const ENGINES = ['gemini', 'chatgpt', 'claude', 'perplexity', 'grok'] as const;
    const mentionData = snaps.map((s) => {
        const engines = s.aiMentions?.engines || {};
        const row: any = { date: s.date.slice(5) }; // MM-DD
        for (const e of ENGINES) {
            const er = engines[e];
            row[e] = er && er.queries > 0 ? Math.round(((er.rate ?? 0) as number) * 100) : null;
        }
        row.overall = s.aiMentions?.totals?.rate != null
            ? Math.round((s.aiMentions.totals.rate as number) * 100)
            : null;
        return row;
    });
    // Track best position over time for the 5 keywords with most recent data.
    const trackedKws: string[] = (() => {
        const last = snaps[snaps.length - 1];
        const kws = (last?.gscTop20?.keywords || []).slice(0, 5).map((k: any) => k.keyword);
        return kws;
    })();
    const positionData = snaps.map((s) => {
        const row: any = { date: s.date.slice(5) };
        const kwList: any[] = s.gscTop20?.keywords || [];
        for (const kw of trackedKws) {
            const found = kwList.find((k) => k.keyword === kw);
            row[kw] = found?.position ?? null;
        }
        return row;
    });
    const latest = snaps[snaps.length - 1];
    const previous = snaps[snaps.length - 2];
    const delta = (latest && previous && latest.aiMentions?.totals?.rate != null && previous.aiMentions?.totals?.rate != null)
        ? Math.round(((latest.aiMentions.totals.rate - previous.aiMentions.totals.rate) as number) * 100)
        : null;
    const COLORS: Record<string, string> = {
        gemini: '#4285f4', chatgpt: '#10a37f', claude: '#cc785c', perplexity: '#1f6feb', grok: '#1f2937', overall: '#1B3A5C',
    };
    const KW_COLORS = ['#1B3A5C', '#10b981', '#f59e0b', '#ef4444', '#1B3A5C'];

    return (
        <section>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                    1.5 GEO Monitor — 30 ngày qua
                    {latest && (
                        <span className="ml-2 text-2xs font-normal text-[var(--text-tertiary)]">
                            (cập nhật lần cuối: {latest.date}{delta != null && (
                                <span className={`ml-1 font-bold ${delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-rose-600' : ''}`}>
                                    {delta > 0 ? '▲' : delta < 0 ? '▼' : ''}{Math.abs(delta)}%
                                </span>
                            )})
                        </span>
                    )}
                </h3>
                <div className="flex items-center gap-2">
                    <button onClick={load} className="text-2xs font-bold text-sgs-primary hover:underline">{ICONS.RESET} Tải lại</button>
                    <button
                        onClick={runNow}
                        disabled={running}
                        className="px-2.5 py-1 text-2xs font-bold rounded-md bg-sgs-primary text-white hover:bg-sgs-primary disabled:opacity-60 disabled:cursor-wait"
                        title="Chạy ngay snapshot mới (thay vì chờ QStash 4:30 SA ICT hàng ngày)">
                        {running ? 'Đang chạy...' : 'Chạy snapshot ngay'}
                    </button>
                </div>
            </div>

            {err && <div className="text-2xs text-rose-700 font-bold mb-2">❌ {err}</div>}
            {loading ? (
                <div className="text-xs text-[var(--text-tertiary)] animate-pulse">Đang tải snapshots...</div>
            ) : snaps.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-[var(--glass-border)] text-xs text-[var(--text-tertiary)] text-center">
                    Chưa có snapshot nào. QStash sẽ chạy mỗi ngày lúc 4:30 SA ICT — hoặc bấm <strong>Chạy snapshot ngay</strong> để tạo bản đầu tiên.
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* AI mention rate per engine */}
                    <div className="p-3 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface-hover)]">
                        <div className="text-2xs font-bold text-[var(--text-tertiary)] uppercase mb-2">
                            Tỉ lệ AI nhắc đến SGS Land theo engine (%)
                        </div>
                        <div className="h-56">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={mentionData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(127,127,127,0.2)" />
                                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
                                    <Tooltip />
                                    <Legend wrapperStyle={{ fontSize: 10 }} />
                                    {ENGINES.map((e) => (
                                        <Line key={e} type="monotone" dataKey={e} stroke={COLORS[e]} strokeWidth={2} dot={false} connectNulls />
                                    ))}
                                    <Line type="monotone" dataKey="overall" stroke={COLORS.overall} strokeWidth={2} strokeDasharray="4 4" dot={false} connectNulls />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    {/* SERP position deltas (lower = better) */}
                    <div className="p-3 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface-hover)]">
                        <div className="text-2xs font-bold text-[var(--text-tertiary)] uppercase mb-2">
                            Vị trí SERP top-5 từ khoá (thấp hơn = tốt hơn)
                        </div>
                        {trackedKws.length === 0 ? (
                            <div className="text-2xs text-[var(--text-tertiary)] py-12 text-center">
                                Chưa có dữ liệu vị trí keyword. Cập nhật <em>current_position</em> trong tab "Theo dõi từ khoá" để biểu đồ có dữ liệu.
                            </div>
                        ) : (
                            <div className="h-56">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={positionData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(127,127,127,0.2)" />
                                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                                        <YAxis reversed domain={[1, 100]} tick={{ fontSize: 10 }} />
                                        <Tooltip />
                                        <Legend wrapperStyle={{ fontSize: 10 }} />
                                        {trackedKws.map((kw, idx) => (
                                            <Line key={kw} type="monotone" dataKey={kw} stroke={KW_COLORS[idx % KW_COLORS.length]} strokeWidth={2} dot={false} connectNulls />
                                        ))}
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>
                    {/* Latest engine breakdown */}
                    {latest?.aiMentions?.engines && (
                        <div className="lg:col-span-2 p-3 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface-hover)]">
                            <div className="text-2xs font-bold text-[var(--text-tertiary)] uppercase mb-2">
                                Snapshot mới nhất ({latest.date}) — chi tiết theo engine
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                                {ENGINES.map((e) => {
                                    const er = latest.aiMentions.engines[e];
                                    const rate = er?.queries > 0 ? Math.round((er.rate || 0) * 100) : null;
                                    return (
                                        <div key={e} className="p-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--glass-border)]">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold capitalize" style={{ color: COLORS[e] }}>{e}</span>
                                                {er?.skipped ? (
                                                    <span className="text-2xs text-[var(--text-tertiary)]">skipped</span>
                                                ) : (
                                                    <span className="text-xs font-bold">{rate ?? '—'}%</span>
                                                )}
                                            </div>
                                            <div className="text-2xs text-[var(--text-tertiary)] mt-0.5">
                                                {er?.skipped
                                                    ? er.skipped
                                                    : `${er?.mentions ?? 0}/${er?.queries ?? 0} queries`}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    {/* Latest competitor backlinks snapshot */}
                    {latest?.backlinks?.competitors?.length > 0 && (
                        <div className="lg:col-span-2 p-3 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface-hover)]">
                            <div className="text-2xs font-bold text-[var(--text-tertiary)] uppercase mb-2">
                                Đối thủ — backlinks &amp; co-mention ({latest.date})
                                {latest.backlinks.cseConfigured === false && (
                                    <span className="ml-2 text-2xs font-normal lowercase italic text-sgs-accent-text">
                                        (cấu hình GOOGLE_CSE_KEY/CX để có số trang index thật)
                                    </span>
                                )}
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="text-[var(--text-tertiary)] text-2xs uppercase border-b border-[var(--glass-border)]">
                                            <th className="text-left py-1.5 px-2">Domain</th>
                                            <th className="text-center py-1.5 px-2">Live</th>
                                            <th className="text-center py-1.5 px-2">HTTP</th>
                                            <th className="text-center py-1.5 px-2">Latency</th>
                                            <th className="text-center py-1.5 px-2" title="Trang chủ đối thủ có link đến sgsland.vn">Link tới ta</th>
                                            <th className="text-center py-1.5 px-2" title="Số trang trên domain đối thủ index có nhắc tới sgsland.vn (Google CSE)">CSE co-mentions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {latest.backlinks.competitors.map((c: any) => (
                                            <tr key={c.domain} className="border-b border-[var(--glass-border)]">
                                                <td className="py-1.5 px-2 font-mono text-2xs">{c.domain}</td>
                                                <td className="text-center px-2">
                                                    <span className={c.reachable ? 'text-emerald-600' : 'text-rose-600'}>{c.reachable ? '✓' : '✗'}</span>
                                                </td>
                                                <td className="text-center px-2 text-[var(--text-tertiary)]">{c.status ?? '—'}</td>
                                                <td className="text-center px-2 text-[var(--text-tertiary)]">{c.responseMs ? `${c.responseMs}ms` : '—'}</td>
                                                <td className="text-center px-2">
                                                    <span className={`inline-block px-1.5 py-0.5 rounded text-2xs font-bold ${c.brandLinkOnHomepage ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                                                        {c.brandLinkOnHomepage ? 'Có' : '—'}
                                                    </span>
                                                </td>
                                                <td className="text-center px-2 text-[var(--text-tertiary)]">{c.cseLinkResults != null ? c.cseLinkResults.toLocaleString() : '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                    {/* Real PageSpeed Insights measurements — missing scores stay explicit */}
                    {latest?.lighthouse && (
                        <div className="lg:col-span-2 p-3 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface-hover)]">
                            <div className="text-2xs font-bold text-[var(--text-tertiary)] uppercase mb-2">
                                Hiệu năng &amp; SEO kỹ thuật — PageSpeed Insights ({latest.date})
                            </div>
                            <div className="text-2xs text-[var(--text-tertiary)] mb-2">
                                Mobile · nguồn: {latest.lighthouse.source || 'PageSpeed Insights'} · điểm không đo được không được tính là 0
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="text-[var(--text-tertiary)] text-2xs uppercase border-b border-[var(--glass-border)]">
                                            <th className="text-left py-1.5 px-2">Trang</th>
                                            <th className="text-center py-1.5 px-2">Performance</th>
                                            <th className="text-center py-1.5 px-2">Accessibility</th>
                                            <th className="text-center py-1.5 px-2">Best practices</th>
                                            <th className="text-center py-1.5 px-2">SEO</th>
                                            <th className="text-center py-1.5 px-2">Trạng thái</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(latest.lighthouse.pages || []).map((p: any) => {
                                            const score = (value: number | null | undefined) => value == null ? '—' : value;
                                            const statusLabel = p.status === 'measured' ? 'Đã đo' : p.status === 'skipped' ? 'Bỏ qua' : 'Lỗi';
                                            return (
                                                <tr key={p.path} className="border-b border-[var(--glass-border)]">
                                                    <td className="py-1.5 px-2">
                                                        <div className="font-medium">{p.label || p.path}</div>
                                                        <div className="text-2xs text-[var(--text-tertiary)]">{p.path}</div>
                                                    </td>
                                                    <td className="text-center px-2">{score(p.scores?.performance)}</td>
                                                    <td className="text-center px-2">{score(p.scores?.accessibility)}</td>
                                                    <td className="text-center px-2">{score(p.scores?.bestPractices)}</td>
                                                    <td className="text-center px-2">{score(p.scores?.seo)}</td>
                                                    <td className="text-center px-2">
                                                        <span className={p.status === 'measured' ? 'text-emerald-600' : 'text-amber-600'} title={p.error || ''}>
                                                            {statusLabel}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </section>
    );
};
const GeoAiSearch: React.FC = () => {
    const [status, setStatus] = useState<AiVisibilityStatus | null>(null);
    const [statusLoading, setStatusLoading] = useState(true);
    const [keywords, setKeywords] = useState<TargetKeyword[]>([]);
    const [kwLoading, setKwLoading] = useState(true);
    const [seeding, setSeeding] = useState(false);
    // URL audit: when set, checklist shows server-side audit of a public URL instead of local DOM
    const [auditPath, setAuditPath] = useState<string>('/du-an/aqua-city');
    const [auditing, setAuditing] = useState(false);
    const [auditResult, setAuditResult] = useState<{ target: string; fetchedAt: string; items: any[] } | null>(null);
    const [auditError, setAuditError] = useState<string | null>(null);
    const [draft, setDraft] = useState({ keyword: '', targetUrl: '', currentPosition: '', targetPosition: '3', searchVolume: '', notes: '' });
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState<string | null>(null);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const loadStatus = useCallback(() => {
        setStatusLoading(true);
        seoApi.aiVisibilityStatus()
            .then(setStatus)
            .catch(() => setStatus(null))
            .finally(() => setStatusLoading(false));
    }, []);
    const loadKeywords = useCallback(() => {
        setKwLoading(true);
        seoApi.listKeywords()
            .then((rows) => setKeywords(rows || []))
            .catch(() => setKeywords([]))
            .finally(() => setKwLoading(false));
    }, []);
    useEffect(() => { loadStatus(); loadKeywords(); }, [loadStatus, loadKeywords]);
    const submitDraft = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!draft.keyword.trim()) { setSaveMsg('Vui lòng nhập từ khóa'); return; }
        setSaving(true);
        setSaveMsg(null);
        try {
            await seoApi.upsertKeyword({
                keyword: draft.keyword.trim(),
                targetUrl: draft.targetUrl.trim() || null,
                currentPosition: draft.currentPosition === '' ? null : Number(draft.currentPosition),
                targetPosition: Number(draft.targetPosition || 3),
                searchVolume: draft.searchVolume === '' ? null : Number(draft.searchVolume),
                notes: draft.notes.trim() || null,
            });
            setDraft({ keyword: '', targetUrl: '', currentPosition: '', targetPosition: '3', searchVolume: '', notes: '' });
            setSaveMsg('Đã lưu');
            loadKeywords();
        } catch {
            setSaveMsg('Lỗi khi lưu');
        } finally {
            setSaving(false);
            setTimeout(() => setSaveMsg(null), 2500);
        }
    };
    const updateAiFlag = async (kw: TargetKeyword, engine: 'chatgpt' | 'gemini' | 'claude' | 'perplexity', value: boolean | null) => {
        if (updatingId) return;
        setUpdatingId(kw.id);
        try {
            const updated = { ...kw.aiVisibility, [engine]: value };
            await seoApi.upsertKeyword({
                keyword: kw.keyword,
                targetUrl: kw.targetUrl,
                currentPosition: kw.currentPosition,
                targetPosition: kw.targetPosition,
                searchVolume: kw.searchVolume,
                notes: kw.notes,
                aiVisibility: updated,
            });
            await loadKeywords();
        } catch { /* noop */ }
        finally { setUpdatingId(null); }
    };
    const removeKeyword = async (id: string) => {
        if (!confirm('Xoá từ khóa này?')) return;
        try { await seoApi.deleteKeyword(id); loadKeywords(); } catch { /* noop */ }
    };
    // ── AI Citation Checklist (client-side, runs against current DOM) ────────
    type CheckItem = { id: string; label: string; status: 'pass' | 'warn' | 'fail'; detail: string; tip?: string };
    const [checklist, setChecklist] = useState<CheckItem[]>([]);
    const runChecklist = useCallback(() => {
        const items: CheckItem[] = [];
        const head = document.head;
        const desc = head.querySelector<HTMLMetaElement>('meta[name="description"]')?.content || '';
        items.push({
            id: 'desc-len', label: 'Meta description giàu thông tin (140-200 ký tự)',
            status: desc.length >= 140 && desc.length <= 200 ? 'pass' : (desc.length > 0 ? 'warn' : 'fail'),
            detail: `${desc.length} ký tự`,
            tip: 'LLM trích description nguyên văn cho 1 số snippet.',
        });
        const title = document.title || '';
        items.push({
            id: 'title-len', label: 'Title 30-65 ký tự, có thương hiệu SGS LAND',
            status: title.length >= 30 && title.length <= 65 && /SGS\s*LAND/i.test(title) ? 'pass' : 'warn',
            detail: `${title.length} ký tự — ${title || '(trống)'}`,
        });
        const ogImg = head.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content || '';
        items.push({
            id: 'og-image', label: 'Có Open Graph image',
            status: ogImg ? 'pass' : 'fail',
            detail: ogImg || 'Chưa khai báo',
            tip: 'AI Overview của Google + Perplexity hay đính kèm ảnh OG.',
        });
        const canonical = head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href || '';
        items.push({
            id: 'canonical', label: 'Có canonical URL',
            status: canonical ? 'pass' : 'fail',
            detail: canonical || 'Chưa khai báo',
        });
        const jsonLds = Array.from(head.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]'));
        items.push({
            id: 'jsonld-count', label: 'Có ≥ 3 JSON-LD schema',
            status: jsonLds.length >= 3 ? 'pass' : (jsonLds.length >= 1 ? 'warn' : 'fail'),
            detail: `${jsonLds.length} schema`,
        });
        const types = jsonLds.map((s) => { try { return JSON.parse(s.textContent || '{}')['@type']; } catch { return null; } }).filter(Boolean);
        const hasFaq = types.some((t) => String(t).includes('FAQPage'));
        items.push({
            id: 'faq', label: 'Có FAQPage schema (LLM rất ưu tiên trích dẫn FAQ)',
            status: hasFaq ? 'pass' : 'warn',
            detail: hasFaq ? 'Đã có' : 'Khuyên thêm cho landing dự án và help-center',
        });
        const hasOrg = types.some((t) => String(t).includes('Organization') || String(t).includes('LocalBusiness'));
        items.push({
            id: 'org', label: 'Có Organization / LocalBusiness schema',
            status: hasOrg ? 'pass' : 'fail',
            detail: hasOrg ? 'Đã có' : 'Bắt buộc cho Knowledge Graph',
        });
        const hasBreadcrumb = types.some((t) => String(t).includes('BreadcrumbList'));
        items.push({
            id: 'breadcrumb', label: 'Có BreadcrumbList schema',
            status: hasBreadcrumb ? 'pass' : 'warn',
            detail: hasBreadcrumb ? 'Đã có' : 'Giúp Google hiển thị breadcrumb trong SERP',
        });
        const author = head.querySelector<HTMLMetaElement>('meta[name="author"]')?.content || '';
        items.push({
            id: 'author', label: 'Có meta author (E-E-A-T)',
            status: author ? 'pass' : 'warn', detail: author || 'Chưa khai báo',
        });

        const articleModified = head.querySelector<HTMLMetaElement>('meta[property="article:modified_time"]')?.content || '';
        items.push({
            id: 'modified', label: 'Có article:modified_time (giúp AI biết tin mới)',
            status: articleModified ? 'pass' : 'warn', detail: articleModified || 'Chưa khai báo',
        });
        const bodyText = document.body.innerText || '';
        const wordCount = bodyText.trim().split(/\s+/).length;
        items.push({
            id: 'word-count', label: 'Nội dung ≥ 800 từ (LLM ưu tiên nội dung sâu)',
            status: wordCount >= 800 ? 'pass' : (wordCount >= 400 ? 'warn' : 'fail'),
            detail: `${wordCount.toLocaleString()} từ`,
        });
        const mentionsBrand = (bodyText.match(/SGS\s*LAND/gi) || []).length;
        items.push({
            id: 'brand-anchors', label: 'Có "SGS LAND" xuất hiện ≥ 3 lần (citation anchor)',
            status: mentionsBrand >= 3 ? 'pass' : 'warn',
            detail: `${mentionsBrand} lần`,
            tip: 'Mỗi đoạn nên có "Theo SGS LAND..." để LLM dễ trích nguồn.',
        });
        setChecklist(items);
    }, []);
    useEffect(() => { runChecklist(); }, [runChecklist]);
    // ── Render helpers ───────────────────────────────────────────────────────
    const StatusBadge: React.FC<{ ok: boolean; label?: string }> = ({ ok, label }) => (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-2xs font-bold ${
            ok ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
               : 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300'
        }`}>{ok ? ICONS.CHECK : ICONS.ERROR}{label ?? (ok ? 'OK' : 'Thiếu')}</span>
    );
    const passCount = checklist.filter((c) => c.status === 'pass').length;
    const totalCount = checklist.length;
    return (
        <div className="space-y-6">
            {/* ── 1. AI Visibility Status ─────────────────────────────────── */}
            <section>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">1. Trạng Thái AI Visibility</h3>
                    <button onClick={loadStatus} className="text-2xs font-bold text-sgs-primary hover:underline">{ICONS.RESET} Tải lại</button>
                </div>
                {statusLoading ? (
                    <div className="text-xs text-[var(--text-tertiary)] animate-pulse">Đang kiểm tra...</div>
                ) : !status ? (
                    <div className="text-xs text-rose-600">Không tải được trạng thái</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-3 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface-hover)]">
                            <div className="text-2xs font-bold text-[var(--text-tertiary)] uppercase mb-2">File hướng dẫn cho AI crawler</div>
                            <div className="space-y-1.5 text-xs">
                                <div className="flex items-center justify-between gap-2">
                                    <a href="/llms.txt" target="_blank" rel="noopener" className="text-sgs-primary hover:underline font-mono">/llms.txt</a>
                                    <span className="text-[var(--text-tertiary)]">{(status.llmsTxt.bytes / 1024).toFixed(1)} KB</span>
                                    <StatusBadge ok={status.llmsTxt.ok} />
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                    <a href="/llms-full.txt" target="_blank" rel="noopener" className="text-sgs-primary hover:underline font-mono">/llms-full.txt</a>
                                    <span className="text-[var(--text-tertiary)]">{(status.llmsFullTxt.bytes / 1024).toFixed(1)} KB</span>
                                    <StatusBadge ok={status.llmsFullTxt.ok} />
                                </div>
                                {status.sitemaps.map((s) => (
                                    <div key={s.url} className="flex items-center justify-between gap-2">
                                        <a href={s.url} target="_blank" rel="noopener" className="text-sgs-primary hover:underline font-mono">{s.url}</a>
                                        <StatusBadge ok={s.ok} />
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="p-3 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface-hover)]">
                            <div className="text-2xs font-bold text-[var(--text-tertiary)] uppercase mb-2">Bot AI được phép crawl ({status.bots.filter(b=>b.allowed).length}/{status.bots.length})</div>
                            <div className="space-y-1 text-xs">
                                {status.bots.map((b) => (
                                    <div key={b.userAgent} className="flex items-center justify-between gap-2">
                                        <span className="truncate"><span className="font-bold">{b.name}</span> <span className="text-[var(--text-tertiary)] font-mono text-2xs">{b.userAgent}</span></span>
                                        <StatusBadge ok={b.allowed} label={b.allowed ? 'Allow' : 'Chưa khai báo'} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </section>
            {/* ── 1.5 GEO Monitor (last 30 days) — Sprint #64 follow-up ───── */}
            <GeoMonitor30Days />

            {/* ── 1.6 Agent Runs (audit trail cho mọi cron/agent) ──────── */}
            <AgentRuns7Days />

            {/* ── 2. Target Keywords Tracker ─────────────────────────────── */}
            <section>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">2. Theo Dõi Từ Khóa Mục Tiêu (Top 3)</h3>
                    <span className="text-2xs text-[var(--text-tertiary)]">{keywords.length} từ khóa</span>
                </div>
                {keywords.length === 0 && !kwLoading && (
                    <div className="mb-3 p-3 rounded-xl border border-[var(--sgs-primary)] bg-[var(--sgs-primary)]/10 dark:bg-sgs-primary/15 flex items-start gap-3">
                        <div className="flex-1 text-xs text-sgs-primary dark:text-[var(--sgs-primary)]">
                            <div className="font-bold mb-0.5">💡 Bắt đầu nhanh — Nạp bộ 20 từ khoá chiến lược</div>
                            <div className="text-2xs opacity-90">Bao gồm: BĐS TP.HCM/Đồng Nai/Long Thành/Bình Dương, định giá BĐS, Aqua City, Izumi, Vinhomes Grand Park/Central Park/<strong>Cần Giờ</strong>, Global City, Masterise, <strong>Vạn Phúc City</strong>, <strong>Sala Đại Quang Minh</strong>, Thủ Thiêm, Grand Manhattan, Sơn Kim. Chỉ thêm nếu chưa có (an toàn để bấm nhiều lần).</div>
                        </div>
                        <button
                            disabled={seeding}
                            onClick={async () => {
                                if (seeding) return;
                                setSeeding(true);
                                try {
                                    const r = await seoApi.seedDefaultKeywords();
                                    await loadKeywords();
                                    alert(`Đã nạp: ${r.inserted} từ khoá mới (bỏ qua ${r.skipped} đã tồn tại)`);
                                } catch { alert('Lỗi khi nạp bộ mặc định'); }
                                finally { setSeeding(false); }
                            }}
                            className="shrink-0 px-3 py-1.5 text-xs font-bold rounded-md bg-sgs-primary text-white hover:bg-sgs-primary disabled:opacity-60 disabled:cursor-wait">
                            {seeding ? 'Đang nạp...' : 'Nạp 20 từ khoá'}
                        </button>
                    </div>
                )}
                <form onSubmit={submitDraft} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2 mb-4 p-3 rounded-xl bg-[var(--glass-surface-hover)] border border-[var(--glass-border)]">
                    <input type="text" value={draft.keyword} onChange={(e) => setDraft({ ...draft, keyword: e.target.value })}
                        placeholder="Từ khóa (vd: căn hộ Aqua City)" maxLength={300}
                        className="lg:col-span-2 px-2 py-1.5 text-xs rounded-md border border-[var(--glass-border)] bg-[var(--bg-surface)]" />
                    <input type="text" value={draft.targetUrl} onChange={(e) => setDraft({ ...draft, targetUrl: e.target.value })}
                        placeholder="URL đích (tuỳ chọn)" className="lg:col-span-2 px-2 py-1.5 text-xs rounded-md border border-[var(--glass-border)] bg-[var(--bg-surface)]" />
                    <input type="number" value={draft.currentPosition} onChange={(e) => setDraft({ ...draft, currentPosition: e.target.value })}
                        placeholder="Hạng hiện tại" min={1} max={100}
                        className="px-2 py-1.5 text-xs rounded-md border border-[var(--glass-border)] bg-[var(--bg-surface)]" />
                    <input type="number" value={draft.targetPosition} onChange={(e) => setDraft({ ...draft, targetPosition: e.target.value })}
                        placeholder="Mục tiêu (3)" min={1} max={100}
                        className="px-2 py-1.5 text-xs rounded-md border border-[var(--glass-border)] bg-[var(--bg-surface)]" />
                    <input type="number" value={draft.searchVolume} onChange={(e) => setDraft({ ...draft, searchVolume: e.target.value })}
                        placeholder="Volume/tháng" min={0}
                        className="px-2 py-1.5 text-xs rounded-md border border-[var(--glass-border)] bg-[var(--bg-surface)]" />
                    <input type="text" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                        placeholder="Ghi chú" maxLength={500}
                        className="lg:col-span-4 px-2 py-1.5 text-xs rounded-md border border-[var(--glass-border)] bg-[var(--bg-surface)]" />
                    <button type="submit" disabled={saving}
                        className="lg:col-span-2 px-3 py-1.5 text-xs font-bold rounded-md bg-sgs-primary text-white hover:bg-sgs-primary disabled:opacity-50">
                        {saving ? 'Đang lưu...' : (saveMsg || 'Thêm / Cập nhật')}
                    </button>
                </form>
                {kwLoading ? (
                    <div className="text-xs text-[var(--text-tertiary)] animate-pulse">Đang tải...</div>
                ) : keywords.length === 0 ? (
                    <div className="text-xs text-[var(--text-tertiary)] py-6 text-center border border-dashed border-[var(--glass-border)] rounded-xl">
                        Chưa có từ khóa nào. Thêm từ khóa đầu tiên để bắt đầu theo dõi top 3 và mức độ AI trích dẫn.
                    </div>
                ) : (
                    <div className="overflow-x-auto -mx-1">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="text-[var(--text-tertiary)] text-2xs uppercase border-b border-[var(--glass-border)]">
                                    <th className="text-left py-2 px-2">Từ khóa</th>
                                    <th className="text-center py-2 px-2">Hạng</th>
                                    <th className="text-center py-2 px-2">Mục tiêu</th>
                                    <th className="text-center py-2 px-2" title="Volume/tháng ước tính">Vol/th</th>
                                    <th className="text-center py-2 px-2">Có trên AI</th>
                                    <th className="text-center py-2 px-2">Test</th>
                                    <th className="text-right py-2 px-2"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {keywords.map((kw) => {
                                    const links = AI_PROMPT_TEMPLATES(kw.keyword);
                                    const reachedTop = kw.currentPosition !== null && kw.currentPosition <= kw.targetPosition;
                                    const aiCount = (['chatgpt','gemini','claude','perplexity'] as const).filter(e => kw.aiVisibility[e] === true).length;
                                    return (
                                        <tr key={kw.id} className="border-b border-[var(--glass-border)] hover:bg-[var(--glass-surface-hover)]">
                                            <td className="py-2 px-2">
                                                <div className="font-bold text-[var(--text-primary)]">{kw.keyword}</div>
                                                {kw.targetUrl && <a href={kw.targetUrl} target="_blank" rel="noopener" className="text-2xs text-sgs-primary hover:underline truncate block max-w-[280px]">{kw.targetUrl}</a>}
                                                {kw.notes && <div className="text-2xs text-[var(--text-tertiary)] mt-0.5">{kw.notes}</div>}
                                            </td>
                                            <td className="text-center px-2">
                                                <span className={`inline-block px-2 py-0.5 rounded font-bold ${
                                                    kw.currentPosition === null ? 'bg-gray-100 text-gray-500'
                                                    : reachedTop ? 'bg-emerald-100 text-emerald-700'
                                                    : kw.currentPosition <= 10 ? 'bg-amber-100 text-amber-700'
                                                    : 'bg-rose-100 text-rose-700'
                                                }`}>{kw.currentPosition ?? '—'}</span>
                                            </td>
                                            <td className="text-center px-2 text-[var(--text-tertiary)]">{kw.targetPosition}</td>
                                            <td className="text-center px-2 text-[var(--text-tertiary)]">{kw.searchVolume?.toLocaleString() ?? '—'}</td>
                                            <td className="text-center px-2">
                                                <div className="flex items-center justify-center gap-1">
                                                    {(['chatgpt', 'gemini', 'claude', 'perplexity'] as const).map((engine) => {
                                                        const v = kw.aiVisibility[engine];
                                                        const label = engine[0].toUpperCase();
                                                        const cls = v === true ? 'bg-emerald-500 text-white'
                                                                  : v === false ? 'bg-rose-300 text-rose-900'
                                                                  : 'bg-gray-200 text-gray-500';
                                                        const busy = updatingId === kw.id;
                                                        return (
                                                            <button key={engine}
                                                                disabled={busy}
                                                                onClick={() => updateAiFlag(kw, engine, v === true ? false : v === false ? null : true)}
                                                                title={`${engine}: ${v === true ? 'Có' : v === false ? 'Không' : 'Chưa kiểm tra'} (click để đổi)`}
                                                                className={`w-6 h-6 rounded text-2xs font-bold ${cls} ${busy ? 'opacity-50 cursor-wait' : ''}`}>{label}</button>
                                                        );
                                                    })}
                                                </div>
                                                <div className="text-2xs text-[var(--text-tertiary)] mt-0.5">{aiCount}/4</div>
                                            </td>
                                            <td className="text-center px-2">
                                                <div className="flex items-center justify-center gap-1">
                                                    <a href={links.chatgpt}    target="_blank" rel="noopener" className="px-1.5 py-0.5 rounded text-2xs font-bold bg-[#10a37f] text-white hover:opacity-90" title="Test trên ChatGPT">GPT</a>
                                                    <a href={links.gemini}     target="_blank" rel="noopener" className="px-1.5 py-0.5 rounded text-2xs font-bold bg-[#4285f4] text-white hover:opacity-90" title="Test trên Gemini">GMN</a>
                                                    <a href={links.claude}     target="_blank" rel="noopener" className="px-1.5 py-0.5 rounded text-2xs font-bold bg-[#cc785c] text-white hover:opacity-90" title="Test trên Claude">CLD</a>
                                                    <a href={links.perplexity} target="_blank" rel="noopener" className="px-1.5 py-0.5 rounded text-2xs font-bold bg-[#1f6feb] text-white hover:opacity-90" title="Test trên Perplexity">PPX</a>
                                                    <a href={links.google}     target="_blank" rel="noopener" className="px-1.5 py-0.5 rounded text-2xs font-bold bg-gray-200 text-gray-700 hover:bg-gray-300" title="Test trên Google">G</a>
                                                </div>
                                            </td>
                                            <td className="text-right px-2">
                                                <button onClick={() => removeKeyword(kw.id)} className="text-rose-500 hover:text-rose-700 text-2xs font-bold">Xoá</button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
            {/* ── 3. AI Citation Checklist ───────────────────────────────── */}
            {(() => {
                const displayItems: any[] = auditResult ? auditResult.items : checklist;
                const dPass = displayItems.filter((c) => c.status === 'pass').length;
                const dTotal = displayItems.length;
                return (
                    <section>
                        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                            <h3 className="text-sm font-bold text-[var(--text-primary)]">3. Checklist Sẵn Sàng Cho AI Trích Dẫn ({dPass}/{dTotal})</h3>
                            <button onClick={() => { setAuditResult(null); setAuditError(null); runChecklist(); }} className="text-2xs font-bold text-sgs-primary hover:underline">{ICONS.RESET} Chạy lại / Quay về DOM admin</button>
                        </div>
                        {/* URL Audit input — kiểm tra trang công khai bất kỳ */}
                        <div className="p-3 mb-3 rounded-lg border border-[var(--sgs-primary)] bg-[var(--sgs-primary)]/10 dark:bg-sgs-primary/15">
                            <div className="text-xs font-bold text-sgs-primary dark:text-[var(--sgs-primary)] mb-2">🔎 Kiểm tra trang công khai (server-side fetch + parse HTML thật)</div>
                            <div className="flex flex-wrap gap-2 items-center">
                                <input
                                    type="text"
                                    value={auditPath}
                                    onChange={(e) => setAuditPath(e.target.value)}
                                    placeholder="/du-an/aqua-city"
                                    className="flex-1 min-w-[240px] px-2 py-1.5 text-xs rounded-md border border-[var(--glass-border)] bg-[var(--bg-surface)]"
                                />
                                <button
                                    disabled={auditing || !auditPath.trim()}
                                    onClick={async () => {
                                        setAuditing(true); setAuditError(null); setAuditResult(null);
                                        try {
                                            const r = await seoApi.auditUrl(auditPath.trim());
                                            setAuditResult(r);
                                        } catch (err: any) {
                                            setAuditError(err?.message || 'Lỗi không xác định');
                                        } finally { setAuditing(false); }
                                    }}
                                    className="px-3 py-1.5 text-xs font-bold rounded-md bg-sgs-primary text-white hover:bg-sgs-primary disabled:opacity-60">
                                    {auditing ? 'Đang kiểm tra...' : 'Kiểm tra URL này'}
                                </button>
                            </div>
                            <div className="text-2xs text-sgs-primary dark:text-sgs-on-dark-muted mt-1.5 opacity-90">
                                Gợi ý: <code>/du-an/vinhomes-can-gio</code>, <code>/du-an/sala</code>, <code>/du-an/van-phuc-city</code>, <code>/bat-dong-san-long-thanh</code>, <code>/ai-valuation</code>
                            </div>
                            {auditError && <div className="text-2xs text-rose-700 mt-1.5 font-bold">❌ {auditError}</div>}
                            {auditResult && (
                                <div className="text-2xs text-emerald-800 dark:text-emerald-300 mt-1.5">
                                    ✓ Đã kiểm tra: <strong className="break-all">{auditResult.target}</strong> — {new Date(auditResult.fetchedAt).toLocaleString('vi-VN')}
                                </div>
                            )}
                        </div>
                        {!auditResult && (
                            <div className="p-3 mb-3 rounded-lg border border-amber-300 bg-amber-50/70 dark:bg-amber-900/15 text-2xs text-amber-900 dark:text-amber-200">
                                <div className="font-bold mb-1">⚠️ Đang xem: DOM của trang admin này</div>
                                Checklist dưới đang chấm DOM của <strong>chính trang Quản Lý SEO</strong>. Để chấm SEO của trang công khai (vd dự án Aqua City), nhập đường dẫn ở ô bên trên rồi bấm <strong>Kiểm tra URL này</strong>.
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {displayItems.map((c: any) => (
                                <div key={c.id} className={`p-2.5 rounded-lg border text-xs ${
                                    c.status === 'pass' ? 'border-emerald-200 bg-emerald-50/50 dark:bg-emerald-900/10'
                                    : c.status === 'warn' ? 'border-amber-200 bg-amber-50/50 dark:bg-amber-900/10'
                                    : 'border-rose-200 bg-rose-50/50 dark:bg-rose-900/10'
                                }`}>
                                    <div className="flex items-start gap-2">
                                        <span className={`mt-0.5 ${c.status === 'pass' ? 'text-emerald-600' : c.status === 'warn' ? 'text-amber-600' : 'text-rose-600'}`}>
                                            {c.status === 'pass' ? ICONS.CHECK : c.status === 'warn' ? ICONS.WARN : ICONS.ERROR}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <div className="font-bold text-[var(--text-primary)]">{c.label}</div>
                                            <div className="text-2xs text-[var(--text-tertiary)] mt-0.5 break-all">{c.detail}</div>
                                            {c.tip && <div className="text-2xs text-sgs-primary mt-1">💡 {c.tip}</div>}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                );
            })()}
        </div>
    );
};
// ── Main Component ─────────────────────────────────────────────────────────────
export const SeoManager: React.FC = () => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [activeTab, setActiveTab] = useState<TabId>('SERP');
    // Single source of truth for overrides — shared by SERP Preview and Meta Editor
    const [overrides, setOverrides] = useState<Record<string, { title: string; description: string }>>(getSEOOverrides);
    // schemaVersion: bumped after each meta save to force StructuredData to remount
    // and re-read the freshly-patched DOM JSON-LD
    const [schemaVersion, setSchemaVersion] = useState(0);
    // Always start SERP Preview on the homepage — the most important page for Google.
    // Only changes when: user saves a route (onAfterSave) or manually selects from dropdown.
    const [serpSelectedKey, setSerpSelectedKey] = useState<string>('home');

    // On mount: load BOTH user session AND server SEO overrides in parallel before rendering.
    // This prevents the race condition where getCurrentUser resolves first (loading=false)
    // causing SERP Preview to render with empty overrides (falling back to stale ROUTE_SEO defaults).
    useEffect(() => {
        Promise.all([
            db.getCurrentUser().catch(() => null),
            seoApi.getAll().catch((): Record<string, SeoOverride> | null => null),
        ]).then(([u, serverOverrides]) => {
            setIsAdmin(['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD'].includes(u?.role ?? ''));

            const local = getSEOOverrides();
            const merged: Record<string, { title: string; description: string }> = { ...local };
            if (serverOverrides) {
                for (const [key, ov] of Object.entries(serverOverrides)) {
                    merged[key] = { title: ov.title, description: ov.description };
                    saveSEOOverride(key, ov.title, ov.description);
                }
            }
            setOverrides(merged);
            if (Object.keys(merged).length > 0) {
                applyOverridesToDom(merged);
                setSchemaVersion(1);
            }
            setLoading(false);
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const TABS: { id: TabId; label: string }[] = [
        { id: 'SERP',   label: 'Xem Trước SERP' },
        { id: 'META',   label: 'Chỉnh Sửa Meta' },
        { id: 'HEALTH', label: 'Sức Khoẻ SEO' },
        { id: 'SCHEMA', label: 'Dữ Liệu Cấu Trúc' },
        { id: 'GEO',    label: 'GEO / AI Search' },
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
          <SeoHead title="Quản Lý SEO | SGS LAND" description="Tối ưu hóa SEO cho danh sách bất động sản và nội dung website SGS LAND." canonicalPath="/seo-manager" />


            {/* ── Header ──────────────────────────────────────────────────── */}
            <div className="bg-[var(--bg-surface)] px-5 py-4 sm:px-6 sm:py-5 rounded-[20px] border border-[var(--glass-border)] shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-9 h-9 bg-sgs-champagne dark:bg-sgs-primary/30 text-sgs-primary rounded-xl flex items-center justify-center shrink-0">
                                {ICONS.GLOBE}
                            </div>
                            <h2 className="text-lg sm:text-xl font-bold text-[var(--text-primary)]">Quản Lý SEO</h2>
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
                                className={`flex items-center gap-1.5 px-3 py-1.5 bg-[var(--glass-surface-hover)] border border-[var(--glass-border)] rounded-xl text-2xs font-bold hover:border-[var(--sgs-primary)] hover:shadow-sm transition-all ${tool.color}`}
                            >
                                {tool.label} {ICONS.EXT}
                            </a>
                        ))}
                    </div>
                </div>
                {/* Tab Bar — mobile: dropdown, desktop: pill tabs */}
                {/* Mobile dropdown */}
                <div className="sm:hidden mt-4">
                    <Dropdown
                        value={activeTab}
                        onChange={(val) => setActiveTab(val as TabId)}
                        options={TABS.map(tab => ({ value: tab.id, label: tab.label }))}
                        className="w-full"
                    />
                </div>
                {/* Desktop pill tabs */}
                <div className="hidden sm:inline-flex gap-1 mt-4 bg-[var(--glass-surface-hover)] p-1 rounded-xl">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                                activeTab === tab.id
                                    ? 'bg-[var(--bg-surface)] shadow text-sgs-primary dark:text-[var(--sgs-primary)]'
                                    : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>
            {/* ── Tab Content ─────────────────────────────────────────────── */}
            <div className="bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-[20px] shadow-sm p-4 sm:p-6 w-full min-w-0 overflow-x-hidden">
                {activeTab === 'SERP'   && <SerpPreview selectedKey={serpSelectedKey} onSelect={setSerpSelectedKey} overrides={overrides} />}
                {activeTab === 'META'   && <MetaEditor overrides={overrides} onOverridesChange={(next) => {
                    setOverrides(next);
                    // Patch DOM JSON-LD immediately so switching to SCHEMA tab shows updated values
                    applyOverridesToDom(next);
                    // Force StructuredData to remount and re-read the freshly patched DOM
                    setSchemaVersion(v => v + 1);
                }} onAfterSave={setSerpSelectedKey} />}
                {activeTab === 'HEALTH' && <HealthChecklist />}
                {activeTab === 'SCHEMA' && <StructuredData key={schemaVersion} />}
                {activeTab === 'GEO'    && <GeoAiSearch />}
            </div>

        </div>
    );
};