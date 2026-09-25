import React from 'react';

/**
 * Shared building blocks for record detail pages (lead, listing, contract, project).
 * Layout contract: header strip → two-column body (main work area + ~320px context
 * column) → sticky action footer. Columns stack on small screens.
 */

export const DetailSection: React.FC<{ title: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string }> = ({ title, action, children, className = '' }) => (
    <section className={`py-5 first:pt-0 ${className}`}>
        <div className="mb-3 flex items-baseline justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)]">{title}</h3>
            {action}
        </div>
        {children}
    </section>
);

export const LevelMeter: React.FC<{ level: number; labels: [string, string, string]; colors?: [string, string, string]; suffix?: string }> = ({
    level,
    labels,
    colors = ['var(--ui-danger)', 'var(--sgs-accent)', 'var(--ui-success)'],
    suffix,
}) => (
    <div>
        <div className="grid grid-cols-3 gap-1" aria-hidden="true">
            {[0, 1, 2].map(i => (
                <div key={i} className="h-1.5 rounded-full" style={{ background: i === level ? colors[i] : 'var(--glass-surface-hover)' }} />
            ))}
        </div>
        <div className="mt-1.5 grid grid-cols-3 gap-1 text-center text-xs text-[var(--text-tertiary)]">
            {labels.map((label, i) => (
                <span key={label} className={i === level ? 'font-bold text-[var(--text-primary)]' : ''}>
                    {label}{i === level && suffix ? ` · ${suffix}` : ''}
                </span>
            ))}
        </div>
    </div>
);

const CHIP_TONE = {
    neutral: 'ui-badge-neutral',
    info: 'ui-badge-info',
    success: 'ui-badge-success',
    warning: 'ui-badge-warning',
    danger: 'ui-badge-danger',
} as const;

export const StatusChip: React.FC<{ children: React.ReactNode; tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger' }> = ({ children, tone = 'neutral' }) => (
    <span className={`ui-badge ${CHIP_TONE[tone]}`}>{children}</span>
);
