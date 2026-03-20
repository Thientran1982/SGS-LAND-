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
  revenueDelta: number;
  pipelineValue: number;
  pipelineValueDelta: number;
  winProbability: number;
  aiDeflectionRate: number;
  aiDeflectionRateDelta: number;
  salesVelocity: number;
  salesVelocityDelta: number;
  conversionRate: number;
  totalLeadsDelta: number;
  leadsByStage: Record<string, number>;
  leadsBySource: Record<string, number>;
  revenueByMonth: { month: string; revenue: number }[];
  leadsTrend: { date: string; count: number }[];
  recentActivities: { type: string; content: string; time: string }[];
  marketPulse: { location: string; area: number; price: number; interest: number }[];
  agentLeaderboard: { name: string; avatar: string; deals: number; closeRate: number; slaScore: number; avgResponseTime: string }[];
  // Scope context for the frontend to display correctly
  scopeLabel: string;   // e.g. "Toàn công ty" | "Dữ liệu của bạn"
}

const GRADE_PROBABILITY: Record<string, number> = {
  A: 0.85,
  B: 0.60,
  C: 0.30,
  D: 0.10,
  F: 0.01,
};

// Roles that see the full tenant scope
const FULL_SCOPE_ROLES = new Set(['ADMIN', 'TEAM_LEAD', 'MARKETING', 'VIEWER']);

function getDaysInterval(timeRange?: string): number {
  if (!timeRange || timeRange === 'all') return 365;
  const n = parseInt(timeRange, 10);
  // Clamp to [1, 3650] so the interpolated value in INTERVAL is always a safe integer.
  if (!isNaN(n) && n > 0) return Math.min(n, 3650);
  return 365;
}

function calcDelta(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'vừa xong';
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} ngày trước`;
}

// Reusable tenant filter expression for use in WHERE clauses
const TENANT_FILTER = `tenant_id = current_setting('app.current_tenant_id', true)::uuid`;

export class AnalyticsRepository extends BaseRepository {
  constructor() {
    super('leads');
  }

  /**
   * Get analytics summary.
   * @param tenantId  - tenant isolation (required)
   * @param timeRange - "7d" | "30d" | "all"
   * @param userId    - current user's UUID (required for RBAC)
   * @param role      - current user's role (required for RBAC)
   *
   * RBAC rules:
   *   SALES      → sees only leads assigned to themselves
   *   TEAM_LEAD  → sees full tenant data (manage their team)
   *   ADMIN / MARKETING / VIEWER → sees full tenant data
   */
  async getSummary(
    tenantId: string,
    timeRange?: string,
    userId?: string,
    role?: string,
  ): Promise<AnalyticsSummary> {
    return this.withTenant(tenantId, async (client) => {
      const days = getDaysInterval(timeRange);
      const useTimeFilter = timeRange && timeRange !== 'all';
      const timeFilter = useTimeFilter ? `AND l.created_at >= NOW() - INTERVAL '${days} days'` : '';
      const prevTimeFilter = useTimeFilter
        ? `AND l.created_at >= NOW() - INTERVAL '${days * 2} days' AND l.created_at < NOW() - INTERVAL '${days} days'`
        : '';

      // ── RBAC: SALES agents only see their own assigned leads ──────────────
      const isSalesScope = role === 'SALES' && userId;
      // Sanitize userId — must be a valid UUID
      const safeUserId = userId ? userId.replace(/[^a-f0-9\-]/gi, '') : null;
      const userLeadFilter = isSalesScope && safeUserId
        ? `AND l.assigned_to = '${safeUserId}'`
        : '';
      const userLeadFilterNoAlias = isSalesScope && safeUserId
        ? `AND assigned_to = '${safeUserId}'`
        : '';
      const scopeLabel = isSalesScope ? 'Dữ liệu của bạn' : 'Toàn công ty';

      const leadsResult = await client.query(`
        SELECT
          COUNT(*)::int as total,
          COUNT(*) FILTER (WHERE stage = 'NEW')::int as new_leads,
          COUNT(*) FILTER (WHERE stage = 'WON')::int as won_leads,
          COUNT(*) FILTER (WHERE stage = 'LOST')::int as lost_leads
        FROM leads l
        WHERE l.${TENANT_FILTER} ${timeFilter} ${userLeadFilter}
      `);

      const prevLeadsResult = useTimeFilter
        ? await client.query(`SELECT COUNT(*)::int as total FROM leads l WHERE l.${TENANT_FILTER} ${prevTimeFilter} ${userLeadFilter}`)
        : { rows: [{ total: 0 }] };

      const leadsByStageResult = await client.query(`
        SELECT stage, COUNT(*)::int as count
        FROM leads
        WHERE ${TENANT_FILTER} ${userLeadFilterNoAlias}
        GROUP BY stage
      `);

      const leadsBySourceResult = await client.query(`
        SELECT COALESCE(source, 'UNKNOWN') as source, COUNT(*)::int as count
        FROM leads
        WHERE ${TENANT_FILTER} ${userLeadFilterNoAlias}
        GROUP BY source
      `);

      // Listings are shared company assets — always full-scope
      const listingsResult = await client.query(`
        SELECT COUNT(*)::int as total, COUNT(*) FILTER (WHERE status = 'AVAILABLE')::int as available
        FROM listings
        WHERE ${TENANT_FILTER}
      `);

      // Proposals: for SALES, only proposals linked to their leads
      const proposalLeadJoin = isSalesScope && safeUserId
        ? `INNER JOIN leads lp ON p.lead_id = lp.id AND lp.tenant_id = p.tenant_id AND lp.assigned_to = '${safeUserId}'`
        : '';
      const proposalsResult = await client.query(`
        SELECT COUNT(p.id)::int as total, COUNT(p.id) FILTER (WHERE p.status = 'APPROVED')::int as approved
        FROM proposals p
        ${proposalLeadJoin}
        WHERE p.${TENANT_FILTER}
      `);

      // Contracts: for SALES, only contracts linked to their leads
      const contractLeadJoin = isSalesScope && safeUserId
        ? `INNER JOIN proposals cp ON c.proposal_id = cp.id AND cp.tenant_id = c.tenant_id
           INNER JOIN leads cl ON cp.lead_id = cl.id AND cl.tenant_id = c.tenant_id AND cl.assigned_to = '${safeUserId}'`
        : '';
      const contractsResult = await client.query(`
        SELECT COUNT(c.id)::int as total, COUNT(c.id) FILTER (WHERE c.status = 'SIGNED')::int as signed
        FROM contracts c
        ${contractLeadJoin}
        WHERE c.${TENANT_FILTER}
      `);

      const commissionRate = parseFloat(process.env.COMMISSION_RATE || '0.02');

      const revenueResult = await client.query(`
        SELECT COALESCE(SUM(p.final_price * $1), 0)::numeric as revenue
        FROM proposals p
        ${proposalLeadJoin}
        WHERE p.${TENANT_FILTER}
          AND p.status = 'APPROVED'
          ${useTimeFilter ? `AND p.created_at >= NOW() - INTERVAL '${days} days'` : ''}
      `, [commissionRate]);

      const prevRevenueResult = useTimeFilter
        ? await client.query(`
            SELECT COALESCE(SUM(p.final_price * $1), 0)::numeric as revenue
            FROM proposals p
            ${proposalLeadJoin}
            WHERE p.${TENANT_FILTER}
              AND p.status = 'APPROVED'
              AND p.created_at >= NOW() - INTERVAL '${days * 2} days'
              AND p.created_at < NOW() - INTERVAL '${days} days'
          `, [commissionRate])
        : { rows: [{ revenue: '0' }] };

      const pipelineResult = await client.query(`
        SELECT
          l.stage,
          l.score->>'grade' as grade,
          COALESCE(SUM(p.final_price), 0)::numeric as total_value,
          COUNT(p.id)::int as deal_count
        FROM leads l
        INNER JOIN proposals p ON l.id = p.lead_id AND p.tenant_id = l.tenant_id
        WHERE l.${TENANT_FILTER}
          AND l.stage NOT IN ('WON', 'LOST')
          AND p.status IN ('APPROVED', 'PENDING_APPROVAL')
          ${isSalesScope && safeUserId ? `AND l.assigned_to = '${safeUserId}'` : ''}
        GROUP BY l.stage, l.score->>'grade'
      `);

      // Interactions: for SALES, only from their leads
      const interactionLeadFilter = isSalesScope && safeUserId
        ? `AND i.lead_id IN (SELECT id FROM leads WHERE ${TENANT_FILTER} AND assigned_to = '${safeUserId}')`
        : '';
      const interactionStats = await client.query(`
        SELECT
          COUNT(*) FILTER (WHERE direction = 'OUTBOUND')::int as total_outbound,
          COUNT(*) FILTER (WHERE direction = 'OUTBOUND' AND (metadata->>'isAi')::boolean = true)::int as ai_outbound
        FROM interactions i
        WHERE i.${TENANT_FILTER} ${interactionLeadFilter}
      `);

      // Previous-period AI deflection rate (for delta calculation)
      const prevInteractionStats = useTimeFilter
        ? await client.query(`
            SELECT
              COUNT(*) FILTER (WHERE direction = 'OUTBOUND')::int as total_outbound,
              COUNT(*) FILTER (WHERE direction = 'OUTBOUND' AND (metadata->>'isAi')::boolean = true)::int as ai_outbound
            FROM interactions i
            WHERE i.${TENANT_FILTER} ${interactionLeadFilter}
              AND i.timestamp >= NOW() - INTERVAL '${days * 2} days'
              AND i.timestamp < NOW() - INTERVAL '${days} days'
          `)
        : { rows: [{ total_outbound: 0, ai_outbound: 0 }] };

      // Previous-period pipeline value (for pipelineValueDelta)
      const prevPipelineResult = useTimeFilter
        ? await client.query(`
            SELECT
              l.score->>'grade' as grade,
              COALESCE(SUM(p.final_price), 0)::numeric as total_value,
              COUNT(p.id)::int as deal_count
            FROM leads l
            INNER JOIN proposals p ON l.id = p.lead_id AND p.tenant_id = l.tenant_id
            WHERE l.${TENANT_FILTER}
              AND l.stage NOT IN ('WON', 'LOST')
              AND p.status IN ('APPROVED', 'PENDING_APPROVAL')
              AND l.created_at >= NOW() - INTERVAL '${days * 2} days'
              AND l.created_at < NOW() - INTERVAL '${days} days'
              ${isSalesScope && safeUserId ? `AND l.assigned_to = '${safeUserId}'` : ''}
            GROUP BY l.score->>'grade'
          `)
        : { rows: [] };

      const salesVelocityResult = await client.query(`
        SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400), 0)::numeric as avg_days
        FROM leads
        WHERE ${TENANT_FILTER}
          AND stage = 'WON'
          ${userLeadFilterNoAlias}
          ${useTimeFilter ? `AND updated_at >= NOW() - INTERVAL '${days} days'` : ''}
      `);

      const prevSalesVelocityResult = useTimeFilter
        ? await client.query(`
            SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400), 0)::numeric as avg_days
            FROM leads
            WHERE ${TENANT_FILTER}
              AND stage = 'WON'
              ${userLeadFilterNoAlias}
              AND updated_at >= NOW() - INTERVAL '${days * 2} days'
              AND updated_at < NOW() - INTERVAL '${days} days'
          `)
        : { rows: [{ avg_days: '0' }] };

      const leadsTrendResult = await client.query(`
        SELECT
          TO_CHAR(created_at, 'DD/MM') as date,
          COUNT(*)::int as count
        FROM leads
        WHERE ${TENANT_FILTER}
          ${userLeadFilterNoAlias}
          ${useTimeFilter ? `AND created_at >= NOW() - INTERVAL '${days} days'` : `AND created_at >= NOW() - INTERVAL '30 days'`}
        GROUP BY TO_CHAR(created_at, 'DD/MM'), DATE(created_at)
        ORDER BY DATE(created_at) ASC
      `);

      const recentActivitiesResult = await client.query(`
        SELECT
          i.type,
          i.content,
          i.timestamp as created_at,
          l.name as lead_name
        FROM interactions i
        LEFT JOIN leads l ON i.lead_id = l.id AND l.tenant_id = i.tenant_id
        WHERE i.${TENANT_FILTER}
          ${interactionLeadFilter}
        ORDER BY i.timestamp DESC
        LIMIT 10
      `);

      // Market pulse: always full-scope (shared listings data)
      const marketPulseResult = await client.query(`
        SELECT
          COALESCE(attributes->>'district', attributes->>'city', 'Khác') as location,
          COALESCE((attributes->>'area')::numeric, 80) as area,
          COALESCE(price, 1000000000) / 1000000000.0 as price_ty
        FROM listings
        WHERE ${TENANT_FILTER}
          AND status = 'AVAILABLE'
        ORDER BY created_at DESC
        LIMIT 20
      `);

      // Agent leaderboard: always full-scope (context for entire team)
      // avgResponseMinutes: median time from first INBOUND to first OUTBOUND per lead, per agent
      const agentLeaderboardResult = await client.query(`
        SELECT
          u.id,
          u.name,
          COALESCE(NULLIF(TRIM(u.avatar), ''), 'https://api.dicebear.com/7.x/initials/svg?seed=' || encode(u.name::bytea, 'base64')) as avatar,
          COUNT(l.id) FILTER (WHERE l.stage = 'WON')::int as deals,
          CASE
            WHEN COUNT(l.id)::int > 0
            THEN ROUND((COUNT(l.id) FILTER (WHERE l.stage = 'WON')::numeric / COUNT(l.id)::numeric) * 100)
            ELSE 0
          END::int as close_rate,
          COUNT(l.id)::int as total_leads,
          (
            SELECT ROUND(AVG(EXTRACT(EPOCH FROM (first_out.ts - first_in.ts)) / 60))::int
            FROM (
              SELECT lead_id, MIN(timestamp) as ts
              FROM interactions
              WHERE direction = 'INBOUND' AND ${TENANT_FILTER}
                AND lead_id IN (SELECT id FROM leads WHERE assigned_to = u.id AND ${TENANT_FILTER})
              GROUP BY lead_id
            ) first_in
            JOIN LATERAL (
              SELECT MIN(timestamp) as ts
              FROM interactions
              WHERE lead_id = first_in.lead_id
                AND direction = 'OUTBOUND'
                AND timestamp > first_in.ts
                AND ${TENANT_FILTER}
            ) first_out ON first_out.ts IS NOT NULL
          ) as avg_response_minutes
        FROM users u
        LEFT JOIN leads l ON l.assigned_to = u.id AND l.tenant_id = u.tenant_id
        WHERE u.${TENANT_FILTER}
          AND u.role IN ('SALES', 'TEAM_LEAD')
        GROUP BY u.id, u.name, u.avatar
        ORDER BY deals DESC
        LIMIT 10
      `);

      const revenueByMonthResult = await client.query(`
        SELECT
          TO_CHAR(p.created_at, 'YYYY-MM') as month,
          SUM(p.final_price * $1)::numeric as revenue
        FROM proposals p
        ${proposalLeadJoin}
        WHERE p.${TENANT_FILTER}
          AND p.status = 'APPROVED'
        GROUP BY TO_CHAR(p.created_at, 'YYYY-MM')
        ORDER BY month DESC
        LIMIT 12
      `, [commissionRate]);

      // ── Compute aggregates ────────────────────────────────────────────────
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

      // Previous pipeline value (for delta)
      let prevPipelineValue = 0;
      for (const row of prevPipelineResult.rows) {
        const grade = row.grade || 'C';
        const prob = GRADE_PROBABILITY[grade] || 0.30;
        const val = parseFloat(row.total_value) || 0;
        prevPipelineValue += val * prob;
      }

      const winProbability = totalDeals > 0 ? (weightedProbSum / totalDeals) * 100 : 0;

      const totalOutbound = interactionStats.rows[0]?.total_outbound || 0;
      const aiOutbound = interactionStats.rows[0]?.ai_outbound || 0;
      const aiDeflectionRate = totalOutbound > 0 ? (aiOutbound / totalOutbound) * 100 : 0;

      // Previous-period AI deflection rate (for delta)
      const prevTotalOutbound = prevInteractionStats.rows[0]?.total_outbound || 0;
      const prevAiOutbound = prevInteractionStats.rows[0]?.ai_outbound || 0;
      const prevAiDeflectionRate = prevTotalOutbound > 0 ? (prevAiOutbound / prevTotalOutbound) * 100 : 0;

      const leadStats = leadsResult.rows[0];
      const prevLeadTotal = prevLeadsResult.rows[0]?.total || 0;
      const listingStats = listingsResult.rows[0];
      const proposalStats = proposalsResult.rows[0];
      const contractStats = contractsResult.rows[0];

      const revenue = parseFloat(revenueResult.rows[0].revenue) || 0;
      const prevRevenue = parseFloat(prevRevenueResult.rows[0].revenue) || 0;

      const salesVelocity = Math.round(parseFloat(salesVelocityResult.rows[0].avg_days) || 0);
      const prevSalesVelocity = Math.round(parseFloat(prevSalesVelocityResult.rows[0].avg_days) || 0);

      const conversionRate = leadStats.total > 0
        ? Math.round((leadStats.won_leads / leadStats.total) * 10000) / 100
        : 0;

      const leadsByStage: Record<string, number> = {};
      for (const row of leadsByStageResult.rows) {
        leadsByStage[row.stage] = row.count;
      }

      const leadsBySource: Record<string, number> = {};
      for (const row of leadsBySourceResult.rows) {
        leadsBySource[row.source] = row.count;
      }

      const recentActivities = recentActivitiesResult.rows.map((row: any) => {
        let type = 'SYSTEM';
        if (row.type === 'CALL' || row.type === 'NOTE') type = 'LEAD';
        else if (row.type === 'EMAIL' || row.type === 'CHAT') type = 'AI';
        else if (row.type === 'MEETING') type = 'DEAL';

        const timeAgo = getTimeAgo(new Date(row.created_at));
        const leadName = row.lead_name || 'Khách hàng';
        return {
          type,
          content: `${leadName}: ${(row.content || '').substring(0, 60)}`,
          time: timeAgo,
        };
      });

      const locationCounts: Record<string, number> = {};
      for (const row of marketPulseResult.rows) {
        const loc = row.location || 'Khác';
        locationCounts[loc] = (locationCounts[loc] || 0) + 1;
      }
      const marketPulse = marketPulseResult.rows.map((row: any) => ({
        location: row.location || 'Khác',
        area: Math.round(parseFloat(row.area) || 80),
        price: Math.round((parseFloat(row.price_ty) || 1) * 10) / 10,
        interest: locationCounts[row.location || 'Khác'] || 1,
      }));

      const agentLeaderboard = agentLeaderboardResult.rows.map((row: any) => {
        // slaScore = close_rate (70%) + response speed bonus (30%)
        // Response speed: ≤10 min → 30pts, ≤30 min → 20pts, ≤60 min → 10pts, >60 min → 0pts
        const avgMins = row.avg_response_minutes != null ? Number(row.avg_response_minutes) : null;
        const responseBonus = avgMins == null ? 0
          : avgMins <= 10 ? 30
          : avgMins <= 30 ? 20
          : avgMins <= 60 ? 10
          : 0;
        const slaScore = Math.min(100, Math.round(row.close_rate * 0.7 + responseBonus));
        return {
          name: row.name,
          avatar: row.avatar,
          deals: row.deals,
          closeRate: row.close_rate,
          slaScore,
          avgResponseTime: avgMins != null ? `${avgMins} phút` : 'N/A',
        };
      });

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
        revenue,
        revenueDelta: calcDelta(revenue, prevRevenue),
        pipelineValue,
        pipelineValueDelta: calcDelta(pipelineValue, prevPipelineValue),
        winProbability: Math.round(winProbability * 100) / 100,
        aiDeflectionRate: Math.round(aiDeflectionRate * 100) / 100,
        aiDeflectionRateDelta: prevAiDeflectionRate > 0 ? calcDelta(aiDeflectionRate, prevAiDeflectionRate) : 0,
        salesVelocity,
        salesVelocityDelta: prevSalesVelocity > 0 ? calcDelta(salesVelocity, prevSalesVelocity) : 0,
        conversionRate,
        totalLeadsDelta: calcDelta(leadStats.total, prevLeadTotal),
        leadsByStage,
        leadsBySource,
        revenueByMonth: revenueByMonthResult.rows.map((r: any) => ({
          month: r.month,
          revenue: parseFloat(r.revenue) || 0,
        })),
        leadsTrend: leadsTrendResult.rows.map((r: any) => ({
          date: r.date,
          count: r.count,
        })),
        recentActivities,
        marketPulse,
        agentLeaderboard,
        scopeLabel,
      };
    });
  }

  async generateBiMarts(
    tenantId: string,
    timeRange?: string,
    userId?: string,
    role?: string,
  ): Promise<any> {
    return this.withTenant(tenantId, async (client) => {
      const days = getDaysInterval(timeRange);
      const useTimeFilter = timeRange && timeRange !== 'all';
      const timeFilterAnd = useTimeFilter ? `AND created_at >= NOW() - INTERVAL '${days} days'` : '';

      const isSalesScope = role === 'SALES' && userId;
      const safeUserId = userId ? userId.replace(/[^a-f0-9\-]/gi, '') : null;
      const userLeadFilter = isSalesScope && safeUserId
        ? `AND assigned_to = '${safeUserId}'`
        : '';
      const userLeadFilterL = isSalesScope && safeUserId
        ? `AND l.assigned_to = '${safeUserId}'`
        : '';

      const funnelResult = await client.query(`
        SELECT stage, COUNT(*)::int as count
        FROM leads
        WHERE ${TENANT_FILTER}
          AND stage != 'LOST'
          ${userLeadFilter}
          ${useTimeFilter ? `AND created_at >= NOW() - INTERVAL '${days} days'` : ''}
        GROUP BY stage
        ORDER BY
          CASE stage
            WHEN 'NEW' THEN 1
            WHEN 'CONTACTED' THEN 2
            WHEN 'QUALIFIED' THEN 3
            WHEN 'PROPOSAL' THEN 4
            WHEN 'NEGOTIATION' THEN 5
            WHEN 'WON' THEN 6
            ELSE 7
          END
      `);

      const attributionResult = await client.query(`
        SELECT
          COALESCE(l.source, 'UNKNOWN') as source,
          COUNT(l.id)::int as lead_count,
          COUNT(l.id) FILTER (WHERE l.stage = 'WON')::int as won_count,
          COALESCE(SUM(p.final_price) FILTER (WHERE l.stage = 'WON'), 0)::numeric as revenue
        FROM leads l
        LEFT JOIN proposals p ON l.id = p.lead_id AND p.tenant_id = l.tenant_id AND p.status = 'APPROVED'
        WHERE l.${TENANT_FILTER}
          ${userLeadFilterL}
          ${timeFilterAnd.replace('created_at', 'l.created_at')}
        GROUP BY l.source
        ORDER BY revenue DESC
      `);

      // Campaign costs: always full-scope (company-level marketing spend)
      const campaignCostsResult = await client.query(`
        SELECT source, COALESCE(SUM(cost), 0)::numeric as total_cost
        FROM campaign_costs
        WHERE ${TENANT_FILTER}
          ${useTimeFilter ? `AND period >= TO_CHAR(NOW() - INTERVAL '${days} days', 'YYYY-MM')` : ''}
        GROUP BY source
      `);

      const costsBySource: Record<string, number> = {};
      for (const row of campaignCostsResult.rows) {
        costsBySource[row.source] = parseFloat(row.total_cost) || 0;
      }

      const attribution = attributionResult.rows.map((row: any) => {
        const revenue = parseFloat(row.revenue) || 0;
        const spend = costsBySource[row.source] || 0;
        const roi = spend > 0 ? ((revenue - spend) / spend) * 100 : 0;
        const leads = row.lead_count || 0;
        const cac = leads > 0 ? spend / leads : 0;
        return {
          channel: row.source,
          leads,
          revenue,
          spend,
          cac: Math.round(cac),
          roi: Math.round(roi * 100) / 100,
        };
      });

      const conversionByPeriodResult = await client.query(`
        SELECT
          TO_CHAR(created_at, 'YYYY-MM') as period,
          COUNT(*)::int as total,
          COUNT(*) FILTER (WHERE stage = 'WON')::int as won,
          COUNT(*) FILTER (WHERE stage = 'LOST')::int as lost
        FROM leads
        WHERE ${TENANT_FILTER}
          ${userLeadFilter}
          ${useTimeFilter ? `AND created_at >= NOW() - INTERVAL '${days} days'` : ''}
        GROUP BY TO_CHAR(created_at, 'YYYY-MM')
        ORDER BY period DESC
        LIMIT 12
      `);

      const conversionByPeriod = conversionByPeriodResult.rows.map((row: any) => ({
        period: row.period,
        total: row.total,
        won: row.won,
        lost: row.lost,
        conversionRate: row.total > 0
          ? Math.round((row.won / row.total) * 10000) / 100
          : 0,
      }));

      const funnel = funnelResult.rows.map((row: any) => ({
        stage: row.stage,
        count: row.count,
      }));

      // conversionRate = each stage's count / NEW stage count (top-of-funnel %)
      // e.g. WON: 5 out of 100 NEW = 5.00% — tells you how many leads made it through
      const newStageCount = funnel.find((f: any) => f.stage === 'NEW')?.count || 0;
      const funnelWithPercentage = funnel.map((f: any) => ({
        ...f,
        conversionRate: newStageCount > 0 ? Math.round((f.count / newStageCount) * 10000) / 100 : 0,
      }));

      const campaignCostsListResult = await client.query(`
        SELECT id, campaign_name, source, cost, period, created_at
        FROM campaign_costs
        WHERE ${TENANT_FILTER}
          ${useTimeFilter ? `AND period >= TO_CHAR(NOW() - INTERVAL '${days} days', 'YYYY-MM')` : ''}
        ORDER BY created_at DESC
        LIMIT 100
      `);

      const campaignCosts = campaignCostsListResult.rows.map((row: any) => ({
        id: row.id,
        campaignName: row.campaign_name,
        source: row.source,
        cost: parseFloat(row.cost) || 0,
        period: row.period,
        createdAt: row.created_at,
      }));

      return {
        funnel: funnelWithPercentage,
        attribution,
        conversionByPeriod,
        campaignCosts,
      };
    });
  }

  async updateCampaignCost(tenantId: string, id: string, cost: number): Promise<any> {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `UPDATE campaign_costs SET cost = $1 WHERE id = $2 AND ${TENANT_FILTER} RETURNING *`,
        [cost, id]
      );
      if (result.rows.length === 0) throw new Error('Campaign cost not found');
      return this.rowToEntity(result.rows[0]);
    });
  }

  async createCampaignCost(tenantId: string, data: { campaignName: string; source: string; cost: number; period: string }): Promise<any> {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `INSERT INTO campaign_costs (tenant_id, campaign_name, source, cost, period)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [tenantId, data.campaignName, data.source, data.cost, data.period]
      );
      return this.rowToEntity(result.rows[0]);
    });
  }

  async deleteCampaignCost(tenantId: string, id: string): Promise<void> {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `DELETE FROM campaign_costs WHERE id = $1 AND ${TENANT_FILTER} RETURNING id`,
        [id]
      );
      if (result.rows.length === 0) throw new Error('Campaign cost not found');
    });
  }
}

export const analyticsRepository = new AnalyticsRepository();
