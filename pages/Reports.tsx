
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

        const onMouseDown = (e: MouseEvent) => {
            // Ignore inputs
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
            if (Math.abs(walk) > 5) {
                dragged = true;
            }
            node.scrollLeft = scrollLeft - walk;
        };

        const onClick = (e: MouseEvent) => {
            if (dragged) {
                e.preventDefault();
                e.stopPropagation();
            }
        };

        node.addEventListener('mousedown', onMouseDown);
        node.addEventListener('mouseleave', onMouseLeave);
        node.addEventListener('mouseup', onMouseUp);
        node.addEventListener('mousemove', onMouseMove);
        node.addEventListener('click', onClick, true); // Use capture phase

        node.classList.add('cursor-grab');

        return () => {
            node.removeEventListener('mousedown', onMouseDown);
            node.removeEventListener('mouseleave', onMouseLeave);
            node.removeEventListener('mouseup', onMouseUp);
            node.removeEventListener('mousemove', onMouseMove);
            node.removeEventListener('click', onClick, true);
            node.classList.remove('cursor-grab', 'cursor-grabbing', 'select-none');
        };
    }, [ref, trigger]);
};

const EmptyChartState = ({ t, message }: { t: any, message: string }) => (
    <div className="flex flex-col items-center justify-center h-full text-slate-400">
        <svg className="w-12 h-12 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
        <p className="text-xs font-medium">{message}</p>
    </div>
);

const CustomTooltip = memo(({ active, payload, label, formatCurrency, theme }: any) => {
    // Safety check: Ensure theme colors exist and payload is a valid array
    if (active && Array.isArray(payload) && payload.length && theme && theme.colors) {
        return (
            <div className="p-3 rounded-xl border shadow-xl text-xs backdrop-blur-md transition-all z-50" 
                 style={{ backgroundColor: theme.colors.tooltipBg, borderColor: theme.colors.grid }}>
                <p className="font-bold mb-2 text-slate-800 dark:text-white">{label}</p>
                {payload.map((p: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }}></div>
                        <span className="capitalize text-slate-500 dark:text-slate-400">{p.name}:</span>
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
    const hasTrend = data.conversionByPeriod.length > 0;
    const colors = chartTheme?.colors || {};

    const totalRevenue = data.attribution.reduce((acc, curr) => acc + curr.revenue, 0);
    const totalSpend = data.attribution.reduce((acc, curr) => acc + curr.spend, 0);
    const totalLeads = data.attribution.reduce((acc, curr) => acc + curr.leads, 0);
    const avgRoi = data.attribution.length > 0
        ? data.attribution.reduce((acc, curr) => acc + curr.roi, 0) / data.attribution.length
        : 0;

    return (
        <div className="space-y-6 animate-enter">
            {/* KPI Summary Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: t('reports.metric_revenue'), value: formatCurrency(totalRevenue), color: 'emerald', icon: '↑' },
                    { label: t('reports.metric_spend'), value: formatCurrency(totalSpend), color: 'rose', icon: '↑' },
                    { label: t('reports.table_leads'), value: totalLeads.toLocaleString(), color: 'indigo', icon: '↑' },
                    { label: t('reports.metric_roi'), value: `${avgRoi > 0 ? '+' : ''}${avgRoi.toFixed(1)}%`, color: avgRoi >= 0 ? 'emerald' : 'rose', icon: avgRoi >= 0 ? '↑' : '↓' },
                ].map(({ label, value, color, icon }) => (
                    <div key={label} className="bg-white p-5 rounded-[20px] border border-slate-100 shadow-sm relative overflow-hidden group">
                        <div className={`absolute top-0 right-0 w-20 h-20 bg-${color}-50 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none`}></div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 relative z-10">{label}</div>
                        <div className="text-2xl font-extrabold text-slate-800 tracking-tight relative z-10">{value}</div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Channel Revenue + ROI Chart */}
                <div className="lg:col-span-2 bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm h-[380px] flex flex-col relative">
                    <h3 className="font-bold text-slate-800 mb-6">{t('reports.chart_source_mix')}</h3>
                    <div className="flex-1 w-full min-h-[250px] relative">
                        {hasData ? (
                            <ResponsiveContainer width="100%" height="100%" minHeight={250} minWidth={250}>
                                <ComposedChart data={data.attribution} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={colors.grid} />
                                    <XAxis 
                                        dataKey="channel" 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{fill: colors.text, fontSize: 11}}
                                        tickFormatter={(val) => t(`source.${val}`)}
                                    />
                                    <YAxis 
                                        yAxisId="left"
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{fill: colors.text, fontSize: 11}}
                                        tickFormatter={(val) => formatCompactNumber(val)}
                                    />
                                    <YAxis 
                                        yAxisId="right"
                                        orientation="right"
                                        axisLine={false} 
                                        tickLine={false} 
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
                            <EmptyChartState t={t} message={t('common.no_results')} />
                        )}
                    </div>
                </div>

                {/* Conversion Trend Chart */}
                <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm h-[380px] flex flex-col relative">
                    <h3 className="font-bold text-slate-800 mb-1">{t('reports.chart_conversion_trend') || 'Xu hướng chuyển đổi'}</h3>
                    <p className="text-[11px] text-slate-400 mb-4">{t('reports.chart_conversion_desc') || 'Tỷ lệ chốt deal theo tháng'}</p>
                    <div className="flex-1 w-full min-h-[200px] relative">
                        {hasTrend ? (
                            <ResponsiveContainer width="100%" height="100%" minHeight={200}>
                                <AreaChart data={data.conversionByPeriod} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                                        tick={{fill: colors.text, fontSize: 10}}
                                    />
                                    <YAxis 
                                        axisLine={false} 
                                        tickLine={false} 
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
                                                            <span className="text-slate-400">{t('reports.metric_conversion') || 'Tỷ lệ'}:</span>
                                                            <span className="font-mono text-emerald-400">{payload[0].value}%</span>
                                                        </div>
                                                        <div className="flex gap-3">
                                                            <span className="text-slate-400">Won:</span>
                                                            <span className="font-mono">{payload[0].payload.won}/{payload[0].payload.total}</span>
                                                        </div>
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
                            <EmptyChartState t={t} message={t('common.no_results')} />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
});

const FunnelTab = memo(({ data, t, chartTheme }: { data: BiData, t: any, chartTheme: any }) => {
    const hasData = data.funnel.length > 0;
    const colors = chartTheme?.colors || {}; // Safety fallback

    return (
        <div className="space-y-6 animate-enter">
            <div className="bg-white p-6 md:p-8 rounded-[24px] border border-slate-100 shadow-sm h-[500px] flex flex-col relative">
                <h3 className="font-bold text-slate-800 mb-2">{t('reports.chart_funnel')}</h3>
                <p className="text-xs text-slate-500 mb-6">{t('reports.funnel_desc')}</p>
                
                <div className="flex-1 w-full min-h-[300px] relative">
                    {hasData ? (
                        <ResponsiveContainer width="100%" height="100%" minHeight={300} minWidth={300}>
                            <AreaChart 
                                layout="vertical" 
                                data={data.funnel} 
                                margin={{ top: 10, right: 30, left: 40, bottom: 0 }}
                            >
                                <defs>
                                    <linearGradient id="colorFunnel" x1="0" y1="0" x2="1" y2="0">
                                        <stop offset="5%" stopColor={colors.primary} stopOpacity={0.8}/>
                                        <stop offset="95%" stopColor={colors.secondary} stopOpacity={0.4}/>
                                    </linearGradient>
                                </defs>
                                <XAxis type="number" hide />
                                <YAxis 
                                    dataKey="stage" 
                                    type="category" 
                                    axisLine={false} 
                                    tickLine={false}
                                    width={120}
                                    tick={{fill: colors.text, fontSize: 11, fontWeight: 600}}
                                    tickFormatter={(val) => t(`stage.${val}`)}
                                />
                                <Tooltip 
                                    cursor={{fill: 'transparent'}}
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            const d = payload[0].payload;
                                            return (
                                                <div className="bg-slate-900 text-white p-3 rounded-xl text-xs shadow-xl border border-white/10">
                                                    <div className="font-bold mb-1">{t(`stage.${d.stage}`)}</div>
                                                    <div className="flex justify-between gap-4">
                                                        <span className="opacity-70">{t('reports.metric_count') || 'Count'}:</span>
                                                        <span className="font-mono">{d.count}</span>
                                                    </div>
                                                    <div className="flex justify-between gap-4">
                                                        <span className="opacity-70">{t('reports.metric_conversion') || 'Conversion'}:</span>
                                                        <span className="font-mono text-emerald-400">{d.conversionRate}%</span>
                                                    </div>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Area 
                                    type="monotone" 
                                    dataKey="count" 
                                    stroke={colors.primary} 
                                    fill="url(#colorFunnel)" 
                                    activeDot={{r: 6, fill: '#fff', stroke: colors.primary, strokeWidth: 2}}
                                    animationDuration={1500}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <EmptyChartState t={t} message={t('common.no_results')} />
                    )}
                </div>
            </div>
        </div>
    );
});

const RoiTab = memo(({ data, t, formatCurrency }: { data: BiData, t: any, formatCurrency: any }) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    useDraggableScroll(scrollRef);

    return (
    <div className="space-y-6 animate-enter">
        <div className="bg-white p-0 md:p-2 rounded-[24px] border border-slate-100 shadow-sm overflow-hidden">
            <div ref={scrollRef} className="overflow-x-auto no-scrollbar overscroll-contain">
                <table className="min-w-[800px] md:min-w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase tracking-wider sticky top-0 z-10">
                        <tr>
                            <th className="p-5">{t('reports.table_channel')}</th>
                            <th className="p-5 text-right">{t('reports.table_spend')}</th>
                            <th className="p-5 text-right">{t('reports.table_leads')}</th>
                            <th className="p-5 text-right">{t('reports.table_cac')}</th>
                            <th className="p-5 text-right">{t('reports.table_revenue')}</th>
                            <th className="p-5 text-right">{t('reports.table_roi')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {data.attribution.length === 0 && (
                            <tr><td colSpan={6} className="p-10 text-center text-slate-400">{t('common.no_results')}</td></tr>
                        )}
                        {data.attribution.map(row => (
                            <tr key={row.channel} className="hover:bg-slate-50 transition-colors group">
                                <td className="p-5 font-bold text-slate-800">
                                    <span className="bg-slate-100 px-2 py-1 rounded text-xs border border-slate-200 group-hover:bg-white transition-colors">
                                        {t(`source.${row.channel}`) !== `source.${row.channel}` ? t(`source.${row.channel}`) : row.channel}
                                    </span>
                                </td>
                                <td className="p-5 text-right font-mono text-slate-600">{formatCurrency(row.spend)}</td>
                                <td className="p-5 text-right font-bold text-slate-700">{row.leads}</td>
                                <td className="p-5 text-right font-mono text-slate-600">{formatCurrency(row.cac)}</td>
                                <td className="p-5 text-right font-mono font-bold text-indigo-600">{formatCurrency(row.revenue)}</td>
                                <td className="p-5 text-right">
                                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${row.roi >= 0 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                                        {(row.roi > 0 ? '+' : '')}{(row.roi || 0).toFixed(1)}%
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
    );
});

const CostsTab = memo(({ data, t, formatCurrency, currentUser, onCostUpdated }: { data: BiData, t: any, formatCurrency: any, currentUser: any, onCostUpdated: () => void }) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    useDraggableScroll(scrollRef);
    const [isUpdating, setIsUpdating] = useState(false);
    const [editingCost, setEditingCost] = useState<CampaignCost | null>(null);
    const [newCostValue, setNewCostValue] = useState('');

    const canUpdateCosts = currentUser?.role === 'ADMIN' || currentUser?.role === 'TEAM_LEAD';

    const handleUpdate = async () => {
        if (!editingCost) return;
        try {
            await db.updateCampaignCost(editingCost.id, Number(newCostValue));
            setIsUpdating(false);
            setEditingCost(null);
            onCostUpdated();
        } catch (error) {
            console.error('Failed to update cost', error);
        }
    };

    return (
    <div className="space-y-6 animate-enter">
        <div className="bg-white p-0 md:p-2 rounded-[24px] border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-white">
                <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">{t('reports.cost_history')}</h3>
            </div>
            
            <div ref={scrollRef} className="overflow-x-auto no-scrollbar overscroll-contain">
                <table className="min-w-[600px] md:min-w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase tracking-wider">
                        <tr>
                            <th className="p-5">{t('reports.cost_source')}</th>
                            <th className="p-5">{t('reports.cost_month')}</th>
                            <th className="p-5 text-right">{t('reports.cost_amount')}</th>
                            <th className="p-5 text-right">{t('reports.cost_user')}</th>
                            {canUpdateCosts && <th className="p-5 text-right"></th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {data.campaignCosts.length === 0 ? (
                            <tr><td colSpan={canUpdateCosts ? 5 : 4} className="p-10 text-center text-slate-400 italic">{t('reports.empty_costs')}</td></tr>
                        ) : (
                            data.campaignCosts.map((cost) => (
                                <tr key={cost.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-5 font-bold text-slate-700">{cost.source}</td>
                                    <td className="p-5 font-mono text-xs text-slate-500">{cost.period}</td>
                                    <td className="p-5 text-right font-mono font-bold text-slate-800">{formatCurrency(cost.cost)}</td>
                                    <td className="p-5 text-right text-xs">
                                        <span className="bg-slate-100 text-slate-500 px-2 py-1 rounded border border-slate-200">{cost.campaignName}</span>
                                    </td>
                                    {canUpdateCosts && (
                                        <td className="p-5 text-right">
                                            <button 
                                                onClick={() => { setEditingCost(cost); setNewCostValue(cost.cost.toString()); setIsUpdating(true); }}
                                                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                                            >
                                                {t('reports.btn_update')}
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>

        {/* Update Cost Modal */}
        {isUpdating && editingCost && createPortal(
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-enter">
                <div className="bg-white w-full max-w-sm rounded-[24px] p-6 shadow-2xl border border-slate-100 scale-100 animate-scale-up">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">{t('reports.btn_update')} - {editingCost.source}</h3>
                    <div className="mb-6">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{t('reports.cost_amount')}</label>
                        <input 
                            type="number" 
                            value={newCostValue}
                            onChange={(e) => setNewCostValue(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                        />
                    </div>
                    <div className="flex gap-3 w-full">
                        <button onClick={() => { setIsUpdating(false); setEditingCost(null); }} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl text-sm hover:bg-slate-200 transition-colors">
                            {t('common.cancel')}
                        </button>
                        <button onClick={handleUpdate} className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl text-sm shadow-lg hover:bg-indigo-700 transition-all">
                            {t('common.save')}
                        </button>
                    </div>
                </div>
            </div>,
            document.body
        )}
    </div>
    );
});

// -----------------------------------------------------------------------------
// 4. MAIN COMPONENT
// -----------------------------------------------------------------------------

export const Reports: React.FC = () => {
    const [data, setData] = useState<BiData | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'FUNNEL' | 'ROI' | 'COSTS'>('ROI');
    const [currentUser, setCurrentUser] = useState<any>(null);
    
    // Get language for locale detection
    const { t, formatCurrency, formatCompactNumber, language } = useTranslation();
    const { chartTheme } = useTheme();

    const locale = language === 'vn' ? 'vi-VN' : 'en-US';

    const loadData = useCallback(() => {
        let mounted = true;
        setLoading(true);
        
        Promise.all([
            db.generateBiMarts(),
            db.getCurrentUser()
        ]).then(([res, user]) => {
            if (!mounted) return;
            // Clean handling of potential nulls from backend
            const safeData: BiData = {
                funnel: res.funnel || [], 
                attribution: res.attribution || [],
                campaignCosts: res.campaignCosts || [],
                conversionByPeriod: res.conversionByPeriod || [],
            };
            setData(safeData);
            setCurrentUser(user);
            setLoading(false);
        }).catch(err => {
            console.error("Failed to load reports", err);
            if(mounted) setLoading(false);
        });
        return () => { mounted = false; };
    }, []);

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

    if (loading) return <div className="p-10 text-center text-slate-400 font-mono animate-pulse">{t('common.loading')}</div>;
    if (!data) return null;

    return (
        <div className="space-y-6 pb-20 relative animate-enter">
            {/* Tab Navigation */}
            <div className="flex flex-col lg:flex-row justify-end items-start lg:items-center bg-white p-4 sm:p-6 rounded-[24px] border border-slate-100 shadow-sm gap-4 w-full overflow-hidden">
                {/* Mobile Dropdown */}
                <div className="w-full md:hidden">
                    <Dropdown 
                        value={activeTab}
                        onChange={(val) => setActiveTab(val as any)}
                        options={tabs.map(tab => ({ value: tab.id, label: tab.label }))}
                        className="w-full"
                    />
                </div>

                {/* Desktop Tabs */}
                <div ref={scrollRef} className="hidden md:flex bg-slate-100 p-1 rounded-xl flex-wrap gap-1 w-full lg:w-auto">
                    {tabs.map(tab => (
                        <button 
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap flex-1 lg:flex-none text-center ${
                                activeTab === tab.id 
                                ? 'bg-white shadow text-slate-800 ring-1 ring-black/5' 
                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div className="min-h-[500px]">
                {activeTab === 'OVERVIEW' && <OverviewTab data={data} t={t} formatCurrency={formatCurrency} formatCompactNumber={formatCompactNumber} chartTheme={chartTheme} locale={locale} />}
                {activeTab === 'FUNNEL' && <FunnelTab data={data} t={t} chartTheme={chartTheme} />} 
                {activeTab === 'ROI' && <RoiTab data={data} t={t} formatCurrency={formatCurrency} />}
                {activeTab === 'COSTS' && <CostsTab data={data} t={t} formatCurrency={formatCurrency} currentUser={currentUser} onCostUpdated={loadData} />}
            </div>
        </div>
    );
};
