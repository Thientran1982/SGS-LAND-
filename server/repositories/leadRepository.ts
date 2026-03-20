import { PoolClient } from 'pg';
import { BaseRepository, PaginatedResult, PaginationParams } from './baseRepository';

export interface LeadFilters {
  stage?: string;
  stage_in?: string[];
  assignedTo?: string;
  source?: string;
  search?: string;
  tags?: string[];
  slaBreached?: boolean;
  score_gte?: number;
  score_lte?: number;
  createdAt_gte?: string;
  createdAt_lte?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

export class LeadRepository extends BaseRepository {
  constructor() {
    super('leads');
  }

  async findLeads(
    tenantId: string,
    pagination: PaginationParams,
    filters?: LeadFilters,
    userId?: string,
    userRole?: string
  ): Promise<PaginatedResult<any>> {
    return this.withTenant(tenantId, async (client) => {
      const conditions: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      const RESTRICTED = ['SALES', 'MARKETING', 'VIEWER'];
      if (RESTRICTED.includes(userRole || '') && userId) {
        conditions.push(`l.assigned_to = $${paramIndex++}`);
        values.push(userId);
      }

      if (filters?.stage) {
        conditions.push(`l.stage = $${paramIndex++}`);
        values.push(filters.stage);
      }
      if (filters?.stage_in && filters.stage_in.length > 0) {
        const placeholders = filters.stage_in.map((_, i) => `$${paramIndex + i}`).join(', ');
        conditions.push(`l.stage IN (${placeholders})`);
        values.push(...filters.stage_in);
        paramIndex += filters.stage_in.length;
      }
      if (filters?.assignedTo) {
        conditions.push(`l.assigned_to = $${paramIndex++}`);
        values.push(filters.assignedTo);
      }
      if (filters?.source) {
        conditions.push(`l.source = $${paramIndex++}`);
        values.push(filters.source);
      }
      if (filters?.slaBreached !== undefined) {
        conditions.push(`l.sla_breached = $${paramIndex++}`);
        values.push(filters.slaBreached);
      }
      if (filters?.search) {
        conditions.push(`(l.name ILIKE $${paramIndex} OR l.phone ILIKE $${paramIndex} OR l.email ILIKE $${paramIndex})`);
        values.push(`%${filters.search}%`);
        paramIndex++;
      }
      if (filters?.createdAt_gte) {
        conditions.push(`l.created_at >= $${paramIndex++}`);
        values.push(filters.createdAt_gte);
      }
      if (filters?.createdAt_lte) {
        conditions.push(`l.created_at <= $${paramIndex++}`);
        values.push(filters.createdAt_lte);
      }
      if (filters?.score_gte !== undefined) {
        conditions.push(`(l.score->>'score')::numeric >= $${paramIndex++}`);
        values.push(filters.score_gte);
      }
      if (filters?.score_lte !== undefined) {
        conditions.push(`(l.score->>'score')::numeric <= $${paramIndex++}`);
        values.push(filters.score_lte);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countResult = await client.query(
        `SELECT COUNT(*)::int as total FROM leads l ${whereClause}`,
        values
      );
      const total = countResult.rows[0].total;

      const RESTRICTED_ROLES = ['SALES', 'MARKETING', 'VIEWER'];
      const isRestricted = RESTRICTED_ROLES.includes(userRole || '') && !!userId;
      const statsResult = await client.query(
        `SELECT
          COUNT(*)::int                                                                           AS total,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int                 AS new_count,
          COUNT(*) FILTER (WHERE stage = 'WON')::int                                            AS won_count,
          COUNT(*) FILTER (WHERE stage = 'LOST')::int                                           AS lost_count,
          COALESCE(ROUND(AVG((score->>'score')::numeric)), 0)::int                              AS avg_score
         FROM leads
         WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid
           ${isRestricted ? 'AND assigned_to = $1' : ''}`,
        isRestricted ? [userId] : []
      );
      const sr = statsResult.rows[0];
      const globalTotal = sr.total || 0;
      const wonCount = sr.won_count || 0;
      const lostCount = sr.lost_count || 0;
      const decidedCount = wonCount + lostCount;
      const stats = {
        total:    globalTotal,
        newCount: sr.new_count || 0,
        wonCount,
        lostCount,
        avgScore: sr.avg_score || 0,
        winRate:  decidedCount > 0 ? Math.round((wonCount / decidedCount) * 100) : 0,
      };

      const page = pagination.page;
      const pageSize = pagination.pageSize;
      const offset = (page - 1) * pageSize;

      const sortField = filters?.sort || 'updated_at';
      const sortDir = (filters?.order || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      const orderBy = sortField === 'score'
        ? `(l.score->>'score')::numeric ${sortDir} NULLS LAST`
        : sortField === 'name'
          ? `l.name ${sortDir}`
          : sortField === 'created_at'
            ? `l.created_at ${sortDir}`
            : `l.updated_at ${sortDir}`;

      const result = await client.query(
        `SELECT l.*, u.name as assigned_to_name, u.avatar as assigned_to_avatar
         FROM leads l
         LEFT JOIN users u ON l.assigned_to = u.id
         ${whereClause}
         ORDER BY ${orderBy}
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...values, pageSize, offset]
      );

      return {
        data: this.rowsToEntities(result.rows),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        stats,
      };
    });
  }

  async findByIdWithAccess(
    tenantId: string,
    id: string,
    userId?: string,
    userRole?: string
  ): Promise<any | null> {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `SELECT l.*, u.name as assigned_to_name, u.avatar as assigned_to_avatar
         FROM leads l
         LEFT JOIN users u ON l.assigned_to = u.id
         WHERE l.id = $1 AND l.tenant_id = current_setting('app.current_tenant_id', true)::uuid`,
        [id]
      );
      if (!result.rows[0]) return null;

      const lead = this.rowToEntity<any>(result.rows[0]);

      const RESTRICTED = ['SALES', 'MARKETING', 'VIEWER'];
      if (RESTRICTED.includes(userRole || '') && userId && lead.assignedTo !== userId) {
        return null;
      }

      return lead;
    });
  }

  async checkDuplicatePhone(tenantId: string, phone: string, excludeId?: string): Promise<any | null> {
    return this.withTenant(tenantId, async (client) => {
      const normalizedPhone = phone.replace(/[\s\-()]/g, '');
      let query = `SELECT * FROM leads WHERE REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '(', ''), ')', '') = $1`;
      const values: any[] = [normalizedPhone];

      if (excludeId) {
        query += ` AND id != $2`;
        values.push(excludeId);
      }

      query += ` LIMIT 1`;
      const result = await client.query(query, values);
      return result.rows[0] ? this.rowToEntity(result.rows[0]) : null;
    });
  }

  async create(tenantId: string, data: {
    name: string;
    phone: string;
    email?: string;
    address?: string;
    source?: string;
    stage?: string;
    assignedTo?: string;
    tags?: string[];
    notes?: string;
    score?: any;
    socialIds?: any;
    optOutChannels?: string[];
    attributes?: any;
    preferences?: any;
  }): Promise<any> {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `INSERT INTO leads (
          tenant_id, name, phone, email, address, source, stage, assigned_to,
          tags, notes, score, social_ids, opt_out_channels, attributes, preferences
        ) VALUES (
          current_setting('app.current_tenant_id', true)::uuid,
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
        ) RETURNING *`,
        [
          data.name, data.phone, data.email || null, data.address || null,
          data.source || 'DIRECT', data.stage || 'NEW', data.assignedTo || null,
          JSON.stringify(data.tags || []), data.notes || null,
          data.score ? JSON.stringify(data.score) : null,
          data.socialIds ? JSON.stringify(data.socialIds) : null,
          JSON.stringify(data.optOutChannels || []),
          data.attributes ? JSON.stringify(data.attributes) : null,
          data.preferences ? JSON.stringify(data.preferences) : null,
        ]
      );
      return this.rowToEntity(result.rows[0]);
    });
  }

  async update(tenantId: string, id: string, data: Record<string, any>, userId?: string, userRole?: string): Promise<any | null> {
    return this.withTenant(tenantId, async (client) => {
      const RESTRICTED = ['SALES', 'MARKETING', 'VIEWER'];
      if (RESTRICTED.includes(userRole || '') && userId) {
        const check = await client.query(`SELECT assigned_to FROM leads WHERE id = $1 AND tenant_id = current_setting('app.current_tenant_id', true)::uuid`, [id]);
        if (!check.rows[0] || check.rows[0].assigned_to !== userId) return null;
      }

      const updates: string[] = ['updated_at = CURRENT_TIMESTAMP'];
      const values: any[] = [];
      let paramIndex = 2;

      const fieldMap: Record<string, string> = {
        name: 'name', phone: 'phone', email: 'email', address: 'address',
        source: 'source', stage: 'stage', assignedTo: 'assigned_to',
        notes: 'notes', slaBreached: 'sla_breached',
      };
      const jsonFields = ['tags', 'score', 'socialIds', 'optOutChannels', 'attributes', 'preferences'];

      for (const [key, col] of Object.entries(fieldMap)) {
        if (key === 'assignedTo' && userRole === 'SALES') continue;
        if (data[key] !== undefined) {
          updates.push(`${col} = $${paramIndex++}`);
          values.push(data[key]);
        }
      }
      for (const key of jsonFields) {
        if (data[key] !== undefined) {
          updates.push(`${this.camelToSnake(key)} = $${paramIndex++}`);
          values.push(JSON.stringify(data[key]));
        }
      }

      if (updates.length <= 1) return this.findById(tenantId, id);

      const result = await client.query(
        `UPDATE leads SET ${updates.join(', ')} WHERE id = $1 AND tenant_id = current_setting('app.current_tenant_id', true)::uuid RETURNING *`,
        [id, ...values]
      );

      if (!result.rows[0]) return null;

      if (data.stage === 'LOST') {
        await client.query(
          `UPDATE proposals SET status = 'REJECTED' WHERE lead_id = $1 AND status IN ('PENDING_APPROVAL', 'DRAFT')`,
          [id]
        );
      }

      return this.rowToEntity(result.rows[0]);
    });
  }

  /**
   * Find a lead by a specific social channel ID (zalo, facebook, telegram, ...).
   * e.g. findBySocialId(tenantId, 'zalo', '123456789')
   */
  async findBySocialId(tenantId: string, channel: 'zalo' | 'facebook' | 'telegram', socialId: string): Promise<any | null> {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `SELECT * FROM leads WHERE social_ids->>'${channel}' = $1 LIMIT 1`,
        [socialId]
      );
      return result.rows[0] ? this.rowToEntity(result.rows[0]) : null;
    });
  }

}

export const leadRepository = new LeadRepository();
