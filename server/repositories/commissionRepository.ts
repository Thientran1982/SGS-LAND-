import { withTenantContext, withRlsBypass } from '../db';
import type { PoolClient } from 'pg';

/**
 * SECURITY — Commission policies & ledger.
 *
 * commission_policies: tenant_id = tenant chủ dự án; CRUD chỉ qua tenant context
 * (ADMIN của tenant chủ). RLS đã enforce.
 *
 * commission_ledger: tenant_id = tenant chủ; partner_tenant_id = đại lý hưởng.
 * - Tenant chủ đọc/ghi qua withTenantContext.
 * - Partner đọc qua withRlsBypass + WHERE partner_tenant_id = $partnerTenantId
 *   (cross-tenant read hợp pháp; bypass an toàn vì WHERE pin ở partner_tenant_id).
 * - Partner KHÔNG được mark-paid (route layer chặn).
 */

export type PolicyType = 'FLAT' | 'TIERED' | 'MILESTONE';
export type LedgerStatus = 'PENDING' | 'DUE' | 'PAID' | 'CANCELLED';

export interface CommissionPolicyRow {
  id: string;
  tenant_id: string;
  project_id: string;
  version: number;
  type: PolicyType;
  config: any;
  active_from: string;
  active_to: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

function rowToPolicy(r: any): CommissionPolicyRow {
  return r as CommissionPolicyRow;
}

export const commissionPolicyRepository = {
  async listByProject(tenantId: string, projectId: string): Promise<CommissionPolicyRow[]> {
    return withTenantContext(tenantId, async (c: PoolClient) => {
      const { rows } = await c.query(
        `SELECT * FROM commission_policies
         WHERE tenant_id = $1 AND project_id = $2
         ORDER BY active_from DESC, created_at DESC`,
        [tenantId, projectId],
      );
      return rows.map(rowToPolicy);
    });
  },

  /** Trả policy ACTIVE tại 1 thời điểm cho project (active_from <= at < active_to or active_to NULL). */
  async findActiveAt(tenantId: string, projectId: string, atIso: string): Promise<CommissionPolicyRow | null> {
    return withTenantContext(tenantId, async (c: PoolClient) => {
      const { rows } = await c.query(
        `SELECT * FROM commission_policies
         WHERE tenant_id = $1 AND project_id = $2
           AND active_from <= $3
           AND (active_to IS NULL OR active_to > $3)
         ORDER BY active_from DESC
         LIMIT 1`,
        [tenantId, projectId, atIso],
      );
      return rows[0] ? rowToPolicy(rows[0]) : null;
    });
  },

  async findById(tenantId: string, id: string): Promise<CommissionPolicyRow | null> {
    return withTenantContext(tenantId, async (c: PoolClient) => {
      const { rows } = await c.query(
        `SELECT * FROM commission_policies WHERE tenant_id = $1 AND id = $2`,
        [tenantId, id],
      );
      return rows[0] ? rowToPolicy(rows[0]) : null;
    });
  },

  /**
   * Tạo policy mới ACTIVE (active_to = NULL). Trong cùng transaction:
   * đóng policy ACTIVE hiện tại của project (set active_to = now). Đảm bảo unique
   * partial index không bị vi phạm tạm thời.
   */
  async createActive(
    tenantId: string,
    data: {
      projectId: string;
      type: PolicyType;
      config: any;
      createdBy: string;
    },
  ): Promise<CommissionPolicyRow> {
    return withTenantContext(tenantId, async (c: PoolClient) => {
      await c.query('BEGIN');
      try {
        // Đóng policy cũ trước
        await c.query(
          `UPDATE commission_policies
           SET active_to = NOW(), updated_at = NOW()
           WHERE tenant_id = $1 AND project_id = $2 AND active_to IS NULL`,
          [tenantId, data.projectId],
        );
        // Tính version tiếp theo
        const v = await c.query(
          `SELECT COALESCE(MAX(version), 0) + 1 AS next_version
             FROM commission_policies
            WHERE tenant_id = $1 AND project_id = $2`,
          [tenantId, data.projectId],
        );
        const nextVersion = v.rows[0].next_version;
        const ins = await c.query(
          `INSERT INTO commission_policies
             (tenant_id, project_id, version, type, config, active_from, created_by)
           VALUES ($1, $2, $3, $4, $5::jsonb, NOW(), $6)
           RETURNING *`,
          [tenantId, data.projectId, nextVersion, data.type, JSON.stringify(data.config), data.createdBy],
        );
        await c.query('COMMIT');
        return rowToPolicy(ins.rows[0]);
      } catch (e) {
        await c.query('ROLLBACK');
        throw e;
      }
    });
  },

  /** Đóng policy ACTIVE (không tạo policy mới). */
  async closeActive(tenantId: string, projectId: string): Promise<number> {
    return withTenantContext(tenantId, async (c: PoolClient) => {
      const r = await c.query(
        `UPDATE commission_policies
         SET active_to = NOW(), updated_at = NOW()
         WHERE tenant_id = $1 AND project_id = $2 AND active_to IS NULL`,
        [tenantId, projectId],
      );
      return r.rowCount ?? 0;
    });
  },
};

// ─── Ledger ──────────────────────────────────────────────────────────────────

export interface LedgerRow {
  id: string;
  tenant_id: string;
  project_id: string;
  listing_id: string;
  policy_id: string | null;
  policy_version: number | null;
  policy_type: PolicyType | null;
  sale_date: string;
  sales_user_id: string | null;
  partner_tenant_id: string | null;
  sale_price: string;
  gross_amount: string;
  rate_pct: string | null;
  milestones: any[];
  status: LedgerStatus;
  paid_at: string | null;
  paid_note: string | null;
  paid_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface LedgerListFilters {
  projectId?: string;
  partnerTenantId?: string;
  salesUserId?: string;
  status?: LedgerStatus;
  fromDate?: string;
  toDate?: string;
}

export interface LedgerListItem extends LedgerRow {
  listing_code?: string | null;
  listing_title?: string | null;
  project_name?: string | null;
  project_code?: string | null;
  sales_user_name?: string | null;
  partner_tenant_name?: string | null;
}

export const commissionLedgerRepository = {
  /**
   * Idempotent insert — nếu (listing_id) đã có entry thì trả entry hiện hữu.
   */
  async upsertOnSale(
    tenantId: string,
    data: {
      projectId: string;
      listingId: string;
      policyId: string | null;
      policyVersion: number | null;
      policyType: PolicyType | null;
      saleDate: string;
      salesUserId: string | null;
      partnerTenantId: string | null;
      salePrice: number;
      grossAmount: number;
      ratePct: number;
      milestones: any[];
    },
  ): Promise<{ row: LedgerRow; created: boolean }> {
    return withTenantContext(tenantId, async (c: PoolClient) => {
      const ins = await c.query(
        `INSERT INTO commission_ledger
           (tenant_id, project_id, listing_id, policy_id, policy_version, policy_type,
            sale_date, sales_user_id, partner_tenant_id, sale_price, gross_amount,
            rate_pct, milestones, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,'PENDING')
         ON CONFLICT (listing_id) DO NOTHING
         RETURNING *`,
        [
          tenantId, data.projectId, data.listingId, data.policyId, data.policyVersion, data.policyType,
          data.saleDate, data.salesUserId, data.partnerTenantId, data.salePrice, data.grossAmount,
          data.ratePct, JSON.stringify(data.milestones),
        ],
      );
      if (ins.rows[0]) return { row: ins.rows[0] as LedgerRow, created: true };

      const sel = await c.query(
        `SELECT * FROM commission_ledger WHERE listing_id = $1 AND tenant_id = $2`,
        [data.listingId, tenantId],
      );
      return { row: sel.rows[0] as LedgerRow, created: false };
    });
  },

  async findById(tenantId: string, id: string): Promise<LedgerRow | null> {
    return withTenantContext(tenantId, async (c: PoolClient) => {
      const { rows } = await c.query(
        `SELECT * FROM commission_ledger WHERE tenant_id = $1 AND id = $2`,
        [tenantId, id],
      );
      return rows[0] ?? null;
    });
  },

  /** Đếm số căn SOLD trong cùng tháng (UTC) cho 1 partner — phục vụ TIERED. */
  async countMonthlyUnitsForPartner(
    tenantId: string,
    partnerTenantId: string | null,
    saleDateIso: string,
    projectId: string,
  ): Promise<number> {
    const d = new Date(saleDateIso);
    const monthStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
    const monthEnd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString();
    return withTenantContext(tenantId, async (c: PoolClient) => {
      const { rows } = await c.query(
        `SELECT COUNT(*)::int AS n
           FROM commission_ledger
          WHERE tenant_id = $1
            AND project_id = $2
            AND sale_date >= $3 AND sale_date < $4
            AND ($5::uuid IS NULL AND partner_tenant_id IS NULL OR partner_tenant_id = $5::uuid)`,
        [tenantId, projectId, monthStart, monthEnd, partnerTenantId],
      );
      return rows[0]?.n ?? 0;
    });
  },

  async list(
    tenantId: string,
    pagination: { page: number; pageSize: number },
    filters: LedgerListFilters,
    /** Khi set, chỉ trả entry partner_tenant_id = scope (partner đăng nhập). */
    partnerScope?: string | null,
  ): Promise<{ data: LedgerListItem[]; total: number; page: number; pageSize: number }> {
    const conds: string[] = [];
    const vals: any[] = [];
    let i = 1;

    if (partnerScope) {
      conds.push(`cl.partner_tenant_id = $${i++}`);
      vals.push(partnerScope);
    } else {
      conds.push(`cl.tenant_id = $${i++}`);
      vals.push(tenantId);
    }
    if (filters.projectId)        { conds.push(`cl.project_id = $${i++}`);        vals.push(filters.projectId); }
    if (filters.partnerTenantId)  { conds.push(`cl.partner_tenant_id = $${i++}`); vals.push(filters.partnerTenantId); }
    if (filters.salesUserId)      { conds.push(`cl.sales_user_id = $${i++}`);     vals.push(filters.salesUserId); }
    if (filters.status)           { conds.push(`cl.status = $${i++}`);            vals.push(filters.status); }
    if (filters.fromDate)         { conds.push(`cl.sale_date >= $${i++}`);        vals.push(filters.fromDate); }
    if (filters.toDate)           { conds.push(`cl.sale_date <= $${i++}`);        vals.push(filters.toDate); }

    const where = `WHERE ${conds.join(' AND ')}`;
    const offset = (pagination.page - 1) * pagination.pageSize;

    // Cross-tenant read (partner đọc ledger của tenant chủ): bypass + WHERE
    // pin partner_tenant_id. Tenant chủ cũng dùng bypass để JOIN tới tenants
    // (đại lý) và users (sales) trên các tenant khác mà không vướng RLS.
    const runner = <T,>(fn: (c: PoolClient) => Promise<T>) => withRlsBypass(fn);

    return runner(async (c) => {
      const totalRes = await c.query(
        `SELECT COUNT(*)::int AS n FROM commission_ledger cl ${where}`,
        vals,
      );
      const total = totalRes.rows[0]?.n ?? 0;

      const dataRes = await c.query(
        `SELECT cl.*,
                l.code   AS listing_code,
                l.title  AS listing_title,
                p.name   AS project_name,
                p.code   AS project_code,
                u.name   AS sales_user_name,
                t.name   AS partner_tenant_name
           FROM commission_ledger cl
           LEFT JOIN listings l ON l.id = cl.listing_id
           LEFT JOIN projects p ON p.id = cl.project_id
           LEFT JOIN users    u ON u.id = cl.sales_user_id
           LEFT JOIN tenants  t ON t.id = cl.partner_tenant_id
          ${where}
          ORDER BY cl.sale_date DESC
          LIMIT $${i} OFFSET $${i + 1}`,
        [...vals, pagination.pageSize, offset],
      );
      return { data: dataRes.rows as LedgerListItem[], total, page: pagination.page, pageSize: pagination.pageSize };
    });
  },

  async markPaid(
    tenantId: string,
    id: string,
    data: { paidNote?: string | null; paidBy: string },
  ): Promise<LedgerRow | null> {
    return withTenantContext(tenantId, async (c: PoolClient) => {
      const { rows } = await c.query(
        `UPDATE commission_ledger
         SET status = 'PAID', paid_at = NOW(), paid_note = $1, paid_by = $2, updated_at = NOW()
         WHERE tenant_id = $3 AND id = $4
         RETURNING *`,
        [data.paidNote || null, data.paidBy, tenantId, id],
      );
      return rows[0] ?? null;
    });
  },

  /** Aggregate cho widget project tab: tổng theo status + due-soon/overdue. */
  async aggregateByProject(
    tenantId: string,
    projectId: string,
  ): Promise<{
    totalCount: number; pending: number; due: number; paid: number;
    grossPending: number; grossPaid: number;
    dueSoonCount: number; overdueCount: number;
    grossDueSoon: number; grossOverdue: number;
  }> {
    return withTenantContext(tenantId, async (c: PoolClient) => {
      const baseRes = await c.query(
        `SELECT
           COUNT(*)::int AS total_count,
           COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending,
           COUNT(*) FILTER (WHERE status = 'DUE')::int AS due,
           COUNT(*) FILTER (WHERE status = 'PAID')::int AS paid,
           COALESCE(SUM(gross_amount) FILTER (WHERE status IN ('PENDING','DUE')), 0) AS gross_pending,
           COALESCE(SUM(gross_amount) FILTER (WHERE status = 'PAID'), 0) AS gross_paid
         FROM commission_ledger
         WHERE tenant_id = $1 AND project_id = $2`,
        [tenantId, projectId],
      );
      const r = baseRes.rows[0] || {};

      // Walk milestones jsonb để tính sắp đến hạn (≤ 7 ngày) + quá hạn,
      // chỉ xét các slice còn PENDING (unpaid) thuộc bút toán chưa CANCELLED/PAID.
      const msRes = await c.query(
        `SELECT
           COALESCE(SUM(CASE WHEN (m->>'dueDate')::date <  CURRENT_DATE THEN COALESCE((m->>'amount')::numeric,0) ELSE 0 END), 0) AS overdue_amt,
           COALESCE(SUM(CASE WHEN (m->>'dueDate')::date >= CURRENT_DATE
                              AND (m->>'dueDate')::date <= (CURRENT_DATE + INTERVAL '7 days')
                             THEN COALESCE((m->>'amount')::numeric,0) ELSE 0 END), 0) AS duesoon_amt,
           COUNT(DISTINCT cl.id) FILTER (WHERE (m->>'dueDate')::date <  CURRENT_DATE)::int AS overdue_cnt,
           COUNT(DISTINCT cl.id) FILTER (WHERE (m->>'dueDate')::date >= CURRENT_DATE
                                          AND (m->>'dueDate')::date <= (CURRENT_DATE + INTERVAL '7 days'))::int AS duesoon_cnt
         FROM commission_ledger cl
         CROSS JOIN LATERAL jsonb_array_elements(COALESCE(cl.milestones, '[]'::jsonb)) AS m
         WHERE cl.tenant_id = $1 AND cl.project_id = $2
           AND cl.status NOT IN ('PAID','CANCELLED')
           AND COALESCE(m->>'status','PENDING') <> 'PAID'`,
        [tenantId, projectId],
      );
      const ms = msRes.rows[0] || {};

      return {
        totalCount: r.total_count ?? 0,
        pending: r.pending ?? 0,
        due: r.due ?? 0,
        paid: r.paid ?? 0,
        grossPending: Number(r.gross_pending ?? 0),
        grossPaid: Number(r.gross_paid ?? 0),
        dueSoonCount: ms.duesoon_cnt ?? 0,
        overdueCount: ms.overdue_cnt ?? 0,
        grossDueSoon: Number(ms.duesoon_amt ?? 0),
        grossOverdue: Number(ms.overdue_amt ?? 0),
      };
    });
  },

  /** Bulk mark-paid: chỉ cập nhật rows thuộc tenantId, bỏ qua các id không hợp lệ. */
  async markManyPaid(
    tenantId: string,
    ids: string[],
    data: { paidNote?: string | null; paidBy: string },
  ): Promise<LedgerRow[]> {
    if (ids.length === 0) return [];
    return withTenantContext(tenantId, async (c: PoolClient) => {
      const { rows } = await c.query(
        `UPDATE commission_ledger
         SET status = 'PAID', paid_at = NOW(), paid_note = $1, paid_by = $2, updated_at = NOW()
         WHERE tenant_id = $3 AND id = ANY($4::uuid[]) AND status NOT IN ('PAID','CANCELLED')
         RETURNING *`,
        [data.paidNote || null, data.paidBy, tenantId, ids],
      );
      return rows as LedgerRow[];
    });
  },

  /** Top partner/sales theo doanh số tháng cho 1 project. */
  async leaderboardThisMonth(
    tenantId: string,
    projectId: string,
    nowIso: string,
    limit = 5,
  ): Promise<{ partners: any[]; sales: any[] }> {
    const d = new Date(nowIso);
    const monthStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
    const monthEnd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString();
    return withRlsBypass(async (c: PoolClient) => {
      const partners = await c.query(
        `SELECT cl.partner_tenant_id, t.name AS partner_name,
                COUNT(*)::int AS units,
                COALESCE(SUM(cl.gross_amount),0) AS gross
           FROM commission_ledger cl
           LEFT JOIN tenants t ON t.id = cl.partner_tenant_id
          WHERE cl.tenant_id = $1 AND cl.project_id = $2
            AND cl.sale_date >= $3 AND cl.sale_date < $4
          GROUP BY cl.partner_tenant_id, t.name
          ORDER BY units DESC, gross DESC
          LIMIT $5`,
        [tenantId, projectId, monthStart, monthEnd, limit],
      );
      const sales = await c.query(
        `SELECT cl.sales_user_id, u.name AS sales_name,
                COUNT(*)::int AS units,
                COALESCE(SUM(cl.gross_amount),0) AS gross
           FROM commission_ledger cl
           LEFT JOIN users u ON u.id = cl.sales_user_id
          WHERE cl.tenant_id = $1 AND cl.project_id = $2
            AND cl.sale_date >= $3 AND cl.sale_date < $4
          GROUP BY cl.sales_user_id, u.name
          ORDER BY units DESC, gross DESC
          LIMIT $5`,
        [tenantId, projectId, monthStart, monthEnd, limit],
      );
      return { partners: partners.rows, sales: sales.rows };
    });
  },
};
