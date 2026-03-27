import { pool } from '../db';

export interface CreateNotificationData {
  tenantId: string;
  userId: string;
  type: string;
  title: string;
  body?: string;
  metadata?: Record<string, any>;
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

  async findByUser(tenantId: string, userId: string, limit = 30): Promise<any[]> {
    const result = await pool.query(
      `SELECT * FROM notifications
       WHERE tenant_id = $1 AND user_id = $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [tenantId, userId, limit]
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

  async markAllRead(tenantId: string, userId: string): Promise<void> {
    await pool.query(
      `UPDATE notifications
       SET read_at = NOW()
       WHERE tenant_id = $1 AND user_id = $2 AND read_at IS NULL`,
      [tenantId, userId]
    );
  }

  private rowToEntity(row: Record<string, any>): any {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      type: row.type,
      title: row.title,
      body: row.body,
      metadata: row.metadata,
      readAt: row.read_at,
      createdAt: row.created_at,
    };
  }
}

export const notificationRepository = new NotificationRepository();
