import React from 'react';

/**
 * Shared building blocks for the Settings hub pages (profile, enterprise, users,
 * vendors, billing, security, system, data sources, error monitor, scraper,
 * custom fields). They keep page width, headers, cards, KPI tiles and small
 * charts consistent. All visible text is passed in by the caller (i18n there).
 * Charts are plain SVG/CSS so they stay light, theme-aware and accessible.
 */

export type Tone = 'neutral' | 'brand' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

export const TONE_COLOR: Record<Tone, string> = {
    neutral: 'var(--text-tertiary)',
    brand: 'var(--sgs-primary)',
    accent: 'var(--sgs-accent)',
    success: 'var(--ui-success)',
    warning: 'var(--ui-warning, #B7791F)',
    danger: 'var(--ui-danger)',
    info: 'var(--ui-info)',
};

/** Ordered palette for categorical series (navy, gold, then supporting tones). */
export const SERIES_COLORS = [
    'var(--sgs-primary)',
    'var(--sgs-accent)',
    'var(--ui-info)',
    'var(--ui-success)',
    'var(--ui-warning, #B7791F)',
    'var(--ui-danger)',
    'var(--text-tertiary)',
];

const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

/* ---------------- Layout ---------------- */

export const SettingsPage: React.FC<{ children: React.ReactNode; width?: 'wide' | 'narrow'; className?: string }> = ({ children, width = 'wide', className }) => (
    <div className="h-full overflow-y-auto">
        <div className={cx('mx-auto w-full space-y-5 p-4 pb-24 sm:p-6', width === 'narrow' ? 'max-w-4xl' : 'max-w-[1400px]', className)}>
            {children}
        </div>
    </div>
);

export const SettingsHeader: React.FC<{
    title: React.ReactNode;
    description?: React.ReactNode;
    icon?: React.ReactNode;
    meta?: React.ReactNode;
    actions?: React.ReactNode;
}> = ({ title, description, icon, meta, actions }) => (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
            {icon && <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--glass-surface)] text-[var(--sgs-primary)]" aria-hidden="true">{icon}</span>}
            <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-bold leading-tight text-[var(--text-primary)]">{title}</h2>
                    {meta}
                </div>
                {description && <p className="mt-1 text-sm text-[var(--text-secondary)]">{description}</p>}
            </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
);

export const SettingsCard: React.FC<{
    title?: React.ReactNode;
    description?: React.ReactNode;
    actions?: React.ReactNode;
    children?: React.ReactNode;
    className?: string;
    bodyClassName?: string;
    as?: 'section' | 'div';
    ariaLabel?: string;
}> = ({ title, description, actions, children, className, bodyClassName, as = 'section', ariaLabel }) => {
    const Tag = as as any;
    return (
        <Tag className={cx('rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-surface)]', className)} aria-label={ariaLabel}>
            {(title || actions) && (
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--glass-border)] px-4 py-3 sm:px-5">
                    <div className="min-w-0">
                        {title && <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>}
                        {description && <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">{description}</p>}
                    </div>
                    {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
                </div>
            )}
            <div className={cx('p-4 sm:p-5', bodyClassName)}>{children}</div>
        </Tag>
    );
};

/* ---------------- KPI tiles ---------------- */

export const StatTile: React.FC<{
    label: React.ReactNode;
    value: React.ReactNode;
    hint?: React.ReactNode;
    tone?: Tone;
    visual?: React.ReactNode;
    onClick?: () => void;
    active?: boolean;
}> = ({ label, value, hint, tone = 'neutral', visual, onClick, active }) => {
    const body = (
        <>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-xs font-medium text-[var(--text-secondary)]">{label}</div>
                    <div className="mt-1 text-2xl font-bold tabular-nums leading-tight" style={{ color: tone === 'neutral' ? 'var(--text-primary)' : TONE_COLOR[tone] }}>{value}</div>
                </div>
                {visual}
            </div>
            {hint && <div className="mt-1 text-xs text-[var(--text-tertiary)]">{hint}</div>}
        </>
    );
    const base = cx(
        'rounded-2xl border bg-[var(--bg-surface)] p-4 text-left',
        active ? 'border-[var(--sgs-primary)] ring-1 ring-[var(--sgs-primary)]' : 'border-[var(--glass-border)]',
    );
    return onClick ? (
        <button type="button" onClick={onClick} aria-pressed={active} className={cx(base, 'w-full transition-colors hover:border-[var(--ui-border-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)]')}>
            {body}
        </button>
    ) : <div className={base}>{body}</div>;
};

export const StatGrid: React.FC<{ children: React.ReactNode; cols?: 2 | 3 | 4 }> = ({ children, cols = 4 }) => (
    <div className={cx('grid grid-cols-2 gap-3', cols === 3 ? 'lg:grid-cols-3' : cols === 4 ? 'lg:grid-cols-4' : '')}>{children}</div>
);

/* ---------------- Meters & distributions ---------------- */

/** Used vs limit. Over-limit usage is shown in red with the overflow, never clipped silently. */
export const UsageMeter: React.FC<{
    label: React.ReactNode;
    used: number;
    limit: number | null;
    formatValue?: (n: number) => string;
    overLabel?: (over: string) => React.ReactNode;
    unlimitedLabel?: React.ReactNode;
}> = ({ label, used, limit, formatValue = n => n.toLocaleString(), overLabel, unlimitedLabel }) => {
    const hasLimit = limit != null && Number.isFinite(limit) && limit > 0;
    const ratio = hasLimit ? used / (limit as number) : 0;
    const pct = Math.round(ratio * 100);
    const tone: Tone = !hasLimit ? 'brand' : ratio > 1 ? 'danger' : ratio >= 0.8 ? 'warning' : 'brand';
    return (
        <div>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-xs">
                <span className="font-medium text-[var(--text-secondary)]">{label}</span>
                <span className="tabular-nums font-semibold text-[var(--text-primary)]">
                    {formatValue(used)}{hasLimit ? ` / ${formatValue(limit as number)}` : unlimitedLabel ? <> · {unlimitedLabel}</> : null}
                    {hasLimit && <span className="ml-1.5 font-normal text-[var(--text-tertiary)]">({pct}%)</span>}
                </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--glass-surface-hover)]" role="meter" aria-valuemin={0} aria-valuemax={hasLimit ? (limit as number) : undefined} aria-valuenow={used} aria-label={typeof label === 'string' ? label : undefined}>
                <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${hasLimit ? Math.min(100, pct) : used > 0 ? 100 : 0}%`, background: TONE_COLOR[tone] }} />
            </div>
            {hasLimit && ratio > 1 && overLabel && (
                <div className="mt-1 text-xs font-semibold" style={{ color: TONE_COLOR.danger }}>{overLabel(formatValue(used - (limit as number)))}</div>
            )}
        </div>
    );
};

export interface Segment { label: string; value: number; color?: string }

/** One stacked bar with a legend: share of each category. */
export const DistributionBar: React.FC<{ segments: Segment[]; ariaLabel: string; emptyText?: string; formatValue?: (n: number) => string }> = ({ segments, ariaLabel, emptyText, formatValue = n => n.toLocaleString() }) => {
    const total = segments.reduce((s, x) => s + Math.max(0, x.value || 0), 0);
    if (total <= 0) return <div className="py-2 text-xs text-[var(--text-tertiary)]">{emptyText}</div>;
    return (
        <div role="group" aria-label={ariaLabel}>
            <div className="flex h-3 overflow-hidden rounded-full bg-[var(--glass-surface-hover)]" aria-hidden="true">
                {segments.map((s, i) => s.value > 0 && (
                    <div key={s.label} title={`${s.label}: ${formatValue(s.value)}`} style={{ width: `${(s.value / total) * 100}%`, background: s.color || SERIES_COLORS[i % SERIES_COLORS.length] }} />
                ))}
            </div>
            <ul className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-2">
                {segments.map((s, i) => (
                    <li key={s.label} className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-2 text-[var(--text-secondary)]">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color || SERIES_COLORS[i % SERIES_COLORS.length] }} aria-hidden="true" />
                            <span className="truncate">{s.label}</span>
                        </span>
                        <span className="shrink-0 tabular-nums font-semibold text-[var(--text-primary)]">
                            {formatValue(s.value)} <span className="font-normal text-[var(--text-tertiary)]">· {Math.round((s.value / total) * 100)}%</span>
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
};

/** Donut chart with a centre value; pair with a legend (e.g. DistributionBar without the bar) when needed. */
export const DonutChart: React.FC<{ segments: Segment[]; ariaLabel: string; size?: number; centerValue?: React.ReactNode; centerLabel?: React.ReactNode; thickness?: number }> = ({ segments, ariaLabel, size = 120, centerValue, centerLabel, thickness = 14 }) => {
    const total = segments.reduce((s, x) => s + Math.max(0, x.value || 0), 0);
    const r = 50 - thickness / 2;
    const c = 2 * Math.PI * r;
    let offset = 0;
    return (
        <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={ariaLabel}>
            <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
                <circle cx="50" cy="50" r={r} fill="none" stroke="var(--glass-surface-hover)" strokeWidth={thickness} />
                {total > 0 && segments.map((s, i) => {
                    const len = (Math.max(0, s.value) / total) * c;
                    const el = (
                        <circle key={s.label} cx="50" cy="50" r={r} fill="none" stroke={s.color || SERIES_COLORS[i % SERIES_COLORS.length]} strokeWidth={thickness}
                            strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} transform="rotate(-90 50 50)">
                            <title>{`${s.label}: ${s.value}`}</title>
                        </circle>
                    );
                    offset += len;
                    return el;
                })}
            </svg>
            {(centerValue != null || centerLabel) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center" aria-hidden="true">
                    {centerValue != null && <span className="text-lg font-bold tabular-nums text-[var(--text-primary)]">{centerValue}</span>}
                    {centerLabel && <span className="text-[10px] text-[var(--text-tertiary)]">{centerLabel}</span>}
                </div>
            )}
        </div>
    );
};

/* ---------------- Time series ---------------- */

export interface TrendPoint { label: string; value: number | null }

/** Vertical bars over time (e.g. errors per day). Missing points stay empty, not zero. */
export const TrendBars: React.FC<{
    points: TrendPoint[];
    ariaLabel: string;
    color?: string;
    height?: number;
    formatValue?: (n: number) => string;
    emptyText?: string;
    highlightLast?: boolean;
}> = ({ points, ariaLabel, color = 'var(--sgs-primary)', height = 96, formatValue = n => n.toLocaleString(), emptyText, highlightLast = true }) => {
    const values = points.map(p => (p.value == null || !Number.isFinite(p.value) ? null : p.value));
    const max = Math.max(0, ...values.map(v => v ?? 0));
    if (!points.length || values.every(v => v == null)) return <div className="py-6 text-center text-xs text-[var(--text-tertiary)]">{emptyText}</div>;
    return (
        <div role="img" aria-label={ariaLabel}>
            <div className="flex items-end gap-[3px]" style={{ height }} aria-hidden="true">
                {points.map((p, i) => {
                    const v = values[i];
                    const h = v == null ? 0 : max > 0 ? Math.max(v > 0 ? 3 : 1, (v / max) * height) : 1;
                    const last = highlightLast && i === points.length - 1;
                    return (
                        <div key={`${p.label}-${i}`} className="group relative flex h-full flex-1 items-end">
                            <div className="w-full rounded-t-[3px]" style={{ height: h, background: v == null ? 'transparent' : last ? 'var(--sgs-accent)' : color, opacity: v === 0 ? 0.35 : 1 }} />
                            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-[var(--sgs-primary-deep,#0F2238)] px-1.5 py-0.5 text-[10px] font-semibold text-white opacity-0 group-hover:opacity-100">
                                {p.label}: {v == null ? '—' : formatValue(v)}
                            </span>
                        </div>
                    );
                })}
            </div>
            <div className="mt-1.5 flex justify-between text-[10px] text-[var(--text-tertiary)]" aria-hidden="true">
                <span>{points[0]?.label}</span>
                {points.length > 2 && <span>{points[Math.floor(points.length / 2)]?.label}</span>}
                <span>{points[points.length - 1]?.label}</span>
            </div>
        </div>
    );
};

/** Tiny inline trend line for KPI tiles. */
export const Sparkline: React.FC<{ values: number[]; color?: string; width?: number; height?: number; ariaLabel?: string }> = ({ values, color = 'var(--sgs-primary)', width = 96, height = 28, ariaLabel }) => {
    const clean = values.filter(v => Number.isFinite(v));
    if (clean.length < 2) return null;
    const min = Math.min(...clean), max = Math.max(...clean);
    const span = max - min || 1;
    const step = width / (clean.length - 1);
    const pts = clean.map((v, i) => `${(i * step).toFixed(1)},${(height - 2 - ((v - min) / span) * (height - 4)).toFixed(1)}`);
    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role={ariaLabel ? 'img' : undefined} aria-label={ariaLabel} aria-hidden={ariaLabel ? undefined : true} className="shrink-0">
            <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
    );
};

/** Consistent status pill using the shared badge classes. */
export const StatusBadge: React.FC<{ tone: Tone; children: React.ReactNode }> = ({ tone, children }) => {
    const cls: Record<Tone, string> = {
        neutral: 'ui-badge ui-badge-neutral',
        brand: 'ui-badge ui-badge-info',
        accent: 'ui-badge ui-badge-warning',
        success: 'ui-badge ui-badge-success',
        warning: 'ui-badge ui-badge-warning',
        danger: 'ui-badge ui-badge-danger',
        info: 'ui-badge ui-badge-info',
    };
    return <span className={cls[tone]}>{children}</span>;
};

export const EmptyState: React.FC<{ title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; icon?: React.ReactNode }> = ({ title, description, action, icon }) => (
    <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
        {icon && <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--glass-surface)] text-[var(--text-tertiary)]" aria-hidden="true">{icon}</span>}
        <div className="text-sm font-semibold text-[var(--text-primary)]">{title}</div>
        {description && <p className="mt-1 max-w-sm text-xs text-[var(--text-tertiary)]">{description}</p>}
        {action && <div className="mt-4">{action}</div>}
    </div>
);
