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

  async matchLead(tenantId: string, lead: {
    source?: string;
    address?: string;
    tags?: string[];
    preferences?: any;
    score?: any;
  }): Promise<string | null> {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `SELECT * FROM routing_rules WHERE is_active = true ORDER BY priority ASC, created_at DESC`
      );
      for (const row of result.rows) {
        const rule = this.rowToEntity<any>(row);
        const cond: any = rule.conditions || {};

        if (cond.source && cond.source.length > 0) {
          if (!lead.source || !cond.source.includes(lead.source)) continue;
        }
        if (cond.region && cond.region.length > 0) {
          const addr = (lead.address || '').toLowerCase();
          if (!cond.region.some((r: string) => addr.includes(r.toLowerCase()))) continue;
        }
        if (cond.tags && cond.tags.length > 0) {
          const leadTags: string[] = lead.tags || [];
          if (!cond.tags.some((tag: string) => leadTags.includes(tag))) continue;
        }
        const budget = lead.preferences?.budget || 0;
        if (cond.budgetMin && cond.budgetMin > 0 && budget < cond.budgetMin) continue;
        if (cond.budgetMax && cond.budgetMax > 0 && budget > cond.budgetMax) continue;
        if (cond.temperature && cond.temperature.length > 0) {
          const label = lead.score?.label || '';
          if (!cond.temperature.includes(label)) continue;
        }

        const action: any = rule.action || {};
        if (action.type === 'ASSIGN_USER' && action.targetId) {
          return action.targetId;
        }
        if (action.type === 'ASSIGN_TEAM' && action.targetId) {
          const members = await client.query(
            `SELECT user_id FROM team_members WHERE team_id = $1 ORDER BY RANDOM() LIMIT 1`,
            [action.targetId]
          );
          if (members.rows[0]) return members.rows[0].user_id;
        }
      }
      return null;
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
