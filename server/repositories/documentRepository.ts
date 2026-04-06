import { BaseRepository } from './baseRepository';

const TENANT_FILTER = `tenant_id = current_setting('app.current_tenant_id', true)::uuid`;

class DocumentRepository extends BaseRepository {
  constructor() {
    super('documents');
  }

  async findDocuments(
    tenantId: string,
    pagination?: { page: number; pageSize: number },
    filters?: { search?: string }
  ) {
    return this.withTenant(tenantId, async (client) => {
      const page = pagination?.page || 1;
      const pageSize = pagination?.pageSize || 50;
      const offset = (page - 1) * pageSize;

      const conditions: string[] = [`${TENANT_FILTER}`];
      const values: any[] = [];
      let paramIndex = 1;

      if (filters?.search) {
        conditions.push(`title ILIKE $${paramIndex++}`);
        values.push(`%${filters.search}%`);
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`;

      const countResult = await client.query(
        `SELECT COUNT(*)::int as total FROM documents ${whereClause}`,
        values
      );
      const total = countResult.rows[0].total;

      const result = await client.query(
        `SELECT * FROM documents ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
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

  async create(tenantId: string, data: any) {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `INSERT INTO documents (tenant_id, title, type, content, status, file_url, size_kb)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [tenantId, data.title, data.type || 'document', data.content || '', data.status || 'ACTIVE', data.fileUrl || null, data.sizeKb || null]
      );
      return this.rowToEntity(result.rows[0]);
    });
  }

  async update(tenantId: string, id: string, data: any) {
    return this.withTenant(tenantId, async (client) => {
      const updates: string[] = [];
      const values: any[] = [id];
      let paramIndex = 2;

      const fields: Record<string, string> = { title: 'title', type: 'type', content: 'content', status: 'status', fileUrl: 'file_url' };
      for (const [key, col] of Object.entries(fields)) {
        if (data[key] !== undefined) {
          updates.push(`${col} = $${paramIndex++}`);
          values.push(data[key]);
        }
      }
      if (updates.length === 0) return this.findById(tenantId, id);

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      const result = await client.query(
        `UPDATE documents SET ${updates.join(', ')} WHERE id = $1 AND ${TENANT_FILTER} RETURNING *`,
        values
      );
      return result.rows[0] ? this.rowToEntity(result.rows[0]) : null;
    });
  }
}

export const documentRepository = new DocumentRepository();
