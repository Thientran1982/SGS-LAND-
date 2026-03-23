
import React, { useEffect, useState, useMemo, memo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    ComposedChart, Line, Area, AreaChart
} from 'recharts';
import { db } from '../services/dbApi';
import { useTranslation } from '../services/i18n';
import { useTheme } from '../services/theme';
import { CampaignCost } from '../types';
import { Dropdown } from '../components/Dropdown';

// -----------------------------------------------------------------------------
// 1. TYPES & INTERFACES
// -----------------------------------------------------------------------------
interface AttributionData {
    channel: string;
    spend: number;
    leads: number;
    revenue: number;
    cac: number;
    roi: number;
}

interface FunnelStep {
    stage: string;
    count: number;
    conversionRate: number;
}

interface ConversionPeriod {
    period: string;
    won: number;
    total: number;
    conversionRate: number;
}

interface BiData {
    funnel: FunnelStep[];
    attribution: AttributionData[];
    campaignCosts: CampaignCost[];
    conversionByPeriod: ConversionPeriod[];
}

// -----------------------------------------------------------------------------
// 2. HELPER COMPONENTS
// -----------------------------------------------------------------------------

const useDraggableScroll = (ref: React.RefObject<HTMLDivElement>, trigger?: any) => {
    useEffect(() => {
        const node = ref.current;
        if (!node) return;

        let isDown = false;
        let startX = 0;
        let scrollLeft = 0;
        let dragged = false;

        // --- Mouse events ---
        const onMouseDown = (e: MouseEvent) => {
            if ((e.target as HTMLElement).closest('input, textarea')) return;
            isDown = true;
            dragged = false;
            node.classList.add('cursor-grabbing', 'select-none');
            node.classList.remove('cursor-grab', 'snap-x');
            startX = e.pageX - node.offsetLeft;
            scrollLeft = node.scrollLeft;
        };
        const onMouseLeave = () => {
            if (!isDown) return;
            isDown = false;
            node.classList.remove('cursor-grabbing', 'select-none');
            node.classList.add('cursor-grab', 'snap-x');
        };
        const onMouseUp = () => {
            if (!isDown) return;
            isDown = false;
            node.classList.remove('cursor-grabbing', 'select-none');
            node.classList.add('cursor-grab', 'snap-x');
        };
        const onMouseMove = (e: MouseEvent) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - node.offsetLeft;
            const walk = (x - startX) * 2;
            if (Math.abs(walk) > 5) dragged = true;
            node.scrollLeft = scrollLeft - walk;
        };
        const onClick = (e: MouseEvent) => {
            if (dragged) { e.preventDefault(); e.stopPropagation(); }
        };

        // --- Touch events (mobile) ---
        let touchStartX = 0;
        let touchScrollLeft = 0;
        const onTouchStart = (e: TouchEvent) => {
            if ((e.target as HTMLElement).closest('input, textarea, button')) return;
            touchStartX = e.touches[0].pageX - node.offsetLeft;
            touchScrollLeft = node.scrollLeft;
        };
        const onTouchMove = (e: TouchEvent) => {
            const x = e.touches[0].pageX - node.offsetLeft;
            const walk = (x - touchStartX) * 1.5;
            if (Math.abs(walk) > 8) {
                node.scrollLeft = touchScrollLeft - walk;
            }
        };

        node.addEventListener('mousedown', onMouseDown);
        node.addEventListener('mouseleave', onMouseLeave);
        node.addEventListener('mouseup', onMouseUp);
        node.addEventListener('mousemove', onMouseMove);
        node.addEventListener('click', onClick, true);
        node.addEventListener('touchstart', onTouchStart, { passive: true });
        node.addEventListener('touchmove', onTouchMove, { passive: true });
        node.classList.add('cursor-grab');

        return () => {
            node.removeEventListener('mousedown', onMouseDown);
            node.removeEventListener('mouseleave', onMouseLeave);
            node.removeEventListener('mouseup', onMouseUp);
            node.removeEventListener('mousemove', onMouseMove);
            node.removeEventListener('click', onClick, true);
            node.removeEventListener('touchstart', onTouchStart);
            node.removeEventListener('touchmove', onTouchMove);
            node.classList.remove('cursor-grab', 'cursor-grabbing', 'select-none');
        };
    }, [ref, trigger]);
};

const EmptyChartState = ({ t, message }: { t: any, message: string }) => (
    <div className="flex flex-col items-center justify-center h-full text-[var(--text-secondary)]">
        <svg className="w-12 h-12 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
        <p className="text-xs font-medium">{message}</p>
    </div>
);

const CustomTooltip = memo(({ active, payload, label, formatCurrency, theme }: any) => {
    if (active && Array.isArray(payload) && payload.length && theme && theme.colors) {
        return (
            <div className="p-3 rounded-xl border shadow-xl text-xs backdrop-blur-md transition-all z-50" 
                 style={{ backgroundColor: theme.colors.tooltipBg, borderColor: theme.colors.grid }}>
                <p className="font-bold mb-2 text-[var(--text-primary)] dark:text-white">{label}</p>
                {payload.map((p: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }}></div>
                        <span className="capitalize text-[var(--text-tertiary)] dark:text-slate-400">{p.name}:</span>
                        <span className="font-mono font-bold" style={{ color: p.color }}>
                            {typeof p.value === 'number' && p.value > 1000 ? formatCurrency(p.value) : p.value}
                        </span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
});

// -----------------------------------------------------------------------------
// 3. TAB COMPONENTS
// -----------------------------------------------------------------------------

const OverviewTab = memo(({ data, t, formatCurrency, formatCompactNumber, chartTheme, locale }: { data: BiData, t: any, formatCurrency: any, formatCompactNumber: any, chartTheme: any, locale: string }) => {
    const hasData = data.attribution.length > 0;
    // Fix: reverse conversionByPeriod so trend chart shows oldest → newest (left → right)
    const trendData = useMemo(() => [...data.conversionByPeriod].reverse(), [data.conversionByPeriod]);
    const hasTrend = trendData.length > 0;
    const colors = chartTheme?.colors || {};

    const totalRevenue = data.attribution.reduce((acc, curr) => acc + curr.revenue, 0);
    const totalSpend = data.attribution.reduce((acc, curr) => acc + curr.spend, 0);
    const totalLeads = data.attribution.reduce((acc, curr) => acc + curr.leads, 0);
    const avgRoi = totalSpend > 0
        ? ((totalRevenue - totalSpend) / totalSpend) * 100
        : 0;

    return (
        <div className="space-y-6 animate-enter">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {[
                    { label: t('reports.metric_revenue'), value: formatCurrency(totalRevenue), color: 'emerald' },
                    { label: t('reports.metric_spend'), value: formatCurrency(totalSpend), color: 'rose' },
                    { label: t('reports.table_leads'), value: totalLeads.toLocaleString(), color: 'indigo' },
                    { label: t('reports.metric_roi'), value: `${avgRoi > 0 ? '+' : ''}${avgRoi.toFixed(1)}%`, color: avgRoi >= 0 ? 'emerald' : 'rose' },
                ].map(({ label, value, color }) => (
                    <div key={label} className="bg-[var(--bg-surface)] p-4 sm:p-5 rounded-[20px] border border-[var(--glass-border)] shadow-sm relative overflow-hidden group min-w-0">
                        <div className={`absolute top-0 right-0 w-20 h-20 bg-${color}-50 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none`}></div>
                        <div className="text-2xs sm:text-xs2 font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1.5 relative z-10 truncate">{label}</div>
                        <div className="text-sm sm:text-base xl:text-xl font-extrabold text-[var(--text-primary)] tracking-tight relative z-10 truncate" title={value}>{value}</div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-[var(--bg-surface)] p-4 sm:p-6 rounded-[24px] border border-[var(--glass-border)] shadow-sm">
                    <h3 className="font-bold text-[var(--text-primary)] mb-3 sm:mb-4 text-sm sm:text-base">{t('reports.chart_source_mix')}</h3>
                    <div style={{ width: '100%', height: 260 }}>
                        {hasData ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={data.attribution} margin={{ top: 8, right: 48, bottom: 36, left: 8 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={colors.grid} />
                                    <XAxis 
                                        dataKey="channel" 
                                        axisLine={false} 
                                        tickLine={false} 
                                        height={36}
                                        tick={{fill: colors.text, fontSize: 11}}
                                        tickFormatter={(val) => t(`source.${val}`)}
                                    />
                                    <YAxis 
                                        yAxisId="left"
                                        axisLine={false} 
                                        tickLine={false} 
                                        width={62}
                                        tick={{fill: colors.text, fontSize: 11}}
                                        tickFormatter={(val) => formatCompactNumber(val)}
                                    />
                                    <YAxis 
                                        yAxisId="right"
                                        orientation="right"
                                        axisLine={false} 
                                        tickLine={false} 
                                        width={44}
                                        tick={{fill: colors.text, fontSize: 11}}
                                        unit="%"
                                    />
                                    <Tooltip content={<CustomTooltip formatCurrency={formatCurrency} theme={chartTheme} />} cursor={{ fill: 'transparent' }} />
                                    <Bar 
                                        yAxisId="left"
                                        dataKey="revenue" 
                                        name={t('reports.metric_revenue')} 
                                        fill={colors.primary} 
                                        radius={[4, 4, 0, 0]} 
                                        barSize={32}
                                        animationDuration={1000}
                                    />
                                    <Line 
                                        yAxisId="right"
                                        type="monotone" 
                                        dataKey="roi" 
                                        name={t('reports.metric_roi')} 
                                        stroke={colors.success} 
                                        strokeWidth={3}
                                        dot={{r: 4, strokeWidth: 2, fill: '#fff'}}
                                        animationDuration={1500}
                                    />
                                </ComposedChart>
                            </ResponsiveContainer>
                        ) : (
                            <div style={{ height: 200 }}><EmptyChartState t={t} message={t('common.no_results')} /></div>
                        )}
                    </div>
                </div>

                <div className="bg-[var(--bg-surface)] p-4 sm:p-6 rounded-[24px] border border-[var(--glass-border)] shadow-sm">
                    <h3 className="font-bold text-[var(--text-primary)] mb-0.5 text-sm sm:text-base">{t('reports.chart_conversion_trend')}</h3>
                    <p className="text-xs2 sm:text-xs3 text-[var(--text-secondary)] mb-2 sm:mb-3">{t('reports.chart_conversion_desc')}</p>
                    <div style={{ width: '100%', height: 260 }}>
                        {hasTrend ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={trendData} margin={{ top: 8, right: 16, left: 4, bottom: 36 }}>
                                    <defs>
                                        <linearGradient id="convGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={colors.primary} stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor={colors.primary} stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={colors.grid} />
                                    <XAxis 
                                        dataKey="period" 
                                        axisLine={false} 
                                        tickLine={false} 
                                        height={36}
                                        tick={{fill: colors.text, fontSize: 10}}
                                    />
                                    <YAxis 
                                        axisLine={false} 
                                        tickLine={false} 
                                        width={40}
                                        tick={{fill: colors.text, fontSize: 10}}
                                        unit="%"
                                        domain={[0, 100]}
                                    />
                                    <Tooltip 
                                        cursor={{stroke: colors.grid, strokeWidth: 1}}
                                        content={({ active, payload, label }) => {
                                            if (active && payload && payload.length) {
                                                return (
                                                    <div className="bg-slate-900 text-white p-2.5 rounded-xl text-xs shadow-xl border border-white/10">
                                                        <div className="font-bold mb-1">{label}</div>
                                                        <div className="flex gap-3">
                                                            <span className="text-[var(--text-secondary)]">{t('reports.metric_conversion')}:</span>
                                                            <span className="font-mono text-emerald-400">{payload[0].value}%</span>
                                                        </div>
                                                        <div className="flex gap-3">
                                                            <span className="text-[var(--text-secondary)]">{t('reports.won')}:</span>
                                                            <span className="font-mono text-emerald-400">{payload[0].payload.won}/{payload[0].payload.total}</span>
                                                        </div>
                                                        {payload[0].payload.lost > 0 && (
                                                            <div className="flex gap-3">
                                                                <span className="text-[var(--text-secondary)]">{t('reports.lost')}:</span>
                                                                <span className="font-mono text-rose-400">{payload[0].payload.lost}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Area 
                                        type="monotone" 
                                        dataKey="conversionRate" 
                                        stroke={colors.primary} 
                                        fill="url(#convGradient)"
                                        strokeWidth={2.5}
                                        dot={{r: 3, fill: '#fff', stroke: colors.primary, strokeWidth: 2}}
                                        activeDot={{r: 5}}
                                        animationDuration={1500}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div style={{ height: 200 }}><EmptyChartState t={t} message={t('common.no_results')} /></div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
});

const FUNNEL_COLORS = ['#6366f1', '#818cf8', '#a5b4fc', '#7c3aed', '#8b5cf6', '#4f46e5'];

const FunnelTab = memo(({ data, t, chartTheme }: { data: BiData, t: any, chartTheme: any }) => {
    const hasData = data.funnel.length > 0;
    const colors = chartTheme?.colors || {};

    const maxCount = hasData ? Math.max(...data.funnel.map(f => f.count)) : 1;
    const wonStage = data.funnel.find(f => f.stage === 'WON');
    const newStage = data.funnel.find(f => f.stage === 'NEW');
    const overallRate = newStage && newStage.count > 0 && wonStage
        ? ((wonStage.count / newStage.count) * 100).toFixed(1)
        : null;

    return (
        <div className="space-y-6 animate-enter">
            <div className="bg-[var(--bg-surface)] p-6 md:p-8 rounded-[24px] border border-[var(--glass-border)] shadow-sm flex flex-col relative">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
                    <div>
                        <h3 className="font-bold text-[var(--text-primary)] mb-1">{t('reports.chart_funnel')}</h3>
                        <p className="text-xs text-[var(--text-tertiary)]">{t('reports.funnel_desc')}</p>
                        <p className="text-xs2 text-[var(--text-secondary)] mt-0.5">{t('reports.funnel_rate_note')}</p>
                    </div>
                    {overallRate !== null && (
                        <div className="flex-shrink-0 bg-emerald-50 border border-emerald-100 rounded-[14px] px-4 py-2 text-center">
                            <div className="text-xs2 font-bold text-emerald-600 uppercase tracking-wider">{t('reports.funnel_overall_rate')}</div>
                            <div className="text-2xl font-extrabold text-emerald-700">{overallRate}%</div>
                        </div>
                    )}
                </div>

                {hasData ? (
                    <div className="space-y-2">
                        {data.funnel.map((step, idx) => {
                            const barPct = maxCount > 0 ? (step.count / maxCount) * 100 : 0;
                            const color = FUNNEL_COLORS[idx % FUNNEL_COLORS.length];
                            return (
                                <div key={step.stage} className="flex items-center gap-2 sm:gap-3 group">
                                    <div className="w-16 sm:w-28 md:w-36 flex-shrink-0 text-right">
                                        <span className="text-xs2 sm:text-xs font-bold text-[var(--text-secondary)] leading-tight">{t(`stage.${step.stage}`)}</span>
                                    </div>
                                    <div className="flex-1 relative h-8 sm:h-9 bg-[var(--glass-surface)] rounded-lg overflow-hidden border border-[var(--glass-border)]">
                                        <div
                                            className="h-full rounded-lg transition-all duration-700 ease-out"
                                            style={{ width: `${barPct}%`, backgroundColor: color, opacity: 0.85 }}
                                        />
                                    </div>
                                    <div className="w-16 sm:w-28 md:w-36 flex-shrink-0 flex items-center gap-1 sm:gap-2">
                                        <span className="text-xs sm:text-sm font-extrabold text-[var(--text-primary)]">{step.count.toLocaleString()}</span>
                                        <span className="hidden sm:inline text-xs2 text-[var(--text-secondary)] font-medium">({step.conversionRate}%)</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="h-[300px] flex items-center justify-center">
                        <EmptyChartState t={t} message={t('common.no_results')} />
                    </div>
                )}

                {hasData && (
                    <div className="mt-6 pt-4 border-t border-[var(--glass-border)] flex flex-wrap gap-3">
                        {data.funnel.map((step, idx) => (
                            <div key={step.stage} className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: FUNNEL_COLORS[idx % FUNNEL_COLORS.length] }} />
                                <span className="text-xs3 text-[var(--text-tertiary)]">{t(`stage.${step.stage}`)}: <strong className="text-[var(--text-secondary)]">{step.count}</strong></span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
});

const RoiTab = memo(({ data, t, formatCurrency }: { data: BiData, t: any, formatCurrency: any }) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    useDraggableScroll(scrollRef);

    // KPI summary computed from attribution data
    const totalRevenue = data.attribution.reduce((acc, r) => acc + r.revenue, 0);
    const totalSpend = data.attribution.reduce((acc, r) => acc + r.spend, 0);
    const totalLeads = data.attribution.reduce((acc, r) => acc + r.leads, 0);
    const overallRoi = totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : null;

    const roiDisplay = (row: AttributionData) => {
        // Fix: when spend = 0, ROI is meaningless — show N/A instead of 0%
        if (row.spend === 0) return <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[var(--glass-surface)] text-[var(--text-secondary)] border border-[var(--glass-border)]">{t('reports.roi_na')}</span>;
        return (
            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${row.roi >= 0 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                {row.roi > 0 ? '+' : ''}{row.roi.toFixed(1)}%
            </span>
        );
    };

    return (
    <div className="space-y-6 animate-enter">
        {/* KPI Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {[
                { label: t('reports.metric_revenue'), value: formatCurrency(totalRevenue), color: 'emerald' },
                { label: t('reports.metric_spend'), value: formatCurrency(totalSpend), color: 'rose' },
                { label: t('reports.table_leads'), value: totalLeads.toLocaleString(), color: 'indigo' },
                { 
                    label: t('reports.metric_roi'), 
                    value: overallRoi !== null ? `${overallRoi > 0 ? '+' : ''}${overallRoi.toFixed(1)}%` : 'N/A',
                    color: overallRoi === null ? 'slate' : overallRoi >= 0 ? 'emerald' : 'rose'
                },
            ].map(({ label, value, color }) => (
                <div key={label} className="bg-[var(--bg-surface)] p-4 sm:p-5 rounded-[20px] border border-[var(--glass-border)] shadow-sm relative overflow-hidden group min-w-0">
                    <div className={`absolute top-0 right-0 w-20 h-20 bg-${color}-50 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none`}></div>
                    <div className="text-2xs sm:text-xs2 font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1.5 relative z-10 truncate">{label}</div>
                    <div className="text-sm sm:text-base xl:text-xl font-extrabold text-[var(--text-primary)] tracking-tight relative z-10 truncate" title={value}>{value}</div>
                </div>
            ))}
        </div>

        {/* Attribution Table */}
        <div className="bg-[var(--bg-surface)] p-0 md:p-2 rounded-[24px] border border-[var(--glass-border)] shadow-sm overflow-hidden">
            {data.attribution.length === 0 ? (
                <div className="p-10 flex flex-col items-center justify-center text-[var(--text-secondary)] gap-2">
                    <svg className="w-10 h-10 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                    <p className="text-xs font-medium">{t('common.no_results')}</p>
                </div>
            ) : (
                <div ref={scrollRef} className="overflow-x-auto no-scrollbar overscroll-contain">
                    <table className="min-w-[800px] md:min-w-full text-sm text-left">
                        <thead className="bg-[var(--glass-surface)] text-[var(--text-tertiary)] font-bold text-xs uppercase tracking-wider sticky top-0 z-10">
                            <tr>
                                <th className="p-5">{t('reports.table_channel')}</th>
                                <th className="p-5 text-right">{t('reports.table_spend')}</th>
                                <th className="p-5 text-right">{t('reports.table_leads')}</th>
                                <th className="p-5 text-right">{t('reports.table_cac')}</th>
                                <th className="p-5 text-right">{t('reports.table_revenue')}</th>
                                <th className="p-5 text-right">{t('reports.table_roi')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--glass-border)]">
                            {data.attribution.map(row => (
                                <tr key={row.channel} className="hover:bg-[var(--glass-surface)] transition-colors group">
                                    <td className="p-5 font-bold text-[var(--text-primary)]">
                                        <span className="bg-[var(--glass-surface-hover)] px-2 py-1 rounded text-xs border border-[var(--glass-border)] group-hover:bg-[var(--bg-surface)] transition-colors">
                                            {t(`source.${row.channel}`) !== `source.${row.channel}` ? t(`source.${row.channel}`) : row.channel}
                                        </span>
                                    </td>
                                    <td className="p-5 text-right font-mono text-[var(--text-secondary)]">
                                        {row.spend > 0 ? formatCurrency(row.spend) : <span className="text-[var(--text-secondary)]">—</span>}
                                    </td>
                                    <td className="p-5 text-right font-bold text-[var(--text-secondary)]">{row.leads}</td>
                                    <td className="p-5 text-right font-mono text-[var(--text-secondary)]">
                                        {row.cac > 0 ? formatCurrency(row.cac) : <span className="text-[var(--text-secondary)]">—</span>}
                                    </td>
                                    <td className="p-5 text-right font-mono font-bold text-indigo-600">{formatCurrency(row.revenue)}</td>
                                    <td className="p-5 text-right">{roiDisplay(row)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    </div>
    );
});

const CostsTab = memo(({ data, t, formatCurrency, currentUser, onCostUpdated, notify }: { data: BiData, t: any, formatCurrency: any, currentUser: any, onCostUpdated: () => void, notify: (msg: string, type?: 'success' | 'error') => void }) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    useDraggableScroll(scrollRef);
    const [showUpdateModal, setShowUpdateModal] = useState(false);
    const [editingCost, setEditingCost] = useState<CampaignCost | null>(null);
    const [newCostValue, setNewCostValue] = useState('');
    const [isSavingUpdate, setIsSavingUpdate] = useState(false);

    const [isAdding, setIsAdding] = useState(false);
    const [addForm, setAddForm] = useState({ campaignName: '', source: '', cost: '', period: new Date().toISOString().slice(0, 7) });
    const [isSaving, setIsSaving] = useState(false);

    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const canUpdateCosts = currentUser?.role === 'ADMIN' || currentUser?.role === 'TEAM_LEAD';

    const handleUpdate = async () => {
        if (!editingCost) return;
        const parsed = Number(newCostValue);
        if (!newCostValue || isNaN(parsed) || parsed < 0) {
            notify(t('reports.cost_amount_invalid'), 'error');
            return;
        }
        setIsSavingUpdate(true);
        try {
            await db.updateCampaignCost(editingCost.id, parsed);
            setShowUpdateModal(false);
            setEditingCost(null);
            notify(t('reports.cost_updated'), 'success');
            onCostUpdated();
        } catch (error: any) {
            notify(error?.message || t('common.error'), 'error');
        } finally {
            setIsSavingUpdate(false);
        }
    };

    const handleAdd = async () => {
        if (!addForm.source || !addForm.cost || !addForm.period) return;
        const parsedCost = Number(addForm.cost);
        if (isNaN(parsedCost) || parsedCost < 0) {
            notify(t('reports.cost_amount_invalid'), 'error');
            return;
        }
        setIsSaving(true);
        try {
            await db.createCampaignCost({
                campaignName: addForm.campaignName || addForm.source,
                source: addForm.source,
                cost: parsedCost,
                period: addForm.period,
            });
            setIsAdding(false);
            setAddForm({ campaignName: '', source: '', cost: '', period: new Date().toISOString().slice(0, 7) });
            notify(t('reports.cost_added'), 'success');
            onCostUpdated();
        } catch (error: any) {
            notify(error?.message || t('common.error'), 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deletingId) return;
        setIsDeleting(true);
        try {
            await db.deleteCampaignCost(deletingId);
            setDeletingId(null);
            notify(t('reports.cost_deleted'), 'success');
            onCostUpdated();
        } catch (error: any) {
            notify(error?.message || t('common.error'), 'error');
        } finally {
            setIsDeleting(false);
        }
    };

    return (
    <div className="space-y-6 animate-enter">
        <div className="bg-[var(--bg-surface)] p-0 md:p-2 rounded-[24px] border border-[var(--glass-border)] shadow-sm overflow-hidden">
            <div className="p-5 border-b border-[var(--glass-border)] flex justify-between items-center bg-[var(--bg-surface)]">
                <h3 className="font-bold text-[var(--text-primary)] text-sm uppercase tracking-wide">{t('reports.cost_history')}</h3>
                {canUpdateCosts && (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow hover:bg-indigo-700 transition-all"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                        {t('reports.btn_add_cost')}
                    </button>
                )}
            </div>
            
            {data.campaignCosts.length === 0 ? (
                <div className="p-10 flex flex-col items-center justify-center text-[var(--text-secondary)] gap-2">
                    <svg className="w-10 h-10 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                    <p className="text-xs font-medium italic">{t('reports.empty_costs')}</p>
                </div>
            ) : (
                <div ref={scrollRef} className="overflow-x-auto no-scrollbar overscroll-contain">
                    <table className="min-w-[700px] md:min-w-full text-sm text-left">
                        <thead className="bg-[var(--glass-surface)] text-[var(--text-tertiary)] font-bold text-xs uppercase tracking-wider">
                            <tr>
                                <th className="p-5">{t('reports.cost_source')}</th>
                                <th className="p-5">{t('reports.cost_campaign_name')}</th>
                                <th className="p-5">{t('reports.cost_month')}</th>
                                <th className="p-5 text-right">{t('reports.cost_amount')}</th>
                                {canUpdateCosts && <th className="p-5 text-right"></th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--glass-border)]">
                            {data.campaignCosts.map((cost) => (
                                <tr key={cost.id} className="hover:bg-[var(--glass-surface)] transition-colors group">
                                    <td className="p-5 font-bold text-[var(--text-secondary)]">{cost.source}</td>
                                    <td className="p-5 text-[var(--text-tertiary)] text-xs">
                                        <span className="bg-[var(--glass-surface-hover)] text-[var(--text-secondary)] px-2 py-1 rounded border border-[var(--glass-border)]">{cost.campaignName || '—'}</span>
                                    </td>
                                    <td className="p-5 font-mono text-xs text-[var(--text-tertiary)]">{cost.period}</td>
                                    <td className="p-5 text-right font-mono font-bold text-[var(--text-primary)]">{formatCurrency(cost.cost)}</td>
                                    {canUpdateCosts && (
                                        <td className="p-3 sm:p-5 text-right">
                                            <div className="flex items-center justify-end gap-2 sm:gap-3 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    onClick={() => { setEditingCost(cost); setNewCostValue(cost.cost.toString()); setShowUpdateModal(true); }}
                                                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors px-2 py-1 rounded-lg hover:bg-indigo-50"
                                                >
                                                    {t('reports.btn_update')}
                                                </button>
                                                <button 
                                                    onClick={() => setDeletingId(cost.id)}
                                                    className="text-xs font-bold text-rose-500 hover:text-rose-700 transition-colors px-2 py-1 rounded-lg hover:bg-rose-50"
                                                >
                                                    {t('common.delete')}
                                                </button>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>

        {/* Add Cost Modal */}
        {createPortal(
            isAdding ? <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-enter">
                <div className="bg-[var(--bg-surface)] w-full sm:max-w-sm rounded-t-[28px] sm:rounded-[24px] p-6 shadow-2xl border border-[var(--glass-border)] overflow-y-auto no-scrollbar max-h-[92dvh] sm:max-h-[90vh]">
                    <h3 className="text-lg font-bold text-[var(--text-primary)] mb-5">{t('reports.btn_add_cost')}</h3>
                    <div className="space-y-4 mb-6">
                        <div>
                            <label className="block text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5">{t('reports.cost_source')} *</label>
                            <input 
                                type="text"
                                value={addForm.source}
                                onChange={(e) => setAddForm(f => ({ ...f, source: e.target.value }))}
                                placeholder={t('reports.cost_source_placeholder')}
                                className="w-full px-4 py-3 bg-[var(--glass-surface)] border border-[var(--glass-border)] rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-[var(--bg-surface)] transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5">{t('reports.cost_campaign_name')}</label>
                            <input 
                                type="text"
                                value={addForm.campaignName}
                                onChange={(e) => setAddForm(f => ({ ...f, campaignName: e.target.value }))}
                                placeholder={t('reports.cost_campaign_placeholder')}
                                className="w-full px-4 py-3 bg-[var(--glass-surface)] border border-[var(--glass-border)] rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-[var(--bg-surface)] transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5">{t('reports.cost_month')} *</label>
                            <input 
                                type="month"
                                value={addForm.period}
                                onChange={(e) => setAddForm(f => ({ ...f, period: e.target.value }))}
                                className="w-full px-4 py-3 bg-[var(--glass-surface)] border border-[var(--glass-border)] rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-[var(--bg-surface)] transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5">{t('reports.cost_amount')} {t('reports.cost_currency')} *</label>
                            <input 
                                type="number"
                                value={addForm.cost}
                                onChange={(e) => setAddForm(f => ({ ...f, cost: e.target.value }))}
                                placeholder="0"
                                className="w-full px-4 py-3 bg-[var(--glass-surface)] border border-[var(--glass-border)] rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-[var(--bg-surface)] transition-all"
                            />
                        </div>
                    </div>
                    <div className="flex gap-3 w-full">
                        <button onClick={() => setIsAdding(false)} className="flex-1 py-3 bg-[var(--glass-surface-hover)] text-[var(--text-secondary)] font-bold rounded-xl text-sm hover:bg-slate-200 transition-colors">
                            {t('common.cancel')}
                        </button>
                        <button 
                            onClick={handleAdd} 
                            disabled={isSaving || !addForm.source || !addForm.cost}
                            className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl text-sm shadow-lg hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSaving ? '...' : t('common.save')}
                        </button>
                    </div>
                </div>
            </div> : null,
            document.body
        )}

        {/* Delete Confirm Modal */}
        {createPortal(
            deletingId ? <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-enter">
                <div className="bg-[var(--bg-surface)] w-full sm:max-w-sm rounded-t-[28px] sm:rounded-[24px] p-6 shadow-2xl border border-[var(--glass-border)]">
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-rose-50 mb-4 mx-auto">
                        <svg className="w-6 h-6 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </div>
                    <h3 className="text-base font-bold text-[var(--text-primary)] text-center mb-2">{t('reports.confirm_delete_cost')}</h3>
                    <p className="text-xs text-[var(--text-tertiary)] text-center mb-6">{t('reports.confirm_delete_cost_desc')}</p>
                    <div className="flex gap-3 w-full">
                        <button onClick={() => setDeletingId(null)} className="flex-1 py-3 bg-[var(--glass-surface-hover)] text-[var(--text-secondary)] font-bold rounded-xl text-sm hover:bg-slate-200 transition-colors">
                            {t('common.cancel')}
                        </button>
                        <button 
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="flex-1 py-3 bg-rose-500 text-white font-bold rounded-xl text-sm shadow hover:bg-rose-600 transition-all disabled:opacity-50"
                        >
                            {isDeleting ? '...' : t('common.delete')}
                        </button>
                    </div>
                </div>
            </div> : null,
            document.body
        )}

        {/* Update Cost Modal */}
        {createPortal(
            (showUpdateModal && editingCost) ? <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-enter">
                <div className="bg-[var(--bg-surface)] w-full sm:max-w-sm rounded-t-[28px] sm:rounded-[24px] p-6 shadow-2xl border border-[var(--glass-border)] scale-100 animate-scale-up">
                    <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">{t('reports.btn_update')}</h3>
                    <p className="text-xs text-[var(--text-secondary)] mb-5">{editingCost.source} · {editingCost.period}</p>
                    <div className="mb-6">
                        <label className="block text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-2">{t('reports.cost_amount')} {t('reports.cost_currency')}</label>
                        <input 
                            type="number" 
                            value={newCostValue}
                            onChange={(e) => setNewCostValue(e.target.value)}
                            className="w-full px-4 py-3 bg-[var(--glass-surface)] border border-[var(--glass-border)] rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-[var(--bg-surface)] transition-all"
                        />
                    </div>
                    <div className="flex gap-3 w-full">
                        <button onClick={() => { setShowUpdateModal(false); setEditingCost(null); }} disabled={isSavingUpdate} className="flex-1 py-3 bg-[var(--glass-surface-hover)] text-[var(--text-secondary)] font-bold rounded-xl text-sm hover:bg-slate-200 transition-colors disabled:opacity-50">
                            {t('common.cancel')}
                        </button>
                        <button onClick={handleUpdate} disabled={isSavingUpdate} className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl text-sm shadow-lg hover:bg-indigo-700 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                            {isSavingUpdate && <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                            {isSavingUpdate ? '...' : t('common.save')}
                        </button>
                    </div>
                </div>
            </div> : null,
            document.body
        )}
    </div>
    );
});

// -----------------------------------------------------------------------------
// 4. MAIN COMPONENT
// -----------------------------------------------------------------------------

const TIME_RANGE_VALUES = ['7', '30', '90', '365', 'all'];

export const Reports: React.FC = () => {
    const [data, setData] = useState<BiData | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'FUNNEL' | 'ROI' | 'COSTS'>('OVERVIEW');
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [timeRange, setTimeRange] = useState<string>('30');
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    
    const { t, formatCurrency, formatCompactNumber, language } = useTranslation();
    const { chartTheme } = useTheme();

    const locale = language === 'vn' ? 'vi-VN' : 'en-US';

    const notify = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    }, []);

    const loadData = useCallback(() => {
        let mounted = true;
        setLoading(true);
        
        Promise.all([
            db.generateBiMarts(timeRange),
            db.getCurrentUser()
        ]).then(([res, user]) => {
            if (!mounted) return;
            const safeData: BiData = {
                funnel: res.funnel || [], 
                attribution: res.attribution || [],
                campaignCosts: res.campaignCosts || [],
                conversionByPeriod: res.conversionByPeriod || [],
            };
            setData(safeData);
            setCurrentUser(user);
            setLoading(false);
        }).catch(() => {
            if (mounted) {
                notify(t('common.error_loading'), 'error');
                setLoading(false);
            }
        });
        return () => { mounted = false; };
    }, [timeRange]);

    useEffect(() => {
        const cleanup = loadData();
        return cleanup;
    }, [loadData]);

    const tabs = useMemo(() => [
        { id: 'OVERVIEW', label: t('reports.tab_overview') },
        { id: 'FUNNEL', label: t('reports.tab_funnel') },
        { id: 'ROI', label: t('reports.tab_roi') },
        { id: 'COSTS', label: t('reports.tab_costs') }
    ], [t]);

    const scrollRef = useRef<HTMLDivElement>(null);
    useDraggableScroll(scrollRef);

    if (loading) return <div className="p-10 text-center text-[var(--text-secondary)] font-mono animate-pulse">{t('common.loading')}</div>;
    if (!data) return null;

    return (
        <div className="p-4 sm:p-6 space-y-4 pb-20 relative animate-enter">
            {/* Header: single bar — Tabs (left) + Time Filter (right) on desktop; stacked on mobile */}
            <div className="bg-[var(--bg-surface)] px-4 sm:px-5 py-3 rounded-[24px] border border-[var(--glass-border)] shadow-sm">
                {/* Desktop: one row */}
                <div className="hidden md:flex items-center gap-3">
                    {/* Tabs */}
                    <div ref={scrollRef} className="flex bg-[var(--glass-surface-hover)] p-1 rounded-xl gap-1 flex-1 overflow-x-auto no-scrollbar">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap flex-1 text-center ${
                                    activeTab === tab.id
                                    ? 'bg-[var(--bg-surface)] shadow text-[var(--text-primary)] ring-1 ring-black/5'
                                    : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-slate-200/50'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    {/* Divider */}
                    <div className="w-px h-6 bg-slate-200 shrink-0" />
                    {/* Time filter */}
                    <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs2 font-bold text-[var(--text-secondary)] uppercase tracking-widest">{t('reports.period_label')}</span>
                        <div className="flex bg-[var(--glass-surface-hover)] p-0.5 rounded-xl gap-0.5">
                            {TIME_RANGE_VALUES.map(val => (
                                <button
                                    key={val}
                                    onClick={() => setTimeRange(val)}
                                    className={`px-2.5 py-1.5 text-xs3 font-bold rounded-[9px] transition-all whitespace-nowrap ${
                                        timeRange === val
                                        ? 'bg-[var(--bg-surface)] shadow text-[var(--text-primary)] ring-1 ring-black/5'
                                        : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                                    }`}
                                >
                                    {t(`reports.range_${val}`)}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
                {/* Mobile: stacked */}
                <div className="flex md:hidden flex-col gap-2.5">
                    <Dropdown
                        value={activeTab}
                        onChange={(val) => setActiveTab(val as any)}
                        options={tabs.map(tab => ({ value: tab.id, label: tab.label }))}
                        className="w-full"
                    />
                    <div className="flex bg-[var(--glass-surface-hover)] p-0.5 rounded-xl gap-0.5 overflow-x-auto no-scrollbar">
                        {TIME_RANGE_VALUES.map(val => (
                            <button
                                key={val}
                                onClick={() => setTimeRange(val)}
                                className={`px-3 py-1.5 text-xs font-bold rounded-[10px] transition-all whitespace-nowrap flex-1 ${
                                    timeRange === val
                                    ? 'bg-[var(--bg-surface)] shadow text-[var(--text-primary)] ring-1 ring-black/5'
                                    : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                                }`}
                            >
                                {t(`reports.range_${val}`)}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="min-h-[500px]">
                {activeTab === 'OVERVIEW' && <OverviewTab data={data} t={t} formatCurrency={formatCurrency} formatCompactNumber={formatCompactNumber} chartTheme={chartTheme} locale={locale} />}
                {activeTab === 'FUNNEL' && <FunnelTab data={data} t={t} chartTheme={chartTheme} />} 
                {activeTab === 'ROI' && <RoiTab data={data} t={t} formatCurrency={formatCurrency} />}
                {activeTab === 'COSTS' && <CostsTab data={data} t={t} formatCurrency={formatCurrency} currentUser={currentUser} onCostUpdated={loadData} notify={notify} />}
            </div>

            {createPortal(
                toast ? <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl text-sm font-bold transition-all animate-enter ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
                    {toast.type === 'success'
                        ? <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                        : <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                    }
                    {toast.msg}
                </div> : null,
                document.body
            )}
        </div>
    );
};
