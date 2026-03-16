
import React, { memo, useMemo } from 'react';
import { useTranslation } from '../services/i18n';

interface SkeletonProps {
    className?: string;
    variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
    height?: string | number;
    width?: string | number;
    style?: React.CSSProperties; // Allow custom styles overrides safely
    count?: number;
}

// -----------------------------------------------------------------------------
// 1. CONSTANTS & STYLES
// -----------------------------------------------------------------------------

const STYLES = {
    BASE: "relative overflow-hidden bg-slate-200/50 dark:bg-[var(--bg-surface)]/5 backdrop-blur-sm",
    SHIMMER: "after:absolute after:inset-0 after:-translate-x-full after:animate-[shimmer_1.5s_infinite] after:bg-gradient-to-r after:from-transparent after:via-white/60 dark:after:via-white/10 after:to-transparent",
    VARIANTS: {
        text: "rounded-lg",
        circular: "rounded-full",
        rectangular: "rounded-none",
        rounded: "rounded-xl"
    },
    CARD_CONTAINER: "p-6 md:p-8 rounded-[24px] border border-white/20 dark:border-white/5 bg-[var(--bg-surface)]/40 dark:bg-[var(--bg-surface)]/5 shadow-sm h-[240px] flex flex-col"
};

// -----------------------------------------------------------------------------
// 2. ATOMIC COMPONENT
// -----------------------------------------------------------------------------

export const Skeleton: React.FC<SkeletonProps> = memo(({ 
    className = "", 
    variant = 'rounded', 
    height, 
    width,
    style,
    count = 1
}) => {
    const { t } = useTranslation();
    
    const combinedStyle: React.CSSProperties = useMemo(() => ({
        height,
        width,
        ...style
    }), [height, width, style]);

    if (count === 1) {
        return (
            <div 
                className={`${STYLES.BASE} ${STYLES.SHIMMER} ${STYLES.VARIANTS[variant]} ${className}`} 
                style={combinedStyle}
                role="status"
                aria-label={t('common.loading')}
                aria-busy="true"
            />
        );
    }

    return (
        <>
            {Array.from({ length: count }).map((_, i) => (
                <div 
                    key={i}
                    className={`${STYLES.BASE} ${STYLES.SHIMMER} ${STYLES.VARIANTS[variant]} ${className}`} 
                    style={combinedStyle}
                    role="status"
                    aria-label={t('common.loading')}
                    aria-busy="true"
                />
            ))}
        </>
    );
});

Skeleton.displayName = 'Skeleton';

// -----------------------------------------------------------------------------
// 3. DASHBOARD SKELETON (Configuration Driven)
// -----------------------------------------------------------------------------

const GRID_CONFIG = [
    { id: 'stats_1', span: 'col-span-1', type: 'STATS' },
    { id: 'stats_2', span: 'col-span-1', type: 'STATS' },
    { id: 'chart_main', span: 'col-span-1 sm:col-span-2 xl:col-span-2 xl:row-span-2 min-h-[300px]', type: 'CHART' },
    { id: 'list_1', span: 'col-span-1', type: 'LIST' },
    { id: 'list_2', span: 'col-span-1', type: 'LIST_AVATAR' },
] as const;

export const DashboardSkeleton: React.FC = memo(() => {
    
    // Render helpers to keep JSX clean
    const renderContent = (type: string) => {
        switch (type) {
            case 'STATS':
                return (
                    <>
                        <div className="flex justify-between mb-6">
                            <Skeleton width="40%" height={16} variant="text" />
                            <Skeleton width={32} height={32} variant="circular" />
                        </div>
                        <Skeleton width="60%" height={40} className="mb-2" />
                        <Skeleton width="30%" height={12} variant="text" />
                    </>
                );
            case 'CHART':
                return (
                    <>
                        <div className="flex justify-between mb-6">
                            <Skeleton width="30%" height={24} variant="text" />
                            <Skeleton width={32} height={32} variant="rounded" />
                        </div>
                        <div className="flex-1 flex items-end gap-3 mt-4 px-2">
                            {Array.from({ length: 8 }).map((_, i) => (
                                <Skeleton 
                                    key={i} 
                                    className="flex-1 rounded-t-lg opacity-60" 
                                    height={`${Math.floor(Math.random() * 50 + 30)}%`} 
                                />
                            ))}
                        </div>
                    </>
                );
            case 'LIST':
            case 'LIST_AVATAR':
                return (
                    <>
                        <div className="flex justify-between mb-4">
                            <Skeleton width="50%" height={16} variant="text" />
                            <Skeleton width={32} height={32} variant="rounded" />
                        </div>
                        <div className="space-y-3 mt-auto">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="flex gap-3">
                                    {type === 'LIST_AVATAR' && <Skeleton width={40} height={40} variant="circular" />}
                                    <div className="flex-1 space-y-2 py-1">
                                        <Skeleton width="70%" height={12} variant="text" />
                                        <Skeleton width={type === 'LIST_AVATAR' ? '40%' : '100%'} height={12} variant="text" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                );
            default: return null;
        }
    };

    return (
        <div className="space-y-6 pb-12 animate-enter">
            {/* Filter Bar */}
            <div className="flex justify-end gap-4 h-10">
                <Skeleton width={120} height="100%" className="rounded-xl" />
                <Skeleton width={40} height="100%" className="rounded-xl" />
            </div>

            {/* Bento Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
                {GRID_CONFIG.map((item) => (
                    <div key={item.id} className={`${STYLES.CARD_CONTAINER} ${item.span}`}>
                        {renderContent(item.type)}
                    </div>
                ))}
            </div>
        </div>
    );
});

DashboardSkeleton.displayName = 'DashboardSkeleton';
