import { PoolClient } from 'pg';

const migration = {
  description: 'Create error_logs table for frontend + backend error monitoring',

  async up(client: PoolClient) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS error_logs (
        id              SERIAL PRIMARY KEY,
        tenant_id       VARCHAR(36) NOT NULL,
        type            VARCHAR(30) NOT NULL CHECK (type IN ('frontend', 'backend', 'unhandled_promise', 'chunk_load')),
        severity        VARCHAR(10) NOT NULL CHECK (severity IN ('error', 'warning', 'critical')),
        message         TEXT NOT NULL,
        stack           TEXT,
        component       VARCHAR(500),
        path            VARCHAR(1000),
        user_id         VARCHAR(36),
        user_agent      TEXT,
        metadata        JSONB DEFAULT '{}',
        resolved        BOOLEAN DEFAULT FALSE,
        resolved_at     TIMESTAMPTZ,
        resolved_by     VARCHAR(36),
        created_at      TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_error_logs_tenant_created
        ON error_logs (tenant_id, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_error_logs_type
        ON error_logs (tenant_id, type, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_error_logs_resolved
        ON error_logs (tenant_id, resolved, created_at DESC);
    `);
  },

  async down(client: PoolClient) {
    await client.query(`DROP TABLE IF EXISTS error_logs;`);
  },
};

export default migration;
