import { pool } from '../db';

export interface CreateNotificationData {
  tenantId: string;
  userId: string;
  type: string;
  title: string;
  body?: string;
  metadata?: Record<string, any>;
}

export interface CreateAdminNotificationData {
  type: string;
  title: string;
  body?: string;
  metadata?: Record<string, any>;
  /** When set, an existing notification with this transition key is reused. */
  dedupeKey?: string;
}

export interface NotificationOperationalEvent {
  id: string;
  tenantId: string;
  eventType: string;
  payload: Record<string, any>;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
}

export type ZaloReadinessNotificationRetryStatus = 'PENDING' | 'DELIVERED' | 'EXHAUSTED';

export interface ZaloReadinessNotificationRetryView {
  reasonCode: string;
  checkedAt: string;
  retryState: {
    status: ZaloReadinessNotificationRetryStatus;
    attemptCount: number;
    nextAttemptAt: string | null;
    deliveredAt: string | null;
    exhaustedAt: string | null;
  };
}

class NotificationRepository {
  async create(data: CreateNotificationData): Promise<any> {
    const result = await pool.query(
      `INSERT INTO notifications (tenant_id, user_id, type, title, body, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [data.tenantId, data.userId, data.type, data.title, data.body || null, JSON.stringify(data.metadata || {})]
    );
    return this.rowToEntity(result.rows[0]);
  }

  /**
   * Create one notification for every active administrator in a tenant.
   * The caller owns error handling because this is commonly best-effort work
   * performed after the primary operation has already committed.
   */
  async createForTenantAdmins(tenantId: string, data: CreateAdminNotificationData): Promise<void> {
    if (data.dedupeKey) {
      await pool.query(
        `WITH input AS (
           SELECT
             $1::uuid AS tenant_id,
             $2::text AS notification_type,
             $3::text AS notification_title,
             $4::text AS notification_body,
             $5::jsonb AS notification_metadata,
             $6::text AS dedupe_key
         )
         INSERT INTO notifications (tenant_id, user_id, type, title, body, metadata)
         SELECT input.tenant_id,
                u.id,
                input.notification_type,
                input.notification_title,
                input.notification_body,
                input.notification_metadata
           FROM users u
           CROSS JOIN input
          WHERE u.tenant_id = input.tenant_id
            AND u.status = 'ACTIVE'
            AND u.role IN ('SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD')
            AND NOT EXISTS (
              SELECT 1
                FROM notifications existing
               WHERE existing.tenant_id = input.tenant_id
                 AND existing.user_id = u.id
                 AND existing.type = input.notification_type
                 AND existing.metadata->>'transitionEventId' = input.dedupe_key
            )`,
        [
          tenantId,
          data.type,
          data.title,
          data.body || null,
          JSON.stringify(data.metadata || {}),
          data.dedupeKey,
        ],
      );
      return;
    }

    const result = await pool.query<{ id: string }>(
      `SELECT id
       FROM users
       WHERE tenant_id = $1
         AND status = 'ACTIVE'
         AND role IN ('SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD')`,
      [tenantId],
    );

    await Promise.all(result.rows.map(({ id }) => this.create({
      tenantId,
      userId: id,
      type: data.type,
      title: data.title,
      body: data.body,
      metadata: data.metadata,
    })));
  }

  async recordOperationalEvent(
    tenantId: string,
    eventType: string,
    payload: Record<string, any>,
  ): Promise<NotificationOperationalEvent> {
    const result = await pool.query(
      `INSERT INTO notification_operational_events (tenant_id, event_type, payload)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [tenantId, eventType, JSON.stringify(payload)],
    );
    return this.operationalEventToEntity(result.rows[0]);
  }

  async findOperationalEvents(
    tenantId: string,
    eventType?: string,
    limit = 60,
  ): Promise<NotificationOperationalEvent[]> {
    const result = await pool.query(
      `SELECT *
       FROM notification_operational_events
       WHERE tenant_id = $1
         AND ($2::text IS NULL OR event_type = $2)
       ORDER BY created_at DESC
       LIMIT $3`,
      [tenantId, eventType ?? null, limit],
    );
    return result.rows.map(row => this.operationalEventToEntity(row));
  }

  async findOperationalEventById(
    tenantId: string,
    id: string,
  ): Promise<NotificationOperationalEvent | null> {
    const result = await pool.query(
      `SELECT *
       FROM notification_operational_events
       WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id],
    );
    return result.rows[0] ? this.operationalEventToEntity(result.rows[0]) : null;
  }

  async resolveOperationalEvent(
    tenantId: string,
    id: string,
    resolvedBy: string,
  ): Promise<NotificationOperationalEvent | null> {
    const result = await pool.query(
      `UPDATE notification_operational_events
       SET resolved_at = NOW(), resolved_by = $3
       WHERE tenant_id = $1 AND id = $2 AND resolved_at IS NULL
       RETURNING *`,
      [tenantId, id, resolvedBy],
    );
    return result.rows[0] ? this.operationalEventToEntity(result.rows[0]) : null;
  }

  async findByUser(tenantId: string, userId: string, limit = 30): Promise<any[]> {
    const result = await pool.query(
      `SELECT n.*, u.name AS user_name FROM notifications n
       LEFT JOIN users u ON u.id = n.user_id
       WHERE n.tenant_id = $1 AND n.user_id = $2
       ORDER BY n.created_at DESC
       LIMIT $3`,
      [tenantId, userId, limit]
    );
    return result.rows.map(r => this.rowToEntity(r));
  }

  /** ADMIN: all notifications in the tenant, newest first */
  async findByTenant(tenantId: string, limit = 60): Promise<any[]> {
    const result = await pool.query(
      `SELECT n.*, u.name AS user_name FROM notifications n
       LEFT JOIN users u ON u.id = n.user_id
       WHERE n.tenant_id = $1
       ORDER BY n.created_at DESC
       LIMIT $2`,
      [tenantId, limit]
    );
    return result.rows.map(r => this.rowToEntity(r));
  }

  async countUnread(tenantId: string, userId: string): Promise<number> {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS count FROM notifications
       WHERE tenant_id = $1 AND user_id = $2 AND read_at IS NULL`,
      [tenantId, userId]
    );
    return result.rows[0]?.count ?? 0;
  }

  /** ADMIN: count all unread in the tenant */
  async countUnreadByTenant(tenantId: string): Promise<number> {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS count FROM notifications
       WHERE tenant_id = $1 AND read_at IS NULL`,
      [tenantId]
    );
    return result.rows[0]?.count ?? 0;
  }

  /**
   * Return only reviewed facts needed by the Admin Cockpit to explain a
   * readiness-warning delivery gap. Keep transition IDs, tenant IDs, and any
   * provider context out of this projection.
   */
  async listZaloReadinessNotificationRetries(
    tenantId: string,
    limit = 25,
  ): Promise<ZaloReadinessNotificationRetryView[]> {
    const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 100));
    const result = await pool.query(
      `SELECT reason_code, checked_at, status, attempt_count,
              next_attempt_at, delivered_at, exhausted_at
       FROM zalo_readiness_notification_retries
       WHERE tenant_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [tenantId, safeLimit],
    );
    return result.rows.map(row => ({
      reasonCode: row.reason_code,
      checkedAt: new Date(row.checked_at).toISOString(),
      retryState: {
        status: row.status as ZaloReadinessNotificationRetryStatus,
        attemptCount: Number(row.attempt_count),
        nextAttemptAt: row.next_attempt_at ? new Date(row.next_attempt_at).toISOString() : null,
        deliveredAt: row.delivered_at ? new Date(row.delivered_at).toISOString() : null,
        exhaustedAt: row.exhausted_at ? new Date(row.exhausted_at).toISOString() : null,
      },
    }));
  }

  async markRead(tenantId: string, userId: string, id: string): Promise<any | null> {
    const result = await pool.query(
      `UPDATE notifications
       SET read_at = NOW()
       WHERE id = $1 AND tenant_id = $2 AND user_id = $3
       RETURNING *`,
      [id, tenantId, userId]
    );
    return result.rows[0] ? this.rowToEntity(result.rows[0]) : null;
  }

  /** ADMIN: mark any notification read without user restriction */
  async markReadByTenant(tenantId: string, id: string): Promise<any | null> {
    const result = await pool.query(
      `UPDATE notifications
       SET read_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [id, tenantId]
    );
    return result.rows[0] ? this.rowToEntity(result.rows[0]) : null;
  }

  async markAllRead(tenantId: string, userId: string): Promise<void> {
    await pool.query(
      `UPDATE notifications
       SET read_at = NOW()
       WHERE tenant_id = $1 AND user_id = $2 AND read_at IS NULL`,
      [tenantId, userId]
    );
  }

  async recordZaloReadinessNotificationRetry(
    tenantId: string,
    transitionEventId: string,
    data: { reasonCode: string; checkedAt: string },
  ): Promise<boolean> {
    const result = await pool.query(
      `INSERT INTO zalo_readiness_notification_retries
         (tenant_id, transition_event_id, reason_code, checked_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, transition_event_id) DO NOTHING
       RETURNING id`,
      [tenantId, transitionEventId, data.reasonCode, data.checkedAt],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async claimDueZaloReadinessNotificationRetries(limit = 25): Promise<Array<{
    id: string;
    tenantId: string;
    transitionEventId: string;
    reasonCode: string;
    checkedAt: string;
    attemptCount: number;
  }>> {
    const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 100));
    const result = await pool.query(
      `WITH due AS (
         SELECT id
         FROM zalo_readiness_notification_retries
         WHERE status = 'PENDING'
           AND next_attempt_at <= NOW()
           AND (claimed_until IS NULL OR claimed_until <= NOW())
         ORDER BY next_attempt_at ASC, created_at ASC
         LIMIT $1
         FOR UPDATE SKIP LOCKED
       )
       UPDATE zalo_readiness_notification_retries retry
       SET attempt_count = retry.attempt_count + 1,
           claimed_until = NOW() + INTERVAL '5 minutes',
           updated_at = NOW()
       FROM due
       WHERE retry.id = due.id
       RETURNING retry.id, retry.tenant_id, retry.transition_event_id,
                 retry.reason_code, retry.checked_at, retry.attempt_count`,
      [safeLimit],
    );
    return result.rows.map(row => ({
      id: row.id,
      tenantId: row.tenant_id,
      transitionEventId: row.transition_event_id,
      reasonCode: row.reason_code,
      checkedAt: new Date(row.checked_at).toISOString(),
      attemptCount: Number(row.attempt_count),
    }));
  }

  async markZaloReadinessNotificationRetryDelivered(id: string): Promise<void> {
    await pool.query(
      `UPDATE zalo_readiness_notification_retries
       SET status = 'DELIVERED', claimed_until = NULL, delivered_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND status = 'PENDING'`,
      [id],
    );
  }

  async markZaloReadinessNotificationRetryFailed(
    id: string,
    attemptCount: number,
  ): Promise<'PENDING' | 'EXHAUSTED' | null> {
    const result = await pool.query(
      `UPDATE zalo_readiness_notification_retries
       SET status = CASE WHEN $2 >= $3 THEN 'EXHAUSTED' ELSE 'PENDING' END,
           next_attempt_at = CASE
             WHEN $2 >= $3 THEN next_attempt_at
             ELSE NOW() + (INTERVAL '1 minute' * POWER(2, LEAST($2 - 1, 2)))
           END,
           claimed_until = NULL,
           exhausted_at = CASE WHEN $2 >= $3 THEN NOW() ELSE exhausted_at END,
           updated_at = NOW()
       WHERE id = $1 AND status = 'PENDING'
       RETURNING status`,
      [id, attemptCount, ZALO_READINESS_NOTIFICATION_MAX_ATTEMPTS],
    );
    return result.rows[0]?.status || null;
  }

  async recordZaloReadinessNotificationExhausted(
    tenantId: string,
    data: { transitionEventId: string; reasonCode: string; checkedAt: string; attempts: number },
  ): Promise<void> {
    await pool.query(
      `INSERT INTO notification_operational_events (tenant_id, event_type, payload)
       SELECT $1, 'zalo_readiness_notification_retry_exhausted', $2::jsonb
       WHERE NOT EXISTS (
         SELECT 1
         FROM notification_operational_events
         WHERE tenant_id = $1
           AND event_type = 'zalo_readiness_notification_retry_exhausted'
           AND payload->>'transitionEventId' = $3
       )`,
      [
        tenantId,
        JSON.stringify({
          transitionEventId: data.transitionEventId,
          reasonCode: data.reasonCode,
          checkedAt: data.checkedAt,
          attempts: data.attempts,
        }),
        data.transitionEventId,
      ],
    );
  }

  /** ADMIN: mark all notifications in the tenant as read */
  async markAllReadByTenant(tenantId: string): Promise<void> {
    await pool.query(
      `UPDATE notifications
       SET read_at = NOW()
       WHERE tenant_id = $1 AND read_at IS NULL`,
      [tenantId]
    );
  }

  async deleteOne(tenantId: string, userId: string, id: string): Promise<boolean> {
    const result = await pool.query(
      `DELETE FROM notifications WHERE id = $1 AND tenant_id = $2 AND user_id = $3`,
      [id, tenantId, userId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async deleteOneByTenant(tenantId: string, id: string): Promise<boolean> {
    const result = await pool.query(
      `DELETE FROM notifications WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async deleteAllRead(tenantId: string, userId: string): Promise<void> {
    await pool.query(
      `DELETE FROM notifications WHERE tenant_id = $1 AND user_id = $2 AND read_at IS NOT NULL`,
      [tenantId, userId]
    );
  }

  async deleteAllReadByTenant(tenantId: string): Promise<void> {
    await pool.query(
      `DELETE FROM notifications WHERE tenant_id = $1 AND read_at IS NOT NULL`,
      [tenantId]
    );
  }

  private rowToEntity(row: Record<string, any>): any {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      userName: row.user_name ?? null,
      type: row.type,
      title: row.title,
      body: row.body,
      metadata: row.metadata,
      readAt: row.read_at,
      createdAt: row.created_at,
    };
  }

  private operationalEventToEntity(row: Record<string, any>): NotificationOperationalEvent {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      eventType: row.event_type,
      payload: row.payload || {},
      resolvedAt: row.resolved_at,
      resolvedBy: row.resolved_by,
      createdAt: row.created_at,
    };
  }
}

export const notificationRepository = new NotificationRepository();

export const ZALO_READINESS_NOTIFICATION_MAX_ATTEMPTS = 3;
