import { BaseRepository } from './baseRepository';

class RoutingRuleRepository extends BaseRepository {
  constructor() {
    super('routing_rules');
  }

  async findAllRules(tenantId: string) {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `SELECT * FROM routing_rules ORDER BY priority ASC, created_at DESC`
      );
      return this.rowsToEntities(result.rows);
    });
  }

  async create(tenantId: string, data: any) {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `INSERT INTO routing_rules (name, conditions, action, priority, is_active)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          data.name,
          JSON.stringify(data.conditions || []),
          JSON.stringify(data.action || {}),
          data.priority || 0,
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
      if (data.conditions !== undefined) {
        fields.push(`conditions = $${paramIndex++}`);
        values.push(JSON.stringify(data.conditions));
      }
      if (data.action !== undefined) {
        fields.push(`action = $${paramIndex++}`);
        values.push(JSON.stringify(data.action));
      }
      if (data.priority !== undefined) {
        fields.push(`priority = $${paramIndex++}`);
        values.push(data.priority);
      }
      if (data.isActive !== undefined) {
        fields.push(`is_active = $${paramIndex++}`);
        values.push(data.isActive);
      }

      if (fields.length === 0) return null;

      values.push(id);
      const result = await client.query(
        `UPDATE routing_rules SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
      );
      return result.rows[0] ? this.rowToEntity(result.rows[0]) : null;
    });
  }
}

export const routingRuleRepository = new RoutingRuleRepository();
