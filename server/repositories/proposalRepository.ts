import { BaseRepository, PaginatedResult, PaginationParams } from './baseRepository';
import { pool } from '../db';
import { v4 as uuidv4 } from 'uuid';

export class ProposalRepository extends BaseRepository {
  constructor() {
    super('proposals');
  }

  async findProposals(
    tenantId: string,
    pagination: PaginationParams,
    filters?: { status?: string; status_in?: string[]; leadId?: string; listingId?: string; createdById?: string },
    userId?: string,
    userRole?: string
  ): Promise<PaginatedResult<any>> {
    return this.withTenant(tenantId, async (client) => {
      const conditions: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      const RESTRICTED = ['SALES', 'MARKETING', 'VIEWER'];
      if (RESTRICTED.includes(userRole || '') && userId) {
        conditions.push(`p.created_by_id = $${paramIndex++}`);
        values.push(userId);
      }
      if (filters?.status) {
        conditions.push(`p.status = $${paramIndex++}`);
        values.push(filters.status);
      }
      if (filters?.status_in?.length) {
        const ph = filters.status_in.map((_, i) => `$${paramIndex + i}`).join(', ');
        conditions.push(`p.status IN (${ph})`);
        values.push(...filters.status_in);
        paramIndex += filters.status_in.length;
      }
      if (filters?.leadId) {
        conditions.push(`p.lead_id = $${paramIndex++}`);
        values.push(filters.leadId);
      }
      if (filters?.listingId) {
        conditions.push(`p.listing_id = $${paramIndex++}`);
        values.push(filters.listingId);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countResult = await client.query(
        `SELECT COUNT(*)::int as total FROM proposals p ${whereClause}`,
        values
      );
      const total = countResult.rows[0].total;

      const page = pagination.page;
      const pageSize = pagination.pageSize;
      const offset = (page - 1) * pageSize;

      const result = await client.query(
        `SELECT p.*, l.name as lead_name, li.title as listing_title, li.code as listing_code
         FROM proposals p
         LEFT JOIN leads l ON p.lead_id = l.id
         LEFT JOIN listings li ON p.listing_id = li.id
         ${whereClause}
         ORDER BY p.created_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...values, pageSize, offset]
      );

      return {
        data: this.rowsToEntities(result.rows),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    });
  }

  async create(tenantId: string, data: {
    leadId: string;
    listingId: string;
    basePrice: number;
    discountAmount?: number;
    finalPrice: number;
    currency?: string;
    validUntil?: string;
    createdBy: string;
    createdById: string;
    metadata?: any;
  }): Promise<any> {
    return this.withTenant(tenantId, async (client) => {
      // Always require explicit approval — never auto-approve based on discount
      // Auto-approval bypassed AML checks for high-value deals
      const status = 'PENDING_APPROVAL';
      const token = uuidv4();

      const result = await client.query(
        `INSERT INTO proposals (
          tenant_id, lead_id, listing_id, base_price, discount_amount, final_price,
          currency, status, token, valid_until, created_by, created_by_id, metadata
        ) VALUES (
          current_setting('app.current_tenant_id', true)::uuid,
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
        ) RETURNING *`,
        [
          data.leadId, data.listingId, data.basePrice, data.discountAmount || 0,
          data.finalPrice, data.currency || 'VND', status, token,
          data.validUntil || null,
          data.createdBy,    // VARCHAR display name
          data.createdById,  // UUID — used for RBAC
          data.metadata ? JSON.stringify(data.metadata) : null,
        ]
      );
      return this.rowToEntity(result.rows[0]);
    });
  }

  async updateStatus(tenantId: string, id: string, status: string): Promise<any | null> {
    return this.withTenant(tenantId, async (client) => {
      // Defense-in-depth: explicit tenant_id filter in addition to RLS
      const result = await client.query(
        `UPDATE proposals SET status = $1 WHERE id = $2 AND tenant_id = current_setting('app.current_tenant_id', true)::uuid RETURNING *`,
        [status, id]
      );
      return result.rows[0] ? this.rowToEntity(result.rows[0]) : null;
    });
  }

  async updateAml(tenantId: string, id: string, data: { amlVerified: boolean; amlNotes?: string }): Promise<any | null> {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `UPDATE proposals
         SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb
         WHERE id = $2 RETURNING *`,
        [JSON.stringify({ amlVerified: data.amlVerified, amlNotes: data.amlNotes ?? null, amlReviewedAt: new Date().toISOString() }), id]
      );
      return result.rows[0] ? this.rowToEntity(result.rows[0]) : null;
    });
  }

  async getPendingApprovals(
    tenantId: string,
    userId?: string,
    userRole?: string
  ): Promise<any[]> {
    return this.withTenant(tenantId, async (client) => {
      let query = `
        SELECT p.*, l.name as lead_name, li.title as listing_title
        FROM proposals p
        LEFT JOIN leads l ON p.lead_id = l.id
        LEFT JOIN listings li ON p.listing_id = li.id
        WHERE p.status IN ('PENDING_APPROVAL', 'DRAFT')
      `;
      const values: any[] = [];

      const RESTRICTED = ['SALES', 'MARKETING', 'VIEWER'];
      if (RESTRICTED.includes(userRole || '') && userId) {
        query += ` AND p.created_by_id = $1`;
        values.push(userId);
      }

      query += ` ORDER BY p.created_at DESC`;
      const result = await client.query(query, values);
      return this.rowsToEntities(result.rows);
    });
  }

  // Public token lookup: token chính là credential xác thực.
  // Dùng withRlsBypass để JOIN cross-tenant trên leads/listings; ràng buộc bằng p.token.
  async findByTokenGlobal(token: string): Promise<any | null> {
    const { withRlsBypass } = await import('../db');
    const result = await withRlsBypass((client) => client.query(
      `SELECT p.*,
              l.name as lead_name,
              li.title as listing_title,
              li.location as listing_location,
              li.images as listing_images,
              li.area as listing_area,
              li.bedrooms as listing_bedrooms,
              li.type as listing_type,
              li.attributes as listing_attributes
       FROM proposals p
       LEFT JOIN leads l ON p.lead_id = l.id
       LEFT JOIN listings li ON p.listing_id = li.id
       WHERE p.token = $1
       LIMIT 1`,
      [token]
    ));
    return result.rows[0] ? this.rowToEntity(result.rows[0]) : null;
  }
}

export const proposalRepository = new ProposalRepository();
