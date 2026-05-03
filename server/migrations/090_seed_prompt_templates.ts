import { PoolClient } from 'pg';
import {
  DEFAULT_ROUTER_INSTRUCTION,
  DEFAULT_WRITER_PERSONA,
  DEFAULT_INVENTORY_SYSTEM,
  DEFAULT_FINANCE_SYSTEM,
  DEFAULT_LEGAL_SYSTEM,
  DEFAULT_SALES_SYSTEM,
  DEFAULT_MARKETING_SYSTEM,
  DEFAULT_CONTRACT_SYSTEM,
  DEFAULT_LEAD_ANALYST_SYSTEM,
  DEFAULT_VALUATION_SYSTEM,
  DEFAULT_VALUATION_SEARCH_SYSTEM,
  DEFAULT_VALUATION_RENTAL_SYSTEM,
} from '../ai/defaultPrompts';

const PROMPTS: Array<{ name: string; category: string; content: string; agentRole?: string }> = [
  { name: 'ROUTER_SYSTEM',            category: 'router',     content: DEFAULT_ROUTER_INSTRUCTION,        agentRole: 'router' },
  { name: 'WRITER_PERSONA',           category: 'writer',     content: DEFAULT_WRITER_PERSONA('Trợ lý ảo BĐS'), agentRole: 'writer' },
  { name: 'INVENTORY_SYSTEM',         category: 'specialist', content: DEFAULT_INVENTORY_SYSTEM,          agentRole: 'inventory_specialist' },
  { name: 'FINANCE_SYSTEM',           category: 'specialist', content: DEFAULT_FINANCE_SYSTEM,            agentRole: 'finance_specialist' },
  { name: 'LEGAL_SYSTEM',             category: 'specialist', content: DEFAULT_LEGAL_SYSTEM,              agentRole: 'legal_specialist' },
  { name: 'SALES_SYSTEM',             category: 'specialist', content: DEFAULT_SALES_SYSTEM,              agentRole: 'sales_specialist' },
  { name: 'MARKETING_SYSTEM',         category: 'specialist', content: DEFAULT_MARKETING_SYSTEM,          agentRole: 'marketing_specialist' },
  { name: 'CONTRACT_SYSTEM',          category: 'specialist', content: DEFAULT_CONTRACT_SYSTEM,           agentRole: 'contract_specialist' },
  { name: 'LEAD_ANALYST_SYSTEM',      category: 'specialist', content: DEFAULT_LEAD_ANALYST_SYSTEM,       agentRole: 'lead_analyst' },
  { name: 'VALUATION_SYSTEM',         category: 'valuation',  content: DEFAULT_VALUATION_SYSTEM,          agentRole: 'valuation_specialist' },
  { name: 'VALUATION_SEARCH_SYSTEM',  category: 'valuation',  content: DEFAULT_VALUATION_SEARCH_SYSTEM },
  { name: 'VALUATION_RENTAL_SYSTEM',  category: 'valuation',  content: DEFAULT_VALUATION_RENTAL_SYSTEM },
];

const up = async (client: PoolClient): Promise<void> => {
  // Reconcile prompt_templates schema — migrations 003 and 009 created this
  // table with divergent column sets. Ensure all columns this seed needs exist.
  await client.query(`
    ALTER TABLE prompt_templates ADD COLUMN IF NOT EXISTS content        TEXT NOT NULL DEFAULT '';
    ALTER TABLE prompt_templates ADD COLUMN IF NOT EXISTS description    TEXT;
    ALTER TABLE prompt_templates ADD COLUMN IF NOT EXISTS category       TEXT;
    ALTER TABLE prompt_templates ADD COLUMN IF NOT EXISTS active_version INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE prompt_templates ADD COLUMN IF NOT EXISTS versions       JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE prompt_templates ADD COLUMN IF NOT EXISTS variables      JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE prompt_templates ADD COLUMN IF NOT EXISTS created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW();
    ALTER TABLE prompt_templates ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW();
  `);
  // Deduplicate (tenant_id, name) before creating the unique index — legacy
  // create API didn't enforce uniqueness, so older rows may collide.
  await client.query(`
    WITH ranked AS (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY tenant_id, name
               ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
             ) AS rn
        FROM prompt_templates
    )
    DELETE FROM prompt_templates p
     USING ranked r
     WHERE p.id = r.id AND r.rn > 1;
  `);
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_prompt_templates_tenant_name
      ON prompt_templates (tenant_id, name);
  `);

  for (const p of PROMPTS) {
    const versions = JSON.stringify([
      { version: 1, content: p.content, status: 'ACTIVE', createdAt: new Date().toISOString(), source: 'migration_090' },
    ]);
    await client.query(
      `
      INSERT INTO prompt_templates (
        tenant_id, name, content, description, category,
        active_version, versions, variables, created_at, updated_at
      )
      SELECT
        t.id,
        $1, $2, $3, $4,
        1, $5::jsonb, '[]'::jsonb,
        NOW(), NOW()
      FROM tenants t
      ON CONFLICT (tenant_id, name) DO NOTHING;
      `,
      [p.name, p.content, `Default prompt for ${p.name} (seeded by migration 090)`, p.category, versions]
    );

    if (p.agentRole) {
      await client.query(
        `
        UPDATE ai_agents
           SET system_instruction = $1,
               updated_at = NOW()
         WHERE role = $2
           AND (system_instruction IS NULL OR TRIM(system_instruction) = '');
        `,
        [p.content, p.agentRole]
      );
    }
  }
};

const down = async (client: PoolClient): Promise<void> => {
  await client.query(
    `DELETE FROM prompt_templates
      WHERE description LIKE '%seeded by migration 090%';`
  );
  await client.query(`DROP INDEX IF EXISTS uniq_prompt_templates_tenant_name;`);
};

export default {
  up,
  down,
  description: 'Seed 12 default prompt_templates per tenant + backfill ai_agents.system_instruction',
};
