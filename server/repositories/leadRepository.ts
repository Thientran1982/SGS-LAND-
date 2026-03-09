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

      if (userRole === 'SALES' && userId) {
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

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countResult = await client.query(
        `SELECT COUNT(*)::int as total FROM leads l ${whereClause}`,
        values
      );
      const total = countResult.rows[0].total;

      const page = pagination.page;
      const pageSize = pagination.pageSize;
      const offset = (page - 1) * pageSize;

      const result = await client.query(
        `SELECT l.*, u.name as assigned_to_name, u.avatar as assigned_to_avatar
         FROM leads l
         LEFT JOIN users u ON l.assigned_to = u.id
         ${whereClause}
         ORDER BY l.updated_at DESC
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
         WHERE l.id = $1`,
        [id]
      );
      if (!result.rows[0]) return null;

      const lead = this.rowToEntity<any>(result.rows[0]);

      if (userRole === 'SALES' && userId && lead.assignedTo !== userId) {
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
      if (userRole === 'SALES' && userId) {
        const check = await client.query(`SELECT assigned_to FROM leads WHERE id = $1`, [id]);
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
        `UPDATE leads SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
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

  async getStageDistribution(tenantId: string): Promise<Record<string, number>> {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `SELECT stage, COUNT(*)::int as count FROM leads GROUP BY stage`
      );
      const dist: Record<string, number> = {};
      for (const row of result.rows) {
        dist[row.stage] = row.count;
      }
      return dist;
    });
  }

  async getRecentLeads(tenantId: string, limit: number = 10): Promise<any[]> {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `SELECT l.*, u.name as assigned_to_name
         FROM leads l
         LEFT JOIN users u ON l.assigned_to = u.id
         ORDER BY l.created_at DESC
         LIMIT $1`,
        [limit]
      );
      return this.rowsToEntities(result.rows);
    });
  }
}

export const leadRepository = new LeadRepository();
