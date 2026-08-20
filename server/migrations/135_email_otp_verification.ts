import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const migration: Migration = {
  description: 'Add hashed, expiring email OTP verification records',
  async up(client: PoolClient) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS email_otp_challenges (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        email VARCHAR(320) NOT NULL,
        code_hash VARCHAR(128) NOT NULL,
        locale VARCHAR(8) NOT NULL DEFAULT 'vn',
        expires_at TIMESTAMPTZ NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        consumed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_email_otp_email_created
        ON email_otp_challenges (LOWER(email), created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_email_otp_user_active
        ON email_otp_challenges (user_id, created_at DESC)
        WHERE consumed_at IS NULL;
    `);
  },
  async down(client: PoolClient) {
    await client.query('DROP TABLE IF EXISTS email_otp_challenges');
  },
};

export default migration;