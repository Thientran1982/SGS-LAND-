import { PoolClient } from 'pg';
import { Migration } from './runner';

const migration: Migration = {
  description: 'Add SUPER_ADMIN role — promote platform owner account to SUPER_ADMIN',
  async up(client: PoolClient) {
    // Promote the primary platform admin (admin@sgs.vn) in DEFAULT_TENANT_ID to SUPER_ADMIN.
    // SUPER_ADMIN is the highest tier: exclusively controls vendor approval and
    // can manage all user roles including ADMIN.
    await client.query(`
      UPDATE users
        SET role = 'SUPER_ADMIN'
        WHERE email = 'admin@sgs.vn'
          AND tenant_id = '00000000-0000-0000-0000-000000000001';
    `);
  },
};

export default migration;
