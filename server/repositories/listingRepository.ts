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
  noProjectCode?: boolean;
  isVerified?: boolean;
}

const PARTNER_ROLES = ['PARTNER_ADMIN', 'PARTNER_AGENT'];

export class ListingRepository extends BaseRepository {
  constructor() {
    super('listings');
  }

  /** Build filter conditions (shared between standard and partner queries). */
  private buildFilterConditions(
    filters: ListingFilters | undefined,
    startIndex: number
  ): { conditions: string[]; values: any[]; nextIndex: number } {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = startIndex;

    if (filters?.type) { conditions.push(`type = $${paramIndex++}`); values.push(filters.type); }
    if (filters?.type_in?.length) {
      const ph = filters.type_in.map((_, i) => `$${paramIndex + i}`).join(', ');
      conditions.push(`type IN (${ph})`);
      values.push(...filters.type_in);
      paramIndex += filters.type_in.length;
    }
    if (filters?.status) { conditions.push(`status = $${paramIndex++}`); values.push(filters.status); }
    if (filters?.status_in?.length) {
      const ph = filters.status_in.map((_, i) => `$${paramIndex + i}`).join(', ');
      conditions.push(`status IN (${ph})`);
      values.push(...filters.status_in);
      paramIndex += filters.status_in.length;
    }
    if (filters?.transaction) { conditions.push(`transaction = $${paramIndex++}`); values.push(filters.transaction); }
    if (filters?.price_gte !== undefined) { conditions.push(`price >= $${paramIndex++}`); values.push(filters.price_gte); }
    if (filters?.price_lte !== undefined) { conditions.push(`price <= $${paramIndex++}`); values.push(filters.price_lte); }
    if (filters?.area_gte !== undefined) { conditions.push(`area >= $${paramIndex++}`); values.push(filters.area_gte); }
    if (filters?.area_lte !== undefined) { conditions.push(`area <= $${paramIndex++}`); values.push(filters.area_lte); }
    if (filters?.bedrooms_gte !== undefined) { conditions.push(`bedrooms >= $${paramIndex++}`); values.push(filters.bedrooms_gte); }
    if (filters?.projectCode) { conditions.push(`project_code = $${paramIndex++}`); values.push(filters.projectCode); }
    if (filters?.noProjectCode) { conditions.push(`(project_code IS NULL OR project_code = '')`); }
    if (filters?.isVerified !== undefined) { conditions.push(`is_verified = $${paramIndex++}`); values.push(filters.isVerified); }
    if (filters?.search) {
      conditions.push(`(title ILIKE $${paramIndex} OR location ILIKE $${paramIndex} OR code ILIKE $${paramIndex})`);
      values.push(`%${filters.search}%`);
      paramIndex++;
    }

    return { conditions, values, nextIndex: paramIndex };
  }

  /** Compute stats row from a raw result. */
  private computeStats(rows: any[]) {
    const counts = { available: 0, hold: 0, sold: 0, rented: 0, booking: 0, opening: 0, inactive: 0 };
    for (const r of rows) {
      const s = (r.status || '').toUpperCase();
      if (s === 'AVAILABLE') counts.available++;
      else if (s === 'HOLD') counts.hold++;
      else if (s === 'SOLD') counts.sold++;
      else if (s === 'RENTED') counts.rented++;
      else if (s === 'BOOKING') counts.booking++;
      else if (s === 'OPENING') counts.opening++;
      else if (s === 'INACTIVE') counts.inactive++;
    }
    return {
      availableCount: counts.available, holdCount: counts.hold, soldCount: counts.sold,
      rentedCount: counts.rented, bookingCount: counts.booking, openingCount: counts.opening,
      inactiveCount: counts.inactive, totalCount: rows.length,
    };
  }

  /**
   * Find listings accessible to a PARTNER tenant.
   * Returns only listings whose project_id is in an ACTIVE project_access grant for partnerTenantId.
   * Sensitive internal fields (ownerPhone, ownerName, commission) are redacted.
   */
  async findListingsForPartner(
    partnerTenantId: string,
    pagination: PaginationParams,
    filters?: ListingFilters
  ): Promise<PaginatedResult<any>> {
    const { pool } = await import('../db');

    const empty: PaginatedResult<any> = {
      data: [], total: 0, page: pagination.page, pageSize: pagination.pageSize, totalPages: 0,
      stats: { availableCount: 0, holdCount: 0, soldCount: 0, rentedCount: 0, bookingCount: 0, openingCount: 0, inactiveCount: 0, totalCount: 0 },
    };

    // Resolve accessible project IDs (cross-tenant — no RLS context needed)
    const accessResult = await pool.query(
      `SELECT pa.project_id
       FROM project_access pa
       JOIN projects p ON p.id = pa.project_id
       WHERE pa.partner_tenant_id = $1
         AND pa.status = 'ACTIVE'
         AND (pa.expires_at IS NULL OR pa.expires_at > NOW())
         AND p.status = 'ACTIVE'`,
      [partnerTenantId]
    );

    if (accessResult.rows.length === 0) return empty;
    const projectIds = accessResult.rows.map((r: any) => r.project_id);

    // Start conditions: listings must belong to an accessible project
    // AND apply listing_access granular filter:
    //   - if a listing has active listing_access rows → partner needs explicit grant
    //   - if no listing_access rows for a listing → all project-level partners see it (default open)
    const conditions: string[] = [
      `project_id = ANY($1)`,
      `(
        NOT EXISTS (
          SELECT 1 FROM listing_access la2
          WHERE la2.listing_id = listings.id AND la2.status = 'ACTIVE'
            AND (la2.expires_at IS NULL OR la2.expires_at > NOW())
        )
        OR EXISTS (
          SELECT 1 FROM listing_access la3
          WHERE la3.listing_id = listings.id AND la3.partner_tenant_id = $2
            AND la3.status = 'ACTIVE'
            AND (la3.expires_at IS NULL OR la3.expires_at > NOW())
        )
      )`,
    ];
    const baseValues: any[] = [projectIds, partnerTenantId];

    const { conditions: filterConds, values: filterValues, nextIndex } =
      this.buildFilterConditions(filters, 3);

    const allConditions = [...conditions, ...filterConds];
    const allValues = [...baseValues, ...filterValues];
    const whereClause = `WHERE ${allConditions.join(' AND ')}`;

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM listings ${whereClause}`,
      allValues
    );
    const total = countResult.rows[0].total;

    const dataResult = await pool.query(
      `SELECT id, tenant_id, code, title, location, price, currency, area, bedrooms, bathrooms,
              type, status, transaction, attributes, images, project_code, project_id,
              contact_phone, coordinates, is_verified, view_count, booking_count,
              total_units, available_units, hold_expires_at, created_by, authorized_agents,
              created_at, updated_at
       FROM listings ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${nextIndex} OFFSET $${nextIndex + 1}`,
      [...allValues, pagination.pageSize, (pagination.page - 1) * pagination.pageSize]
    );

    // Redact sensitive internal fields for partners
    const data = this.rowsToEntities(dataResult.rows).map((l: any) => ({
      ...l,
      ownerName: undefined,
      ownerPhone: undefined,
      commission: undefined,
      commissionUnit: undefined,
    }));

    return {
      data,
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(total / pagination.pageSize),
      stats: this.computeStats(dataResult.rows),
    };
  }

  /**
   * Find a single listing by ID for a PARTNER tenant.
   * Returns null if listing has no project_id or the partner has no active grant for that project.
   */
  async findByIdForPartner(partnerTenantId: string, listingId: string): Promise<any | null> {
    const { pool } = await import('../db');

    const result = await pool.query(
      `SELECT l.id, l.tenant_id, l.code, l.title, l.location, l.price, l.currency,
              l.area, l.bedrooms, l.bathrooms, l.type, l.status, l.transaction,
              l.attributes, l.images, l.project_code, l.project_id,
              l.contact_phone, l.coordinates, l.is_verified, l.view_count, l.booking_count,
              l.total_units, l.available_units, l.hold_expires_at, l.created_by, l.authorized_agents,
              l.created_at, l.updated_at
       FROM listings l
       JOIN project_access pa ON pa.project_id = l.project_id
       WHERE l.id = $1
         AND pa.partner_tenant_id = $2
         AND pa.status = 'ACTIVE'
         AND (pa.expires_at IS NULL OR pa.expires_at > NOW())`,
      [listingId, partnerTenantId]
    );

    if (!result.rows[0]) return null;

    const listing = this.rowToEntity<any>(result.rows[0]);
    // Redact sensitive internal fields unless partner agent is explicitly authorized
    return {
      ...listing,
      ownerName: undefined,
      ownerPhone: undefined,
      commission: undefined,
      commissionUnit: undefined,
    };
  }

  /** Override findById to include assigned_to user info via JOIN. */
  async findById(tenantId: string, id: string): Promise<any | null> {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `SELECT l.*,
                u.name  AS assigned_to_name,
                u.email AS assigned_to_email,
                u.avatar AS assigned_to_avatar,
                u.role   AS assigned_to_role
         FROM listings l
         LEFT JOIN users u ON u.id = l.assigned_to
         WHERE l.id = $1 AND l.tenant_id = $2`,
        [id, tenantId]
      );
      if (!result.rows[0]) return null;
      return this.rowToEntity(result.rows[0]);
    });
  }

  /** Assign a listing to an internal user (or unassign with null). ADMIN/TEAM_LEAD only. */
  async assign(tenantId: string, listingId: string, userId: string | null): Promise<any | null> {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `UPDATE listings SET assigned_to = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND tenant_id = current_setting('app.current_tenant_id', true)::uuid
         RETURNING *`,
        [userId, listingId]
      );
      if (!result.rows[0]) return null;
      return this.rowToEntity(result.rows[0]);
    });
  }

  async findListings(
    tenantId: string,
    pagination: PaginationParams,
    filters?: ListingFilters,
    userId?: string,
    userRole?: string
  ): Promise<PaginatedResult<any>> {
    return this.withTenant(tenantId, async (client) => {
      const conditions: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      const RESTRICTED = ['SALES', 'MARKETING', 'VIEWER'];
      const PARTNER_RESTRICTED = ['PARTNER_ADMIN', 'PARTNER_AGENT'];
      // Visibility rules:
      // - AVAILABLE-only queries (e.g. proposal picker): see all available listings.
      // - Project-scoped queries:
      //     SALES/MARKETING/VIEWER → see ALL units in the project.
      //     PARTNER_ADMIN/PARTNER_AGENT → see ONLY units assigned to them.
      // - All other (non-project) queries for RESTRICTED roles: own + assigned listings.
      const isAvailableOnlyQuery = filters?.status === 'AVAILABLE';
      const isProjectQuery = !!filters?.projectCode;
      if (PARTNER_RESTRICTED.includes(userRole || '') && userId && isProjectQuery) {
        // Partner roles in project context: only their assigned units.
        conditions.push(`l.assigned_to = $${paramIndex}`);
        values.push(userId);
        paramIndex++;
      } else if (RESTRICTED.includes(userRole || '') && userId && !isAvailableOnlyQuery && !isProjectQuery) {
        // Non-partner restricted roles outside project context: own + assigned.
        conditions.push(`(l.created_by = $${paramIndex} OR l.assigned_to = $${paramIndex})`);
        values.push(userId);
        paramIndex++;
      }

      const { conditions: filterConds, values: filterValues, nextIndex } =
        this.buildFilterConditions(filters, paramIndex);
      conditions.push(...filterConds);
      values.push(...filterValues);
      paramIndex = nextIndex;

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countResult = await client.query(
        `SELECT COUNT(*)::int as total FROM listings l ${whereClause}`,
        values
      );
      const total = countResult.rows[0].total;

      const statsResult = await client.query(
        `SELECT
          COUNT(*) FILTER (WHERE l.status = 'AVAILABLE')::int AS available_count,
          COUNT(*) FILTER (WHERE l.status = 'HOLD')::int       AS hold_count,
          COUNT(*) FILTER (WHERE l.status = 'SOLD')::int       AS sold_count,
          COUNT(*) FILTER (WHERE l.status = 'RENTED')::int     AS rented_count,
          COUNT(*) FILTER (WHERE l.status = 'BOOKING')::int    AS booking_count,
          COUNT(*) FILTER (WHERE l.status = 'OPENING')::int    AS opening_count,
          COUNT(*) FILTER (WHERE l.status = 'INACTIVE')::int   AS inactive_count,
          COUNT(*)::int                                         AS total_count
         FROM listings l ${whereClause}`,
        values
      );
      const sr = statsResult.rows[0];

      const result = await client.query(
        `SELECT sub.*,
                u.name   AS assigned_to_name,
                u.email  AS assigned_to_email,
                u.avatar AS assigned_to_avatar,
                u.role   AS assigned_to_role
         FROM (
           SELECT * FROM listings l ${whereClause}
           ORDER BY l.created_at DESC
           LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
         ) AS sub
         LEFT JOIN users u ON u.id = sub.assigned_to`,
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
          inactiveCount:  sr.inactive_count,
          totalCount:     sr.total_count,
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

  async removeFavorite(tenantId: string, userId: string, listingId: string): Promise<void> {
    return this.withTenant(tenantId, async (client) => {
      await client.query(
        `DELETE FROM favorites WHERE user_id = $1 AND listing_id = $2`,
        [userId, listingId]
      );
    });
  }

  async getFavorites(tenantId: string, userId: string): Promise<any[]> {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `SELECT l.*, true AS is_favorite FROM listings l
         INNER JOIN favorites f ON l.id = f.listing_id
         WHERE f.user_id = $1
         ORDER BY f.created_at DESC`,
        [userId]
      );
      return this.rowsToEntities(result.rows).map((item: any) => ({
        ...item,
        isFavorite: true,
      }));
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

  /**
   * Find comparable listings for valuation (internal comps engine).
   *
   * Matching criteria:
   *   - Same location (district-level ILIKE match)
   *   - Area within ±40% of target area
   *   - Same or similar property type
   *   - Active or recently sold listings only
   *   - price > 0 and area > 0 (valid entries only)
   *
   * Returns aggregate stats (median, avg, percentiles) + sample listings.
   */
  async findComparables(
    tenantId: string,
    params: {
      location: string;
      area: number;
      propertyType?: string;
      maxSamples?: number;
    }
  ): Promise<{
    count: number;
    medianPricePerM2: number;
    avgPricePerM2: number;
    p25PricePerM2: number;
    p75PricePerM2: number;
    minPricePerM2: number;
    maxPricePerM2: number;
    samples: Array<{ id: string; title: string; location: string; price: number; area: number; pricePerM2: number; type: string }>;
  }> {
    return this.withTenant(tenantId, async (client) => {
      const areaMin = params.area * 0.60;
      const areaMax = params.area * 1.60;

      // Extract district-level keyword from location for fuzzy matching
      // e.g. "123 Nguyễn Văn Linh, Quận 7, TP.HCM" → search for "quận 7" or "q.7"
      const locationParts = params.location.split(/[,;]/);
      const district = (locationParts[1] || locationParts[0] || params.location).trim().slice(0, 50);

      const maxSamples = params.maxSamples || 20;

      // Map broad property type category
      const typeFilter = params.propertyType
        ? `AND type ILIKE $4`
        : '';
      const values: any[] = [areaMin, areaMax, `%${district}%`];
      if (params.propertyType) values.push(`%${params.propertyType.split('_')[0]}%`);

      const query = `
        SELECT
          id, title, location, price, area, type,
          CASE WHEN area > 0 THEN price / area ELSE 0 END AS price_per_m2
        FROM listings
        WHERE area BETWEEN $1 AND $2
          AND location ILIKE $3
          AND price > 0
          AND area > 0
          AND status IN ('AVAILABLE', 'SOLD', 'HOLD')
          ${typeFilter}
        ORDER BY updated_at DESC
        LIMIT ${maxSamples * 3}
      `;

      const result = await client.query(query, values);

      if (result.rows.length === 0) {
        return {
          count: 0, medianPricePerM2: 0, avgPricePerM2: 0,
          p25PricePerM2: 0, p75PricePerM2: 0, minPricePerM2: 0, maxPricePerM2: 0,
          samples: [],
        };
      }

      const prices = result.rows
        .map((r: any) => Number(r.price_per_m2))
        .filter((p: number) => p > 0 && p < 1_000_000_000)  // sanity filter
        .sort((a: number, b: number) => a - b);

      if (prices.length === 0) {
        return {
          count: 0, medianPricePerM2: 0, avgPricePerM2: 0,
          p25PricePerM2: 0, p75PricePerM2: 0, minPricePerM2: 0, maxPricePerM2: 0,
          samples: [],
        };
      }

      const median = prices[Math.floor(prices.length / 2)];
      const avg = Math.round(prices.reduce((s: number, p: number) => s + p, 0) / prices.length);
      const p25 = prices[Math.floor(prices.length * 0.25)];
      const p75 = prices[Math.floor(prices.length * 0.75)];

      const samples = result.rows
        .slice(0, maxSamples)
        .map((r: any) => ({
          id: r.id,
          title: r.title,
          location: r.location,
          price: Number(r.price),
          area: Number(r.area),
          pricePerM2: Math.round(Number(r.price_per_m2)),
          type: r.type,
        }));

      return {
        count: prices.length,
        medianPricePerM2: Math.round(median),
        avgPricePerM2: avg,
        p25PricePerM2: Math.round(p25),
        p75PricePerM2: Math.round(p75),
        minPricePerM2: Math.round(prices[0]),
        maxPricePerM2: Math.round(prices[prices.length - 1]),
        samples,
      };
    });
  }
}

export const listingRepository = new ListingRepository();
