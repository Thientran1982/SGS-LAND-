import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const STRICT_TENANT_EXPR = `(
  NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
  AND tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), '')
)`;

async function strictTenantPolicy(client: PoolClient, table: string): Promise<void> {
  await client.query(`DROP POLICY IF EXISTS tenant_isolation_v2 ON ${table}`);
  await client.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
  await client.query(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
  await client.query(`
    CREATE POLICY tenant_isolation_v2 ON ${table}
      AS PERMISSIVE FOR ALL TO PUBLIC
      USING (${STRICT_TENANT_EXPR})
      WITH CHECK (${STRICT_TENANT_EXPR})
  `);
}

const migration: Migration = {
  description: 'Fence agent execution leases and add durable at-most-once outbound delivery records',

  async up(client: PoolClient): Promise<void> {
    await client.query(`
      ALTER TABLE agent_executions
      ADD COLUMN IF NOT EXISTS claim_token UUID NOT NULL DEFAULT gen_random_uuid()
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS agent_outbound_deliveries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        execution_id UUID NOT NULL REFERENCES agent_executions(id) ON DELETE CASCADE,
        interaction_id UUID,
        lead_id UUID NOT NULL,
        channel TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING'
          CHECK (status IN ('PENDING','SENDING','SENT','FAILED','UNKNOWN')),
        claim_token UUID,
        attempt INTEGER NOT NULL DEFAULT 0,
        content_hash TEXT NOT NULL,
        provider_message_id TEXT,
        error_text TEXT,
        claimed_at TIMESTAMPTZ,
        sent_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, execution_id)
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_agent_outbound_delivery_status
      ON agent_outbound_deliveries (tenant_id, status, created_at)
    `);

    // Unlike older app tables, orchestration state deliberately has no
    // app.bypass_rls GUC branch: runtime access always requires exact tenant context.
    await strictTenantPolicy(client, 'agent_executions');
    await strictTenantPolicy(client, 'agent_execution_steps');
    await strictTenantPolicy(client, 'agent_outbound_deliveries');
    await client.query(`
      GRANT SELECT, INSERT, UPDATE, DELETE
      ON agent_outbound_deliveries TO sgs_app
    `).catch(() => {});
  },

  async down(client: PoolClient): Promise<void> {
    await client.query(`DROP TABLE IF EXISTS agent_outbound_deliveries`);
    await client.query(`ALTER TABLE agent_executions DROP COLUMN IF EXISTS claim_token`);
  },
};

export default migration;