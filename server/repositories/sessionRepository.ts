import { BaseRepository } from './baseRepository';

class SessionRepository extends BaseRepository {
  constructor() {
    super('user_sessions');
  }

  async findByUser(tenantId: string, userId: string) {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `SELECT * FROM user_sessions WHERE user_id = $1 AND expires_at > CURRENT_TIMESTAMP ORDER BY created_at DESC`,
        [userId]
      );
      return this.rowsToEntities(result.rows);
    });
  }

  async findAllActive(tenantId: string) {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `SELECT s.*, u.name as user_name, u.email as user_email
         FROM user_sessions s
         LEFT JOIN users u ON s.user_id = u.id
         WHERE s.expires_at > CURRENT_TIMESTAMP
         ORDER BY s.created_at DESC`
      );
      return this.rowsToEntities(result.rows);
    });
  }

  async create(tenantId: string, data: { userId: string; ipAddress?: string; userAgent?: string; expiresAt?: string }) {
    return this.withTenant(tenantId, async (client) => {
      const expiresAt = data.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const result = await client.query(
        `INSERT INTO user_sessions (user_id, ip_address, user_agent, expires_at)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [data.userId, data.ipAddress || null, data.userAgent || null, expiresAt]
      );
      return this.rowToEntity(result.rows[0]);
    });
  }

  async revoke(tenantId: string, sessionId: string) {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `DELETE FROM user_sessions WHERE id = $1`,
        [sessionId]
      );
      return (result.rowCount ?? 0) > 0;
    });
  }

  async revokeAllForUser(tenantId: string, userId: string) {
    return this.withTenant(tenantId, async (client) => {
      await client.query(
        `DELETE FROM user_sessions WHERE user_id = $1`,
        [userId]
      );
      return true;
    });
  }

  async cleanupExpired(tenantId: string) {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `DELETE FROM user_sessions WHERE expires_at <= CURRENT_TIMESTAMP`
      );
      return result.rowCount ?? 0;
    });
  }
}

export const sessionRepository = new SessionRepository();
