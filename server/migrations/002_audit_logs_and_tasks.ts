/**
 * Migration 002 — Audit logs, tasks, and supporting tables
 */

import type { Migration } from './runner';

const migration: Migration = {
  description: 'Add audit_logs, tasks, articles, campaign_costs, sequences, and support tables',

  async up(client) {
    // --- Audit Logs ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
        actor_id    UUID REFERENCES users(id) ON DELETE SET NULL,
        action      VARCHAR(50) NOT NULL,
        entity_type VARCHAR(100),
        entity_id   UUID,
        details     TEXT,
        ip_address  VARCHAR(100),
        timestamp   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // --- Tasks ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
        lead_id     UUID REFERENCES leads(id) ON DELETE CASCADE,
        assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
        title       VARCHAR(500),
        description TEXT,
        status      VARCHAR(50) DEFAULT 'PENDING',
        due_date    TIMESTAMP WITH TIME ZONE,
        priority    VARCHAR(20) DEFAULT 'MEDIUM',
        created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // --- Articles ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS articles (
        id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id    UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
        title        VARCHAR(500) NOT NULL,
        slug         VARCHAR(500),
        content      TEXT,
        excerpt      TEXT,
        category     VARCHAR(100),
        status       VARCHAR(50) DEFAULT 'DRAFT',
        author_id    UUID REFERENCES users(id) ON DELETE SET NULL,
        published_at TIMESTAMP WITH TIME ZONE,
        metadata     JSONB DEFAULT '{}'::jsonb,
        created_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // --- Sequences ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS sequences (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
        name        VARCHAR(255) NOT NULL,
        description TEXT,
        status      VARCHAR(50) DEFAULT 'ACTIVE',
        trigger     JSONB DEFAULT '{}'::jsonb,
        steps       JSONB DEFAULT '[]'::jsonb,
        created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // --- Campaign costs (for BI analytics attribution) ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS campaign_costs (
        id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
        campaign_name VARCHAR(255),
        source        VARCHAR(100),
        cost          NUMERIC DEFAULT 0,
        period        VARCHAR(7),  -- YYYY-MM
        created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // --- Password reset tokens ---
    await client.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
        token      VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        used       BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id, timestamp DESC)',
      'CREATE INDEX IF NOT EXISTS idx_tasks_tenant_assigned ON tasks(tenant_id, assigned_to)',
      'CREATE INDEX IF NOT EXISTS idx_articles_tenant_status ON articles(tenant_id, status)',
      'CREATE INDEX IF NOT EXISTS idx_prt_token ON password_reset_tokens(token)',
      'CREATE INDEX IF NOT EXISTS idx_prt_user ON password_reset_tokens(user_id)',
    ];
    for (const idx of indexes) {
      await client.query(idx);
    }

    // RLS on new tables
    const tables = ['audit_logs', 'tasks', 'articles', 'sequences', 'campaign_costs'];
    for (const t of tables) {
      await client.query(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY;`);
      await client.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_policies WHERE tablename = '${t}' AND policyname = '${t}_tenant_isolation'
          ) THEN
            CREATE POLICY ${t}_tenant_isolation ON ${t}
              USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
          END IF;
        END $$;
      `);
    }
  },
};

export default migration;
