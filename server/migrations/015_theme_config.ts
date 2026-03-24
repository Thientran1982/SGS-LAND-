import type { Migration } from './runner';

const migration: Migration = {
  description: 'Add theme_config JSONB to enterprise_config via tenant_themes table for per-tenant UI customization',

  async up(client) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenant_themes (
        tenant_id    UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
        theme_config JSONB NOT NULL DEFAULT '{}',
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      ALTER TABLE tenant_themes ENABLE ROW LEVEL SECURITY;
    `);

    await client.query(`
      DROP POLICY IF EXISTS tenant_themes_isolation ON tenant_themes;
      CREATE POLICY tenant_themes_isolation ON tenant_themes
        USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
    `);
  },

  async down(client) {
    await client.query(`DROP TABLE IF EXISTS tenant_themes CASCADE;`);
  },
};

export default migration;
