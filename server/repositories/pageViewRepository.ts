import { BaseRepository } from './baseRepository';

class PageViewRepository extends BaseRepository {
  constructor() {
    super('user_page_views');
  }

  async recordView(tenantId: string, data: {
    userId: string;
    path: string;
    pageLabel: string;
    sessionId?: string | null;
    ipAddress?: string | null;
  }): Promise<void> {
    return this.withTenant(tenantId, async (client) => {
      const recent = await client.query(
        `SELECT id FROM user_page_views
         WHERE user_id = $1 AND path = $2
           AND visited_at > (NOW() - INTERVAL '5 seconds')
         LIMIT 1`,
        [data.userId, data.path]
      );
      if ((recent.rowCount ?? 0) > 0) return;

      await client.query(
        `INSERT INTO user_page_views (tenant_id, user_id, path, page_label, session_id, ip_address)
         VALUES (current_setting('app.current_tenant_id', true)::uuid, $1, $2, $3, $4, $5)`,
        [
          data.userId,
          data.path,
          data.pageLabel,
          data.sessionId || null,
          data.ipAddress || null,
        ]
      );
    });
  }

  async getUsersActivitySummary(tenantId: string, fromDate?: string): Promise<any[]> {
    return this.withTenant(tenantId, async (client) => {
      const dateFilter = fromDate ? `AND pv.visited_at >= $1` : '';
      const values: any[] = fromDate ? [fromDate] : [];

      const result = await client.query(
        `SELECT
           u.id AS user_id,
           u.name AS user_name,
           u.email AS user_email,
           u.role AS user_role,
           u.avatar AS user_avatar,
           COUNT(pv.id)::int AS total_views,
           COUNT(pv.id) FILTER (WHERE pv.visited_at >= NOW() - INTERVAL '30 days')::int AS views_30d,
           MIN(pv.visited_at) AS first_visit,
           MAX(pv.visited_at) AS last_visit,
           (
             SELECT pv2.page_label
             FROM user_page_views pv2
             WHERE pv2.user_id = u.id
               AND pv2.tenant_id = current_setting('app.current_tenant_id', true)::uuid
             GROUP BY pv2.page_label
             ORDER BY COUNT(*) DESC
             LIMIT 1
           ) AS top_page,
           COUNT(DISTINCT s.id) FILTER (WHERE s.expires_at > NOW())::int AS active_sessions
         FROM users u
         LEFT JOIN user_page_views pv
           ON pv.user_id = u.id ${dateFilter}
         LEFT JOIN user_sessions s
           ON s.user_id = u.id
             AND s.tenant_id = current_setting('app.current_tenant_id', true)::uuid
         WHERE u.tenant_id = current_setting('app.current_tenant_id', true)::uuid
         GROUP BY u.id, u.name, u.email, u.role, u.avatar
         ORDER BY MAX(pv.visited_at) DESC NULLS LAST`,
        values
      );

      return this.rowsToEntities(result.rows);
    });
  }

  async getUserActivity(tenantId: string, userId: string, fromDate?: string): Promise<{
    pageStats: any[];
    recentVisits: any[];
  }> {
    return this.withTenant(tenantId, async (client) => {
      const dateFilter = fromDate ? `AND pv.visited_at >= $2` : '';
      const values: any[] = fromDate ? [userId, fromDate] : [userId];

      const pageStatsResult = await client.query(
        `SELECT
           path,
           page_label,
           COUNT(*)::int AS visit_count,
           MIN(visited_at) AS first_visit,
           MAX(visited_at) AS last_visit
         FROM user_page_views pv
         WHERE user_id = $1 ${dateFilter}
         GROUP BY path, page_label
         ORDER BY visit_count DESC`,
        values
      );

      const recentResult = await client.query(
        `SELECT
           id,
           path,
           page_label,
           visited_at,
           ip_address
         FROM user_page_views pv
         WHERE user_id = $1 ${dateFilter}
         ORDER BY visited_at DESC
         LIMIT 200`,
        values
      );

      return {
        pageStats: this.rowsToEntities(pageStatsResult.rows),
        recentVisits: this.rowsToEntities(recentResult.rows),
      };
    });
  }
}

export const pageViewRepository = new PageViewRepository();
