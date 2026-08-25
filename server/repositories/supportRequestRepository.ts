import { BaseRepository } from './baseRepository';

export const SUPPORT_STATUSES = ['RECEIVED', 'IN_PROGRESS', 'WAITING_FOR_USER', 'RESOLVED', 'CLOSED'] as const;
export type SupportStatus = typeof SUPPORT_STATUSES[number];

const safeText = (value: unknown, max: number) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

class SupportRequestRepository extends BaseRepository {
  constructor() { super('support_requests'); }

  async create(tenantId: string, requesterId: string, data: {
    category?: string; title: string; description: string; sourceSessionId?: string;
  }) {
    const title = safeText(data.title, 160);
    const description = safeText(data.description, 2000);
    if (!title || !description) throw new Error('TITLE_AND_DESCRIPTION_REQUIRED');
    return this.withTenant(tenantId, async client => {
      const result = await client.query(`
        INSERT INTO support_requests
          (tenant_id, requester_id, tracking_code, category, title, description, source_session_id, consent_confirmed)
        VALUES ($1, $2, 'TEMP', $3, $4, $5, $6, TRUE)
        RETURNING id
      `, [tenantId, requesterId, safeText(data.category || 'GENERAL', 40).toUpperCase(), title, description, safeText(data.sourceSessionId, 120) || null]);
      const id = result.rows[0].id as string;
      const code = `SGS-${new Date().getUTCFullYear()}-${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
      const updated = await client.query(`UPDATE support_requests SET tracking_code = $2 WHERE id = $1 RETURNING *`, [id, code]);
      await client.query(`INSERT INTO support_request_events (tenant_id, request_id, actor_id, event_type, status, message)
        VALUES ($1, $2, $3, 'CREATED', 'RECEIVED', 'Yêu cầu đã được tiếp nhận.')`, [tenantId, id, requesterId]);
      return this.rowToEntity(updated.rows[0]);
    });
  }

  async findForUser(tenantId: string, requesterId: string, id?: string) {
    return this.withTenant(tenantId, async client => {
      const result = await client.query(`
        SELECT r.*, COALESCE(json_agg(e ORDER BY e.created_at ASC) FILTER (WHERE e.id IS NOT NULL), '[]') AS events
        FROM support_requests r LEFT JOIN support_request_events e
          ON e.request_id = r.id AND e.tenant_id = r.tenant_id
        WHERE r.tenant_id = $1 AND r.requester_id = $2 ${id ? 'AND r.id = $3' : ''}
        GROUP BY r.id ORDER BY r.updated_at DESC
      `, id ? [tenantId, requesterId, id] : [tenantId, requesterId]);
      return id ? (result.rows[0] ? this.rowToEntity(result.rows[0]) : null) : this.rowsToEntities(result.rows);
    });
  }

  async listForStaff(tenantId: string, status?: string) {
    return this.withTenant(tenantId, async client => {
      const result = await client.query(`
        SELECT r.*, u.name AS requester_name, u.email AS requester_email
        FROM support_requests r JOIN users u ON u.id = r.requester_id AND u.tenant_id = r.tenant_id
        WHERE r.tenant_id = $1 ${status && SUPPORT_STATUSES.includes(status as SupportStatus) ? 'AND r.status = $2' : ''}
        ORDER BY r.updated_at DESC LIMIT 200
      `, status && SUPPORT_STATUSES.includes(status as SupportStatus) ? [tenantId, status] : [tenantId]);
      return this.rowsToEntities(result.rows);
    });
  }

  async updateByStaff(tenantId: string, id: string, actorId: string, status: SupportStatus, reply?: string) {
    return this.withTenant(tenantId, async client => {
      const result = await client.query(`
        UPDATE support_requests
        SET status = $3, latest_reply = COALESCE(NULLIF($4, ''), latest_reply),
            assigned_to = COALESCE(assigned_to, $2), last_updated_by = $2,
            updated_at = NOW(), resolved_at = CASE WHEN $3 IN ('RESOLVED','CLOSED') THEN COALESCE(resolved_at, NOW()) ELSE NULL END
        WHERE id = $1 AND tenant_id = $5 RETURNING *
      `, [id, actorId, status, safeText(reply, 2000), tenantId]);
      if (!result.rows[0]) return null;
      if (reply?.trim()) await client.query(`INSERT INTO support_request_events (tenant_id, request_id, actor_id, event_type, status, message)
        VALUES ($1, $2, $3, 'REPLIED', $4, $5)`, [tenantId, id, actorId, status, safeText(reply, 2000)]);
      else await client.query(`INSERT INTO support_request_events (tenant_id, request_id, actor_id, event_type, status)
        VALUES ($1, $2, $3, 'STATUS_CHANGED', $4)`, [tenantId, id, actorId, status]);
      return this.rowToEntity(result.rows[0]);
    });
  }
}

export const supportRequestRepository = new SupportRequestRepository();