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
  recentActivities: { id: string; type: string; content: string; time: string }[];
  marketPulse: { location: string; area: number; price: number; pricePerM2: number; interest: number }[];
  agentLeaderboard: { name: string; avatar: string | null; deals: number; closeRate: number; slaScore: number; avgResponseMinutes: number | null }[];
  // Scope context for the frontend to display correctly
  scopeLabel: 'personal' | 'company'; // stable i18n key — frontend translates
  commissionRate: number;              // actual rate from env (e.g. 0.02 = 2%)
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
      // Validate userId is a proper UUID (strict format check, not just char stripping)
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const safeUserId = userId && UUID_RE.test(userId) ? userId : null;
      const userLeadFilter = isSalesScope && safeUserId
        ? `AND l.assigned_to = '${safeUserId}'::uuid`
        : '';
      const userLeadFilterNoAlias = isSalesScope && safeUserId
        ? `AND assigned_to = '${safeUserId}'::uuid`
        : '';
      const scopeLabel = isSalesScope ? 'personal' : 'company';

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
        ? `INNER JOIN leads lp ON p.lead_id = lp.id AND lp.tenant_id = p.tenant_id AND lp.assigned_to = '${safeUserId}'::uuid`
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
           INNER JOIN leads cl ON cp.lead_id = cl.id AND cl.tenant_id = c.tenant_id AND cl.assigned_to = '${safeUserId}'::uuid`
        : '';
      const contractsResult = await client.query(`
        SELECT COUNT(c.id)::int as total, COUNT(c.id) FILTER (WHERE c.status = 'SIGNED')::int as signed
        FROM contracts c
        ${contractLeadJoin}
        WHERE c.${TENANT_FILTER}
      `);

      const commissionRate = parseFloat(process.env.COMMISSION_RATE || '0.02');

      // Revenue JOIN: proposals must belong to WON leads (APPROVED proposal + WON lead = recognised revenue).
      // For SALES scope also enforce assigned_to filter. This is consistent with generateBiMarts attribution.
      const wonLeadJoin = isSalesScope && safeUserId
        ? `INNER JOIN leads lrev ON p.lead_id = lrev.id AND lrev.tenant_id = p.tenant_id AND lrev.stage = 'WON' AND lrev.assigned_to = '${safeUserId}'::uuid`
        : `INNER JOIN leads lrev ON p.lead_id = lrev.id AND lrev.tenant_id = p.tenant_id AND lrev.stage = 'WON'`;

      // Filter revenue by won_at (deal close date) — financially correct.
      // Fallback to lrev.updated_at for legacy WON leads that pre-date the won_at column.
      //
      // Dedup: keep only the LATEST approved proposal per WON lead.
      // If a deal was renegotiated (multiple APPROVED proposals exist), only the most
      // recently approved one counts — prevents double-counting inflating revenue.
      const latestApprovedProposalFilter = `
        AND p.updated_at = (
          SELECT MAX(p2.updated_at)
          FROM proposals p2
          WHERE p2.lead_id = p.lead_id
            AND p2.tenant_id = p.tenant_id
            AND p2.status = 'APPROVED'
        )
      `;

      const revenueResult = await client.query(`
        SELECT COALESCE(SUM(p.final_price * $1), 0)::numeric as revenue
        FROM proposals p
        ${wonLeadJoin}
        WHERE p.${TENANT_FILTER}
          AND p.status = 'APPROVED'
          ${latestApprovedProposalFilter}
          ${useTimeFilter ? `AND COALESCE(lrev.won_at, lrev.updated_at) >= NOW() - INTERVAL '${days} days'` : ''}
      `, [commissionRate]);

      const prevRevenueResult = useTimeFilter
        ? await client.query(`
            SELECT COALESCE(SUM(p.final_price * $1), 0)::numeric as revenue
            FROM proposals p
            ${wonLeadJoin}
            WHERE p.${TENANT_FILTER}
              AND p.status = 'APPROVED'
              ${latestApprovedProposalFilter}
              AND COALESCE(lrev.won_at, lrev.updated_at) >= NOW() - INTERVAL '${days * 2} days'
              AND COALESCE(lrev.won_at, lrev.updated_at) < NOW() - INTERVAL '${days} days'
          `, [commissionRate])
        : { rows: [{ revenue: '0' }] };

      // ── SOLD listing commission (stored directly on listing, not via proposals) ──
      // commission_unit = 'PERCENT': revenue = price * commission / 100
      // commission_unit = 'FIXED' or other: revenue = commission (fixed amount)
      const listingUserFilter = isSalesScope && safeUserId
        ? `AND (l.assigned_to = '${safeUserId}'::uuid OR l.created_by = '${safeUserId}'::uuid)`
        : '';
      const listingRevenueResult = await client.query(`
        SELECT COALESCE(SUM(
          CASE WHEN l.commission_unit = 'PERCENT' THEN l.price * l.commission / 100
               ELSE l.commission END
        ), 0)::numeric as revenue
        FROM listings l
        WHERE l.${TENANT_FILTER}
          AND l.status = 'SOLD'
          AND l.commission IS NOT NULL AND l.commission > 0
          ${listingUserFilter}
          ${useTimeFilter ? `AND l.updated_at >= NOW() - INTERVAL '${days} days'` : ''}
      `);
      const prevListingRevenueResult = useTimeFilter
        ? await client.query(`
            SELECT COALESCE(SUM(
              CASE WHEN l.commission_unit = 'PERCENT' THEN l.price * l.commission / 100
                   ELSE l.commission END
            ), 0)::numeric as revenue
            FROM listings l
            WHERE l.${TENANT_FILTER}
              AND l.status = 'SOLD'
              AND l.commission IS NOT NULL AND l.commission > 0
              ${listingUserFilter}
              AND l.updated_at >= NOW() - INTERVAL '${days * 2} days'
              AND l.updated_at < NOW() - INTERVAL '${days} days'
          `)
        : { rows: [{ revenue: '0' }] };

      // Pipeline value: total expected value of currently open deals, weighted by AI grade probability.
      // Apply the same period filter as other metrics so the delta compares equal windows
      // (new pipeline created this period vs new pipeline created last period).
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
          ${isSalesScope && safeUserId ? `AND l.assigned_to = '${safeUserId}'::uuid` : ''}
          ${useTimeFilter ? `AND l.created_at >= NOW() - INTERVAL '${days} days'` : ''}
        GROUP BY l.stage, l.score->>'grade'
      `);

      // Interactions: for SALES, only from their leads
      const interactionLeadFilter = isSalesScope && safeUserId
        ? `AND i.lead_id IN (SELECT id FROM leads WHERE ${TENANT_FILTER} AND assigned_to = '${safeUserId}'::uuid)`
        : '';
      // Time-scoped AI deflection: filter current period so the rate reflects the selected window,
      // not an all-time average that makes the delta comparison meaningless.
      // AI detection: count as automated when isAi=true OR isAgent=true in metadata.
      // queue.ts saves { isAgent: true } (auto-reply worker); ai.ts may save { isAi: true }.
      // Both flags indicate a fully-automated outbound response — must check either.
      const AI_FLAG_FILTER = `(metadata->>'isAi' = 'true' OR metadata->>'isAgent' = 'true')`;
      const interactionStats = await client.query(`
        SELECT
          COUNT(*) FILTER (WHERE direction = 'OUTBOUND')::int as total_outbound,
          COUNT(*) FILTER (WHERE direction = 'OUTBOUND' AND ${AI_FLAG_FILTER})::int as ai_outbound
        FROM interactions i
        WHERE i.${TENANT_FILTER} ${interactionLeadFilter}
          ${useTimeFilter ? `AND i.timestamp >= NOW() - INTERVAL '${days} days'` : ''}
      `);

      // Previous-period AI deflection rate (for delta calculation)
      const prevInteractionStats = useTimeFilter
        ? await client.query(`
            SELECT
              COUNT(*) FILTER (WHERE direction = 'OUTBOUND')::int as total_outbound,
              COUNT(*) FILTER (WHERE direction = 'OUTBOUND' AND ${AI_FLAG_FILTER})::int as ai_outbound
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
              ${isSalesScope && safeUserId ? `AND l.assigned_to = '${safeUserId}'::uuid` : ''}
            GROUP BY l.score->>'grade'
          `)
        : { rows: [] };

      // Sales velocity: average days from listing/lead created → deal closed.
      // Sources combined via UNION for the most complete picture:
      //   1. WON leads: created_at → COALESCE(won_at, updated_at)
      //   2. SOLD listings: created_at → updated_at (proxy for sold date; no sold_at column yet)
      // Using won_at (m024) for accuracy where available; fall back to updated_at for legacy rows.
      const salesVelocityResult = await client.query(`
        SELECT COALESCE(AVG(days), 0)::numeric as avg_days FROM (
          SELECT EXTRACT(EPOCH FROM (COALESCE(won_at, updated_at) - created_at)) / 86400 as days
          FROM leads
          WHERE ${TENANT_FILTER}
            AND stage = 'WON'
            ${userLeadFilterNoAlias}
            ${useTimeFilter ? `AND COALESCE(won_at, updated_at) >= NOW() - INTERVAL '${days} days'` : ''}
          UNION ALL
          SELECT EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400 as days
          FROM listings
          WHERE ${TENANT_FILTER}
            AND status = 'SOLD'
            AND updated_at > created_at
            ${useTimeFilter ? `AND updated_at >= NOW() - INTERVAL '${days} days'` : ''}
        ) combined
        WHERE days > 0
      `);

      const prevSalesVelocityResult = useTimeFilter
        ? await client.query(`
            SELECT COALESCE(AVG(days), 0)::numeric as avg_days FROM (
              SELECT EXTRACT(EPOCH FROM (COALESCE(won_at, updated_at) - created_at)) / 86400 as days
              FROM leads
              WHERE ${TENANT_FILTER}
                AND stage = 'WON'
                ${userLeadFilterNoAlias}
                AND COALESCE(won_at, updated_at) >= NOW() - INTERVAL '${days * 2} days'
                AND COALESCE(won_at, updated_at) < NOW() - INTERVAL '${days} days'
              UNION ALL
              SELECT EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400 as days
              FROM listings
              WHERE ${TENANT_FILTER}
                AND status = 'SOLD'
                AND updated_at > created_at
                AND updated_at >= NOW() - INTERVAL '${days * 2} days'
                AND updated_at < NOW() - INTERVAL '${days} days'
            ) combined
            WHERE days > 0
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
          i.id,
          i.type,
          i.content,
          i.metadata,
          i.timestamp as created_at,
          l.name as lead_name
        FROM interactions i
        LEFT JOIN leads l ON i.lead_id = l.id AND l.tenant_id = i.tenant_id
        WHERE i.${TENANT_FILTER}
          ${interactionLeadFilter}
        ORDER BY i.timestamp DESC
        LIMIT 10
      `);

      // Market pulse: scatter plot of available listings (price vs area, coloured by district).
      // interest = number of proposals submitted for listings in the same district — a true
      // demand signal rather than a supply count.
      //
      // AREA priority: li.area (top-level column added m009) → attributes->>'area' → skip row.
      // Never default to a magic number (80) — if area is unknown the dot is meaningless.
      // PRICE: only include listings with price > 0 and a valid area so the chart is honest.
      // price_per_m2 returned for tooltip display (triệu/m²).
      const marketPulseResult = await client.query(`
        SELECT
          COALESCE(li.attributes->>'district', li.attributes->>'city', 'Khác') as location,
          COALESCE(li.area, (li.attributes->>'area')::numeric) as area,
          li.price / 1000000000.0 as price_ty,
          ROUND(li.price / COALESCE(li.area, (li.attributes->>'area')::numeric) / 1000000.0) as price_per_m2_trieu,
          COUNT(p.id)::int as proposal_demand
        FROM listings li
        LEFT JOIN proposals p ON p.listing_id = li.id AND p.tenant_id = li.tenant_id
        WHERE li.${TENANT_FILTER}
          AND li.status = 'AVAILABLE'
          AND li.price > 0
          -- Sanity cap: exclude clear data-entry errors (> 100,000 tỷ = 10^14 VND).
          -- Corrupted prices (e.g. price entered in tỷ then multiplied by 10^9 again)
          -- would otherwise collapse the Y-axis and make the chart unreadable.
          AND li.price < 100000000000000
          AND COALESCE(li.area, (li.attributes->>'area')::numeric) > 0
        GROUP BY li.id, li.area, li.attributes, li.price, li.created_at
        ORDER BY li.created_at DESC
        LIMIT 20
      `);

      // Agent leaderboard: always full-scope (context for entire team)
      // avgResponseMinutes: median time from first INBOUND to first OUTBOUND per lead, per agent
      // deals = WON leads + SOLD listings (agent is assigned_to or created_by).
      // This is consistent with how revenue is calculated — teams often mark listings SOLD
      // without moving leads through WON stage, so counting only WON leads underreports deals.
      // close_rate = deals / (deals + LOST leads) × 100.
      const agentLeaderboardResult = await client.query(`
        SELECT
          u.id,
          u.name,
          -- Return actual avatar URL if set; NULL otherwise.
          -- Frontend AgentAvatar handles NULL gracefully with a coloured initials badge —
          -- much better than a DiceBear URL keyed on base64(name) which shows wrong initials.
          NULLIF(TRIM(COALESCE(u.avatar, '')), '') as avatar,
          (
            COUNT(l.id) FILTER (WHERE l.stage = 'WON')
            + COALESCE(sold.cnt, 0)
          )::int AS deals,
          -- Close rate = (WON leads + SOLD listings) / (deals + LOST leads).
          -- Including SOLD listings ensures agents who close deals via the inventory
          -- (without moving a lead to WON) are credited correctly.
          CASE
            WHEN (
              COUNT(l.id) FILTER (WHERE l.stage = 'WON')
              + COUNT(l.id) FILTER (WHERE l.stage = 'LOST')
              + COALESCE(sold.cnt, 0)
            ) > 0
            THEN ROUND(
              (COUNT(l.id) FILTER (WHERE l.stage = 'WON') + COALESCE(sold.cnt, 0))::numeric
              / (
                  COUNT(l.id) FILTER (WHERE l.stage = 'WON')
                  + COUNT(l.id) FILTER (WHERE l.stage = 'LOST')
                  + COALESCE(sold.cnt, 0)
                )::numeric
              * 100
            )
            ELSE 0
          END::int AS close_rate,
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
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int AS cnt
          FROM listings li
          WHERE (li.assigned_to = u.id OR li.created_by = u.id)
            AND li.status = 'SOLD'
            AND li.tenant_id = u.tenant_id
        ) sold ON true
        WHERE u.${TENANT_FILTER}
          AND u.role IN ('SALES', 'TEAM_LEAD')
        GROUP BY u.id, u.name, u.avatar, sold.cnt
        ORDER BY deals DESC
        LIMIT 10
      `);

      // Group by the month the deal was WON (won_at), not when the proposal was created.
      // Fallback to lrev.updated_at for legacy rows that pre-date the won_at column.
      // Dedup: same latestApprovedProposalFilter as revenueResult — one price per WON deal.
      const revenueByMonthResult = await client.query(`
        SELECT
          TO_CHAR(COALESCE(lrev.won_at, lrev.updated_at), 'YYYY-MM') as month,
          SUM(p.final_price * $1)::numeric as revenue
        FROM proposals p
        ${wonLeadJoin}
        WHERE p.${TENANT_FILTER}
          AND p.status = 'APPROVED'
          ${latestApprovedProposalFilter}
        GROUP BY TO_CHAR(COALESCE(lrev.won_at, lrev.updated_at), 'YYYY-MM')
        ORDER BY month DESC
        LIMIT 12
      `, [commissionRate]);

      // SOLD listing commission by month (merged into revenueByMonth below)
      const listingRevenueByMonthResult = await client.query(`
        SELECT
          TO_CHAR(l.updated_at, 'YYYY-MM') as month,
          SUM(
            CASE WHEN l.commission_unit = 'PERCENT' THEN l.price * l.commission / 100
                 ELSE l.commission END
          )::numeric as revenue
        FROM listings l
        WHERE l.${TENANT_FILTER}
          AND l.status = 'SOLD'
          AND l.commission IS NOT NULL AND l.commission > 0
          ${listingUserFilter}
        GROUP BY TO_CHAR(l.updated_at, 'YYYY-MM')
        ORDER BY month DESC
        LIMIT 12
      `);

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

      const revenue = (parseFloat(revenueResult.rows[0].revenue) || 0)
                    + (parseFloat(listingRevenueResult.rows[0].revenue) || 0);
      const prevRevenue = (parseFloat(prevRevenueResult.rows[0].revenue) || 0)
                        + (parseFloat(prevListingRevenueResult.rows[0].revenue) || 0);

      // Keep 1 decimal place so sub-day velocities (e.g., 0.08 days) show as "0.1" instead of 0.
      const salesVelocity = Math.round((parseFloat(salesVelocityResult.rows[0].avg_days) || 0) * 10) / 10;
      const prevSalesVelocity = Math.round((parseFloat(prevSalesVelocityResult.rows[0].avg_days) || 0) * 10) / 10;

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
        const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
        const isAi = meta.isAi === true;
        let type = 'SYSTEM';
        if (row.type === 'CALL' || row.type === 'NOTE') type = 'LEAD';
        else if (isAi || row.type === 'EMAIL' || row.type === 'CHAT') type = 'AI';
        else if (row.type === 'MEETING') type = 'DEAL';

        const leadName = row.lead_name || 'Khách hàng';
        return {
          id: row.id,
          type,
          content: `${leadName}: ${(row.content || '').substring(0, 60)}`,
          // Return raw ISO timestamp — frontend formats with locale-aware getTimeAgo()
          time: new Date(row.created_at).toISOString(),
        };
      });

      const marketPulse = marketPulseResult.rows
        .map((row: any) => {
          const area    = Math.round(parseFloat(row.area) || 0);
          const price   = Math.round((parseFloat(row.price_ty) || 0) * 10) / 10;
          const perM2   = Math.round(parseFloat(row.price_per_m2_trieu) || 0);
          return {
            location:   row.location || 'Khác',
            area,
            price,
            // price per m² in triệu — shown in tooltip so team can spot data-entry errors
            pricePerM2: perM2,
            // proposal_demand = number of proposals for this listing → true demand signal.
            // Use 1 as minimum so every dot is visible on the scatter chart.
            interest: Math.max(1, parseInt(row.proposal_demand) || 0),
          };
        })
        // Safety: skip any rows that slipped through without valid area/price
        .filter((r: any) => r.area > 0 && r.price > 0);

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
          id: row.id,
          name: row.name,
          avatar: row.avatar ?? null,
          deals: row.deals,
          closeRate: row.close_rate,
          slaScore,
          // Return raw minutes as a number so the frontend can localise the unit label.
          avgResponseMinutes: avgMins,
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
        // Negate: fewer days = faster = better. calcDelta returns positive when current > previous,
        // but for velocity a positive change (more days) is BAD, so we flip the sign so the
        // TrendIndicator correctly colours improvement (fewer days) as green.
        salesVelocityDelta: prevSalesVelocity > 0 ? -calcDelta(salesVelocity, prevSalesVelocity) : 0,
        conversionRate,
        totalLeadsDelta: calcDelta(leadStats.total, prevLeadTotal),
        leadsByStage,
        leadsBySource,
        revenueByMonth: (() => {
          // Merge proposal revenue + SOLD listing commission by month
          const map = new Map<string, number>();
          for (const r of revenueByMonthResult.rows) {
            map.set(r.month, (map.get(r.month) || 0) + (parseFloat(r.revenue) || 0));
          }
          for (const r of listingRevenueByMonthResult.rows) {
            map.set(r.month, (map.get(r.month) || 0) + (parseFloat(r.revenue) || 0));
          }
          return Array.from(map.entries())
            .map(([month, revenue]) => ({ month, revenue }))
            .sort((a, b) => b.month.localeCompare(a.month))
            .slice(0, 12);
        })(),
        leadsTrend: leadsTrendResult.rows.map((r: any) => ({
          date: r.date,
          count: r.count,
        })),
        recentActivities,
        marketPulse,
        agentLeaderboard,
        scopeLabel,
        commissionRate,
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
      const UUID_RE_L = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const safeUserId = userId && UUID_RE_L.test(userId) ? userId : null;
      const userLeadFilter = isSalesScope && safeUserId
        ? `AND assigned_to = '${safeUserId}'`
        : '';
      const userLeadFilterL = isSalesScope && safeUserId
        ? `AND l.assigned_to = '${safeUserId}'`
        : '';

      // Same commission rate as getSummary — must be consistent across all revenue calculations
      const commissionRate = parseFloat(process.env.COMMISSION_RATE || '0.02');

      // Funnel: include ALL stages (including LOST) so the denominator for conversion rates
      // reflects the true total. LOST leads are filtered out of the visual bars on the frontend
      // but included in the total count used as the denominator.
      const funnelResult = await client.query(`
        SELECT stage, COUNT(*)::int as count
        FROM leads
        WHERE ${TENANT_FILTER}
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
            WHEN 'LOST' THEN 7
            ELSE 8
          END
      `);

      // Attribution revenue semantics (aligned with Dashboard):
      //   lead_count  = leads CREATED in the selected period from each channel (acquisition metric).
      //   won_count   = deals CLOSED (won_at) in the selected period from each channel.
      //   revenue     = commission from proposals of those CLOSED deals — matches Dashboard total.
      //
      // LATERAL join: pick the single latest APPROVED proposal per lead so re-negotiations
      // (multiple APPROVED proposals for the same lead) are never double-counted.
      //
      // WHERE union: include leads created in period OR won in period so both metrics are accurate.
      const wonAtFilter = useTimeFilter
        ? `AND COALESCE(l.won_at, l.updated_at) >= NOW() - INTERVAL '${days} days'`
        : '';
      // lead_count filter: when useTimeFilter=false (all-time), count all leads (no date restriction).
      const leadCountFilter = useTimeFilter
        ? `WHERE l.created_at >= NOW() - INTERVAL '${days} days'`
        : 'WHERE TRUE';
      const attributionResult = await client.query(`
        SELECT
          COALESCE(l.source, 'UNKNOWN') as source,
          COUNT(l.id) FILTER (${leadCountFilter})::int as lead_count,
          COUNT(l.id) FILTER (
            WHERE l.stage = 'WON' ${wonAtFilter}
          )::int as won_count,
          COALESCE(SUM(p.final_price * $1) FILTER (
            WHERE l.stage = 'WON' ${wonAtFilter}
          ), 0)::numeric as revenue
        FROM leads l
        LEFT JOIN LATERAL (
          SELECT final_price
          FROM proposals pinner
          WHERE pinner.lead_id = l.id
            AND pinner.tenant_id = l.tenant_id
            AND pinner.status = 'APPROVED'
          ORDER BY pinner.updated_at DESC
          LIMIT 1
        ) p ON true
        WHERE l.${TENANT_FILTER}
          ${userLeadFilterL}
          ${useTimeFilter ? `AND (
            l.created_at >= NOW() - INTERVAL '${days} days'
            OR (l.stage = 'WON' AND COALESCE(l.won_at, l.updated_at) >= NOW() - INTERVAL '${days} days')
          )` : ''}
        GROUP BY l.source
        ORDER BY revenue DESC
      `, [commissionRate]);

      // Campaign costs: always full-scope (company-level marketing spend)
      const campaignCostsResult = await client.query(`
        SELECT source, COALESCE(SUM(cost), 0)::numeric as total_cost
        FROM campaign_costs
        WHERE ${TENANT_FILTER}
          ${useTimeFilter ? `AND period >= TO_CHAR(NOW() - INTERVAL '${days} days', 'YYYY-MM')` : ''}
        GROUP BY source
      `);

      // normalizeSource must be defined before costsBySource so we can normalize
      // campaign cost keys the same way as lead sources.
      // This prevents ROI/spend lookup failures when sources use variant spellings
      // (e.g. "FB" in campaign_costs vs "Facebook" grouped from leads).
      const normalizeSource = (raw: string): string => {
        const map: Record<string, string> = {
          // Website variants
          'web': 'Website', 'WEB': 'Website', 'website': 'Website', 'WEBSITE': 'Website',
          // Facebook variants
          'facebook': 'Facebook', 'FACEBOOK': 'Facebook', 'FB': 'Facebook', 'fb': 'Facebook',
          // Zalo variants
          'zalo': 'Zalo', 'ZALO': 'Zalo',
          // Google variants
          'google': 'Google', 'GOOGLE': 'Google',
          // TikTok variants
          'tiktok': 'Tiktok', 'TIKTOK': 'Tiktok', 'TikTok': 'Tiktok',
          // Referral variants (including Vietnamese)
          'referral': 'Referral', 'REFERRAL': 'Referral',
          'Giới thiệu': 'Referral', 'giới thiệu': 'Referral',
          // Direct/Walk-in variants (including Vietnamese)
          'direct': 'Direct', 'DIRECT': 'Direct',
          'Khách vãng lai': 'Direct', 'khách vãng lai': 'Direct',
          // Event variants
          'event': 'Event', 'EVENT': 'Event', 'Sự kiện': 'Event', 'sự kiện': 'Event',
          // QR code widget (source=QR appended by LiveChat widget)
          'QR': 'QR Code', 'qr': 'QR Code', 'QR_CODE': 'QR Code', 'qr_code': 'QR Code',
          // Other / Unknown catch-all
          'other': 'Other', 'OTHER': 'Other',
          'unknown': 'Other', 'UNKNOWN': 'Other', 'Khác': 'Other',
        };
        return map[raw] || raw;
      };

      // Build costsBySource keyed by NORMALIZED source name so lookups succeed regardless
      // of how the user entered the source in campaign_costs (e.g. "FB" → "Facebook").
      const costsBySource: Record<string, number> = {};
      for (const row of campaignCostsResult.rows) {
        const normalizedKey = normalizeSource(row.source);
        costsBySource[normalizedKey] = (costsBySource[normalizedKey] || 0) + (parseFloat(row.total_cost) || 0);
      }

      const attribution = attributionResult.rows.map((row: any) => {
        const normalizedSource = normalizeSource(row.source);
        const revenue = parseFloat(row.revenue) || 0;
        // costsBySource keys are already normalized — single lookup is sufficient.
        const spend = costsBySource[normalizedSource] || 0;
        const roi = spend > 0 ? ((revenue - spend) / spend) * 100 : 0;
        const leads = row.lead_count || 0;
        // CAC = spend / customers acquired (WON leads), not total leads.
        // Total leads / spend would be CPL (Cost Per Lead) — a different metric.
        const wonLeads = row.won_count || 0;
        const cac = wonLeads > 0 ? spend / wonLeads : 0;
        return {
          channel: normalizedSource,
          leads,
          revenue,
          spend,
          cac: Math.round(cac),
          roi: Math.round(roi * 100) / 100,
        };
      });

      // ── SOLD listing commission: add as "DIRECT_SALE" attribution row ────────
      // Listings sold directly (without a lead/proposal) have their own commission
      // field. They don't come from any marketing channel, so they appear separately.
      const listingUserFilterBi = isSalesScope && safeUserId
        ? `AND (li.assigned_to = '${safeUserId}'::uuid OR li.created_by = '${safeUserId}'::uuid)`
        : '';
      const listingCommissionResult = await client.query(`
        SELECT COALESCE(SUM(
          CASE WHEN li.commission_unit = 'PERCENT' THEN li.price * li.commission / 100
               ELSE li.commission END
        ), 0)::numeric as revenue,
        COUNT(*)::int as sold_count
        FROM listings li
        WHERE li.${TENANT_FILTER}
          AND li.status = 'SOLD'
          AND li.commission IS NOT NULL AND li.commission > 0
          ${listingUserFilterBi}
          ${useTimeFilter ? `AND li.updated_at >= NOW() - INTERVAL '${days} days'` : ''}
      `);
      const listingCommission = parseFloat(listingCommissionResult.rows[0]?.revenue) || 0;
      const listingSoldCount = listingCommissionResult.rows[0]?.sold_count || 0;
      if (listingCommission > 0) {
        attribution.push({
          channel: 'DIRECT_SALE',
          leads: listingSoldCount,
          revenue: listingCommission,
          spend: 0,
          cac: 0,
          roi: 0,
        });
      }

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

      const conversionByPeriod = conversionByPeriodResult.rows.map((row: any) => {
        // resolved = leads that have reached a terminal state (WON or LOST).
        // Using won/(won+lost) gives the ACTUAL close rate for the cohort —
        // using won/total would understate the rate because leads still in progress
        // (NEW, CONTACTED, QUALIFIED, etc.) haven't resolved yet.
        const resolved = (row.won || 0) + (row.lost || 0);
        return {
          period: row.period,
          total: row.total,
          won: row.won,
          lost: row.lost,
          resolved,
          inProgress: (row.total || 0) - resolved,
          conversionRate: resolved > 0
            ? Math.round((row.won / resolved) * 10000) / 100
            : 0,
        };
      });

      const funnel = funnelResult.rows.map((row: any) => ({
        stage: row.stage,
        count: row.count,
      }));

      // Use TOTAL leads across ALL stages (including LOST) as denominator.
      // This gives the true "what % of all leads ever reached this stage" metric.
      // e.g. 100 total leads, 10 WON → 10.0% — not distorted by how many are still in NEW.
      const totalLeadsCount = funnel.reduce((sum: number, f: any) => sum + f.count, 0);
      const funnelWithPercentage = funnel.map((f: any) => ({
        ...f,
        conversionRate: totalLeadsCount > 0 ? Math.round((f.count / totalLeadsCount) * 10000) / 100 : 0,
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

  // ─── Single-agent performance stats ─────────────────────────────────────────
  // Used by the Profile page "Hiệu Suất" tab. Returns KPIs scoped to one agent.
  async getAgentStats(tenantId: string, userId: string): Promise<{
    deals: number;
    lost: number;
    totalLeads: number;
    inProgress: number;
    closeRate: number;
    revenue: number;
    avgResponseMinutes: number | null;
    slaScore: number;
    activeTasks: number;
    overdueTasks: number;
    completedThisWeek: number;
    completedThisMonth: number;
    workloadScore: number;
  }> {
    const commissionRate = parseFloat(process.env.COMMISSION_RATE || '0.02');

    return this.withTenant(tenantId, async (client) => {
      // ── Lead KPIs ──────────────────────────────────────────────────────────
      const leadRes = await client.query(`
        SELECT
          COUNT(l.id) FILTER (WHERE l.stage = 'WON')::int                      AS won,
          COUNT(l.id) FILTER (WHERE l.stage = 'LOST')::int                     AS lost,
          COUNT(l.id) FILTER (WHERE l.stage NOT IN ('WON','LOST'))::int         AS in_progress,
          COUNT(l.id)::int                                                      AS total,
          -- closeRate = WON / (WON + LOST): only resolved leads count
          CASE
            WHEN (
              COUNT(l.id) FILTER (WHERE l.stage = 'WON') +
              COUNT(l.id) FILTER (WHERE l.stage = 'LOST')
            ) > 0
            THEN ROUND(
              COUNT(l.id) FILTER (WHERE l.stage = 'WON')::numeric
              / (
                  COUNT(l.id) FILTER (WHERE l.stage = 'WON') +
                  COUNT(l.id) FILTER (WHERE l.stage = 'LOST')
                )::numeric
              * 100
            )
            ELSE 0
          END::int AS close_rate,
          -- Revenue: proposal commissions from WON leads + SOLD listing commissions
          COALESCE((
            SELECT SUM(latest_p.final_price * $2)
            FROM leads won_l
            JOIN LATERAL (
              SELECT p2.final_price FROM proposals p2
              WHERE p2.lead_id = won_l.id
                AND p2.status = 'APPROVED'
                AND p2.${TENANT_FILTER}
              ORDER BY p2.updated_at DESC
              LIMIT 1
            ) latest_p ON true
            WHERE won_l.assigned_to = $1
              AND won_l.stage = 'WON'
              AND won_l.${TENANT_FILTER}
          ), 0)::numeric
          +
          COALESCE((
            SELECT SUM(
              CASE WHEN li.commission_unit = 'PERCENT' THEN li.price * li.commission / 100
                   ELSE li.commission END
            )
            FROM listings li
            WHERE (li.assigned_to = $1 OR li.created_by = $1)
              AND li.status = 'SOLD'
              AND li.commission IS NOT NULL AND li.commission > 0
              AND li.${TENANT_FILTER}
          ), 0)::numeric AS revenue,
          -- Avg response: seconds from first INBOUND to first OUTBOUND per lead
          (
            SELECT ROUND(AVG(EXTRACT(EPOCH FROM (first_out.ts - first_in.ts)) / 60))::int
            FROM (
              SELECT lead_id, MIN(timestamp) as ts
              FROM interactions
              WHERE direction = 'INBOUND' AND ${TENANT_FILTER}
                AND lead_id IN (
                  SELECT id FROM leads WHERE assigned_to = $1 AND ${TENANT_FILTER}
                )
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
          ) AS avg_response_minutes
        FROM leads l
        WHERE l.assigned_to = $1 AND l.${TENANT_FILTER}
      `, [userId, commissionRate]);

      const row = leadRes.rows[0] || {};
      const won       = row.won            ?? 0;
      const lost      = row.lost           ?? 0;
      const inProgress = row.in_progress   ?? 0;
      const total     = row.total          ?? 0;
      const revenue   = parseFloat(row.revenue)  || 0;
      const avgMins   = row.avg_response_minutes != null
        ? Number(row.avg_response_minutes) : null;

      // SOLD listings — agents often mark listings SOLD without moving leads to WON,
      // so we add sold listing count to deals to stay consistent with revenue calculation.
      const soldListingsRes = await client.query(`
        SELECT COUNT(*)::int AS cnt
        FROM listings
        WHERE (assigned_to = $1 OR created_by = $1)
          AND status = 'SOLD'
          AND ${TENANT_FILTER}
      `, [userId]);
      const soldListings = soldListingsRes.rows[0]?.cnt ?? 0;

      // deals = WON leads + SOLD listings
      const deals = won + soldListings;
      // closeRate = deals / (deals + LOST) — same denominator logic (resolved only)
      const closeRate = (deals + lost) > 0
        ? Math.round(deals / (deals + lost) * 100)
        : 0;

      // SLA score: 70% close rate component + 30% response-speed bonus
      const responseBonus = avgMins == null ? 0
        : avgMins <= 10 ? 30
        : avgMins <= 30 ? 20
        : avgMins <= 60 ? 10
        : 0;
      const slaScore = Math.min(100, Math.round(closeRate * 0.7 + responseBonus));

      // ── Workload (wf_tasks) ────────────────────────────────────────────────
      const activeRes = await client.query(`
        SELECT COUNT(*)::int as cnt
        FROM wf_tasks t
        JOIN task_assignments ta ON ta.task_id = t.id AND ta.user_id = $1
        WHERE t.status = 'in_progress' AND t.${TENANT_FILTER}
      `, [userId]);

      const overdueRes = await client.query(`
        SELECT COUNT(*)::int as cnt
        FROM wf_tasks t
        JOIN task_assignments ta ON ta.task_id = t.id AND ta.user_id = $1
        WHERE t.status NOT IN ('done','cancelled')
          AND t.deadline < CURRENT_DATE
          AND t.${TENANT_FILTER}
      `, [userId]);

      const weekRes = await client.query(`
        SELECT COUNT(*)::int as cnt
        FROM wf_tasks t
        JOIN task_assignments ta ON ta.task_id = t.id AND ta.user_id = $1
        WHERE t.status = 'done'
          AND t.updated_at >= NOW() - INTERVAL '7 days'
          AND t.${TENANT_FILTER}
      `, [userId]);

      const monthRes = await client.query(`
        SELECT COUNT(*)::int as cnt
        FROM wf_tasks t
        JOIN task_assignments ta ON ta.task_id = t.id AND ta.user_id = $1
        WHERE t.status = 'done'
          AND t.updated_at >= NOW() - INTERVAL '30 days'
          AND t.${TENANT_FILTER}
      `, [userId]);

      const activeTasks         = activeRes.rows[0]?.cnt  ?? 0;
      const overdueTasks        = overdueRes.rows[0]?.cnt ?? 0;
      const completedThisWeek   = weekRes.rows[0]?.cnt    ?? 0;
      const completedThisMonth  = monthRes.rows[0]?.cnt   ?? 0;
      // Workload pressure index: in-progress × 1, overdue × 2, high-urgency handled in UI
      const workloadScore = activeTasks * 1 + overdueTasks * 2;

      return {
        deals,
        lost,
        totalLeads: total,
        inProgress,
        closeRate,
        revenue,
        avgResponseMinutes: avgMins,
        slaScore,
        activeTasks,
        overdueTasks,
        completedThisWeek,
        completedThisMonth,
        workloadScore,
      };
    });
  }
}

export const analyticsRepository = new AnalyticsRepository();
