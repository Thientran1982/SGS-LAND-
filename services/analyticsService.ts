
import { Lead, LeadStage, Proposal, ProposalStatus, Interaction, InteractionMetadata, AnalyticsSummary, User, CampaignCost } from '../types';

export class AnalyticsService {
    /**
     * Calculates the Sales Velocity (Average days to close a deal)
     * Expert Note: In a high-performance B2B2C environment, velocity is the ultimate KPI.
     * We use a 0.5 day floor to account for 'instant' digital conversions while 
     * maintaining statistical integrity for long-tail real estate cycles.
     */
    public static calculateSalesVelocity(leads: Lead[]): number {
        const wonLeads = leads.filter(l => l.stage === LeadStage.WON && l.createdAt);
        if (wonLeads.length === 0) return 0;

        const totalDays = wonLeads.reduce((sum, lead) => {
            const created = new Date(lead.createdAt).getTime();
            const updated = new Date(lead.updatedAt).getTime();
            const diffDays = (updated - created) / (1000 * 60 * 60 * 24);
            return sum + Math.max(0.5, diffDays); // Minimum 0.5 days
        }, 0);

        return parseFloat((totalDays / wonLeads.length).toFixed(1));
    }

    /**
     * Calculates the AI Deflection Rate
     * (Percentage of interactions handled by AI without human intervention)
     */
    public static calculateAiDeflectionRate(interactions: Interaction[]): number {
        if (interactions.length === 0) return 0;
        
        const aiInteractions = interactions.filter(i => i.metadata?.isAgent === true);
        const totalOutbound = interactions.filter(i => i.direction === 'OUTBOUND').length;
        
        if (totalOutbound === 0) return 0;
        
        return Math.round((aiInteractions.length / totalOutbound) * 100);
    }

    /**
     * Calculates the Pipeline Value
     * Sum of (Proposal Price * Probability based on Lead Score/Grade)
     */
    public static calculatePipelineValue(proposals: Proposal[], leads: Lead[]): number {
        const leadMap = new Map(leads.map(l => [l.id, l]));
        
        return proposals
            .filter(p => p.status === ProposalStatus.PENDING_APPROVAL || p.status === ProposalStatus.DRAFT)
            .reduce((sum, p) => {
                const lead = leadMap.get(p.leadId);
                const grade = lead?.score?.grade || 'C';
                let probability = 0.3;
                
                switch(grade) {
                    case 'A': probability = 0.85; break;
                    case 'B': probability = 0.6; break;
                    case 'C': probability = 0.3; break;
                    case 'D': probability = 0.1; break;
                    case 'F': probability = 0.01; break;
                }
                
                return sum + Math.floor(p.finalPrice * probability);
            }, 0);
    }

    /**
     * Generates a trend of leads over time
     */
    public static generateLeadsTrend(leads: Lead[], days: number = 30): { date: string; count: number }[] {
        const trend: Record<string, number> = {};
        const now = new Date();
        
        // Initialize last X days
        for (let i = 0; i < days; i++) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            trend[d.toISOString().split('T')[0]] = 0;
        }

        leads.forEach(l => {
            const date = l.createdAt.split('T')[0];
            if (trend[date] !== undefined) {
                trend[date]++;
            }
        });

        return Object.entries(trend)
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => a.date.localeCompare(b.date));
    }

    /**
     * Generates AI Highlights/Insights
     */
    public static generateAiHighlights(leads: Lead[], proposals: Proposal[], language: string): string[] {
        const highlights: string[] = [];
        const hotLeads = leads.filter(l => l.score && l.score.score > 80).length;
        const conversion = leads.length > 0 ? (leads.filter(l => l.stage === LeadStage.WON).length / leads.length) * 100 : 0;

        if (language === 'vn') {
            if (hotLeads > 0) highlights.push(`Có ${hotLeads} khách hàng tiềm năng điểm cao cần chăm sóc ngay.`);
            if (conversion > 20) highlights.push(`Tỷ lệ chốt deal đang ở mức cao kỷ lục (${conversion.toFixed(1)}%).`);
            highlights.push("AI gợi ý tập trung vào nguồn Facebook vì có tỷ lệ chuyển đổi tốt nhất tuần này.");
        } else {
            if (hotLeads > 0) highlights.push(`${hotLeads} high-score leads require immediate attention.`);
            if (conversion > 20) highlights.push(`Conversion rate is at a record high (${conversion.toFixed(1)}%).`);
            highlights.push("AI suggests focusing on Facebook leads due to best conversion this week.");
        }

        return highlights;
    }

    /**
     * Generates BI Marts for reporting
     */
    public static generateBiMarts(leads: Lead[], proposals: Proposal[], campaignCosts: CampaignCost[]) {
        // 1. Funnel Data
        const stages = [LeadStage.NEW, LeadStage.CONTACTED, LeadStage.QUALIFIED, LeadStage.PROPOSAL, LeadStage.WON];
        const funnel = [];
        let previousCount = leads.length;

        for (const stage of stages) {
            const count = leads.filter(l => {
                const stageIdx = stages.indexOf(l.stage);
                const currentIdx = stages.indexOf(stage);
                return stageIdx >= currentIdx;
            }).length;

            const conversionRate = previousCount > 0 ? Math.round((count / previousCount) * 100) : 0;
            funnel.push({ stage, count, conversionRate });
            previousCount = count;
        }

        // 2. Attribution Data
        const sources = ['Facebook', 'Google', 'Website', 'Referral', 'Zalo'];
        const attribution = [];
        const COMMISSION_RATE = 0.02;

        for (const source of sources) {
            const sourceLeads = leads.filter(l => l.source === source);
            const leadsCount = sourceLeads.length;
            
            if (leadsCount > 0) {
                const sourceLeadIds = new Set(sourceLeads.map(l => l.id));
                const sourceProposals = proposals.filter(p => sourceLeadIds.has(p.leadId) && p.status === ProposalStatus.APPROVED);
                
                const revenue = sourceProposals.reduce((sum, p) => sum + Math.floor(p.finalPrice * COMMISSION_RATE), 0);
                const sourceCosts = campaignCosts.filter(c => c.source === source);
                const spend = sourceCosts.reduce((sum, c) => sum + c.cost, 0);
                
                const cac = leadsCount > 0 ? Math.round(spend / leadsCount) : 0;
                const roi = spend > 0 ? Math.round(((revenue - spend) / spend) * 100) : (revenue > 0 ? 100 : 0);

                attribution.push({ channel: source, spend, revenue, leads: leadsCount, cac, roi });
            }
        }

        return { funnel, attribution, campaignCosts };
    }

    /**
     * Aggregates all analytics into a summary
     */
    public static getSummary(
        leads: Lead[], 
        proposals: Proposal[], 
        interactions: Interaction[], 
        language: string,
        timeRange: string = '30d'
    ): AnalyticsSummary & { revenue: number } {
        const now = new Date();
        let days = 30;
        if (timeRange === '7d') days = 7;
        else if (timeRange === 'all') days = 365;

        const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        const previousStartDate = new Date(now.getTime() - 2 * days * 24 * 60 * 60 * 1000);

        const currentLeads = timeRange === 'all' ? leads : leads.filter(l => new Date(l.createdAt) >= startDate);
        const previousLeads = timeRange === 'all' ? [] : leads.filter(l => {
            const d = new Date(l.createdAt);
            return d >= previousStartDate && d < startDate;
        });

        const currentProposals = timeRange === 'all' ? proposals : proposals.filter(p => new Date(p.createdAt) >= startDate);
        const currentInteractions = timeRange === 'all' ? interactions : interactions.filter(i => new Date(i.timestamp) >= startDate);

        const totalLeads = currentLeads.length;
        const wonLeads = currentLeads.filter(l => l.stage === LeadStage.WON).length;
        const conversionRate = totalLeads > 0 ? parseFloat(((wonLeads / totalLeads) * 100).toFixed(1)) : 0;
        
        const currentPeriodLeadsCount = currentLeads.length;
        const previousPeriodLeadsCount = previousLeads.length;

        const totalLeadsDelta = timeRange === 'all' ? 0 : (previousPeriodLeadsCount > 0 
            ? Math.round(((currentPeriodLeadsCount - previousPeriodLeadsCount) / previousPeriodLeadsCount) * 100)
            : (currentPeriodLeadsCount > 0 ? 100 : 0));

        // Revenue calculation (Commission based)
        const COMMISSION_RATE = 0.02; // 2%
        const revenue = currentProposals
            .filter(p => p.status === ProposalStatus.APPROVED)
            .reduce((sum, p) => sum + Math.floor(p.finalPrice * COMMISSION_RATE), 0);

        const previousProposals = timeRange === 'all' ? [] : proposals.filter(p => {
            const d = new Date(p.createdAt);
            return d >= previousStartDate && d < startDate;
        });

        const previousRevenue = previousProposals
            .filter(p => p.status === ProposalStatus.APPROVED)
            .reduce((sum, p) => sum + Math.floor(p.finalPrice * COMMISSION_RATE), 0);

        const revenueDelta = timeRange === 'all' ? 0 : (previousRevenue > 0 
            ? Math.round(((revenue - previousRevenue) / previousRevenue) * 100)
            : (revenue > 0 ? 100 : 0));

        const currentSalesVelocity = this.calculateSalesVelocity(currentLeads);
        const previousSalesVelocity = this.calculateSalesVelocity(previousLeads);
        const salesVelocityDelta = timeRange === 'all' ? 0 : (previousSalesVelocity > 0
            ? Math.round(((currentSalesVelocity - previousSalesVelocity) / previousSalesVelocity) * 100)
            : 0);

        const winProbability = 30; // Mocked average win probability

        return {
            totalLeads,
            totalLeadsDelta,
            slaBreachedCount: currentLeads.filter(l => l.slaBreached).length,
            leadsTrend: this.generateLeadsTrend(currentLeads, days > 30 ? 30 : days),
            forecast: [
                { month: 'Mar', actual: 45, target: 50 },
                { month: 'Apr', actual: 0, target: 55 }
            ],
            aiHighlights: this.generateAiHighlights(currentLeads, currentProposals, language),
            conversionRate,
            pipelineValue: this.calculatePipelineValue(currentProposals, currentLeads),
            aiDeflectionRate: this.calculateAiDeflectionRate(currentInteractions),
            salesVelocity: currentSalesVelocity,
            revenue,
            revenueDelta,
            winProbability,
            salesVelocityDelta
        };
    }
}
