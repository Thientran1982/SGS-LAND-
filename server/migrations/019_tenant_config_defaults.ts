import { PoolClient } from 'pg';
import { Migration } from './runner';

const migration: Migration = {
  description: 'Set default config (primaryColor, features) on initial tenant',
  async up(client: PoolClient) {
    await client.query(`
      UPDATE tenants
      SET config = jsonb_build_object(
        'primaryColor', '#4F46E5',
        'features', jsonb_build_object(
          'enableZalo', true,
          'maxUsers', 100
        )
      )
      WHERE id = '00000000-0000-0000-0000-000000000001'
        AND (config IS NULL OR config = '{}'::jsonb);
    `);
  },
  async down(client: PoolClient) {
    await client.query(`
      UPDATE tenants
      SET config = '{}'::jsonb
      WHERE id = '00000000-0000-0000-0000-000000000001';
    `);
  },
};

export default migration;
