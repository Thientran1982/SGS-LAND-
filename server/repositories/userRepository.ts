import bcrypt from 'bcrypt';
import { PoolClient } from 'pg';
import { BaseRepository, PaginatedResult, PaginationParams } from './baseRepository';

const SALT_ROUNDS = 12;

export interface UserRow {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  passwordHash?: string;
  role: string;
  permissions?: any;
  avatar?: string;
  status: string;
  source?: string;
  phone?: string;
  bio?: string;
  metadata?: any;
  lastLoginAt?: string;
  createdAt?: string;
  emailVerified?: boolean;
  emailVerificationToken?: string | null;
  emailVerificationExpires?: string | null;
}

export class UserRepository extends BaseRepository {
  constructor() {
    super('users');
  }

  async findByEmail(tenantId: string, email: string): Promise<UserRow | null> {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `SELECT * FROM users WHERE email = $1`,
        [email]
      );
      return result.rows[0] ? this.rowToEntity<UserRow>(result.rows[0]) : null;
    });
  }

  async findByIdDirect(id: string, tenantId?: string): Promise<UserRow | null> {
    if (tenantId) {
      return this.withTenant(tenantId, async (client) => {
        const result = await client.query(`SELECT * FROM users WHERE id = $1`, [id]);
        return result.rows[0] ? this.rowToEntity<UserRow>(result.rows[0]) : null;
      });
    }
    // Fallback: tra cứu user theo PRIMARY KEY khi không có tenant context (vd: refresh JWT,
    // worker nội bộ). Dùng RLS bypass có kiểm soát — luôn ràng buộc bằng id để tránh dò tenant.
    const { withRlsBypass } = await import('../db');
    return withRlsBypass(async (client) => {
      const result = await client.query(`SELECT * FROM users WHERE id = $1`, [id]);
      return result.rows[0] ? this.rowToEntity<UserRow>(result.rows[0]) : null;
    });
  }

  async authenticate(tenantId: string, email: string, password: string): Promise<UserRow | null> {
    const user = await this.findByEmail(tenantId, email);
    if (!user) return null;
    if (!user.passwordHash) return null;
    const valid = await bcrypt.compare(password, user.passwordHash);
    return valid ? user : null;
  }

  async create(tenantId: string, data: {
    name: string;
    email: string;
    password?: string;
    role?: string;
    avatar?: string;
    phone?: string;
    source?: string;
    metadata?: any;
    status?: string;
    emailVerified?: boolean;
    emailVerificationToken?: string | null;
    emailVerificationExpires?: Date | null;
  }): Promise<UserRow> {
    const passwordHash = data.password ? await bcrypt.hash(data.password, SALT_ROUNDS) : null;
    const status = data.status ?? 'ACTIVE';
    const emailVerified = data.emailVerified ?? (status === 'ACTIVE');

    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `INSERT INTO users (tenant_id, name, email, password_hash, role, avatar, phone, source, metadata, status, email_verified, email_verification_token, email_verification_expires)
         VALUES (current_setting('app.current_tenant_id', true)::uuid, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [data.name, data.email, passwordHash, data.role || 'VIEWER', data.avatar || null, data.phone || null, data.source || 'SYSTEM', data.metadata ? JSON.stringify(data.metadata) : null, status, emailVerified, data.emailVerificationToken ?? null, data.emailVerificationExpires ?? null]
      );
      return this.rowToEntity<UserRow>(result.rows[0]);
    });
  }

  async update(tenantId: string, id: string, data: Partial<UserRow>): Promise<UserRow | null> {
    return this.withTenant(tenantId, async (client) => {
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 2;

      const allowedFields = ['name', 'role', 'avatar', 'status', 'phone', 'bio', 'metadata', 'permissions'];
      for (const field of allowedFields) {
        if ((data as any)[field] !== undefined) {
          updates.push(`${this.camelToSnake(field)} = $${paramIndex}`);
          const val = (data as any)[field];
          values.push(typeof val === 'object' && val !== null ? JSON.stringify(val) : val);
          paramIndex++;
        }
      }

      if (updates.length === 0) return this.findById(tenantId, id);

      const result = await client.query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
        [id, ...values]
      );
      return result.rows[0] ? this.rowToEntity<UserRow>(result.rows[0]) : null;
    });
  }

  async updatePassword(tenantId: string, id: string, newPassword: string): Promise<boolean> {
    const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `UPDATE users SET password_hash = $1, updated_at = NOW()
         WHERE id = $2 AND tenant_id = current_setting('app.current_tenant_id', true)::uuid`,
        [hash, id]
      );
      return (result.rowCount ?? 0) > 0;
    });
  }

  async updateLastLogin(tenantId: string, id: string): Promise<void> {
    return this.withTenant(tenantId, async (client) => {
      await client.query(
        `UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [id]
      );
    });
  }

  async listUsers(tenantId: string, pagination?: PaginationParams, filters?: { role?: string; status?: string; search?: string; sortField?: string; sortOrder?: string }): Promise<PaginatedResult<UserRow> & { stats: { activeCount: number; pendingCount: number } }> {
    return this.withTenant(tenantId, async (client) => {
      const conditions: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (filters?.role) {
        conditions.push(`role = $${paramIndex++}`);
        values.push(filters.role);
      }
      if (filters?.status) {
        conditions.push(`status = $${paramIndex++}`);
        values.push(filters.status);
      }
      if (filters?.search) {
        conditions.push(`(name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`);
        values.push(`%${filters.search}%`);
        paramIndex++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const countResult = await client.query(`SELECT COUNT(*)::int as total FROM users ${whereClause}`, values);
      const total = countResult.rows[0].total;

      const statsResult = await client.query(
        `SELECT
          COUNT(*) FILTER (WHERE status = 'ACTIVE')::int AS active_count,
          COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending_count
         FROM users`
      );
      const stats = {
        activeCount: statsResult.rows[0].active_count,
        pendingCount: statsResult.rows[0].pending_count,
      };

      const page = pagination?.page || 1;
      const pageSize = pagination?.pageSize || 50;
      const offset = (page - 1) * pageSize;

      const SORTABLE_FIELDS: Record<string, string> = {
        name: 'name',
        role: 'role',
        status: 'status',
        lastLoginAt: 'last_login_at',
        createdAt: 'created_at',
      };
      const sortCol = SORTABLE_FIELDS[filters?.sortField || ''] || 'created_at';
      const sortDir = filters?.sortOrder === 'asc' ? 'ASC' : 'DESC';

      const result = await client.query(
        `SELECT * FROM users ${whereClause} ORDER BY ${sortCol} ${sortDir} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...values, pageSize, offset]
      );

      return {
        data: this.rowsToEntities<UserRow>(result.rows),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        stats,
      };
    });
  }

  async getTeams(tenantId: string): Promise<any[]> {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(`
        SELECT t.*, 
          COALESCE(json_agg(tm.user_id) FILTER (WHERE tm.user_id IS NOT NULL), '[]') as member_ids
        FROM teams t
        LEFT JOIN team_members tm ON t.id = tm.team_id
        GROUP BY t.id
        ORDER BY t.name
      `);
      return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        leadId: row.lead_id,
        memberIds: row.member_ids,
        metadata: row.metadata,
      }));
    });
  }

  async delete(tenantId: string, id: string): Promise<boolean> {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `DELETE FROM users WHERE id = $1 AND tenant_id = $2`,
        [id, tenantId]
      );
      return (result.rowCount ?? 0) > 0;
    });
  }

  async invite(tenantId: string, data: {
    name: string;
    email: string;
    role?: string;
    phone?: string;
  }): Promise<UserRow> {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query(
        `INSERT INTO users (tenant_id, name, email, phone, role, status, source)
         VALUES (current_setting('app.current_tenant_id', true)::uuid, $1, $2, $3, $4, 'PENDING', 'INVITE')
         RETURNING *`,
        [data.name, data.email, data.phone || null, data.role || 'VIEWER']
      );
      return this.rowToEntity<UserRow>(result.rows[0]);
    });
  }

  toPublicUser(user: UserRow): Omit<UserRow, 'passwordHash'> {
    const { passwordHash, ...publicUser } = user;
    // Normalize permissions: DB may return string (TEXT col) or object — ensure array
    let perms = publicUser.permissions;
    if (typeof perms === 'string') {
      try { perms = JSON.parse(perms); } catch { perms = []; }
    }
    publicUser.permissions = Array.isArray(perms) ? perms : [];
    return publicUser;
  }
}

export const userRepository = new UserRepository();
