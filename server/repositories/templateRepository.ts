import { BaseRepository } from './baseRepository';

class TemplateRepository extends BaseRepository {
  constructor() {
    super('templates');
  }

  async findAllTemplates(tenantId: string, category?: string) {
    return this.withTenant(tenantId, async (client) => {
      let query = `SELECT * FROM templates`;
      const values: any[] = [];

      if (category) {
        query += ` WHERE category = $1`;
        values.push(category);
      }

      query += ` ORDER BY created_at DESC`;

      const result = await client.query(query, values);
      return this.rowsToEntities(result.rows);
    });
  }

  async create(tenantId: string, data: any) {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `INSERT INTO templates (name, category, content, variables)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [
          data.name,
          data.category || 'general',
          data.content || '',
          JSON.stringify(data.variables || {}),
        ]
      );
      return this.rowToEntity(result.rows[0]);
    });
  }

  async update(tenantId: string, id: string, data: any) {
    return this.withTenant(tenantId, async (client) => {
      const fields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (data.name !== undefined) {
        fields.push(`name = $${paramIndex++}`);
        values.push(data.name);
      }
      if (data.category !== undefined) {
        fields.push(`category = $${paramIndex++}`);
        values.push(data.category);
      }
      if (data.content !== undefined) {
        fields.push(`content = $${paramIndex++}`);
        values.push(data.content);
      }
      if (data.variables !== undefined) {
        fields.push(`variables = $${paramIndex++}`);
        values.push(JSON.stringify(data.variables));
      }

      if (fields.length === 0) return null;

      values.push(id);
      const result = await client.query(
        `UPDATE templates SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
      );
      return result.rows[0] ? this.rowToEntity(result.rows[0]) : null;
    });
  }
}

export const templateRepository = new TemplateRepository();
