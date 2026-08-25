import type { PoolClient } from 'pg';
import type { Migration } from './runner';
import { MARKETING_GROWTH_CAPABILITIES } from '../ai/marketingGrowthAgents';
import { getMarketingGrowthPrompt } from '../ai/marketingGrowthPrompts';

const migration: Migration = {
  description: 'Tenant-scoped Company Brain documents and Marketing/Growth capability metadata',
  async up(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS company_brain_documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        document_type TEXT NOT NULL CHECK (document_type IN (
          'brand_voice','developer','project','legal_disclaimer',
          'broker','faq','competitor_note'
        )),
        document_key TEXT NOT NULL,
        content_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        source TEXT NOT NULL DEFAULT 'internal',
        source_url TEXT,
        verification_status TEXT NOT NULL DEFAULT 'unverified'
          CHECK (verification_status IN ('verified','unverified','needs_review','stale')),
        verified_at TIMESTAMPTZ,
        updated_by UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, document_type, document_key)
      );
      CREATE INDEX IF NOT EXISTS idx_company_brain_documents_lookup
        ON company_brain_documents (tenant_id, document_type, verification_status, updated_at DESC);

      CREATE TABLE IF NOT EXISTS marketing_growth_capabilities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        capability_key TEXT NOT NULL,
        role TEXT NOT NULL,
        cadence TEXT NOT NULL,
        rollout TEXT NOT NULL DEFAULT 'SHADOW'
          CHECK (rollout IN ('SHADOW','CANARY_25','CANARY_50','LIVE')),
        active BOOLEAN NOT NULL DEFAULT TRUE,
        prompt_version TEXT NOT NULL DEFAULT 'v1',
        metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, capability_key)
      );
      CREATE INDEX IF NOT EXISTS idx_marketing_growth_capabilities_active
        ON marketing_growth_capabilities (tenant_id, active, capability_key);
    `);

    for (const table of ['company_brain_documents', 'marketing_growth_capabilities']) {
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

    const capabilities = [
      ['CONTENT_RADAR', 'content_radar', 'daily'],
      ['REVENUE_SIGNAL', 'revenue_signal', 'daily'],
      ['COMPETITIVE_INTELLIGENCE', 'competitive_intelligence', 'weekly'],
      ['PROJECT_PAGE', 'project_page', 'on_demand'],
      ['PRICING_INVENTORY_SYNC', 'pricing_inventory_sync', 'daily'],
      ['REPURPOSING', 'repurposing', 'on_demand'],
      ['LEAD_QUALIFICATION', 'lead_qualification', 'realtime'],
      ['OUTREACH', 'outreach', 'realtime'],
      ['BROKER_ENABLEMENT', 'broker_enablement', 'on_demand'],
      ['VALUATION_QA', 'valuation_qa', 'weekly'],
      ['MARKETING_ANALYST', 'marketing_analyst', 'weekly'],
      ['COMPLIANCE_GUARDIAN', 'compliance_guardian', 'per_publish'],
      ['SEO_AEO_AUDITOR', 'seo_aeo_auditor', 'per_publish'],
    ];
    for (const [capabilityKey, role, cadence] of capabilities) {
      await client.query(
        `INSERT INTO marketing_growth_capabilities
          (tenant_id, capability_key, role, cadence, metadata_json)
         SELECT id, $1, $2, $3, jsonb_build_object('source', 'marketing-growth-architecture')
           FROM tenants
         ON CONFLICT (tenant_id, capability_key) DO UPDATE
           SET role=EXCLUDED.role, cadence=EXCLUDED.cadence, updated_at=NOW()`,
        [capabilityKey, role, cadence],
      );
    }

    for (const capability of MARKETING_GROWTH_CAPABILITIES) {
      const systemInstruction = getMarketingGrowthPrompt(capability.capabilityKey);
      await client.query(
        `INSERT INTO ai_agents
          (tenant_id, name, display_name, role, description, system_instruction,
           skills, model, active, metadata, knowledge_filter)
         SELECT t.id, $1, $2, $3, $4, $5, '[]'::jsonb, 'gemini-2.5-flash', TRUE,
                jsonb_build_object('seeded_by', 'migration_171', 'capability_key', $6::text),
                jsonb_build_object('domains', $7::jsonb)
           FROM tenants t
         ON CONFLICT (tenant_id, role) DO UPDATE SET
           display_name=EXCLUDED.display_name,
           description=EXCLUDED.description,
           knowledge_filter=EXCLUDED.knowledge_filter,
           active=TRUE, updated_at=NOW()`,
        [
          capability.capabilityKey,
          `${capability.displayName} — Marketing/Growth`,
          capability.role,
          capability.ownerIntent,
          systemInstruction,
          capability.capabilityKey,
          JSON.stringify(capability.ragDomains),
        ],
      );
      await client.query(
        `INSERT INTO prompt_templates
          (tenant_id, name, content, description, category, active_version, versions, variables)
         SELECT t.id, $1, $2, $3, 'marketing_growth', 1, '[]'::jsonb, '[]'::jsonb
           FROM tenants t
         ON CONFLICT (tenant_id, name) DO UPDATE
           SET description=EXCLUDED.description, updated_at=NOW()
         WHERE prompt_templates.content IS NULL OR trim(prompt_templates.content) = ''`,
        [
          capability.promptKey,
          systemInstruction,
          `Prompt chuẩn hóa cho ${capability.displayName}.`,
        ],
      );
    }
  },
  async down(client: PoolClient): Promise<void> {
    await client.query('DROP TABLE IF EXISTS marketing_growth_capabilities, company_brain_documents CASCADE');
  },
};

export default migration;