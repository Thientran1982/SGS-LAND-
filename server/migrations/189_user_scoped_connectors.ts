import type { Migration } from './runner';

const migration: Migration = {
  description: 'Scope connector configurations and sync jobs to individual users',

  async up(client) {
    // These tables were historically created lazily by the repository rather
    // than by a migration, so this migration must also work in a fresh database.
    await client.query(`
      CREATE TABLE IF NOT EXISTS connector_configs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
        type VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        config JSONB NOT NULL DEFAULT '{}'::jsonb,
        watermark TEXT,
        last_sync_at TIMESTAMPTZ,
        last_sync_status VARCHAR(20),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS sync_jobs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
        connector_id UUID NOT NULL,
        started_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        finished_at TIMESTAMPTZ,
        status VARCHAR(20) NOT NULL DEFAULT 'QUEUED',
        records_processed INT NOT NULL DEFAULT 0,
        errors JSONB NOT NULL DEFAULT '[]'::jsonb,
        retry_count INT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`
      ALTER TABLE connector_configs
        ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
    `);
    await client.query(`
      ALTER TABLE sync_jobs
        ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
    `);

    // Preserve existing configurations by assigning them to the first active
    // administrative user in the same tenant. Orphaned rows remain inaccessible
    // until explicitly assigned because private credentials must not be shared.
    await client.query(`
      UPDATE connector_configs AS c
      SET owner_user_id = (
        SELECT u.id
        FROM users AS u
        WHERE u.tenant_id = c.tenant_id
        ORDER BY
          CASE u.role
            WHEN 'SUPER_ADMIN' THEN 0
            WHEN 'ADMIN' THEN 1
            WHEN 'TEAM_LEAD' THEN 2
            ELSE 3
          END,
          CASE WHEN u.status = 'ACTIVE' THEN 0 ELSE 1 END,
          u.created_at NULLS LAST,
          u.id
        LIMIT 1
      )
      WHERE c.owner_user_id IS NULL
        AND EXISTS (SELECT 1 FROM users AS u WHERE u.tenant_id = c.tenant_id);
    `);
    await client.query(`
      UPDATE sync_jobs AS j
      SET owner_user_id = c.owner_user_id
      FROM connector_configs AS c
      WHERE j.connector_id = c.id
        AND j.owner_user_id IS NULL
        AND c.owner_user_id IS NOT NULL;
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_connector_configs_tenant_owner
        ON connector_configs (tenant_id, owner_user_id, created_at DESC);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sync_jobs_tenant_owner
        ON sync_jobs (tenant_id, owner_user_id, started_at DESC);
    `);
  },

  async down(client) {
    await client.query('DROP INDEX IF EXISTS idx_sync_jobs_tenant_owner;');
    await client.query('DROP INDEX IF EXISTS idx_connector_configs_tenant_owner;');
    await client.query('ALTER TABLE sync_jobs DROP COLUMN IF EXISTS owner_user_id;');
    await client.query('ALTER TABLE connector_configs DROP COLUMN IF EXISTS owner_user_id;');
  },
};

export default migration;