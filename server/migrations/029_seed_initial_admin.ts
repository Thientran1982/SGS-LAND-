import { PoolClient } from 'pg';
import { Migration } from './runner';

// Creates the initial admin account (info@sgsland.vn) if it does not already exist.
// Safe to re-run: uses INSERT ... ON CONFLICT DO UPDATE only when role is not already admin.
// REQUIRED: Set the INITIAL_ADMIN_PASSWORD_HASH env var to a bcrypt hash before running this
//           migration for the first time.
// IMPORTANT: Change the admin password immediately after first login.

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const ADMIN_EMAIL = 'info@sgsland.vn';
const ADMIN_NAME = 'SGS LAND Admin';

const migration: Migration = {
  description: 'Seed the initial admin account (info@sgsland.vn) if not present',

  async up(client: PoolClient) {
    const passwordHash = process.env.INITIAL_ADMIN_PASSWORD_HASH;
    if (!passwordHash) {
      throw new Error(
        'Migration 029 requires the INITIAL_ADMIN_PASSWORD_HASH environment variable. ' +
        'Generate a bcrypt hash of the desired admin password and set it before running migrations.'
      );
    }

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
      [TENANT_ID, ADMIN_NAME, ADMIN_EMAIL, passwordHash]
    );
  },

  async down(_client: PoolClient) {
    // Non-destructive — admin account is not removed on rollback
  },
};

export default migration;
