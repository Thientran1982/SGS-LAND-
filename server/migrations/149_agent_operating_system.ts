import type { PoolClient } from 'pg';
import type { Migration } from './runner';

const migration: Migration = {
  description: 'Agent operating system events, human questions, role cards and KPI snapshots',
  async up(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS agent_operating_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        event_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        idempotency_key TEXT NOT NULL,
        actor TEXT NOT NULL CHECK (actor IN ('SYSTEM','STAFF','BUYER','AGENT')),
        payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        status TEXT NOT NULL DEFAULT 'PENDING'
          CHECK (status IN ('PENDING','PROCESSING','DONE','FAILED','DEAD_LETTER')),
        attempts INTEGER NOT NULL DEFAULT 0,
        available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, event_id),
        UNIQUE (tenant_id, idempotency_key)
      );
      CREATE INDEX IF NOT EXISTS idx_agent_events_queue
        ON agent_operating_events (tenant_id, status, available_at, created_at);

      CREATE TABLE IF NOT EXISTS agent_human_questions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        agent_key TEXT NOT NULL,
        run_id UUID,
        lead_id UUID,
        question TEXT NOT NULL,
        context_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        priority INTEGER NOT NULL DEFAULT 50 CHECK (priority BETWEEN 0 AND 100),
        status TEXT NOT NULL DEFAULT 'OPEN'
          CHECK (status IN ('OPEN','ANSWERED','DISMISSED')),
        answer TEXT,
        answered_by UUID,
        answered_at TIMESTAMPTZ,
        memory_approved BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_agent_human_questions_queue
        ON agent_human_questions (tenant_id, status, priority DESC, created_at);

      CREATE TABLE IF NOT EXISTS agent_role_cards (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        agent_key TEXT NOT NULL,
        card_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        updated_by UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, agent_key)
      );

      CREATE TABLE IF NOT EXISTS agent_kpi_snapshots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        agent_key TEXT NOT NULL,
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        metrics_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, agent_key, period_start, period_end)
      );
      CREATE TABLE IF NOT EXISTS agent_shift_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        report_date DATE NOT NULL,
        shift TEXT NOT NULL DEFAULT 'ALL_DAY',
        metrics_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        summary TEXT NOT NULL DEFAULT '',
        reviewed BOOLEAN NOT NULL DEFAULT FALSE,
        reviewed_by UUID,
        reviewed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, report_date, shift)
      );
      ALTER TABLE agent_role_cards
        ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'PENDING'
          CHECK (approval_status IN ('PENDING','APPROVED','REJECTED')),
        ADD COLUMN IF NOT EXISTS approved_by UUID,
        ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS approval_reason TEXT;
      CREATE INDEX IF NOT EXISTS idx_agent_shift_reports_tenant_date
        ON agent_shift_reports (tenant_id, report_date DESC);
    `);
    for (const table of ['agent_operating_events', 'agent_human_questions', 'agent_role_cards', 'agent_kpi_snapshots', 'agent_shift_reports']) {
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
    await client.query('DROP TABLE IF EXISTS agent_shift_reports, agent_kpi_snapshots, agent_role_cards, agent_human_questions, agent_operating_events CASCADE');
  },
};

export default migration;