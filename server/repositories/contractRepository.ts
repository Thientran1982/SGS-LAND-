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

      const RESTRICTED_ROLES = ['SALES', 'MARKETING', 'VIEWER', 'PARTNER_ADMIN', 'PARTNER_AGENT'];
      if (RESTRICTED_ROLES.includes(userRole || '') && userId) {
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
        conditions.push(`(
          l.name ILIKE $${paramIndex}
          OR c.id::text ILIKE $${paramIndex}
          OR c.party_a->>'name' ILIKE $${paramIndex}
          OR c.party_b->>'name' ILIKE $${paramIndex}
          OR c.property_details->>'address' ILIKE $${paramIndex}
          OR c.party_b->>'phone' ILIKE $${paramIndex}
          OR c.party_a->>'phone' ILIKE $${paramIndex}
        )`);
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
        `SELECT c.*, l.name as lead_name, li.title as listing_title, li.code as listing_code,
                u.name as assigned_to_name, u.email as assigned_to_email, u.avatar as assigned_to_avatar
         FROM contracts c
         LEFT JOIN leads l ON c.lead_id = l.id
         LEFT JOIN listings li ON c.listing_id = li.id
         LEFT JOIN users u ON c.assigned_to_id = u.id
         ${whereClause}
         ORDER BY c.created_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...values, pageSize, offset]
      );

      return {
        data: result.rows.map(row => this.flattenEntity(this.rowToEntity(row))),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    });
  }

  private buildPartyA(data: Record<string, any>): Record<string, any> {
    return data.partyA || {
      name: data.partyAName,
      representative: data.partyARepresentative,
      idNumber: data.partyAIdNumber,
      idDate: data.partyAIdDate,
      idPlace: data.partyAIdPlace,
      address: data.partyAAddress,
      taxCode: data.partyATaxCode,
      phone: data.partyAPhone,
      bankAccount: data.partyABankAccount,
      bankName: data.partyABankName,
    };
  }

  private buildPartyB(data: Record<string, any>): Record<string, any> {
    return data.partyB || {
      name: data.partyBName,
      idNumber: data.partyBIdNumber,
      idDate: data.partyBIdDate,
      idPlace: data.partyBIdPlace,
      address: data.partyBAddress,
      phone: data.partyBPhone,
      bankAccount: data.partyBBankAccount,
      bankName: data.partyBBankName,
    };
  }

  private buildPropertyDetails(data: Record<string, any>): Record<string, any> {
    return data.propertyDetails || {
      address: data.propertyAddress,
      type: data.propertyType,
      landArea: data.propertyLandArea,
      constructionArea: data.propertyConstructionArea,
      area: data.propertyArea,
      certificateNumber: data.propertyCertificateNumber,
      certificateDate: data.propertyCertificateDate,
      certificatePlace: data.propertyCertificatePlace,
    };
  }

  private flattenEntity(entity: Record<string, any>): Record<string, any> {
    const partyA = entity.partyA || {};
    const partyB = entity.partyB || {};
    const propertyDetails = entity.propertyDetails || {};
    return {
      ...entity,
      partyAName: partyA.name,
      partyARepresentative: partyA.representative,
      partyAIdNumber: partyA.idNumber,
      partyAIdDate: partyA.idDate,
      partyAIdPlace: partyA.idPlace,
      partyAAddress: partyA.address,
      partyATaxCode: partyA.taxCode,
      partyAPhone: partyA.phone,
      partyABankAccount: partyA.bankAccount,
      partyABankName: partyA.bankName,
      partyBName: partyB.name,
      partyBIdNumber: partyB.idNumber,
      partyBIdDate: partyB.idDate,
      partyBIdPlace: partyB.idPlace,
      partyBAddress: partyB.address,
      partyBPhone: partyB.phone,
      partyBBankAccount: partyB.bankAccount,
      partyBBankName: partyB.bankName,
      propertyAddress: propertyDetails.address,
      propertyType: propertyDetails.type,
      propertyLandArea: propertyDetails.landArea,
      propertyConstructionArea: propertyDetails.constructionArea,
      propertyArea: propertyDetails.area,
      propertyCertificateNumber: propertyDetails.certificateNumber,
      propertyCertificateDate: propertyDetails.certificateDate,
      propertyCertificatePlace: propertyDetails.certificatePlace,
    };
  }

  async create(tenantId: string, data: Record<string, any>): Promise<any> {
    return this.withTenant(tenantId, async (client) => {
      const value = data.propertyPrice || 0;
      const partyA = this.buildPartyA(data);
      const partyB = this.buildPartyB(data);
      const propertyDetails = this.buildPropertyDetails(data);
      const result = await client.query(
        `INSERT INTO contracts (
          tenant_id, proposal_id, lead_id, listing_id, type, status, value,
          party_a, party_b, property_details, property_price, deposit_amount,
          payment_terms, payment_schedule, tax_responsibility, handover_date, handover_condition,
          dispute_resolution, signed_place, contract_date, metadata, created_by, created_by_id,
          assigned_to_id
        ) VALUES (
          current_setting('app.current_tenant_id', true)::uuid,
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23
        ) RETURNING *`,
        [
          data.proposalId || null, data.leadId || null, data.listingId || null, data.type,
          data.status || 'DRAFT', value,
          JSON.stringify(partyA), JSON.stringify(partyB),
          JSON.stringify(propertyDetails),
          data.propertyPrice || null, data.depositAmount || null,
          data.paymentTerms || null,
          data.paymentSchedule ? JSON.stringify(data.paymentSchedule) : null,
          data.taxResponsibility || null,
          data.handoverDate || null, data.handoverCondition || null,
          data.disputeResolution || null,
          data.signedPlace || null,
          data.contractDate || null,
          data.metadata ? JSON.stringify(data.metadata) : null,
          data.createdBy || null,
          data.createdById || null,
          data.assignedToId || null,
        ]
      );
      return this.flattenEntity(this.rowToEntity(result.rows[0]));
    });
  }

  async update(tenantId: string, id: string, data: Record<string, any>): Promise<any | null> {
    return this.withTenant(tenantId, async (client) => {
      const updates: string[] = ['updated_at = CURRENT_TIMESTAMP'];
      const values: any[] = [];
      let paramIndex = 2;

      const directFields = ['status', 'type', 'paymentTerms', 'taxResponsibility', 'handoverCondition', 'disputeResolution', 'createdBy', 'assignedToId'];
      const numericFields = ['propertyPrice', 'depositAmount'];

      for (const field of directFields) {
        if (data[field] !== undefined) {
          updates.push(`${this.camelToSnake(field)} = $${paramIndex++}`);
          values.push(data[field]);
        }
      }

      // Build JSONB blobs from flat fields or structured objects
      const hasPartyAFlat = data.partyAName !== undefined || data.partyAPhone !== undefined || data.partyAAddress !== undefined;
      if (data.partyA !== undefined || hasPartyAFlat) {
        updates.push(`party_a = $${paramIndex++}`);
        values.push(JSON.stringify(this.buildPartyA(data)));
      }
      const hasPartyBFlat = data.partyBName !== undefined || data.partyBPhone !== undefined || data.partyBAddress !== undefined;
      if (data.partyB !== undefined || hasPartyBFlat) {
        updates.push(`party_b = $${paramIndex++}`);
        values.push(JSON.stringify(this.buildPartyB(data)));
      }
      const hasPropFlat = data.propertyAddress !== undefined || data.propertyArea !== undefined;
      if (data.propertyDetails !== undefined || hasPropFlat) {
        updates.push(`property_details = $${paramIndex++}`);
        values.push(JSON.stringify(this.buildPropertyDetails(data)));
      }
      if (data.paymentSchedule !== undefined) {
        updates.push(`payment_schedule = $${paramIndex++}`);
        values.push(JSON.stringify(data.paymentSchedule));
      }
      if (data.metadata !== undefined) {
        updates.push(`metadata = $${paramIndex++}`);
        values.push(JSON.stringify(data.metadata));
      }

      for (const field of numericFields) {
        if (data[field] !== undefined) {
          updates.push(`${this.camelToSnake(field)} = $${paramIndex++}`);
          values.push(data[field]);
        }
      }
      // Keep value column in sync with propertyPrice (used by LATERAL join for contractValue)
      if (data.propertyPrice !== undefined) {
        updates.push(`value = $${paramIndex++}`);
        values.push(data.propertyPrice || 0);
      }
      if (data.signedAt !== undefined) {
        updates.push(`signed_at = $${paramIndex++}`);
        values.push(data.signedAt);
      }
      if (data.handoverDate !== undefined) {
        updates.push(`handover_date = $${paramIndex++}`);
        values.push(data.handoverDate);
      }
      if (data.signedPlace !== undefined) {
        updates.push(`signed_place = $${paramIndex++}`);
        values.push(data.signedPlace || null);
      }
      if (data.contractDate !== undefined) {
        updates.push(`contract_date = $${paramIndex++}`);
        values.push(data.contractDate || null);
      }

      if (updates.length <= 1) return this.findById(tenantId, id);

      const result = await client.query(
        `UPDATE contracts SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
        [id, ...values]
      );
      return result.rows[0] ? this.flattenEntity(this.rowToEntity(result.rows[0])) : null;
    });
  }

  async findById(tenantId: string, id: string): Promise<any | null> {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `SELECT * FROM contracts WHERE id = $1 AND tenant_id = $2`,
        [id, tenantId]
      );
      return result.rows[0] ? this.flattenEntity(this.rowToEntity(result.rows[0])) : null;
    });
  }
}

export const contractRepository = new ContractRepository();
