import { PoolClient } from 'pg';

const up = async (client: PoolClient): Promise<void> => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS prompt_promote_log (
      id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE
                        DEFAULT '00000000-0000-0000-0000-000000000001',
      template_id     UUID NOT NULL REFERENCES prompt_templates(id) ON DELETE CASCADE,
      template_name   VARCHAR(255) NOT NULL,
      version         INTEGER NOT NULL,
      previous_version INTEGER,
      promoted_by_user_id UUID,
      promoted_by_name TEXT,
      promoted_by_email TEXT,
      created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_prompt_promote_log_tpl
      ON prompt_promote_log (template_id, created_at DESC);
  `);
  await client.query(`ALTER TABLE prompt_promote_log ENABLE ROW LEVEL SECURITY;`);
  await client.query(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'prompt_promote_log' AND policyname = 'tenant_isolation_policy'
      ) THEN
        CREATE POLICY tenant_isolation_policy ON prompt_promote_log FOR ALL
          USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
      END IF;
    END $$;
  `);
};

const down = async (client: PoolClient): Promise<void> => {
  await client.query(`DROP TABLE IF EXISTS prompt_promote_log;`);
};

export default {
  up,
  down,
  description: 'Add prompt_promote_log table to track who promoted which prompt version when',
};
