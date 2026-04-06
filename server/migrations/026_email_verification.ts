import { PoolClient } from 'pg';
import { Migration } from './runner';

const migration: Migration = {
  description: 'Add email_verified and email_verification_token columns to users table',
  async up(client: PoolClient) {
    await client.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS email_verified          BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(64),
        ADD COLUMN IF NOT EXISTS email_verification_expires TIMESTAMP WITH TIME ZONE;
    `);

    // All existing ACTIVE users are considered already verified (legacy accounts)
    await client.query(`
      UPDATE users SET email_verified = TRUE WHERE status = 'ACTIVE';
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_verification_token
        ON users (email_verification_token) WHERE email_verification_token IS NOT NULL;
    `);
  },
  async down(client: PoolClient) {
    await client.query(`
      ALTER TABLE users
        DROP COLUMN IF EXISTS email_verified,
        DROP COLUMN IF EXISTS email_verification_token,
        DROP COLUMN IF EXISTS email_verification_expires;
    `);
  },
};

export default migration;
