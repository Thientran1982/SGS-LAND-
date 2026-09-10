import express from 'express';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool, type PoolClient } from 'pg';
import migration177 from '../migrations/177_p2_skills_rooms';
import migration195 from '../migrations/195_agent_skill_runtime_bindings';
import migration196 from '../migrations/196_agent_skill_binding_rls_bypass';

const integrationUrl = process.env.INTEGRITY_PG_URL;
const describePostgres = describe.skipIf(!integrationUrl);
const suiteTitle = integrationUrl
  ? 'agent skill activation reaches the tenant prompt runtime'
  : 'agent skill activation reaches the tenant prompt runtime [skipped: INTEGRITY_PG_URL is not set]';
const baseConnectionString = integrationUrl?.replace(
  /([?&])(?:sslmode|channel_binding)=[^&]*/g,
  '$1',
).replace(/[?&]$/, '');
const useSsl = process.env.INTEGRITY_PG_SSL !== 'false';

const tenantA = '11111111-1111-4111-8111-111111111111';
const tenantB = '22222222-2222-4222-8222-222222222222';
const managerA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const agentA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01';
const agentB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const skillA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02';
const skillB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

let setupPool: Pool;
let setupClient: PoolClient | undefined;
let appPool: typeof import('../db').pool;
let agentRepository: typeof import('../repositories/agentRepository').agentRepository;
let getPromptTemplate: typeof import('../ai').getPromptTemplate;
let clearPromptCache: typeof import('../ai').clearPromptCache;
let agentSkillsRouter: typeof import('../routes/agentSkillsRoutes').agentSkillsRouter;
let schema: string;
let schemaCreated = false;
let server: Server | undefined;
let origin: string;

function connectionWithSchema(): string {
  const separator = baseConnectionString!.includes('?') ? '&' : '?';
  const options = encodeURIComponent(`-c search_path="${schema}",public`);
  return `${baseConnectionString}${separator}options=${options}`;
}

async function setupQuery(text: string, values?: unknown[]) {
  if (!setupClient) throw new Error('PostgreSQL fixture client is not connected');
  return setupClient.query(text, values);
}

describePostgres(suiteTitle, () => {
  beforeAll(async () => {
    schema = `agent_skill_runtime_${process.pid}_${Date.now()}`;
    setupPool = new Pool({
      connectionString: baseConnectionString,
      max: 2,
      connectionTimeoutMillis: 10_000,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
    });
    setupClient = await setupPool.connect();
    await setupClient.query(`CREATE SCHEMA "${schema}"`);
    schemaCreated = true;
    await setupClient.query(`SET search_path TO "${schema}", public`);
    await setupQuery('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    await setupQuery('CREATE TABLE tenants (id UUID PRIMARY KEY)');
    await setupQuery('INSERT INTO tenants (id) VALUES ($1), ($2)', [tenantA, tenantB]);
    await setupQuery(`
      CREATE TABLE ai_agents (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        display_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        system_instruction TEXT NOT NULL DEFAULT '',
        skills JSONB NOT NULL DEFAULT '[]'::jsonb,
        model TEXT,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        knowledge_filter JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, name)
      );

      CREATE TABLE agent_prompt_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        agent_id UUID NOT NULL,
        version TEXT NOT NULL,
        system_instruction TEXT NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT FALSE,
        change_note TEXT,
        created_by TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await migration177.up(setupClient);
    await migration195.up(setupClient);
    await migration196.up(setupClient);
    await setupQuery(`
      ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;
      ALTER TABLE ai_agents FORCE ROW LEVEL SECURITY;
      CREATE POLICY ai_agents_tenant_isolation ON ai_agents
        AS PERMISSIVE FOR ALL TO PUBLIC
        USING (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), '')
        )
        WITH CHECK (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), '')
        );
    `);
    await setupQuery(`
      INSERT INTO ai_agents (id, tenant_id, name, display_name, role)
      VALUES
        ($1, $3, 'MARKETING_AGENT', 'Marketing A', 'marketing'),
        ($2, $4, 'MARKETING_AGENT', 'Marketing B', 'marketing');

      INSERT INTO agent_skills
        (id, tenant_id, skill_key, title, category, prompt_template, version, visibility, published)
      VALUES
        ($5, $3, 'tenant-a-skill', 'Tenant A skill', 'marketing',
         'Only use the shared campaign evidence.', 4, 'PUBLIC', TRUE),
        ($6, $4, 'tenant-b-skill', 'Tenant B skill', 'marketing',
         'Only use tenant B campaign evidence.', 7, 'TENANT', TRUE);

      INSERT INTO agent_skill_bindings
        (tenant_id, agent_id, skill_id, status, activated_by)
      VALUES ($4, $2, $5, 'ACTIVE', $3);

      INSERT INTO agent_prompt_versions
        (tenant_id, agent_id, version, system_instruction, is_active)
      VALUES
        ($3, $1, 'a-v1', 'Base prompt for tenant A.', TRUE),
        ($4, $2, 'b-v1', 'Base prompt for tenant B.', TRUE);
    `, [agentA, agentB, tenantA, tenantB, skillA, skillB]);
    await setupQuery(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sgs_app') THEN
          CREATE ROLE sgs_app NOLOGIN NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT;
        END IF;
      END $$;
    `);
    await setupQuery('GRANT sgs_app TO CURRENT_USER');
    await setupQuery(`GRANT USAGE ON SCHEMA "${schema}" TO sgs_app`);
    await setupQuery(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "${schema}" TO sgs_app`);
    await setupQuery(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "${schema}" TO sgs_app`);

    process.env.AIVEN_DATABASE_URL = connectionWithSchema();
    process.env.APP_DB_ROLE = 'sgs_app';
    ({ pool: appPool } = await import('../db'));
    ({ agentRepository } = await import('../repositories/agentRepository'));
    ({ clearPromptCache, getPromptTemplate } = await import('../ai'));
    ({ agentSkillsRouter } = await import('../routes/agentSkillsRoutes'));

    const app = express();
    app.use(express.json());
    app.use('/api/admin/agent-skills', (req, _res, next) => {
      (req as any).user = {
        id: managerA,
        tenantId: tenantA,
        role: 'MARKETING',
      };
      next();
    }, agentSkillsRouter);
    server = await new Promise<Server>(resolve => {
      const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not expose a port');
    origin = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    try {
      clearPromptCache?.(tenantA);
      clearPromptCache?.(tenantB);
      if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
      await appPool?.end();
      setupClient?.release();
      setupClient = undefined;
      if (schemaCreated) await setupPool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    } finally {
      await setupPool?.end();
    }
  });

  it('activates through the manager path, loads only the active binding, and scopes prompts by tenant', async () => {
    const response = await fetch(`${origin}/api/admin/agent-skills/${skillA}/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_id: agentA }),
    });

    expect(response.status).toBe(200);
    expect((await response.json()).binding).toMatchObject({
      tenant_id: tenantA,
      agent_id: agentA,
      skill_id: skillA,
      status: 'ACTIVE',
    });

    const activeA = await agentRepository.getActiveCatalogSkills(tenantA, agentA);
    expect(activeA).toHaveLength(1);
    expect(activeA[0]).toMatchObject({
      skillId: skillA,
      skillKey: 'tenant-a-skill',
      promptTemplate: 'Only use the shared campaign evidence.',
    });
    const activeB = await agentRepository.getActiveCatalogSkills(tenantB, agentB);
    expect(activeB).toHaveLength(1);
    expect(activeB[0]).toMatchObject({
      skillId: skillA,
      sourceTenantId: tenantA,
      promptTemplate: 'Only use the shared campaign evidence.',
    });

    const promptA = await getPromptTemplate(
      tenantA,
      'MARKETING_SYSTEM',
      'fallback A',
    );
    expect(promptA).toContain('Base prompt for tenant A.');
    expect(promptA).toContain('Tenant A skill (tenant-a-skill, v4)');
    expect(promptA).toContain('Only use the shared campaign evidence.');
    expect(promptA).not.toContain('Tenant B skill');
    expect(promptA).not.toContain('Only use tenant B campaign evidence.');
    const promptBBeforeUpdate = await getPromptTemplate(
      tenantB,
      'MARKETING_SYSTEM',
      'fallback B',
    );
    expect(promptBBeforeUpdate).toContain('Only use the shared campaign evidence.');
    expect(promptBBeforeUpdate).not.toContain('Only use tenant B campaign evidence.');

    const updateResponse = await fetch(`${origin}/api/admin/agent-skills/${skillA}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt_template: 'Use the updated shared campaign evidence.',
        published: true,
      }),
    });
    expect(updateResponse.status).toBe(200);
    expect((await updateResponse.json()).skill).toMatchObject({
      version: 5,
      published: true,
    });

    const updatedPromptA = await getPromptTemplate(
      tenantA,
      'MARKETING_SYSTEM',
      'fallback A',
    );
    expect(updatedPromptA).toContain('Tenant A skill (tenant-a-skill, v5)');
    expect(updatedPromptA).toContain('Use the updated shared campaign evidence.');
    expect(updatedPromptA).not.toContain('Only use the shared campaign evidence.');

    const updatedPromptB = await getPromptTemplate(
      tenantB,
      'MARKETING_SYSTEM',
      'fallback B',
    );
    expect(updatedPromptB).toContain('Base prompt for tenant B.');
    expect(updatedPromptB).toContain('Use the updated shared campaign evidence.');
    expect(updatedPromptB).not.toContain('Only use the shared campaign evidence.');
    expect(updatedPromptB).not.toContain('Only use tenant B campaign evidence.');

    const unpublishResponse = await fetch(`${origin}/api/admin/agent-skills/${skillA}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        published: false,
        visibility: 'PRIVATE',
      }),
    });
    expect(unpublishResponse.status).toBe(200);
    expect((await unpublishResponse.json()).skill).toMatchObject({
      published: false,
      visibility: 'PRIVATE',
    });

    const ownerPromptAfterUnpublish = await getPromptTemplate(
      tenantA,
      'MARKETING_SYSTEM',
      'fallback A',
    );
    expect(ownerPromptAfterUnpublish).toContain('Use the updated shared campaign evidence.');

    const tenantPromptAfterUnpublish = await getPromptTemplate(
      tenantB,
      'MARKETING_SYSTEM',
      'fallback B',
    );
    expect(tenantPromptAfterUnpublish).toContain('Base prompt for tenant B.');
    expect(tenantPromptAfterUnpublish).not.toContain('Use the updated shared campaign evidence.');
    expect(tenantPromptAfterUnpublish).not.toContain('Only use tenant B campaign evidence.');
  });
});
