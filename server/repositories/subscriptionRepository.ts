import { BaseRepository } from './baseRepository';

class SubscriptionRepository extends BaseRepository {
  constructor() {
    super('subscriptions');
  }

  async getByTenant(tenantId: string): Promise<any | null> {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `SELECT * FROM ${this.tableName} ORDER BY created_at DESC LIMIT 1`
      );
      return result.rows[0] ? this.rowToEntity(result.rows[0]) : null;
    });
  }

  async createSubscription(tenantId: string, data: { planId: string; status?: string }): Promise<any> {
    return this.withTenant(tenantId, async (client) => {
      const now = new Date();
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      // Upsert: if tenant already has a subscription (e.g. race condition or RLS miss), return existing
      const result = await client.query(
        `INSERT INTO ${this.tableName} (tenant_id, plan_id, status, current_period_start, current_period_end)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (tenant_id) DO UPDATE
           SET updated_at = NOW()
         RETURNING *`,
        [tenantId, data.planId, data.status || 'ACTIVE', now.toISOString(), periodEnd.toISOString()]
      );
      return this.rowToEntity(result.rows[0]);
    });
  }

  async updatePlan(tenantId: string, planId: string): Promise<any> {
    return this.withTenant(tenantId, async (client) => {
      const existing = await client.query(
        `SELECT id FROM ${this.tableName} ORDER BY created_at DESC LIMIT 1`
      );

      if (existing.rows.length > 0) {
        const now = new Date();
        const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        const result = await client.query(
          `UPDATE ${this.tableName}
           SET plan_id = $1, status = 'ACTIVE', current_period_start = $2, current_period_end = $3
           WHERE id = $4
           RETURNING *`,
          [planId, now.toISOString(), periodEnd.toISOString(), existing.rows[0].id]
        );
        return this.rowToEntity(result.rows[0]);
      } else {
        return this.createSubscription(tenantId, { planId });
      }
    });
  }

  async getUsage(tenantId: string, period?: string): Promise<any[]> {
    return this.withTenant(tenantId, async (client) => {
      const currentPeriod = period || new Date().toISOString().slice(0, 7);
      const result = await client.query(
        `SELECT * FROM usage_tracking WHERE period = $1 ORDER BY metric_type`,
        [currentPeriod]
      );
      return this.rowsToEntities(result.rows);
    });
  }

  async getUsageSummary(tenantId: string): Promise<any> {
    return this.withTenant(tenantId, async (client) => {
      const currentPeriod = new Date().toISOString().slice(0, 7);

      // 1. Seats: count active users in this tenant
      const seatsResult = await client.query(
        `SELECT COUNT(*)::int AS total FROM users WHERE status = 'ACTIVE'`
      );
      const seatsUsed = seatsResult.rows[0]?.total || 0;

      // 2. Emails: count USER_INVITED + sequence email actions from audit_logs this month
      let emailsSent = 0;
      try {
        const emailResult = await client.query(
          `SELECT COALESCE(SUM(count), 0)::int AS total
           FROM usage_tracking
           WHERE metric_type = 'emails' AND period = $1`,
          [currentPeriod]
        );
        const tracked = emailResult.rows[0]?.total || 0;
        // Also count invite emails from audit_logs this month
        const auditEmailResult = await client.query(
          `SELECT COUNT(*)::int AS total FROM audit_logs
           WHERE action IN ('USER_INVITED', 'EMAIL_SENT', 'SEQUENCE_EMAIL_SENT')
             AND created_at >= date_trunc('month', CURRENT_DATE)`
        );
        emailsSent = tracked + (auditEmailResult.rows[0]?.total || 0);
      } catch {
        emailsSent = 0;
      }

      // 3. AI requests: from usage_tracking table
      let aiRequests = 0;
      try {
        const aiResult = await client.query(
          `SELECT COALESCE(SUM(count), 0)::int AS total
           FROM usage_tracking
           WHERE metric_type = 'ai_requests' AND period = $1`,
          [currentPeriod]
        );
        aiRequests = aiResult.rows[0]?.total || 0;
      } catch {
        aiRequests = 0;
      }

      return { seatsUsed, emailsSent, aiRequests };
    });
  }

  async incrementUsage(tenantId: string, metricType: string, count: number = 1): Promise<void> {
    return this.withTenant(tenantId, async (client) => {
      const currentPeriod = new Date().toISOString().slice(0, 7);
      const existing = await client.query(
        `SELECT id, count FROM usage_tracking WHERE metric_type = $1 AND period = $2`,
        [metricType, currentPeriod]
      );

      if (existing.rows.length > 0) {
        await client.query(
          `UPDATE usage_tracking SET count = count + $1 WHERE id = $2`,
          [count, existing.rows[0].id]
        );
      } else {
        await client.query(
          `INSERT INTO usage_tracking (tenant_id, metric_type, count, period)
           VALUES ($1, $2, $3, $4)`,
          [tenantId, metricType, count, currentPeriod]
        );
      }
    });
  }

  async getInvoices(tenantId: string): Promise<any[]> {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `SELECT s.id, s.plan_id, s.current_period_start as period_start, s.current_period_end as period_end,
                s.status, s.created_at
         FROM ${this.tableName} s
         ORDER BY s.created_at DESC
         LIMIT 12`
      );
      return result.rows.map((row, index) => ({
        id: row.id,
        planId: row.plan_id,
        periodStart: row.period_start,
        periodEnd: row.period_end,
        status: row.status === 'ACTIVE' ? 'PAID' : row.status,
        amount: this.getPlanPrice(row.plan_id),
        createdAt: row.created_at,
      }));
    });
  }

  private getPlanPrice(planId: string): number {
    const prices: Record<string, number> = {
      'INDIVIDUAL': 0,
      'TEAM': 49,
      'ENTERPRISE': 199,
    };
    return prices[planId] || 0;
  }
}

export const subscriptionRepository = new SubscriptionRepository();
