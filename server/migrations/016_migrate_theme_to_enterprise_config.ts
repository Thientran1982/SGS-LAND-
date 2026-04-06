import type { Migration } from './runner';

const migration: Migration = {
  description: 'Migrate theme_config from tenant_themes into enterprise_config as config_key=theme row; drop tenant_themes',

  async up(client) {
    await client.query(`
      INSERT INTO enterprise_config (tenant_id, config_key, config_value, updated_at)
      SELECT tenant_id, 'theme', theme_config, updated_at
      FROM tenant_themes
      WHERE theme_config IS NOT NULL AND theme_config <> '{}'::jsonb
      ON CONFLICT (tenant_id, config_key) DO UPDATE
        SET config_value = EXCLUDED.config_value,
            updated_at   = EXCLUDED.updated_at;
    `);

    await client.query(`DROP TABLE IF EXISTS tenant_themes CASCADE;`);
  },

  async down(client) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenant_themes (
        tenant_id    UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
        theme_config JSONB NOT NULL DEFAULT '{}',
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      INSERT INTO tenant_themes (tenant_id, theme_config, updated_at)
      SELECT tenant_id, config_value, updated_at
      FROM enterprise_config
      WHERE config_key = 'theme'
      ON CONFLICT (tenant_id) DO NOTHING;
    `);

    await client.query(`
      DELETE FROM enterprise_config WHERE config_key = 'theme';
    `);
  },
};

export default migration;
