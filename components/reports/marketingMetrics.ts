export interface MarketingAttributionRow {
    channel: string;
    spend: number;
    leads: number;
    revenue: number;
    roi: number;
}

export function summarizePaidMarketing(rows: MarketingAttributionRow[]) {
    const channels = rows.filter(row => row.channel !== 'DIRECT_SALE' && row.spend > 0);
    const revenue = channels.reduce((sum, row) => sum + row.revenue, 0);
    const spend = channels.reduce((sum, row) => sum + row.spend, 0);
    const leads = channels.reduce((sum, row) => sum + row.leads, 0);

    return {
        channels,
        revenue,
        spend,
        leads,
        roi: spend > 0 ? ((revenue - spend) / spend) * 100 : null,
    };
}

export function countNonDirectLeads(rows: MarketingAttributionRow[]) {
    return rows
        .filter(row => row.channel !== 'DIRECT_SALE')
        .reduce((sum, row) => sum + row.leads, 0);
}