import { PoolClient } from 'pg';
import { Migration } from './runner';

const migration: Migration = {
  description: 'Normalize user roles to uppercase (fix legacy lowercase admin values)',

  async up(client: PoolClient) {
    await client.query(`
      UPDATE users
      SET role = UPPER(role)
      WHERE role != UPPER(role)
    `);
  },

  async down(_client: PoolClient) {
  },
};

export default migration;
