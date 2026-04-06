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

      let resolvedSessionId = data.sessionId || null;
      if (!resolvedSessionId) {
        const sessionRow = await client.query(
          `SELECT id FROM user_sessions
           WHERE user_id = $1
             AND tenant_id = current_setting('app.current_tenant_id', true)::uuid
             AND expires_at > NOW()
           ORDER BY created_at DESC
           LIMIT 1`,
          [data.userId]
        );
        resolvedSessionId = sessionRow.rows[0]?.id ?? null;
      }

      await client.query(
        `INSERT INTO user_page_views (tenant_id, user_id, path, page_label, session_id, ip_address)
         VALUES (current_setting('app.current_tenant_id', true)::uuid, $1, $2, $3, $4, $5)`,
        [
          data.userId,
          data.path,
          data.pageLabel,
          resolvedSessionId,
          data.ipAddress || null,
        ]
      );
    });
  }

  async getUsersActivitySummary(tenantId: string, fromDate?: string, toDate?: string): Promise<any[]> {
    return this.withTenant(tenantId, async (client) => {
      const conditions: string[] = [];
      const values: any[] = [];
      if (fromDate) { conditions.push(`visited_at >= $${values.length + 1}`); values.push(fromDate); }
      if (toDate) { conditions.push(`visited_at <= $${values.length + 1}`); values.push(toDate); }
      const rangeWhere = conditions.length ? conditions.join(' AND ') : null;
      const rangeFilter = rangeWhere
        ? `COUNT(*) FILTER (WHERE ${rangeWhere})::int AS views_in_range,`
        : `0::int AS views_in_range,`;
      const topPageRangeFilter = rangeWhere ? `AND ${rangeWhere}` : '';

      const result = await client.query(
        `WITH pv_agg AS (
           SELECT
             user_id,
             COUNT(*)::int AS total_views,
             COUNT(*) FILTER (WHERE visited_at >= NOW() - INTERVAL '30 days')::int AS views30d,
             ${rangeFilter}
             MIN(visited_at) AS first_visit,
             MAX(visited_at) AS last_visit
           FROM user_page_views
           WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid
           GROUP BY user_id
         ),
         s_agg AS (
           SELECT user_id, COUNT(*)::int AS total_sessions
           FROM user_sessions
           WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid
           GROUP BY user_id
         )
         SELECT
           u.id AS user_id,
           u.name AS user_name,
           u.email AS user_email,
           u.role AS user_role,
           u.avatar AS user_avatar,
           COALESCE(pv.total_views, 0) AS total_views,
           COALESCE(pv.views30d, 0) AS views30d,
           COALESCE(pv.views_in_range, 0) AS views_in_range,
           pv.first_visit,
           pv.last_visit,
           (
             SELECT pvt.page_label
             FROM user_page_views pvt
             WHERE pvt.user_id = u.id
               AND pvt.tenant_id = current_setting('app.current_tenant_id', true)::uuid
               ${topPageRangeFilter}
             GROUP BY pvt.page_label
             ORDER BY COUNT(*) DESC
             LIMIT 1
           ) AS top_page,
           COALESCE(s.total_sessions, 0) AS total_sessions
         FROM users u
         LEFT JOIN pv_agg pv ON pv.user_id = u.id
         LEFT JOIN s_agg s ON s.user_id = u.id
         WHERE u.tenant_id = current_setting('app.current_tenant_id', true)::uuid
         ORDER BY pv.last_visit DESC NULLS LAST`,
        values
      );

      return this.rowsToEntities(result.rows);
    });
  }

  async getUserActivity(tenantId: string, userId: string, fromDate?: string, toDate?: string): Promise<{
    pageStats: any[];
    recentVisits: any[];
  }> {
    return this.withTenant(tenantId, async (client) => {
      const values: any[] = [userId];
      const conditions: string[] = [];
      if (fromDate) { conditions.push(`AND visited_at >= $${values.length + 1}`); values.push(fromDate); }
      if (toDate) { conditions.push(`AND visited_at <= $${values.length + 1}`); values.push(toDate); }
      const dateFilter = conditions.join(' ');

      const pageStatsResult = await client.query(
        `SELECT
           path,
           page_label,
           COUNT(*)::int AS visit_count,
           MIN(visited_at) AS first_visit,
           MAX(visited_at) AS last_visit
         FROM user_page_views
         WHERE user_id = $1 ${dateFilter}
           AND tenant_id = current_setting('app.current_tenant_id', true)::uuid
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
         FROM user_page_views
         WHERE user_id = $1 ${dateFilter}
           AND tenant_id = current_setting('app.current_tenant_id', true)::uuid
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
