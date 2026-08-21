import { pool } from '../db';
import { DEFAULT_TENANT_ID } from '../constants';
import { logger } from '../middleware/logger';

export interface VisitorLogInput {
  tenantId?: string;
  sessionId?: string;
  ipAddress?: string;
  country?: string;
  countryCode?: string;
  region?: string;
  city?: string;
  lat?: number | null;
  lon?: number | null;
  isp?: string;
  page?: string;
  listingId?: string;
  userAgent?: string;
  referrer?: string;
}

export interface VisitorStats {
  totalVisits: number;
  uniqueIps: number;
  topCountries: { country: string; countryCode: string; count: number }[];
  topCities: { city: string; count: number }[];
  topPages: { page: string; count: number }[];
  dailyVisits: { date: string; count: number }[];
  topListings: { listingId: string; count: number }[];
}

export interface VisitorFunnelStats {
  periodDays: number;
  propertyViews: number;
  sessions: number;
  engagedSessions: number;
  pageLeaves: number;
  scroll50: number;
  scroll90: number;
  ctaInteractions: number;
  returningVisitors48h: number;
  averageTimeOnPageMs: number;
  topSources: { value: string; count: number }[];
  topProjects: { value: string; count: number }[];
}

export interface VisitorFunnelFilters {
  projectCode?: string;
  source?: string;
}

function safeMetric(value: unknown): number {
  const metric = Number(value ?? 0);
  return Number.isFinite(metric) && metric >= 0 ? metric : 0;
}

class VisitorRepository {
  async log(data: VisitorLogInput): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO visitor_logs
          (tenant_id, session_id, ip_address, country, country_code, region, city, lat, lon, isp, page, listing_id, user_agent, referrer)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
          data.tenantId ?? DEFAULT_TENANT_ID,
          data.sessionId ?? null,
          data.ipAddress ?? null,
          data.country ?? null,
          data.countryCode ?? null,
          data.region ?? null,
          data.city ?? null,
          data.lat ?? null,
          data.lon ?? null,
          data.isp ?? null,
          data.page ?? null,
          data.listingId ?? null,
          data.userAgent ? data.userAgent.slice(0, 512) : null,
          data.referrer ? data.referrer.slice(0, 512) : null,
        ]
      );
    } catch (err) {
      logger.warn('[visitorRepository] Failed to log visitor: ' + (err as Error).message);
    }
  }

  /**
   * True when this listing was already counted for the same visitor (IP)
   * inside the given window. Used to de-duplicate listings.view_count so a
   * page refresh does not inflate the public counter. Rows written by bots
   * (matching excludeUaPattern) never act as a de-duplication key.
   */
  async hasRecentView(
    listingId: string,
    ipAddress: string | null | undefined,
    minutes = 30,
    excludeUaPattern?: string,
  ): Promise<boolean> {
    if (!listingId || !ipAddress) return false;
    // Native types only: the previous listing_id::text / ip_address::text casts
    // made the composite index unusable, so every view scanned the table.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(listingId))) return false;
    const win = Math.max(1, Math.min(Math.floor(minutes), 1440));
    try {
      const params: any[] = [listingId, String(ipAddress), win];
      let uaClause = '';
      if (excludeUaPattern) {
        params.push(excludeUaPattern);
        uaClause = ' AND user_agent IS NOT NULL AND user_agent !~* $4';
      }
      const r = await pool.query(
        `SELECT 1 FROM visitor_logs
          WHERE listing_id = $1::uuid
            AND ip_address = $2
            AND created_at >= NOW() - ($3 || ' minutes')::interval` + uaClause + `
          LIMIT 1`,
        params
      );
      return (r.rowCount ?? 0) > 0;
    } catch (err) {
      logger.warn('[visitorRepository] hasRecentView failed: ' + (err as Error).message);
      return false;
    }
  }

  async getStats(tenantId: string, days = 30): Promise<VisitorStats> {
    const safeDays = Math.max(1, Math.min(Math.floor(days), 365));

    const [total, countries, cities, pages, daily, listings] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) as total, COUNT(DISTINCT ip_address) as unique_ips
         FROM visitor_logs
         WHERE tenant_id = $1 AND created_at >= NOW() - ($2 || ' days')::interval`,
        [tenantId, safeDays]
      ),
      pool.query(
        `SELECT country, country_code, COUNT(*) as count
         FROM visitor_logs
         WHERE tenant_id = $1 AND created_at >= NOW() - ($2 || ' days')::interval AND country IS NOT NULL
         GROUP BY country, country_code ORDER BY count DESC LIMIT 15`,
        [tenantId, safeDays]
      ),
      pool.query(
        `SELECT city, COUNT(*) as count
         FROM visitor_logs
         WHERE tenant_id = $1 AND created_at >= NOW() - ($2 || ' days')::interval AND city IS NOT NULL
         GROUP BY city ORDER BY count DESC LIMIT 10`,
        [tenantId, safeDays]
      ),
      pool.query(
        `SELECT page, COUNT(*) as count
         FROM visitor_logs
         WHERE tenant_id = $1 AND created_at >= NOW() - ($2 || ' days')::interval AND page IS NOT NULL
         GROUP BY page ORDER BY count DESC LIMIT 10`,
        [tenantId, safeDays]
      ),
      pool.query(
        `SELECT DATE(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') as date, COUNT(*) as count
         FROM visitor_logs
         WHERE tenant_id = $1 AND created_at >= NOW() - ($2 || ' days')::interval
         GROUP BY DATE(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') ORDER BY date`,
        [tenantId, safeDays]
      ),
      pool.query(
        `SELECT listing_id::text, COUNT(*) as count
         FROM visitor_logs
         WHERE tenant_id = $1 AND created_at >= NOW() - ($2 || ' days')::interval AND listing_id IS NOT NULL
         GROUP BY listing_id ORDER BY count DESC LIMIT 10`,
        [tenantId, safeDays]
      ),
    ]);

    return {
      totalVisits: parseInt(total.rows[0]?.total ?? '0'),
      uniqueIps: parseInt(total.rows[0]?.unique_ips ?? '0'),
      topCountries: countries.rows.map(r => ({
        country: r.country,
        countryCode: r.country_code,
        count: parseInt(r.count),
      })),
      topCities: cities.rows.map(r => ({ city: r.city, count: parseInt(r.count) })),
      topPages: pages.rows.map(r => ({ page: r.page, count: parseInt(r.count) })),
      dailyVisits: daily.rows.map(r => ({ date: String(r.date).slice(0, 10), count: parseInt(r.count) })),
      topListings: listings.rows.map(r => ({ listingId: r.listing_id, count: parseInt(r.count) })),
    };
  }

  async getFunnelStats(tenantId: string, days = 30, filters: VisitorFunnelFilters = {}): Promise<VisitorFunnelStats> {
    const safeDays = Math.max(1, Math.min(Math.floor(days), 365));
    const values: any[] = [tenantId, safeDays];
    const clauses = ['tenant_id = $1', "created_at >= NOW() - ($2 || ' days')::interval"];
    if (filters.projectCode) {
      values.push(filters.projectCode);
      clauses.push(`project_code = $${values.length}`);
    }
    if (filters.source) {
      values.push(filters.source);
      clauses.push(`COALESCE(NULLIF(utm_source, ''), NULLIF(referrer, ''), 'direct') = $${values.length}`);
    }
    const where = clauses.join(' AND ');
    const result = await pool.query(
      `WITH events AS (
         SELECT visitor_id, session_id, event_type, metadata, created_at, project_code,
                COALESCE(NULLIF(utm_source, ''), NULLIF(referrer, ''), 'direct') AS traffic_source
         FROM visitor_events
         WHERE ${where}
       ),
       property_views AS (
         SELECT visitor_id, created_at
         FROM events
         WHERE event_type = 'property_view'
       ),
       returning AS (
         SELECT DISTINCT p1.visitor_id
         FROM property_views p1
         JOIN property_views p2
           ON p1.visitor_id = p2.visitor_id
          AND p2.created_at > p1.created_at
          AND p2.created_at <= p1.created_at + interval '48 hours'
       )
       SELECT
         (SELECT COUNT(*)::int FROM property_views) AS property_views,
         (SELECT COUNT(DISTINCT COALESCE(session_id, visitor_id))::int FROM events) AS sessions,
         (SELECT COUNT(DISTINCT COALESCE(session_id, visitor_id))::int FROM events
           WHERE event_type IN ('engagement_30s', 'engagement_60s', 'scroll_50', 'calculator_interaction',
                                'favorite_click', 'share_click', 'contact_click', 'booking_open', 'chat_open')) AS engaged_sessions,
         (SELECT COUNT(*)::int FROM events WHERE event_type = 'page_leave') AS page_leaves,
         (SELECT COUNT(*)::int FROM events WHERE event_type = 'scroll_50') AS scroll_50,
         (SELECT COUNT(*)::int FROM events WHERE event_type = 'scroll_90') AS scroll_90,
         (SELECT COUNT(*)::int FROM events WHERE event_type IN ('favorite_click', 'share_click', 'contact_click',
                                'booking_open', 'booking_submit', 'chat_open', 'similar_listing_click',
                                'calculator_interaction')) AS cta_interactions,
         (SELECT COUNT(*)::int FROM returning) AS returning_visitors_48h,
         (SELECT COALESCE(ROUND(AVG(NULLIF((metadata->>'timeOnPageMs')::numeric, 0))), 0)::int
            FROM events WHERE event_type = 'page_leave'
              AND metadata->>'timeOnPageMs' ~ '^[0-9]+$') AS average_time_on_page_ms`,
      values,
    );
    const [sources, projects] = await Promise.all([
      pool.query(
        `SELECT COALESCE(NULLIF(utm_source, ''), NULLIF(referrer, ''), 'direct') AS value,
                COUNT(*)::int AS count
           FROM visitor_events
          WHERE tenant_id = $1 AND created_at >= NOW() - ($2 || ' days')::interval
          GROUP BY 1 ORDER BY count DESC LIMIT 20`,
        [tenantId, safeDays],
      ),
      pool.query(
        `SELECT project_code AS value, COUNT(*)::int AS count
           FROM visitor_events
          WHERE tenant_id = $1 AND created_at >= NOW() - ($2 || ' days')::interval
            AND project_code IS NOT NULL AND project_code <> ''
          GROUP BY project_code ORDER BY count DESC LIMIT 20`,
        [tenantId, safeDays],
      ),
    ]);
    const row = result.rows[0] || {};
    return {
      periodDays: safeDays,
      propertyViews: safeMetric(row.property_views),
      sessions: safeMetric(row.sessions),
      engagedSessions: safeMetric(row.engaged_sessions),
      pageLeaves: safeMetric(row.page_leaves),
      scroll50: safeMetric(row.scroll_50),
      scroll90: safeMetric(row.scroll_90),
      ctaInteractions: safeMetric(row.cta_interactions),
      returningVisitors48h: safeMetric(row.returning_visitors_48h),
      averageTimeOnPageMs: safeMetric(row.average_time_on_page_ms),
      topSources: sources.rows.map(r => ({ value: String(r.value), count: safeMetric(r.count) })),
      topProjects: projects.rows.map(r => ({ value: String(r.value), count: safeMetric(r.count) })),
    };
  }
}

export const visitorRepository = new VisitorRepository();
