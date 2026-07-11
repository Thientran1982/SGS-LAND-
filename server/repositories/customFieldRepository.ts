import { BaseRepository } from './baseRepository';

export interface CustomFieldRow {
  id: string;
  tenantId: string;
  label: string;
  fieldKey: string;
  entity: string;
  fieldType: string;
  required: boolean;
  createdAt: string;
}

class CustomFieldRepository extends BaseRepository {
  constructor() {
    super('custom_fields');
  }

  async list(tenantId: string, entity?: string): Promise<CustomFieldRow[]> {
    return this.withTenant(tenantId, async (client) => {
      const params: any[] = [tenantId];
      let where = 'tenant_id = $1';
      if (entity) {
        params.push(entity);
        where += ' AND entity = $2';
      }
      const result = await client.query(
        `SELECT * FROM custom_fields WHERE ${where} ORDER BY created_at ASC`,
        params,
      );
      return this.rowsToEntities<CustomFieldRow>(result.rows);
    });
  }

  async create(
    tenantId: string,
    data: { label: string; fieldKey: string; entity: string; fieldType: string; required: boolean },
  ): Promise<CustomFieldRow> {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `INSERT INTO custom_fields (tenant_id, label, field_key, entity, field_type, required)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [tenantId, data.label, data.fieldKey, data.entity, data.fieldType, data.required],
      );
      return this.rowToEntity<CustomFieldRow>(result.rows[0]);
    });
  }
}

export const customFieldRepository = new CustomFieldRepository();
