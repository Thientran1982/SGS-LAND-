import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const migration: Migration = {
  description: 'Tenant-scoped long-term agent memory, behavior signals and matcher weight versions',
  async up(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS agent_store (
        id TEXT PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        namespace TEXT NOT NULL,
        key TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('fact','episodic','procedural')),
        value TEXT NOT NULL,
        importance NUMERIC(4,3) NOT NULL DEFAULT 0.5 CHECK (importance >= 0 AND importance <= 1),
        hits INTEGER NOT NULL DEFAULT 0 CHECK (hits >= 0),
        expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, namespace, key)
      );
      CREATE INDEX IF NOT EXISTS idx_agent_store_namespace ON agent_store (tenant_id, namespace, importance DESC, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_agent_store_expiry ON agent_store (tenant_id, expires_at) WHERE expires_at IS NOT NULL;

      CREATE TABLE IF NOT EXISTS agent_signals (
        id TEXT PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        signal_type TEXT NOT NULL,
        actor_id TEXT,
        subject_type TEXT NOT NULL,
        subject_id TEXT NOT NULL,
        payload TEXT NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_agent_signals_lookup ON agent_signals (tenant_id, signal_type, created_at DESC);

      CREATE TABLE IF NOT EXISTS agent_weight_versions (
        id TEXT PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        weights TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','shadow','live')),
        metrics TEXT NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_by TEXT,
        note TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_agent_weights_status ON agent_weight_versions (tenant_id, status, created_at DESC);
    `);
    for (const table of ['agent_store', 'agent_signals', 'agent_weight_versions']) {
      await client.query(`
        ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;
        ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS tenant_isolation_v2 ON ${table};
        CREATE POLICY tenant_isolation_v2 ON ${table} AS PERMISSIVE FOR ALL TO PUBLIC
          USING (NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
            AND tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), ''))
          WITH CHECK (NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
            AND tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), ''));
      `);
    }
  },
  async down(client: PoolClient): Promise<void> {
    await client.query('DROP TABLE IF EXISTS agent_weight_versions, agent_signals, agent_store CASCADE');
  },
};

export default migration;