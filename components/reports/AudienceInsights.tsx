import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '../../services/dbApi';
import { SearchAnalyticsWidget, VisitorFunnelWidget } from '../../pages/Dashboard';

const FUNNEL_ROLES = ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD'];

/**
 * Visitor-behaviour analytics moved out of the dashboard: search analytics,
 * viewer funnel (managers only) and demand by area.
 */
export const AudienceInsights: React.FC<{ timeRange: string; language: string; role?: string }> = ({ timeRange, language, role }) => {
    const vn = language === 'vn';
    const days = timeRange === 'all' ? 365 : Number.parseInt(timeRange, 10) || 30;
    const { data, isLoading, isError } = useQuery({
        queryKey: ['reportsAudience', timeRange, language],
        queryFn: () => db.getAnalytics(timeRange as any, language as any),
        staleTime: 60000,
        retry: 1,
    });
    const overview: any = data || {};
    const areas: any[] = Array.isArray(overview.demandAreas) ? overview.demandAreas : [];
    return (
        <section className="sgs-dashboard sgs-dashboard-embed mt-8 space-y-6" aria-label={vn ? 'Hành vi khách truy cập' : 'Visitor behaviour'}>
            <div>
                <h2 className="text-lg font-bold text-[var(--text-primary)]">{vn ? 'Hành vi khách truy cập' : 'Visitor behaviour'}</h2>
                <p className="mt-1 text-sm text-[var(--text-tertiary)]">{vn ? 'Tìm kiếm, phễu người xem và nhu cầu theo khu vực' : 'Search, viewer funnel and demand by area'}</p>
            </div>
            {isError ? (
                <div className="dashboard-panel px-4 py-4 text-sm text-[var(--text-tertiary)]">{vn ? 'Chưa tải được dữ liệu tìm kiếm. Vui lòng thử lại sau.' : 'Could not load search data. Please try again later.'}</div>
            ) : isLoading ? (
                <div className="dashboard-panel h-40 animate-pulse" aria-busy="true" />
            ) : (
                <SearchAnalyticsWidget analytics={overview} language={language} />
            )}
            {FUNNEL_ROLES.includes(role ?? '') && <VisitorFunnelWidget days={days} language={language} />}
            <section className="dashboard-panel" aria-label={vn ? 'Nhu cầu theo khu vực' : 'Demand by area'}>
                <div className="dashboard-panel-head"><h2>{vn ? 'Nhu cầu theo khu vực' : 'Demand by area'}</h2><span className="text-xs text-[var(--text-tertiary)]">{areas.length}</span></div>
                <div className="grid grid-cols-1 gap-2 px-4 py-4 sm:grid-cols-2 lg:grid-cols-4">
                    {areas.slice(0, 8).map((area: any, index: number) => (
                        <div key={area.name ?? index} className="rounded-xl border border-[var(--glass-border)] bg-[var(--bg-surface)] px-3 py-3">
                            <div className="flex items-center justify-between gap-2 text-xs"><span className="truncate text-[var(--text-secondary)]">{area.name}</span><strong className="font-mono text-[var(--sgs-primary)]">{area.score ?? area.count ?? 0}</strong></div>
                            <div className="mt-2 h-1.5 rounded-full bg-[var(--glass-surface-hover)]"><div className="h-full rounded-full bg-[var(--sgs-accent)]" style={{ width: `${Math.min(100, Number(area.score ?? area.count ?? 0))}%` }} /></div>
                        </div>
                    ))}
                </div>
                {!isLoading && !areas.length && <div className="mx-4 mb-4 py-3 text-xs text-[var(--text-tertiary)]">{vn ? 'Chưa có dữ liệu nhu cầu theo khu vực' : 'No area demand data yet'}</div>}
            </section>
        </section>
    );
};
