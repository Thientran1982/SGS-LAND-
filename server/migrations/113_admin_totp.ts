import { PoolClient } from 'pg';

/**
 * 2FA cho Admin: them cot TOTP vao bang users.
 * - totp_secret: base32 secret ma hoa AES-256-GCM (khong luu plaintext).
 * - totp_enabled: bat/tat 2FA cho tai khoan.
 * - totp_backup_codes: mang hash SHA-256 cua backup recovery codes.
 * - totp_enrolled_at: thoi diem kich hoat 2FA.
 * SUPER_ADMIN / ADMIN se bi bat buoc nhap TOTP khi totp_enabled = true.
 */
export default {
  description: 'Add admin TOTP 2FA columns to users (secret, enabled, backup codes)',
  async up(client: PoolClient): Promise<void> {
    await client.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS totp_secret       TEXT,
        ADD COLUMN IF NOT EXISTS totp_enabled      BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS totp_backup_codes JSONB   NOT NULL DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS totp_enrolled_at  TIMESTAMP WITH TIME ZONE;
    `);

    // Partial index to quickly find accounts with 2FA active.
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_totp_enabled
        ON users(tenant_id) WHERE totp_enabled = TRUE;
    `);
  },
  async down(client: PoolClient): Promise<void> {
    await client.query(`DROP INDEX IF EXISTS idx_users_totp_enabled;`);
    await client.query(`
      ALTER TABLE users
        DROP COLUMN IF EXISTS totp_secret,
        DROP COLUMN IF EXISTS totp_enabled,
        DROP COLUMN IF EXISTS totp_backup_codes,
        DROP COLUMN IF EXISTS totp_enrolled_at;
    `);
  },
};
