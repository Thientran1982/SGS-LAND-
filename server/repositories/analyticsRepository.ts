import { BaseRepository } from './baseRepository';

export interface AnalyticsSummary {
  totalLeads: number;
  newLeads: number;
  wonLeads: number;
  lostLeads: number;
  totalListings: number;
  availableListings: number;
  totalProposals: number;
  approvedProposals: number;
  totalContracts: number;
  signedContracts: number;
  revenue: number;
  pipelineValue: number;
  winProbability: number;
  aiDeflectionRate: number;
  leadsByStage: Record<string, number>;
  leadsBySource: Record<string, number>;
  revenueByMonth: { month: string; revenue: number }[];
}

const STAGE_PROBABILITY: Record<string, number> = {
  NEW: 0.05,
  CONTACTED: 0.10,
  QUALIFIED: 0.30,
  PROPOSAL: 0.50,
  NEGOTIATION: 0.70,
  WON: 1.0,
  LOST: 0,
};

const GRADE_PROBABILITY: Record<string, number> = {
  A: 0.85,
  B: 0.60,
  C: 0.30,
  D: 0.10,
  F: 0.01,
};

export class AnalyticsRepository extends BaseRepository {
  constructor() {
    super('leads');
  }

  async getSummary(tenantId: string, timeRange?: string): Promise<AnalyticsSummary> {
    return this.withTenant(tenantId, async (client) => {
      let timeFilter = '';
      const timeValues: any[] = [];
      if (timeRange && timeRange !== 'all') {
        const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365;
        timeFilter = `AND l.created_at >= NOW() - INTERVAL '${days} days'`;
      }

      const leadsResult = await client.query(`
        SELECT
          COUNT(*)::int as total,
          COUNT(*) FILTER (WHERE stage = 'NEW')::int as new_leads,
          COUNT(*) FILTER (WHERE stage = 'WON')::int as won_leads,
          COUNT(*) FILTER (WHERE stage = 'LOST')::int as lost_leads
        FROM leads l
        WHERE 1=1 ${timeFilter}
      `, timeValues);

      const leadsByStageResult = await client.query(`
        SELECT stage, COUNT(*)::int as count FROM leads GROUP BY stage
      `);

      const leadsBySourceResult = await client.query(`
        SELECT COALESCE(source, 'UNKNOWN') as source, COUNT(*)::int as count FROM leads GROUP BY source
      `);

      const listingsResult = await client.query(`
        SELECT
          COUNT(*)::int as total,
          COUNT(*) FILTER (WHERE status = 'AVAILABLE')::int as available
        FROM listings
      `);

      const proposalsResult = await client.query(`
        SELECT
          COUNT(*)::int as total,
          COUNT(*) FILTER (WHERE status = 'APPROVED')::int as approved
        FROM proposals
      `);

      const contractsResult = await client.query(`
        SELECT
          COUNT(*)::int as total,
          COUNT(*) FILTER (WHERE status = 'SIGNED')::int as signed
        FROM contracts
      `);

      const revenueResult = await client.query(`
        SELECT COALESCE(SUM(final_price * 0.02), 0)::numeric as revenue
        FROM proposals WHERE status = 'APPROVED'
      `);

      const pipelineResult = await client.query(`
        SELECT
          l.stage,
          l.score->>'grade' as grade,
          COALESCE(SUM(p.final_price), 0)::numeric as total_value,
          COUNT(p.id)::int as deal_count
        FROM leads l
        INNER JOIN proposals p ON l.id = p.lead_id
        WHERE l.stage NOT IN ('WON', 'LOST') AND p.status IN ('APPROVED', 'PENDING_APPROVAL')
        GROUP BY l.stage, l.score->>'grade'
      `);

      let pipelineValue = 0;
      let weightedProbSum = 0;
      let totalDeals = 0;

      for (const row of pipelineResult.rows) {
        const grade = row.grade || 'C';
        const prob = GRADE_PROBABILITY[grade] || 0.30;
        const val = parseFloat(row.total_value) || 0;
        const count = row.deal_count || 0;
        pipelineValue += val * prob;
        weightedProbSum += prob * count;
        totalDeals += count;
      }

      const winProbability = totalDeals > 0 ? (weightedProbSum / totalDeals) * 100 : 0;

      const interactionStats = await client.query(`
        SELECT
          COUNT(*) FILTER (WHERE direction = 'OUTBOUND')::int as total_outbound,
          COUNT(*) FILTER (WHERE direction = 'OUTBOUND' AND (metadata->>'isAi')::boolean = true)::int as ai_outbound
        FROM interactions
      `);
      const totalOutbound = interactionStats.rows[0]?.total_outbound || 0;
      const aiOutbound = interactionStats.rows[0]?.ai_outbound || 0;
      const aiDeflectionRate = totalOutbound > 0 ? (aiOutbound / totalOutbound) * 100 : 0;

      const revenueByMonthResult = await client.query(`
        SELECT
          TO_CHAR(created_at, 'YYYY-MM') as month,
          SUM(final_price * 0.02)::numeric as revenue
        FROM proposals
        WHERE status = 'APPROVED'
        GROUP BY TO_CHAR(created_at, 'YYYY-MM')
        ORDER BY month DESC
        LIMIT 12
      `);

      const leadStats = leadsResult.rows[0];
      const listingStats = listingsResult.rows[0];
      const proposalStats = proposalsResult.rows[0];
      const contractStats = contractsResult.rows[0];

      const leadsByStage: Record<string, number> = {};
      for (const row of leadsByStageResult.rows) {
        leadsByStage[row.stage] = row.count;
      }

      const leadsBySource: Record<string, number> = {};
      for (const row of leadsBySourceResult.rows) {
        leadsBySource[row.source] = row.count;
      }

      return {
        totalLeads: leadStats.total,
        newLeads: leadStats.new_leads,
        wonLeads: leadStats.won_leads,
        lostLeads: leadStats.lost_leads,
        totalListings: listingStats.total,
        availableListings: listingStats.available,
        totalProposals: proposalStats.total,
        approvedProposals: proposalStats.approved,
        totalContracts: contractStats.total,
        signedContracts: contractStats.signed,
        revenue: parseFloat(revenueResult.rows[0].revenue) || 0,
        pipelineValue,
        winProbability: Math.round(winProbability * 100) / 100,
        aiDeflectionRate: Math.round(aiDeflectionRate * 100) / 100,
        leadsByStage,
        leadsBySource,
        revenueByMonth: revenueByMonthResult.rows.map(r => ({
          month: r.month,
          revenue: parseFloat(r.revenue) || 0,
        })),
      };
    });
  }
}

export const analyticsRepository = new AnalyticsRepository();
