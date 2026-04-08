import { Pool } from 'pg';

export interface ErrorLogEntry {
  id: number;
  tenantId: string;
  type: 'frontend' | 'backend' | 'unhandled_promise' | 'chunk_load';
  severity: 'error' | 'warning' | 'critical';
  message: string;
  stack?: string;
  component?: string;
  path?: string;
  userId?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  createdAt: string;
}

export interface ErrorLogInsert {
  tenantId: string;
  type: ErrorLogEntry['type'];
  severity: ErrorLogEntry['severity'];
  message: string;
  stack?: string;
  component?: string;
  path?: string;
  userId?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

export interface ErrorLogStats {
  total: number;
  unresolved: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  trend: { date: string; count: number }[];
}

export class ErrorLogRepository {
  constructor(private pool: Pool) {}

  async insert(entry: ErrorLogInsert): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO error_logs
           (tenant_id, type, severity, message, stack, component, path, user_id, user_agent, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          entry.tenantId,
          entry.type,
          entry.severity,
          entry.message.slice(0, 5000),
          entry.stack?.slice(0, 10000) ?? null,
          entry.component?.slice(0, 500) ?? null,
          entry.path?.slice(0, 1000) ?? null,
          entry.userId ?? null,
          entry.userAgent?.slice(0, 500) ?? null,
          JSON.stringify(entry.metadata ?? {}),
        ]
      );
    } catch {
      // Silently ignore if table doesn't exist yet (migration pending)
    }
  }

  async list(
    tenantId: string,
    opts: { page?: number; pageSize?: number; type?: string; resolved?: boolean; severity?: string }
  ): Promise<{ items: ErrorLogEntry[]; total: number }> {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(100, opts.pageSize ?? 50);
    const offset = (page - 1) * pageSize;

    const conditions: string[] = ['tenant_id = $1'];
    const params: any[] = [tenantId];
    let idx = 2;

    if (opts.type) {
      conditions.push(`type = $${idx++}`);
      params.push(opts.type);
    }
    if (opts.severity) {
      conditions.push(`severity = $${idx++}`);
      params.push(opts.severity);
    }
    if (opts.resolved !== undefined) {
      conditions.push(`resolved = $${idx++}`);
      params.push(opts.resolved);
    }

    const where = conditions.join(' AND ');

    const [rows, countRow] = await Promise.all([
      this.pool.query(
        `SELECT id, tenant_id, type, severity, message, stack, component, path,
                user_id, user_agent, metadata, resolved, resolved_at, resolved_by, created_at
         FROM error_logs
         WHERE ${where}
         ORDER BY created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, pageSize, offset]
      ),
      this.pool.query(`SELECT COUNT(*)::int AS total FROM error_logs WHERE ${where}`, params),
    ]);

    return {
      items: rows.rows.map(this.mapRow),
      total: countRow.rows[0]?.total ?? 0,
    };
  }

  async getStats(tenantId: string): Promise<ErrorLogStats> {
    const [totals, byType, bySeverity, trend] = await Promise.all([
      this.pool.query(
        `SELECT COUNT(*)::int AS total,
                SUM(CASE WHEN resolved = FALSE THEN 1 ELSE 0 END)::int AS unresolved
         FROM error_logs WHERE tenant_id = $1`,
        [tenantId]
      ),
      this.pool.query(
        `SELECT type, COUNT(*)::int AS cnt FROM error_logs
         WHERE tenant_id = $1 GROUP BY type`,
        [tenantId]
      ),
      this.pool.query(
        `SELECT severity, COUNT(*)::int AS cnt FROM error_logs
         WHERE tenant_id = $1 GROUP BY severity`,
        [tenantId]
      ),
      this.pool.query(
        `SELECT DATE(created_at) AS date, COUNT(*)::int AS count
         FROM error_logs
         WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
         GROUP BY DATE(created_at)
         ORDER BY date ASC`,
        [tenantId]
      ),
    ]);

    return {
      total: totals.rows[0]?.total ?? 0,
      unresolved: totals.rows[0]?.unresolved ?? 0,
      byType: Object.fromEntries(byType.rows.map((r: any) => [r.type, r.cnt])),
      bySeverity: Object.fromEntries(bySeverity.rows.map((r: any) => [r.severity, r.cnt])),
      trend: trend.rows.map((r: any) => ({ date: r.date, count: r.count })),
    };
  }

  async resolve(tenantId: string, id: number, resolvedBy: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE error_logs
       SET resolved = TRUE, resolved_at = NOW(), resolved_by = $1
       WHERE id = $2 AND tenant_id = $3`,
      [resolvedBy, id, tenantId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async bulkResolve(tenantId: string, resolvedBy: string): Promise<number> {
    const result = await this.pool.query(
      `UPDATE error_logs
       SET resolved = TRUE, resolved_at = NOW(), resolved_by = $1
       WHERE tenant_id = $2 AND resolved = FALSE`,
      [resolvedBy, tenantId]
    );
    return result.rowCount ?? 0;
  }

  async deleteResolved(tenantId: string): Promise<number> {
    const result = await this.pool.query(
      `DELETE FROM error_logs WHERE tenant_id = $1 AND resolved = TRUE`,
      [tenantId]
    );
    return result.rowCount ?? 0;
  }

  async deleteOld(tenantId: string, daysOld: number): Promise<number> {
    const result = await this.pool.query(
      `DELETE FROM error_logs
       WHERE tenant_id = $1 AND created_at < NOW() - INTERVAL '1 day' * $2`,
      [tenantId, daysOld]
    );
    return result.rowCount ?? 0;
  }

  private mapRow(row: any): ErrorLogEntry {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      type: row.type,
      severity: row.severity,
      message: row.message,
      stack: row.stack ?? undefined,
      component: row.component ?? undefined,
      path: row.path ?? undefined,
      userId: row.user_id ?? undefined,
      userAgent: row.user_agent ?? undefined,
      metadata: row.metadata ?? {},
      resolved: row.resolved,
      resolvedAt: row.resolved_at ?? undefined,
      resolvedBy: row.resolved_by ?? undefined,
      createdAt: row.created_at,
    };
  }
}
