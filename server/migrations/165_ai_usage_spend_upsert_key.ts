import type { Migration } from './runner';

const migration: Migration = {
  description: 'Ensure enterprise AI config upserts have a tenant-scoped unique key',

  async up(client) {
    // Older environments may have recorded the original enterprise_config
    // migration without its unique key. Keep the newest value before creating
    // the index required by ON CONFLICT (tenant_id, config_key).
    await client.query(`
      DELETE FROM enterprise_config older
      USING enterprise_config newer
      WHERE older.tenant_id IS NOT DISTINCT FROM newer.tenant_id
        AND older.config_key = newer.config_key
        AND (
          older.updated_at < newer.updated_at
          OR (older.updated_at IS NOT DISTINCT FROM newer.updated_at AND older.id < newer.id)
        )
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS enterprise_config_tenant_key_unique
        ON enterprise_config (tenant_id, config_key)
    `);
  },

  async down(client) {
    await client.query('DROP INDEX IF EXISTS enterprise_config_tenant_key_unique');
  },
};

export default migration;