import React from 'react';

export interface DashboardBarItem {
    label: string;
    value: number | null;
    color?: string;
    href?: string;
}

/**
 * Compact, labelled horizontal comparison chart for dashboard counts.
 * Missing values stay missing; they are never silently drawn as zero.
 */
export const DashboardValueBars: React.FC<{
    items: DashboardBarItem[];
    locale: string;
    ariaLabel: string;
    emptyText: string;
    formatValue?: (value: number) => string;
}> = ({ items, locale, ariaLabel, emptyText, formatValue }) => {
    const available = items.filter(item => item.value !== null && Number.isFinite(item.value) && item.value >= 0);
    const maximum = Math.max(0, ...available.map(item => item.value as number));
    const number = new Intl.NumberFormat(locale);

    if (!available.length) {
        return <div className="py-3 text-xs text-[var(--text-tertiary)]">{emptyText}</div>;
    }

    return (
        <div className="space-y-3" role="group" aria-label={ariaLabel}>
            {items.map((item, index) => {
                const valid = item.value !== null && Number.isFinite(item.value) && item.value >= 0;
                const width = valid && maximum > 0 ? Math.min(100, ((item.value as number) / maximum) * 100) : 0;
                const content = (
                    <>
                        <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                            <span className="min-w-0 truncate text-[var(--text-secondary)]">{item.label}</span>
                            <strong className="shrink-0 font-mono font-semibold text-[var(--text-primary)]">
                                {valid ? (formatValue ? formatValue(item.value as number) : number.format(item.value as number)) : '—'}
                            </strong>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-[var(--glass-surface-hover)]" aria-hidden="true">
                            {valid && maximum > 0 && (
                                <div
                                    className="h-full rounded-full transition-[width] duration-300"
                                    style={{ width: `${width}%`, background: item.color || 'var(--sgs-primary)' }}
                                />
                            )}
                        </div>
                    </>
                );
                return item.href ? (
                    <a
                        key={`${item.label}-${index}`}
                        href={item.href}
                        className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)]"
                        aria-label={`${item.label}: ${valid ? (formatValue ? formatValue(item.value as number) : number.format(item.value as number)) : '—'}`}
                    >
                        {content}
                    </a>
                ) : <div key={`${item.label}-${index}`}>{content}</div>;
            })}
        </div>
    );
};

export const DashboardMetricRing: React.FC<{
    value: number | null;
    label: string;
    color?: string;
    size?: number;
    showValue?: boolean;
    centerValue?: string;
}> = ({ value, label, color = 'var(--sgs-primary)', size = 52, showValue = true, centerValue }) => {
    const valid = value !== null && Number.isFinite(value);
    const normalized = valid ? Math.max(0, Math.min(100, value as number)) : 0;
    const radius = 19;
    const circumference = 2 * Math.PI * radius;
    const dash = circumference * normalized / 100;
    const displayedValue = centerValue ?? (valid ? `${Math.round(value as number)}%` : '—');
    const centerFontSize = displayedValue.length > 6 ? 8 : displayedValue.length > 4 ? 9 : size >= 72 ? 12 : 10;

    return (
        <div
            className="relative flex shrink-0 items-center justify-center"
            style={{ width: size, height: size }}
            role="img"
            aria-label={label}
            title={label}
        >
            <svg width="100%" height="100%" viewBox="0 0 48 48" aria-hidden="true">
                <circle cx="24" cy="24" r={radius} fill="none" stroke="var(--glass-surface-hover)" strokeWidth="5" />
                {valid && (
                    <circle
                        cx="24" cy="24" r={radius} fill="none" stroke={color} strokeWidth="5"
                        strokeLinecap="round" strokeDasharray={`${dash} ${circumference - dash}`}
                        transform="rotate(-90 24 24)"
                    />
                )}
            </svg>
            {showValue && (
                <span
                    className="absolute inset-0 flex items-center justify-center overflow-hidden px-1 text-center font-mono font-bold leading-none text-[var(--text-primary)]"
                    style={{ fontSize: `${centerFontSize}px` }}
                    aria-hidden="true"
                >
                    {displayedValue}
                </span>
            )}
        </div>
    );
};