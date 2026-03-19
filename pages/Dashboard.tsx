
import React, { useEffect, useState, memo, useMemo, useRef } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { 
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    BarChart, Bar, LineChart, Line, ComposedChart, Legend, ScatterChart, Scatter, ZAxis, Cell
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { db } from '../services/dbApi';
import { systemService } from '../services/systemService';
import { AnalyticsSummary } from '../types';
import { useTranslation } from '../services/i18n';
import { useTheme } from '../services/theme';
import { DashboardSkeleton } from '../components/Skeleton';
import { GlassBento as BentoCard } from '../components/GlassBento';
import { Dropdown } from '../components/Dropdown';
import { useSocket } from '../services/websocket';

// --- ICONS ---
const ICONS = {
    TREND_UP: <svg className="w-3 h-3 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>,
    TREND_DOWN: <svg className="w-3 h-3 text-rose-600 dark:text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>,
    REFRESH: <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
    USER: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
    CHECK: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>,
    CLOUD: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>,
    AI: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" /></svg>,
    WARNING: <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
    EMPTY: <svg className="w-8 h-8 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
};

// --- SUB-COMPONENTS ---

const TrendIndicator = ({ value, label }: { value: number; label: string }) => {
    const safeValue = (typeof value === 'number' && !isNaN(value)) ? value : 0;
    const isPositive = safeValue >= 0;
    return (
        <div className={`flex items-center gap-1 text-xs2 font-bold uppercase tracking-wider ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {isPositive ? ICONS.TREND_UP : ICONS.TREND_DOWN}
            <span>{Math.abs(safeValue)}%</span>
            <span className="text-[var(--text-tertiary)] dark:text-slate-400 font-medium normal-case ml-1">{label}</span>
        </div>
    );
};

const ActivityItem: React.FC<{ activity: any }> = ({ activity }) => {
    const getIcon = (type: string) => {
        switch(type) {
            case 'LEAD': return { icon: ICONS.USER, bg: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' };
            case 'DEAL': return { icon: ICONS.CHECK, bg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' };
            case 'SYSTEM': return { icon: ICONS.CLOUD, bg: 'bg-[var(--glass-surface-hover)] text-[var(--text-secondary)] dark:bg-slate-800 dark:text-slate-300' };
            default: return { icon: ICONS.AI, bg: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' };
        }
    };
    const style = getIcon(activity.type);

    return (
        <div className="flex gap-3 py-3 border-b border-[var(--glass-border)] dark:border-slate-800/50 last:border-0 hover:bg-[var(--glass-surface)]/50 dark:hover:bg-slate-800/30 transition-colors rounded-lg px-2 -mx-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${style.bg}`}>
                {style.icon}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-[var(--text-primary)] dark:text-slate-200 truncate">{activity.content}</p>
                <p className="text-xs2 text-[var(--text-tertiary)] dark:text-slate-400 font-mono mt-0.5">{activity.time}</p>
            </div>
        </div>
    );
};

const CustomTooltip = memo(({ active, payload, label, t, formatCurrency, language }: any) => {
    if (active && Array.isArray(payload) && payload.length) {
        return (
            <div className="bg-[var(--bg-surface)]/95 dark:bg-slate-800/95 p-3 rounded-xl border border-[var(--glass-border)] dark:border-white/10 shadow-xl text-xs backdrop-blur-md z-50">
                <p className="font-bold mb-2 text-[var(--text-secondary)] dark:text-slate-200 uppercase tracking-wider">{label}</p>
                {payload.map((p: any, i: number) => (
                    <div key={i} className="flex items-center justify-between gap-4 mb-1">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }}></div>
                            <span className="text-[var(--text-secondary)] dark:text-slate-400 capitalize">{p.name}:</span>
                        </div>
                        <span className="font-mono font-bold text-[var(--text-primary)] dark:text-white">
                            {p.value > 1000 ? (formatCurrency ? formatCurrency(p.value) : p.value.toLocaleString(language === 'vn' ? 'vi-VN' : 'en-US')) : p.value}
                        </span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
});

const ScatterTooltip = memo(({ active, payload }: any) => {
    if (active && Array.isArray(payload) && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-[var(--bg-surface)]/95 dark:bg-slate-800/95 p-3 rounded-xl border border-[var(--glass-border)] dark:border-white/10 shadow-xl text-xs backdrop-blur-md z-50">
                <p className="font-bold mb-2 text-[var(--text-secondary)] dark:text-slate-200 uppercase tracking-wider">Khu vực: {data.location}</p>
                <div className="flex items-center justify-between gap-4 mb-1">
                    <span className="text-[var(--text-secondary)] dark:text-slate-400">Diện tích:</span>
                    <span className="font-mono font-bold text-[var(--text-primary)] dark:text-white">{data.area} m²</span>
                </div>
                <div className="flex items-center justify-between gap-4 mb-1">
                    <span className="text-[var(--text-secondary)] dark:text-slate-400">Mức giá:</span>
                    <span className="font-mono font-bold text-[var(--text-primary)] dark:text-white">{data.price} Tỷ</span>
                </div>
                <div className="flex items-center justify-between gap-4 mb-1">
                    <span className="text-[var(--text-secondary)] dark:text-slate-400">Mức độ quan tâm:</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{data.interest} lượt hỏi</span>
                </div>
            </div>
        );
    }
    return null;
});

const EmptyState = ({ message }: { message: string }) => (
    <div className="flex flex-col items-center justify-center h-full w-full opacity-60">
        {ICONS.EMPTY}
        <p className="text-xs text-[var(--text-tertiary)] mt-2 font-medium">{message}</p>
    </div>
);

// --- AGENT AVATAR with initials fallback ---
const AVATAR_COLORS = [
    'bg-indigo-500', 'bg-violet-500', 'bg-sky-500', 'bg-emerald-500',
    'bg-rose-500', 'bg-amber-500', 'bg-teal-500', 'bg-pink-500',
];
const AgentAvatar = ({ name, avatar }: { name: string; avatar?: string }) => {
    const [broken, setBroken] = React.useState(false);
    const initials = (name || '?').split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
    const colorClass = AVATAR_COLORS[(name || '').charCodeAt(0) % AVATAR_COLORS.length];
    const isValidSrc = !broken && avatar && avatar.trim() !== '';

    return isValidSrc ? (
        <img
            src={avatar}
            alt={name}
            className="w-10 h-10 rounded-full border-2 border-white dark:border-slate-800 shadow-sm object-cover"
            onError={() => setBroken(true)}
        />
    ) : (
        <div className={`w-10 h-10 rounded-full border-2 border-white dark:border-slate-800 shadow-sm flex items-center justify-center ${colorClass} select-none`}>
            <span className="text-xs font-bold text-white tracking-tight">{initials}</span>
        </div>
    );
};

// --- REALTIME TRAFFIC WIDGET ---
const RealtimeTrafficWidget = memo(({ t, theme }: any) => {
    const [data, setData] = useState<any[]>([]);
    const [stats, setStats] = useState({ rps: 0, latency: 0 });
    const colors = theme?.colors || {};
    const { socket, isConnected } = useSocket();
    const { language } = useTranslation();

    useEffect(() => {
        // Start simulation backend
        systemService.startTrafficSimulation(false, 0.05);
        
        // Listen to WebSocket for real-time traffic data if connected
        if (isConnected) {
            const handleTraffic = (trafficData: any) => {
                // Assuming the server broadcasts 'traffic_update'
                // For this demo, we'll still use the mock service but driven by interval
                // In a real app, this would be:
                // setStats({ rps: trafficData.rps, latency: trafficData.latency });
                // setData(prev => [...prev.slice(-19), { time: trafficData.time, rps: trafficData.rps, latency: trafficData.latency }]);
            };
            socket.on('traffic_update', handleTraffic);
            return () => { socket.off('traffic_update', handleTraffic); };
        }
    }, [isConnected, socket]);

    // Fallback/Mock logic driven by interval (simulating WS stream)
    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            const logs = systemService.getRecentLogs();
            const recentTraffic = logs.filter(l => l.source === 'TRAFFIC' && (now - new Date(l.timestamp).getTime()) < 2000);

            let count = recentTraffic.length;
            if (count === 0 && Math.random() > 0.3) count = Math.floor(Math.random() * 5) + 2; 
            
            let totalLatency = 0;
            if (recentTraffic.length > 0) {
                recentTraffic.forEach(l => {
                    const match = l.message.match(/\((\d+)ms\)/);
                    if (match) totalLatency += parseInt(match[1]);
                });
            } else {
                totalLatency = count * (Math.floor(Math.random() * 40) + 20);
            }

            const avgLatency = count > 0 ? Math.round(totalLatency / count) : 0;
            const rps = Math.round(count / 2);

            setStats({ rps, latency: avgLatency });
            setData(prev => {
                const timeLabel = new Date().toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' });
                const newData = [...prev, { time: timeLabel, rps, latency: avgLatency }]; 
                if (newData.length > 20) newData.shift();
                return newData;
            });
        }, 2000); 
        return () => clearInterval(interval);
    }, []);

    return (
        <BentoCard 
            title={t('dash.traffic_title')}
            className="h-full border border-[var(--glass-border)] dark:border-white/10 bg-[var(--bg-surface)] dark:bg-slate-900"
            contentClassName="justify-start"
            icon={<svg className="w-5 h-5 text-sky-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
        >
            <div className="flex justify-between items-end mb-4">
                <div className="flex gap-6">
                    <div>
                        <div className="text-2xl font-extrabold text-[var(--text-primary)] dark:text-white tracking-tight">{stats.rps}</div>
                        <div className="text-xs2 font-bold text-[var(--text-tertiary)] uppercase tracking-wider">{t('dash.requests_sec')}</div>
                    </div>
                    <div>
                        <div className="text-2xl font-extrabold text-[var(--text-primary)] dark:text-white tracking-tight">{stats.latency}<span className="text-sm text-[var(--text-tertiary)] ml-1">ms</span></div>
                        <div className="text-xs2 font-bold text-[var(--text-tertiary)] uppercase tracking-wider">{t('dash.avg_latency')}</div>
                    </div>
                </div>
                <div className={`flex items-center gap-2 px-2 py-1 rounded-full border ${isConnected ? 'bg-emerald-50 border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-800' : 'bg-amber-50 border-amber-100 dark:bg-amber-900/20 dark:border-amber-800'}`}>
                    <span className="relative flex h-2 w-2">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isConnected ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${isConnected ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                    </span>
                    <span className={`text-xs2 font-bold uppercase ${isConnected ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                        {isConnected ? t('dash.live_status') : 'Connecting...'}
                    </span>
                </div>
            </div>
            
            <div className="h-[150px] w-full -ml-2 relative">
                {data.length > 0 ? (
                    <ResponsiveContainer width="100%" height={150} minHeight={100} minWidth={150}>
                        <ComposedChart data={data}>
                            <defs>
                                <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={colors.info || '#3B82F6'} stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor={colors.info || '#3B82F6'} stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="time" hide />
                            <Tooltip content={<CustomTooltip t={t} language={language} />} cursor={{stroke: colors.grid || '#E2E8F0', strokeWidth: 1}} />
                            <Area 
                                type="monotone" 
                                dataKey="latency" 
                                name={t('dash.avg_latency')}
                                stroke={colors.info || '#3B82F6'} 
                                strokeWidth={2}
                                fill="url(#latencyGradient)" 
                                isAnimationActive={false} 
                            />
                            <Line 
                                type="step" 
                                dataKey="rps" 
                                name={t('dash.requests_sec')}
                                stroke={colors.warning || '#F59E0B'} 
                                strokeWidth={2} 
                                dot={false}
                                isAnimationActive={false}
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                ) : (
                    <EmptyState message="Waiting for traffic data..." />
                )}
            </div>
        </BentoCard>
    );
});

// --- MAIN DASHBOARD ---

export const Dashboard: React.FC = () => {
    const [timeRange, setTimeRange] = useState('30d');
    const [isExporting, setIsExporting] = useState(false);
    const dashboardRef = useRef<HTMLDivElement>(null);
    const { t, formatCurrency, formatCompactNumber, language } = useTranslation();
    const { chartTheme } = useTheme();

    const handleExport = async () => {
        if (!dashboardRef.current) return;
        setIsExporting(true);
        
        try {
            // Give a small delay for any animations to settle
            await new Promise(resolve => setTimeout(resolve, 500));

            const canvas = await html2canvas(dashboardRef.current, {
                scale: 2, // Retina quality
                useCORS: true,
                logging: false,
                backgroundColor: document.documentElement.classList.contains('dark') ? '#050505' : '#FAFAFA',
                onclone: (clonedDoc) => {
                    // Ensure fonts are loaded in the clone
                    const style = clonedDoc.createElement('style');
                    style.innerHTML = `
                        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
                        * { font-family: 'Inter', sans-serif !important; }
                    `;
                    clonedDoc.head.appendChild(style);
                }
            });
            
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: canvas.width > canvas.height ? 'l' : 'p',
                unit: 'px',
                format: [canvas.width, canvas.height]
            });
            
            pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
            pdf.save(`SGS_LAND_Report_${timeRange}_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (error) {
            console.error('Export failed:', error);
            alert('Lỗi khi xuất báo cáo. Vui lòng thử lại.');
        } finally {
            setIsExporting(false);
        }
    };

    // Use React Query for data fetching, caching, and auto-refresh
    const { data: analytics, isLoading, isError, refetch, dataUpdatedAt } = useQuery({
        queryKey: ['dashboardAnalytics', timeRange, language],
        queryFn: async () => {
            const data = await db.getAnalytics(timeRange, language);
            const user = await db.getCurrentUser();
            return { ...data, user };
        },
        refetchInterval: 30000, // Auto-refresh every 30s
        staleTime: 10000,
    });

    if (isLoading) return <DashboardSkeleton />;

    if (isError) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center animate-enter">
                <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                    {ICONS.WARNING}
                </div>
                <h2 className="text-xl font-bold text-[var(--text-primary)] dark:text-white mb-2">{t('common.error')}</h2>
                <p className="text-[var(--text-tertiary)] dark:text-slate-400 mb-6 max-w-md">
                    Không thể tải dữ liệu tổng quan. Vui lòng kiểm tra kết nối mạng hoặc thử lại sau.
                </p>
                <button 
                    onClick={() => refetch()}
                    className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl shadow-md hover:bg-indigo-700 transition-all active:scale-95"
                >
                    {t('common.system_reload')}
                </button>
            </div>
        );
    }

    if (!analytics) return null;

    const lastUpdated = new Date(dataUpdatedAt || Date.now());

    return (
        <div className="space-y-6 p-4 md:p-6 pb-24 animate-enter max-w-[1600px] mx-auto">
            
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
                <div>
                    <h1 className="text-2xl font-extrabold text-[var(--text-primary)] dark:text-white tracking-tight">
                        {t('dash.greeting_morning')}
                    </h1>
                    <div className="flex items-center gap-2 mt-1">
                        <p className="text-sm text-[var(--text-tertiary)] dark:text-slate-400 font-medium">
                            {t('dash.overview_subtitle')}
                        </p>
                        <span className="text-xs2 text-[var(--text-tertiary)] bg-[var(--glass-surface-hover)] dark:bg-slate-800 dark:text-slate-400 px-2 py-0.5 rounded-full flex items-center gap-1 font-medium border border-[var(--glass-border)] dark:border-slate-700">
                            {ICONS.REFRESH} {lastUpdated.toLocaleTimeString()}
                        </span>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    <div className="w-36 z-20">
                        <Dropdown 
                            value={timeRange}
                            onChange={(val) => setTimeRange(val as string)}
                            options={[
                                { value: '7d', label: t('dash.filter_7d') },
                                { value: '30d', label: t('dash.filter_30d') },
                                { value: 'all', label: t('dash.filter_all') }
                            ]}
                            className="text-xs"
                        />
                    </div>
                    <button 
                        onClick={handleExport}
                        disabled={isExporting}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isExporting ? (
                            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        )}
                        {isExporting ? 'Exporting...' : t('common.export')}
                    </button>
                </div>
            </div>

            {/* MAIN GRID LAYOUT */}
            <div ref={dashboardRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                
                {/* TIER 1: North Star Metrics (KPI Cards) — Unified Layout */}
                {/* 1. Revenue (Doanh Thu Hoa Hồng) */}
                <div className="md:col-span-1 lg:col-span-1 overflow-hidden rounded-[32px]">
                    <BentoCard
                        title={t('dash.revenue_title')}
                        className="h-full min-h-[180px] bg-gradient-to-br from-indigo-600 to-purple-700 text-white border-none shadow-xl [&_h3]:!text-indigo-200 overflow-hidden"
                    >
                        <div className="flex flex-col justify-between h-full gap-4">
                            <div>
                                <div className="text-3xl font-black tracking-tight mt-2 text-white break-words">
                                    {formatCompactNumber(analytics.revenue || 0)}
                                </div>
                                <div className="text-xs2 text-indigo-200 font-bold uppercase tracking-wider mt-1">
                                    {t('dash.commission_2_percent') || "Hoa hồng 2%"}
                                </div>
                            </div>
                            <div className="bg-[var(--bg-surface)]/10 p-3 rounded-xl backdrop-blur-sm border border-white/10 text-xs flex items-center gap-2">
                                <span className={`font-bold flex items-center gap-1 ${(analytics.revenueDelta ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                                    {(analytics.revenueDelta ?? 0) >= 0 ? ICONS.TREND_UP : ICONS.TREND_DOWN}
                                    {Math.abs(analytics.revenueDelta || 0)}%
                                </span>
                                <span className="text-white/70 font-medium">{t('dash.vs_last_period')}</span>
                            </div>
                        </div>
                    </BentoCard>
                </div>

                {/* 2. Pipeline Value (Giá Trị Pipeline) */}
                <div className="md:col-span-1 lg:col-span-1 overflow-hidden rounded-[32px]">
                    <BentoCard title={t('dash.pipeline_value') || "Pipeline Value"} className="h-full min-h-[180px] bg-[var(--bg-surface)] dark:bg-slate-900 border border-[var(--glass-border)] dark:border-white/10 overflow-hidden">
                        <div className="flex flex-col justify-between h-full gap-4">
                            <div>
                                <div className="text-3xl font-extrabold text-[var(--text-primary)] dark:text-white tracking-tight mt-2 break-words">
                                    {formatCompactNumber(analytics.pipelineValue || 0)}
                                </div>
                                <div className="text-xs2 text-[var(--text-tertiary)] dark:text-slate-400 font-bold uppercase tracking-wider mt-1">
                                    {t('dash.win_probability') || "Xác suất chốt"}: <span className="text-indigo-600 dark:text-indigo-400">{analytics.winProbability || 0}%</span>
                                </div>
                            </div>
                            <div className="bg-[var(--glass-surface)] dark:bg-slate-800/50 p-3 rounded-xl border border-[var(--glass-border)] dark:border-slate-700/50 text-xs flex items-center gap-2">
                                <TrendIndicator value={analytics.pipelineValueDelta || 0} label={t('dash.vs_last_period') || "vs last period"} />
                            </div>
                        </div>
                    </BentoCard>
                </div>

                {/* 3. AI Deflection Rate (Tỷ Lệ Tự Động Hóa AI) */}
                <div className="md:col-span-1 lg:col-span-1 overflow-hidden rounded-[32px]">
                    <BentoCard title={t('dash.ai_deflection_rate') || "AI Deflection Rate"} className="h-full min-h-[180px] bg-[var(--bg-surface)] dark:bg-slate-900 border border-[var(--glass-border)] dark:border-white/10 overflow-hidden">
                        <div className="flex flex-col justify-between h-full gap-4">
                            <div>
                                <div className="flex items-center gap-2 mt-2">
                                    <div className="relative h-10 w-10 shrink-0">
                                        <svg className="w-10 h-10 -rotate-90" viewBox="0 0 40 40">
                                            <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" className="text-emerald-100 dark:text-emerald-900/30" strokeWidth="4" />
                                            <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" className="text-emerald-500" strokeWidth="4" strokeLinecap="round"
                                                strokeDasharray={`${((analytics.aiDeflectionRate || 0) / 100) * 2 * Math.PI * 16} ${2 * Math.PI * 16}`} />
                                        </svg>
                                        <div className="absolute inset-0 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                            {ICONS.AI}
                                        </div>
                                    </div>
                                    <div className="text-3xl font-extrabold text-[var(--text-primary)] dark:text-white">{analytics.aiDeflectionRate || 0}%</div>
                                </div>
                                <div className="text-xs2 text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider mt-1">{t('dash.resolved_by_ai') || "Xử lý bởi AI"}</div>
                            </div>
                            <div className="bg-[var(--glass-surface)] dark:bg-slate-800/50 p-3 rounded-xl border border-[var(--glass-border)] dark:border-slate-700/50 text-xs flex items-center gap-2">
                                <TrendIndicator value={analytics.aiDeflectionRateDelta || 0} label={t('dash.vs_last_period') || "vs last period"} />
                            </div>
                        </div>
                    </BentoCard>
                </div>

                {/* 4. Sales Velocity (Tốc Độ Bán Hàng) */}
                <div className="md:col-span-1 lg:col-span-1 overflow-hidden rounded-[32px]">
                    <BentoCard title={t('dash.sales_velocity') || "Sales Velocity"} className="h-full min-h-[180px] bg-[var(--bg-surface)] dark:bg-slate-900 border border-[var(--glass-border)] dark:border-white/10 overflow-hidden">
                        <div className="flex flex-col justify-between h-full gap-4">
                            <div>
                                <div className="text-3xl font-extrabold text-[var(--text-primary)] dark:text-white mt-2">{analytics.salesVelocity || 0}</div>
                                <div className="text-xs2 text-[var(--text-tertiary)] dark:text-slate-400 font-bold uppercase tracking-wider mt-1">{t('dash.days_to_close') || "Ngày để chốt deal"}</div>
                            </div>
                            <div className="bg-[var(--glass-surface)] dark:bg-slate-800/50 p-3 rounded-xl border border-[var(--glass-border)] dark:border-slate-700/50 text-xs flex items-center gap-2">
                                <TrendIndicator value={analytics.salesVelocityDelta || 0} label={t('dash.vs_last_period') || "vs last period"} />
                            </div>
                        </div>
                    </BentoCard>
                </div>

                {/* TIER 2: The Engine (Charts & Activity) */}
                <div className="md:col-span-2 lg:col-span-3 min-h-[420px]">
                    <BentoCard 
                        title={t('dash.pipeline_title')}
                        className="h-full border border-[var(--glass-border)] dark:border-white/10 bg-[var(--bg-surface)] dark:bg-slate-900"
                    >
                        <div className="flex justify-between items-end mb-4">
                            <div>
                                <div className="text-4xl font-extrabold text-[var(--text-primary)] dark:text-white tracking-tight">{analytics.totalLeads}</div>
                                <TrendIndicator value={analytics.totalLeadsDelta} label={t('dash.total_leads')} />
                            </div>
                            <div className="text-right hidden sm:block">
                                <div className="text-xs2 uppercase font-bold text-[var(--text-tertiary)] tracking-wider mb-1">{t('dash.conversion')}</div>
                                <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{!isNaN(analytics.conversionRate) ? analytics.conversionRate : 0}%</div>
                            </div>
                        </div>
                        <div className="flex-1 w-full min-h-[250px] relative">
                            {analytics.leadsTrend && analytics.leadsTrend.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%" minHeight={200} minWidth={200}>
                                    <ComposedChart data={analytics.leadsTrend}>
                                        <defs>
                                            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor={chartTheme.colors.primary} stopOpacity={0.8}/>
                                                <stop offset="100%" stopColor={chartTheme.colors.primary} stopOpacity={0.2}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.colors.grid} opacity={0.5} />
                                        <XAxis dataKey="date" hide />
                                        <Tooltip content={<CustomTooltip t={t} formatCurrency={formatCurrency} language={language} />} cursor={{fill: 'transparent'}} />
                                        <Bar 
                                            dataKey="count" 
                                            fill="url(#barGradient)" 
                                            barSize={20} 
                                            radius={[4, 4, 0, 0]}
                                            name={t('dash.chart_new_leads')}
                                        />
                                        <Line 
                                            type="monotone" 
                                            dataKey="count" 
                                            stroke={chartTheme.colors.secondary} 
                                            strokeWidth={3} 
                                            dot={{r: 3, fill: chartTheme.colors.background, stroke: chartTheme.colors.secondary, strokeWidth: 2}}
                                            name={t('dash.chart_trend')}
                                        />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            ) : (
                                <EmptyState message="Không có dữ liệu biểu đồ" />
                            )}
                        </div>
                    </BentoCard>
                </div>

                <div className="md:col-span-2 lg:col-span-1 min-h-[420px]">
                    <BentoCard title={t('dash.activity_title')} className="h-full bg-[var(--bg-surface)] dark:bg-slate-900 border border-[var(--glass-border)] dark:border-white/10 overflow-hidden flex flex-col">
                        <div className="flex-1 overflow-y-auto no-scrollbar -mx-2 px-2 mt-2">
                            <div className="flex flex-col gap-2">
                                {(analytics.recentActivities || []).map((act, idx) => (
                                    <ActivityItem key={idx} activity={act} />
                                ))}
                                {(!analytics.recentActivities || analytics.recentActivities.length === 0) && (
                                    <div className="py-10">
                                        <EmptyState message={t('dash.activity_empty')} />
                                    </div>
                                )}
                            </div>
                        </div>
                    </BentoCard>
                </div>

                {/* TIER 3: Market Pulse & Leaderboard */}
                <div className="md:col-span-2 lg:col-span-2 min-h-[400px]">
                    <BentoCard 
                        title="Nhịp đập thị trường (Market Pulse)"
                        className="h-full border border-[var(--glass-border)] dark:border-white/10 bg-[var(--bg-surface)] dark:bg-slate-900"
                    >
                        <div className="flex-1 w-full h-[320px] relative mt-4 flex flex-col">
                            {analytics.marketPulse && analytics.marketPulse.length > 0 ? (
                                <>
                                    <div className="flex-1 min-h-[200px]">
                                        <ResponsiveContainer width="100%" height="100%" minHeight={200} minWidth={200}>
                                            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.colors.grid} opacity={0.5} />
                                                <XAxis type="number" dataKey="area" name="Diện tích" unit="m²" stroke={chartTheme.colors.text} fontSize={12} tickLine={false} axisLine={false} />
                                                <YAxis type="number" dataKey="price" name="Mức giá" unit=" Tỷ" stroke={chartTheme.colors.text} fontSize={12} tickLine={false} axisLine={false} />
                                                <ZAxis type="number" dataKey="interest" range={[100, 1000]} name="Mức độ quan tâm" />
                                                <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<ScatterTooltip />} />
                                                <Scatter name="Market Interest" data={analytics.marketPulse} opacity={0.7}>
                                                    {analytics.marketPulse.map((entry: any, index: number) => {
                                                        // Generate a color based on location
                                                        const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'];
                                                        const hash = entry.location.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
                                                        const color = colors[hash % colors.length];
                                                        return <Cell key={`cell-${index}`} fill={color} />;
                                                    })}
                                                </Scatter>
                                            </ScatterChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="flex flex-wrap items-center justify-center gap-3 pt-2 pb-1">
                                        {Array.from(new Set(analytics.marketPulse.map((item: any) => item.location))).map((loc: any, idx: number) => {
                                            const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'];
                                            const hash = loc.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
                                            const color = colors[hash % colors.length];
                                            return (
                                                <div key={idx} className="flex items-center gap-1.5">
                                                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }}></div>
                                                    <span className="text-xs2 font-medium text-[var(--text-secondary)] dark:text-slate-400">{loc}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            ) : (
                                <EmptyState message="Không có dữ liệu Nhịp đập thị trường" />
                            )}
                        </div>
                    </BentoCard>
                </div>

                <div className="md:col-span-2 lg:col-span-2 min-h-[400px]">
                    <BentoCard 
                        title="Bảng xếp hạng nhân viên (Agent Leaderboard)"
                        className="h-full border border-[var(--glass-border)] dark:border-white/10 bg-[var(--bg-surface)] dark:bg-slate-900 overflow-hidden flex flex-col"
                    >
                        <div className="flex-1 overflow-y-auto no-scrollbar -mx-2 px-2 mt-4">
                            <div className="flex flex-col gap-3">
                                {(analytics.agentLeaderboard || []).map((agent: any, idx: number) => (
                                    <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-[var(--glass-surface)] dark:bg-slate-800/50 border border-[var(--glass-border)] dark:border-slate-700/50 hover:border-indigo-200 dark:hover:border-indigo-500/30 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="relative">
                                                <AgentAvatar name={agent.name} avatar={agent.avatar} />
                                                {idx < 3 && (
                                                    <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-3xs font-bold text-white shadow-sm ${idx === 0 ? 'bg-amber-400' : idx === 1 ? 'bg-slate-400' : 'bg-amber-600'}`}>
                                                        {idx + 1}
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <div className="font-bold text-sm text-[var(--text-primary)] dark:text-white">{agent.name}</div>
                                                <div className="text-xs2 text-[var(--text-tertiary)] dark:text-slate-400 font-medium">{agent.deals} deal đã chốt</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 text-right">
                                            <div>
                                                <div className="text-xs2 uppercase font-bold text-[var(--text-tertiary)] tracking-wider mb-0.5">Tỷ lệ chốt</div>
                                                <div className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">{agent.closeRate}%</div>
                                            </div>
                                            <div className="w-px h-8 bg-slate-200 dark:bg-slate-700"></div>
                                            <div>
                                                <div className="text-xs2 uppercase font-bold text-[var(--text-tertiary)] tracking-wider mb-0.5">Điểm SLA</div>
                                                <div className="flex items-center gap-1 justify-end">
                                                    <span className={`font-bold text-sm ${agent.slaScore >= 90 ? 'text-indigo-600 dark:text-indigo-400' : 'text-amber-600 dark:text-amber-400'}`}>{agent.slaScore}/100</span>
                                                </div>
                                                <div className="text-2xs text-[var(--text-secondary)] font-medium">TB: {agent.avgResponseTime}</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {(!analytics.agentLeaderboard || analytics.agentLeaderboard.length === 0) && (
                                    <div className="py-10">
                                        <EmptyState message="Không có dữ liệu Bảng xếp hạng" />
                                    </div>
                                )}
                            </div>
                        </div>
                    </BentoCard>
                </div>

                {/* TIER 4: Realtime Traffic (Admin & Team Lead Only) */}
                {(analytics.user?.role === 'ADMIN' || analytics.user?.role === 'TEAM_LEAD') && (
                    <div className="md:col-span-2 lg:col-span-4 h-[360px]">
                        <RealtimeTrafficWidget t={t} theme={chartTheme} />
                    </div>
                )}

            </div>
        </div>
    );
};

export default Dashboard;
