import { BaseRepository, PaginatedResult, PaginationParams } from './baseRepository';

export class AuditRepository extends BaseRepository {
  constructor() {
    super('audit_logs');
  }

  async log(tenantId: string, data: {
    actorId: string;
    action: string;
    entityType: string;
    entityId: string;
    details?: string;
    metadata?: any;
    ipAddress?: string;
  }): Promise<void> {
    return this.withTenant(tenantId, async (client) => {
      await client.query(
        `INSERT INTO audit_logs (tenant_id, actor_id, action, entity_type, entity_id, details, metadata, ip_address)
         VALUES (current_setting('app.current_tenant_id', true)::uuid, $1, $2, $3, $4, $5, $6, $7)`,
        [
          data.actorId, data.action, data.entityType, data.entityId,
          data.details || null,
          data.metadata ? JSON.stringify(data.metadata) : null,
          data.ipAddress || null,
        ]
      );
    });
  }

  async findLogs(
    tenantId: string,
    pagination: PaginationParams,
    filters?: { actorId?: string; action?: string; entityType?: string; entityId?: string; since?: string }
  ): Promise<PaginatedResult<any>> {
    return this.withTenant(tenantId, async (client) => {
      const conditions: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (filters?.actorId) {
        conditions.push(`actor_id = $${paramIndex++}`);
        values.push(filters.actorId);
      }
      if (filters?.action) {
        conditions.push(`action = $${paramIndex++}`);
        values.push(filters.action);
      }
      if (filters?.entityType) {
        conditions.push(`entity_type = $${paramIndex++}`);
        values.push(filters.entityType);
      }
      if (filters?.entityId) {
        conditions.push(`entity_id = $${paramIndex++}`);
        values.push(filters.entityId);
      }
      if (filters?.since) {
        conditions.push(`timestamp >= $${paramIndex++}`);
        values.push(filters.since);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countResult = await client.query(
        `SELECT COUNT(*)::int as total FROM audit_logs ${whereClause}`,
        values
      );
      const total = countResult.rows[0].total;

      const page = pagination.page;
      const pageSize = pagination.pageSize;
      const offset = (page - 1) * pageSize;

      const result = await client.query(
        `SELECT al.*, u.name as actor_name
         FROM audit_logs al
         LEFT JOIN users u ON al.actor_id = u.id::text
         ${whereClause}
         ORDER BY al.timestamp DESC
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
}

export const auditRepository = new AuditRepository();
