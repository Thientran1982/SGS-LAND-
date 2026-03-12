import { BaseRepository, PaginatedResult, PaginationParams } from './baseRepository';

export interface ListingFilters {
  type?: string;
  type_in?: string[];
  status?: string;
  status_in?: string[];
  transaction?: string;
  price_gte?: number;
  price_lte?: number;
  area_gte?: number;
  area_lte?: number;
  bedrooms_gte?: number;
  search?: string;
  projectCode?: string;
  isVerified?: boolean;
}

export class ListingRepository extends BaseRepository {
  constructor() {
    super('listings');
  }

  async findListings(
    tenantId: string,
    pagination: PaginationParams,
    filters?: ListingFilters
  ): Promise<PaginatedResult<any>> {
    return this.withTenant(tenantId, async (client) => {
      const conditions: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (filters?.type) {
        conditions.push(`type = $${paramIndex++}`);
        values.push(filters.type);
      }
      if (filters?.type_in?.length) {
        const ph = filters.type_in.map((_, i) => `$${paramIndex + i}`).join(', ');
        conditions.push(`type IN (${ph})`);
        values.push(...filters.type_in);
        paramIndex += filters.type_in.length;
      }
      if (filters?.status) {
        conditions.push(`status = $${paramIndex++}`);
        values.push(filters.status);
      }
      if (filters?.status_in?.length) {
        const ph = filters.status_in.map((_, i) => `$${paramIndex + i}`).join(', ');
        conditions.push(`status IN (${ph})`);
        values.push(...filters.status_in);
        paramIndex += filters.status_in.length;
      }
      if (filters?.transaction) {
        conditions.push(`transaction = $${paramIndex++}`);
        values.push(filters.transaction);
      }
      if (filters?.price_gte !== undefined) {
        conditions.push(`price >= $${paramIndex++}`);
        values.push(filters.price_gte);
      }
      if (filters?.price_lte !== undefined) {
        conditions.push(`price <= $${paramIndex++}`);
        values.push(filters.price_lte);
      }
      if (filters?.area_gte !== undefined) {
        conditions.push(`area >= $${paramIndex++}`);
        values.push(filters.area_gte);
      }
      if (filters?.area_lte !== undefined) {
        conditions.push(`area <= $${paramIndex++}`);
        values.push(filters.area_lte);
      }
      if (filters?.bedrooms_gte !== undefined) {
        conditions.push(`bedrooms >= $${paramIndex++}`);
        values.push(filters.bedrooms_gte);
      }
      if (filters?.projectCode) {
        conditions.push(`project_code = $${paramIndex++}`);
        values.push(filters.projectCode);
      }
      if (filters?.isVerified !== undefined) {
        conditions.push(`is_verified = $${paramIndex++}`);
        values.push(filters.isVerified);
      }
      if (filters?.search) {
        conditions.push(`(title ILIKE $${paramIndex} OR location ILIKE $${paramIndex} OR code ILIKE $${paramIndex})`);
        values.push(`%${filters.search}%`);
        paramIndex++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countResult = await client.query(
        `SELECT COUNT(*)::int as total FROM listings ${whereClause}`,
        values
      );
      const total = countResult.rows[0].total;

      const statsResult = await client.query(
        `SELECT
          COUNT(*) FILTER (WHERE status = 'AVAILABLE')::int AS available_count,
          COUNT(*) FILTER (WHERE status = 'HOLD')::int       AS hold_count,
          COUNT(*) FILTER (WHERE status = 'SOLD')::int       AS sold_count,
          COUNT(*) FILTER (WHERE status = 'RENTED')::int     AS rented_count,
          COUNT(*) FILTER (WHERE status = 'BOOKING')::int    AS booking_count,
          COUNT(*) FILTER (WHERE status = 'OPENING')::int    AS opening_count
         FROM listings`
      );
      const sr = statsResult.rows[0];

      const result = await client.query(
        `SELECT * FROM listings ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...values, pagination.pageSize, (pagination.page - 1) * pagination.pageSize]
      );

      return {
        data: this.rowsToEntities(result.rows),
        total,
        page: pagination.page,
        pageSize: pagination.pageSize,
        totalPages: Math.ceil(total / pagination.pageSize),
        stats: {
          availableCount: sr.available_count,
          holdCount:      sr.hold_count,
          soldCount:      sr.sold_count,
          rentedCount:    sr.rented_count,
          bookingCount:   sr.booking_count,
          openingCount:   sr.opening_count,
        },
      };
    });
  }

  async create(tenantId: string, data: Record<string, any>): Promise<any> {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `INSERT INTO listings (
          tenant_id, code, title, location, price, currency, area, bedrooms, bathrooms,
          type, status, transaction, attributes, images, project_code, contact_phone,
          coordinates, is_verified, owner_name, owner_phone, commission, commission_unit,
          created_by, authorized_agents, total_units, available_units
        ) VALUES (
          current_setting('app.current_tenant_id', true)::uuid,
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20, $21,
          $22, $23, $24, $25
        ) RETURNING *`,
        [
          data.code, data.title, data.location, data.price, data.currency || 'VND',
          data.area, data.bedrooms || null, data.bathrooms || null,
          data.type, data.status || 'AVAILABLE', data.transaction || 'SALE',
          JSON.stringify(data.attributes || {}), JSON.stringify(data.images || []),
          data.projectCode || null, data.contactPhone || null,
          data.coordinates ? JSON.stringify(data.coordinates) : null,
          data.isVerified || false, data.ownerName || null, data.ownerPhone || null,
          data.commission || null, data.commissionUnit || null,
          data.createdBy || null, JSON.stringify(data.authorizedAgents || []),
          data.totalUnits || null, data.availableUnits || null,
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

      const directFields = [
        'code', 'title', 'location', 'price', 'currency', 'area', 'bedrooms', 'bathrooms',
        'type', 'status', 'transaction', 'projectCode', 'contactPhone', 'isVerified',
        'ownerName', 'ownerPhone', 'commission', 'commissionUnit', 'totalUnits', 'availableUnits',
        'viewCount', 'bookingCount',
      ];
      const jsonFields = ['attributes', 'images', 'coordinates', 'authorizedAgents'];

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
      if (data.holdExpiresAt !== undefined) {
        updates.push(`hold_expires_at = $${paramIndex++}`);
        values.push(data.holdExpiresAt);
      }

      if (updates.length <= 1) return this.findById(tenantId, id);

      const result = await client.query(
        `UPDATE listings SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
        [id, ...values]
      );
      return result.rows[0] ? this.rowToEntity(result.rows[0]) : null;
    });
  }

  async toggleFavorite(tenantId: string, userId: string, listingId: string): Promise<boolean> {
    return this.withTenant(tenantId, async (client) => {
      const existing = await client.query(
        `SELECT 1 FROM favorites WHERE user_id = $1 AND listing_id = $2`,
        [userId, listingId]
      );
      if (existing.rows.length > 0) {
        await client.query(`DELETE FROM favorites WHERE user_id = $1 AND listing_id = $2`, [userId, listingId]);
        return false;
      } else {
        await client.query(
          `INSERT INTO favorites (user_id, listing_id, tenant_id) VALUES ($1, $2, current_setting('app.current_tenant_id', true)::uuid)`,
          [userId, listingId]
        );
        return true;
      }
    });
  }

  async getFavorites(tenantId: string, userId: string): Promise<any[]> {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `SELECT l.* FROM listings l
         INNER JOIN favorites f ON l.id = f.listing_id
         WHERE f.user_id = $1
         ORDER BY f.created_at DESC`,
        [userId]
      );
      return this.rowsToEntities(result.rows);
    });
  }

  async incrementViewCount(tenantId: string, id: string): Promise<number> {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `UPDATE listings SET view_count = view_count + 1 WHERE id = $1 RETURNING view_count`,
        [id]
      );
      return result.rows[0]?.view_count ?? 0;
    });
  }
}

export const listingRepository = new ListingRepository();
