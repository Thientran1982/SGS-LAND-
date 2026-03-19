import { BaseRepository, PaginatedResult, PaginationParams } from './baseRepository';

export class ContractRepository extends BaseRepository {
  constructor() {
    super('contracts');
  }

  async findContracts(
    tenantId: string,
    pagination: PaginationParams,
    filters?: { status?: string; type?: string; leadId?: string; listingId?: string; search?: string },
    userId?: string,
    userRole?: string
  ): Promise<PaginatedResult<any>> {
    return this.withTenant(tenantId, async (client) => {
      const conditions: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      const RESTRICTED = ['SALES', 'MARKETING', 'VIEWER'];
      if (RESTRICTED.includes(userRole || '') && userId) {
        conditions.push(`c.created_by_id = $${paramIndex++}`);
        values.push(userId);
      }

      if (filters?.status) {
        conditions.push(`c.status = $${paramIndex++}`);
        values.push(filters.status);
      }
      if (filters?.type) {
        conditions.push(`c.type = $${paramIndex++}`);
        values.push(filters.type);
      }
      if (filters?.leadId) {
        conditions.push(`c.lead_id = $${paramIndex++}`);
        values.push(filters.leadId);
      }
      if (filters?.listingId) {
        conditions.push(`c.listing_id = $${paramIndex++}`);
        values.push(filters.listingId);
      }
      if (filters?.search) {
        conditions.push(`(l.name ILIKE $${paramIndex} OR c.id::text ILIKE $${paramIndex} OR c.type ILIKE $${paramIndex})`);
        values.push(`%${filters.search}%`);
        paramIndex++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countResult = await client.query(
        `SELECT COUNT(*)::int as total FROM contracts c
         LEFT JOIN leads l ON c.lead_id = l.id
         LEFT JOIN listings li ON c.listing_id = li.id
         ${whereClause}`,
        values
      );
      const total = countResult.rows[0].total;

      const page = pagination.page;
      const pageSize = pagination.pageSize;
      const offset = (page - 1) * pageSize;

      const result = await client.query(
        `SELECT c.*, l.name as lead_name, li.title as listing_title, li.code as listing_code
         FROM contracts c
         LEFT JOIN leads l ON c.lead_id = l.id
         LEFT JOIN listings li ON c.listing_id = li.id
         ${whereClause}
         ORDER BY c.created_at DESC
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
    proposalId?: string;
    leadId?: string;
    listingId?: string;
    type: string;
    status?: string;
    partyA?: any;
    partyB?: any;
    propertyDetails?: any;
    propertyPrice?: number;
    depositAmount?: number;
    paymentTerms?: string;
    taxResponsibility?: string;
    handoverDate?: string;
    handoverCondition?: string;
    metadata?: any;
    createdBy?: string;
    createdById?: string;
  }): Promise<any> {
    return this.withTenant(tenantId, async (client) => {
      const value = data.propertyPrice || 0;
      const result = await client.query(
        `INSERT INTO contracts (
          tenant_id, proposal_id, lead_id, listing_id, type, status, value,
          party_a, party_b, property_details, property_price, deposit_amount,
          payment_terms, tax_responsibility, handover_date, handover_condition,
          metadata, created_by, created_by_id
        ) VALUES (
          current_setting('app.current_tenant_id', true)::uuid,
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
        ) RETURNING *`,
        [
          data.proposalId || null, data.leadId || null, data.listingId || null, data.type,
          data.status || 'DRAFT', value,
          JSON.stringify(data.partyA || {}), JSON.stringify(data.partyB || {}),
          JSON.stringify(data.propertyDetails || {}),
          data.propertyPrice || null, data.depositAmount || null,
          data.paymentTerms || null, data.taxResponsibility || null,
          data.handoverDate || null, data.handoverCondition || null,
          data.metadata ? JSON.stringify(data.metadata) : null,
          data.createdBy || null,
          data.createdById || null,
        ]
      );
      return this.rowToEntity(result.rows[0]);
    });
  }

  async update(tenantId: string, id: string, data: Record<string, any>): Promise<any | null> {
    return this.withTenant(tenantId, async (client) => {
      const updates: string[] = ['updated_at = CURRENT_TIMESTAMP'];
      const values: any[] = [];
      let paramIndex = 2;

      const directFields = ['status', 'type', 'paymentTerms', 'taxResponsibility', 'handoverCondition', 'createdBy'];
      const jsonFields = ['partyA', 'partyB', 'propertyDetails', 'metadata'];
      const numericFields = ['propertyPrice', 'depositAmount'];

      for (const field of directFields) {
        if (data[field] !== undefined) {
          updates.push(`${this.camelToSnake(field)} = $${paramIndex++}`);
          values.push(data[field]);
        }
      }
      for (const field of jsonFields) {
        if (data[field] !== undefined) {
          updates.push(`${this.camelToSnake(field)} = $${paramIndex++}`);
          values.push(JSON.stringify(data[field]));
        }
      }
      for (const field of numericFields) {
        if (data[field] !== undefined) {
          updates.push(`${this.camelToSnake(field)} = $${paramIndex++}`);
          values.push(data[field]);
        }
      }
      if (data.signedAt !== undefined) {
        updates.push(`signed_at = $${paramIndex++}`);
        values.push(data.signedAt);
      }
      if (data.handoverDate !== undefined) {
        updates.push(`handover_date = $${paramIndex++}`);
        values.push(data.handoverDate);
      }

      if (updates.length <= 1) return this.findById(tenantId, id);

      const result = await client.query(
        `UPDATE contracts SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
        [id, ...values]
      );
      return result.rows[0] ? this.rowToEntity(result.rows[0]) : null;
    });
  }
}

export const contractRepository = new ContractRepository();
