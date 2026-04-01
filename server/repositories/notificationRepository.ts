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
}

export const notificationRepository = new NotificationRepository();
