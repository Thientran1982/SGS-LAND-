import { BaseRepository } from './baseRepository';

class SequenceRepository extends BaseRepository {
  constructor() {
    super('sequences');
  }

  /**
   * Return all sequences for a tenant, with live stats computed from
   * sequence_enrollments (enrolled count, open rate, click/reply rate).
   */
  async findAllSequences(tenantId: string) {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(`
        SELECT
          s.*,
          COALESCE(e.enrolled,    0) AS enrolled_count,
          COALESCE(e.sent_count,  0) AS sent_count,
          COALESCE(e.open_count,  0) AS open_count,
          COALESCE(e.click_count, 0) AS click_count
        FROM sequences s
        LEFT JOIN (
          SELECT
            sequence_id,
            COUNT(*)                                          AS enrolled,
            COUNT(*) FILTER (WHERE sent_at IS NOT NULL)      AS sent_count,
            COUNT(*) FILTER (WHERE opened_at IS NOT NULL)    AS open_count,
            COUNT(*) FILTER (WHERE clicked_at IS NOT NULL)   AS click_count
          FROM sequence_enrollments
          GROUP BY sequence_id
        ) e ON e.sequence_id = s.id
        ORDER BY s.created_at DESC
      `);

      return result.rows.map(row => this.rowWithStats(row));
    });
  }

  /** Map a raw DB row → entity with a computed `stats` object. */
  private rowWithStats(row: any) {
    const entity = this.rowToEntity<Record<string, any>>(row);

    const sent    = Number(row.sent_count  ?? 0);
    const opened  = Number(row.open_count  ?? 0);
    const clicked = Number(row.click_count ?? 0);
    const enrolled = Number(row.enrolled_count ?? 0);

    const openRate   = sent > 0 ? Math.round((opened  / sent) * 100) : 0;
    const replyRate  = sent > 0 ? Math.round((clicked / sent) * 100) : 0;
    const clickRate  = sent > 0 ? Math.round((clicked / sent) * 100) : 0;

    return {
      ...entity,
      stats: {
        enrolled,
        active:    enrolled,
        completed: sent,
        openRate,
        replyRate,
        clickRate,
      },
    };
  }

  async create(tenantId: string, data: any) {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `INSERT INTO sequences (tenant_id, name, trigger_event, steps, is_active)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          tenantId,
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

      values.push(id, tenantId);
      const result = await client.query(
        `UPDATE sequences SET ${fields.join(', ')} WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1} RETURNING *`,
        values
      );
      return result.rows[0] ? this.rowToEntity(result.rows[0]) : null;
    });
  }
}

export const sequenceRepository = new SequenceRepository();
