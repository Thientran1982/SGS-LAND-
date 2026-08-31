import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const migration: Migration = {
  description: 'P1.4: MCP client — bang agent_mcp_servers de admin dang ky MCP server ngoai cho agent Minh goi tool.',
  async up(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS agent_mcp_servers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        transport TEXT NOT NULL DEFAULT 'http'
          CHECK (transport IN ('http','sse')),
        custom_instructions TEXT,
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        tools_enabled TEXT[] NOT NULL DEFAULT '{}',
        tools_disabled TEXT[] NOT NULL DEFAULT '{}',
        last_status TEXT,
        last_checked_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, name)
      );
      CREATE INDEX IF NOT EXISTS idx_agent_mcp_servers_tenant
        ON agent_mcp_servers(tenant_id, enabled);
    `);
  },
};

export default migration;
