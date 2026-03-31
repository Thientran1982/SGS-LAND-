import { PoolClient } from 'pg';
import { Migration } from './runner';

// Creates the initial admin account (info@sgsland.vn) if it does not already exist.
// Safe to re-run: uses INSERT ... ON CONFLICT DO UPDATE only when role is not already admin.
// Password hash = 'Lovejolie1' (bcrypt, 10 rounds).

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const ADMIN_EMAIL = 'info@sgsland.vn';
const ADMIN_NAME = 'SGS LAND Admin';
const PASSWORD_HASH = '$2b$10$M3C28.QLrnfkM1nFWeab0uqfKDUvAtsgEhIWSV35sNRS250cfXYom';

const migration: Migration = {
  description: 'Seed the initial admin account (info@sgsland.vn) if not present',

  async up(client: PoolClient) {
    await client.query(
      `INSERT INTO users
         (tenant_id, name, email, password_hash, role, status, email_verified, source, metadata, permissions)
       VALUES ($1, $2, $3, $4, 'admin', 'active', true, 'seed', '{}', '{}')
       ON CONFLICT (tenant_id, email) DO UPDATE
         SET role           = 'admin',
             status         = 'active',
             email_verified = true,
             password_hash  = EXCLUDED.password_hash,
             updated_at     = NOW()
       WHERE users.role <> 'admin'`,
      [TENANT_ID, ADMIN_NAME, ADMIN_EMAIL, PASSWORD_HASH]
    );
  },

  async down(_client: PoolClient) {
    // Non-destructive — admin account is not removed on rollback
  },
};

export default migration;
