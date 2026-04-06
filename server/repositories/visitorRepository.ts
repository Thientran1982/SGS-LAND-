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
}

export const visitorRepository = new VisitorRepository();
