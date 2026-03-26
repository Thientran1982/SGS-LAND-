import { BaseRepository, PaginatedResult, PaginationParams } from './baseRepository';

export class InteractionRepository extends BaseRepository {
  constructor() {
    super('interactions');
  }

  async findByLead(
    tenantId: string,
    leadId: string,
    pagination?: PaginationParams,
    userId?: string,
    userRole?: string
  ): Promise<any[]> {
    return this.withTenant(tenantId, async (client) => {
      if (userRole === 'SALES' && userId) {
        const leadCheck = await client.query(
          `SELECT assigned_to FROM leads WHERE id = $1`,
          [leadId]
        );
        if (!leadCheck.rows[0] || leadCheck.rows[0].assigned_to !== userId) {
          return [];
        }
      }

      const limit = pagination?.pageSize || 100;
      const offset = pagination ? (pagination.page - 1) * pagination.pageSize : 0;

      const result = await client.query(
        `SELECT * FROM interactions WHERE lead_id = $1 ORDER BY timestamp ASC LIMIT $2 OFFSET $3`,
        [leadId, limit, offset]
      );
      return this.rowsToEntities(result.rows);
    });
  }

  async create(tenantId: string, data: {
    leadId: string;
    channel: string;
    direction: string;
    type?: string;
    content: string;
    metadata?: any;
    status?: string;
    senderId?: string;
  }): Promise<any> {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `INSERT INTO interactions (
          tenant_id, lead_id, channel, direction, type, content, metadata, status, sender_id
        ) VALUES (
          current_setting('app.current_tenant_id', true)::uuid,
          $1, $2, $3, $4, $5, $6, $7, $8
        ) RETURNING *`,
        [
          data.leadId, data.channel, data.direction, data.type || 'TEXT',
          data.content, data.metadata ? JSON.stringify(data.metadata) : null,
          data.status || 'SENT', data.senderId || null,
        ]
      );
      return this.rowToEntity(result.rows[0]);
    });
  }

  async getInboxThreads(
    tenantId: string,
    userId?: string,
    userRole?: string
  ): Promise<any[]> {
    return this.withTenant(tenantId, async (client) => {
      let rbacJoin = '';
      let rbacWhere = '';
      const values: any[] = [];

      const RESTRICTED_ROLES = ['SALES', 'MARKETING', 'VIEWER'];
      if (RESTRICTED_ROLES.includes(userRole || '') && userId) {
        rbacJoin = `INNER JOIN leads ld ON i.lead_id = ld.id`;
        rbacWhere = `AND ld.assigned_to = $1`;
        values.push(userId);
      }

      const result = await client.query(`
        WITH latest_messages AS (
          SELECT DISTINCT ON (lead_id)
            i.lead_id,
            i.content as last_message,
            i.channel as last_channel,
            i.direction as last_direction,
            i.timestamp as last_timestamp,
            i.type as last_type
          FROM interactions i
          ${rbacJoin}
          WHERE 1=1 ${rbacWhere}
          ORDER BY lead_id, timestamp DESC
        ),
        unread_counts AS (
          SELECT lead_id, COUNT(*)::int as unread_count
          FROM interactions i
          ${rbacJoin}
          WHERE direction = 'INBOUND' AND status != 'READ' ${rbacWhere}
          GROUP BY lead_id
        )
        SELECT 
          l.id as lead_id,
          l.name as lead_name,
          l.phone as lead_phone,
          l.attributes->>'avatar' as lead_avatar,
          l.stage as lead_stage,
          l.assigned_to,
          l.score as lead_score,
          u.name as assigned_to_name,
          lm.last_message,
          lm.last_channel,
          lm.last_direction,
          lm.last_timestamp,
          lm.last_type,
          COALESCE(uc.unread_count, 0) as unread_count
        FROM latest_messages lm
        INNER JOIN leads l ON lm.lead_id = l.id
        LEFT JOIN users u ON l.assigned_to = u.id
        LEFT JOIN unread_counts uc ON lm.lead_id = uc.lead_id
        ORDER BY lm.last_timestamp DESC
      `, values);

      return result.rows.map(row => ({
        leadId: row.lead_id,
        leadName: row.lead_name,
        leadPhone: row.lead_phone,
        leadAvatar: row.lead_avatar,
        leadStage: row.lead_stage,
        assignedTo: row.assigned_to,
        assignedToName: row.assigned_to_name,
        leadScore: row.lead_score,
        lastMessage: row.last_message,
        lastChannel: row.last_channel,
        lastDirection: row.last_direction,
        lastTimestamp: row.last_timestamp,
        lastType: row.last_type,
        unreadCount: row.unread_count,
      }));
    });
  }

  async markThreadAsRead(tenantId: string, leadId: string): Promise<void> {
    return this.withTenant(tenantId, async (client) => {
      await client.query(
        `UPDATE interactions SET status = 'READ' WHERE lead_id = $1 AND direction = 'INBOUND' AND status != 'READ'`,
        [leadId]
      );
    });
  }

  async deleteConversation(tenantId: string, leadId: string): Promise<boolean> {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `DELETE FROM interactions WHERE lead_id = $1`,
        [leadId]
      );
      return (result.rowCount ?? 0) > 0;
    });
  }

  async getInteractionStats(tenantId: string, since?: string): Promise<{
    totalInbound: number;
    totalOutbound: number;
    aiOutbound: number;
    byChannel: Record<string, number>;
  }> {
    return this.withTenant(tenantId, async (client) => {
      let timeFilter = '';
      const values: any[] = [];
      if (since) {
        timeFilter = `WHERE timestamp >= $1`;
        values.push(since);
      }

      const result = await client.query(`
        SELECT
          COUNT(*) FILTER (WHERE direction = 'INBOUND')::int as total_inbound,
          COUNT(*) FILTER (WHERE direction = 'OUTBOUND')::int as total_outbound,
          COUNT(*) FILTER (WHERE direction = 'OUTBOUND' AND metadata->>'isAi' = 'true')::int as ai_outbound,
          json_object_agg(
            channel, 
            channel_count
          ) as by_channel
        FROM (
          SELECT *, COUNT(*) OVER (PARTITION BY channel)::int as channel_count
          FROM interactions
          ${timeFilter}
        ) sub
      `, values);

      const row = result.rows[0] || {};
      return {
        totalInbound: row.total_inbound || 0,
        totalOutbound: row.total_outbound || 0,
        aiOutbound: row.ai_outbound || 0,
        byChannel: row.by_channel || {},
      };
    });
  }
}

export const interactionRepository = new InteractionRepository();
