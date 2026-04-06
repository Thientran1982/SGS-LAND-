import { BaseRepository } from './baseRepository';

class SequenceRepository extends BaseRepository {
  constructor() {
    super('sequences');
  }

  async findAllSequences(tenantId: string) {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `SELECT * FROM sequences ORDER BY created_at DESC`
      );
      return this.rowsToEntities(result.rows);
    });
  }

  async create(tenantId: string, data: any) {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `INSERT INTO sequences (name, trigger_event, steps, is_active)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [
          data.name,
          data.triggerEvent || data.trigger_event || 'MANUAL',
          JSON.stringify(data.steps || []),
          data.isActive !== undefined ? data.isActive : true,
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
      if (data.triggerEvent !== undefined || data.trigger_event !== undefined) {
        fields.push(`trigger_event = $${paramIndex++}`);
        values.push(data.triggerEvent || data.trigger_event);
      }
      if (data.steps !== undefined) {
        fields.push(`steps = $${paramIndex++}`);
        values.push(JSON.stringify(data.steps));
      }
      if (data.isActive !== undefined) {
        fields.push(`is_active = $${paramIndex++}`);
        values.push(data.isActive);
      }

      fields.push(`updated_at = CURRENT_TIMESTAMP`);

      if (fields.length === 1) return null;

      values.push(id);
      const result = await client.query(
        `UPDATE sequences SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
      );
      return result.rows[0] ? this.rowToEntity(result.rows[0]) : null;
    });
  }
}

export const sequenceRepository = new SequenceRepository();
