import React, { useMemo } from 'react';
import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { useTheme } from '../../services/theme';
import { useTranslation } from '../../services/i18n';

export interface DailyLeadTrendRow {
    date?: string;
    dateKey?: string;
    count?: unknown;
}

export interface MonthlyRevenueTrendRow {
    month?: string;
    revenue?: unknown;
}

export interface TrendPoint {
    timestamp: number;
    dateKey?: string;
    monthKey?: string;
    value: number;
}

const parseDateKey = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day, 12));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
        ? value
        : null;
};

export function buildDailyLeadTrendData(rows: readonly DailyLeadTrendRow[] | undefined): TrendPoint[] {
    if (!Array.isArray(rows)) return [];
    const countsByDay = new Map<string, number>();

    for (const row of rows) {
        const dateKey = parseDateKey(row?.dateKey) ?? parseDateKey(row?.date);
        const count = Number(row?.count);
        if (!dateKey || !Number.isFinite(count) || count < 0) continue;
        countsByDay.set(dateKey, (countsByDay.get(dateKey) ?? 0) + count);
    }

    const dates = [...countsByDay.keys()].sort();
    if (dates.length === 0) return [];

    const first = new Date(`${dates[0]}T12:00:00.000Z`).getTime();
    const last = new Date(`${dates[dates.length - 1]}T12:00:00.000Z`).getTime();
    const points: TrendPoint[] = [];
    for (let timestamp = first; timestamp <= last; timestamp += 24 * 60 * 60 * 1000) {
        const dateKey = new Date(timestamp).toISOString().slice(0, 10);
        points.push({
            timestamp,
            dateKey,
            value: countsByDay.get(dateKey) ?? 0,
        });
    }
    return points;
}

export function buildMonthlyRevenueTrendData(
    rows: readonly MonthlyRevenueTrendRow[] | undefined,
    now = new Date(),
): TrendPoint[] {
    if (!Array.isArray(rows)) return [];
    const revenueByMonth = new Map<string, number>();
    for (const row of rows) {
        if (typeof row?.month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(row.month)) continue;
        const revenue = Number(row.revenue);
        if (!Number.isFinite(revenue)) continue;
        revenueByMonth.set(row.month, (revenueByMonth.get(row.month) ?? 0) + revenue);
    }

    const startMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 11, 1, 12));
    const months = Array.from({ length: 12 }, (_, index) => {
        const date = new Date(Date.UTC(startMonth.getUTCFullYear(), startMonth.getUTCMonth() + index, 15, 12));
        const monthKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
        return { monthKey, timestamp: date.getTime() };
    });

    if (!months.some(({ monthKey }) => revenueByMonth.has(monthKey))) return [];

    return months.map(({ monthKey, timestamp }) => ({
        timestamp,
        monthKey,
        value: revenueByMonth.get(monthKey) ?? 0,
    }));
}

const EmptyTrend: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="flex h-full min-h-[220px] items-center justify-center px-4 text-center text-sm text-[var(--text-tertiary)]">
        {children}
    </div>
);

export const AdvancedTrendCharts: React.FC<{
    leadsTrend?: DailyLeadTrendRow[];
    revenueByMonth?: MonthlyRevenueTrendRow[];
}> = ({ leadsTrend, revenueByMonth }) => {
    const { t, formatCurrency, formatCompactNumber, language } = useTranslation();
    const { chartTheme } = useTheme();
    const locale = language === 'vn' ? 'vi-VN' : 'en-US';
    const leadPoints = useMemo(() => buildDailyLeadTrendData(leadsTrend), [leadsTrend]);
    const revenuePoints = useMemo(() => buildMonthlyRevenueTrendData(revenueByMonth), [revenueByMonth]);
    const dayFormatter = useMemo(
        () => new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short' }),
        [locale],
    );
    const monthFormatter = useMemo(
        () => new Intl.DateTimeFormat(locale, { month: 'short', year: '2-digit' }),
        [locale],
    );
    const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);

    const formatDay = (timestamp: unknown) => {
        const date = new Date(Number(timestamp));
        return Number.isFinite(date.getTime()) ? dayFormatter.format(date) : '';
    };
    const formatMonth = (timestamp: unknown) => {
        const date = new Date(Number(timestamp));
        return Number.isFinite(date.getTime()) ? monthFormatter.format(date) : '';
    };
    const dailyDomain: [number | 'dataMin', number | 'dataMax'] = leadPoints.length === 1
        ? [leadPoints[0].timestamp - 12 * 60 * 60 * 1000, leadPoints[0].timestamp + 12 * 60 * 60 * 1000]
        : ['dataMin', 'dataMax'];

    return (
        <section
            className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2"
            aria-label={t('overview.trends_title')}
        >
            <article className="dashboard-panel min-w-0" aria-label={t('overview.trend_leads_title')}>
                <div className="dashboard-panel-head flex-wrap">
                    <h3>{t('overview.trend_leads_title')}</h3>
                    <span className="ml-auto text-xs text-[var(--text-tertiary)]">{t('overview.trend_leads_period')}</span>
                </div>
                <p className="px-4 pt-3 text-xs text-[var(--text-secondary)]">{t('overview.trend_leads_description')}</p>
                <div className="h-[240px] min-w-0 px-2 pb-3 pt-2 sm:h-[280px]">
                    {leadPoints.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%" minWidth={180} minHeight={220}>
                            <AreaChart data={leadPoints} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                                <CartesianGrid vertical={false} stroke={chartTheme.colors.grid} strokeDasharray="3 3" opacity={0.55} />
                                <XAxis
                                    dataKey="timestamp"
                                    type="number"
                                    scale="time"
                                    domain={dailyDomain}
                                    tickFormatter={formatDay}
                                    tick={{ fill: chartTheme.colors.text, fontSize: 11 }}
                                    tickLine={false}
                                    axisLine={false}
                                    minTickGap={24}
                                    tickCount={5}
                                />
                                <YAxis
                                    allowDecimals={false}
                                    domain={[0, 'auto']}
                                    width={36}
                                    tickFormatter={(value: number) => numberFormatter.format(Number(value))}
                                    tick={{ fill: chartTheme.colors.text, fontSize: 11 }}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <Tooltip
                                    labelFormatter={formatDay}
                                    formatter={(value) => [
                                        numberFormatter.format(Number(value)),
                                        t('overview.trend_leads_series'),
                                    ]}
                                    contentStyle={{
                                        backgroundColor: 'var(--bg-surface)',
                                        borderColor: 'var(--glass-border)',
                                        borderRadius: 12,
                                        color: 'var(--text-primary)',
                                    }}
                                    labelStyle={{ color: 'var(--text-primary)' }}
                                    itemStyle={{ color: 'var(--sgs-primary)' }}
                                />
                                <Area
                                    type="linear"
                                    dataKey="value"
                                    name={t('overview.trend_leads_series')}
                                    stroke="var(--sgs-primary)"
                                    fill="var(--sgs-primary)"
                                    fillOpacity={0.14}
                                    strokeWidth={2}
                                    dot={leadPoints.length <= 8 ? { r: 2 } : false}
                                    activeDot={{ r: 4 }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <EmptyTrend>{t('overview.trend_leads_empty')}</EmptyTrend>
                    )}
                </div>
            </article>

            <article className="dashboard-panel min-w-0" aria-label={t('overview.trend_revenue_title')}>
                <div className="dashboard-panel-head flex-wrap">
                    <h3>{t('overview.trend_revenue_title')}</h3>
                    <span className="ml-auto text-xs text-[var(--text-tertiary)]">{t('overview.trend_revenue_period')}</span>
                </div>
                <p className="px-4 pt-3 text-xs text-[var(--text-secondary)]">{t('overview.trend_revenue_description')}</p>
                <div className="h-[240px] min-w-0 px-2 pb-3 pt-2 sm:h-[280px]">
                    {revenuePoints.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%" minWidth={180} minHeight={220}>
                            <AreaChart data={revenuePoints} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
                                <CartesianGrid vertical={false} stroke={chartTheme.colors.grid} strokeDasharray="3 3" opacity={0.55} />
                                <XAxis
                                    dataKey="timestamp"
                                    type="number"
                                    scale="time"
                                    domain={['dataMin', 'dataMax']}
                                    tickFormatter={formatMonth}
                                    tick={{ fill: chartTheme.colors.text, fontSize: 11 }}
                                    tickLine={false}
                                    axisLine={false}
                                    minTickGap={20}
                                    tickCount={6}
                                />
                                <YAxis
                                    allowDecimals={false}
                                    domain={[0, 'auto']}
                                    width={64}
                                    tickFormatter={(value: number) => formatCompactNumber(Number(value))}
                                    tick={{ fill: chartTheme.colors.text, fontSize: 10 }}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <Tooltip
                                    labelFormatter={formatMonth}
                                    formatter={(value) => [
                                        formatCurrency(Number(value)),
                                        t('overview.trend_revenue_series'),
                                    ]}
                                    contentStyle={{
                                        backgroundColor: 'var(--bg-surface)',
                                        borderColor: 'var(--glass-border)',
                                        borderRadius: 12,
                                        color: 'var(--text-primary)',
                                    }}
                                    labelStyle={{ color: 'var(--text-primary)' }}
                                    itemStyle={{ color: 'var(--sgs-accent)' }}
                                />
                                <Area
                                    type="linear"
                                    dataKey="value"
                                    name={t('overview.trend_revenue_series')}
                                    stroke="var(--sgs-accent)"
                                    fill="var(--sgs-accent)"
                                    fillOpacity={0.16}
                                    strokeWidth={2}
                                    activeDot={{ r: 4 }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <EmptyTrend>{t('overview.trend_revenue_empty')}</EmptyTrend>
                    )}
                </div>
            </article>
        </section>
    );
};