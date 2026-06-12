import { PoolClient } from 'pg';

export async function up(client: PoolClient): Promise<void> {
  // Create lead_journey_memory table for global lead journey tracking
  await client.query(`
    CREATE TABLE IF NOT EXISTS lead_journey_memory (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id VARCHAR(255) NOT NULL,
      lead_id VARCHAR(255) NOT NULL,
      agent_id VARCHAR(100) NOT NULL,
      session_id VARCHAR(255),
      event_type VARCHAR(100) NOT NULL,
      summary TEXT NOT NULL,
      signals JSONB NOT NULL DEFAULT '{}',
      metadata JSONB NOT NULL DEFAULT '{}',
      source VARCHAR(50) NOT NULL DEFAULT 'chat',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Indexes for LEAD_ANALYST queries
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_lead_journey_tenant_lead
      ON lead_journey_memory (tenant_id, lead_id, created_at DESC);
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_lead_journey_session
      ON lead_journey_memory (session_id)
      WHERE session_id IS NOT NULL;
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_lead_journey_event
      ON lead_journey_memory (tenant_id, lead_id, event_type);
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_lead_journey_source
      ON lead_journey_memory (tenant_id, source, created_at DESC);
  `);
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`DROP TABLE IF EXISTS lead_journey_memory;`);
}

export default {
  up,
  down,
  description: 'Add lead_journey_memory table for global lead journey tracking across all agents and sessions'
};
