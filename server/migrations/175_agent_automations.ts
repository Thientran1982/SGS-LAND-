import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const migration: Migration = {
  description: 'P0.2: Webhook automations — bang agent_automations cho phep ben ngoai (Zalo OA, form, sàn BĐS) danh thuc agent qua webhook co credential rieng.',
  async up(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS agent_automations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        slug TEXT NOT NULL,
        description TEXT,
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        webhook_secret TEXT NOT NULL,
        agent_name TEXT NOT NULL,
        trigger_kind TEXT NOT NULL DEFAULT 'webhook'
          CHECK (trigger_kind IN ('webhook','schedule','manual')),
        schedule_cron TEXT,
        payload_template TEXT,
        last_triggered_at TIMESTAMPTZ,
        trigger_count INT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, slug)
      );

      CREATE TABLE IF NOT EXISTS agent_automation_runs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        automation_id UUID NOT NULL REFERENCES agent_automations(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'running'
          CHECK (status IN ('running','success','error','skipped')),
        payload JSONB,
        result JSONB,
        error_text TEXT,
        duration_ms INT,
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        finished_at TIMESTAMPTZ
      );

      CREATE INDEX IF NOT EXISTS idx_agent_automations_tenant
        ON agent_automations(tenant_id, enabled);
      CREATE INDEX IF NOT EXISTS idx_agent_automation_runs_automation
        ON agent_automation_runs(automation_id, started_at DESC);
    `);
  },
};

export default migration;
