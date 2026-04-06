import { PoolClient } from 'pg';
import { Migration } from './runner';

const migration: Migration = {
  description: 'Activate the initial admin account created via registration (info@sgsland.vn)',
  async up(client: PoolClient) {
    // The first registered user on production was created with PENDING status
    // because email verification was required. Since there is no email service
    // configured at that moment and this is the initial admin, we activate them directly.
    await client.query(`
      UPDATE users
      SET
        email_verified = TRUE,
        status = 'ACTIVE',
        email_verification_token = NULL,
        email_verification_expires = NULL,
        updated_at = NOW()
      WHERE email = 'info@sgsland.vn'
        AND status = 'PENDING'
        AND role = 'ADMIN';
    `);
  },
  async down(client: PoolClient) {
    // No-op: we cannot safely revert an account activation
  },
};

export default migration;
