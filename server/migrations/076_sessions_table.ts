import { PoolClient } from 'pg';
import { Migration } from './runner';

const migration: Migration = {
  description: 'Create sessions table with performance indexes for concurrent login support',
  async up(client: PoolClient) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        user_id      UUID NOT NULL,
        ip_address   VARCHAR(45),
        user_agent   TEXT,
        created_at   TIMESTAMPTZ DEFAULT NOW(),
        last_seen_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sessions_user
        ON sessions(tenant_id, user_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sessions_created
        ON sessions(created_at)
    `);
  },
  async down(client: PoolClient) {
    await client.query(`DROP TABLE IF EXISTS sessions`);
  },
};

export default migration;
