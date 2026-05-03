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

/**
 * Migration 092 — Seed v2 prompts (7-section framework) + per-agent knowledge_filter.
 *
 * Behaviour:
 * 1. Append a NEW version (v2) to prompt_templates.versions[] for each of 12 prompts
 *    if not already present. Does NOT auto-promote — admin must promote via UI.
 * 2. Set ai_agents.knowledge_filter per role to scope RAG by domain.
 *
 * Idempotent: safe to re-run.
 */

const PROMPT_VERSION_TAG = 'v2.0-2026-05';

const PROMPTS_V2: Array<{ name: string; content: string }> = [
  { name: 'ROUTER_SYSTEM',           content: DEFAULT_ROUTER_INSTRUCTION },
  { name: 'WRITER_PERSONA',          content: DEFAULT_WRITER_PERSONA('Trợ lý ảo BĐS') },
  { name: 'INVENTORY_SYSTEM',        content: DEFAULT_INVENTORY_SYSTEM },
  { name: 'FINANCE_SYSTEM',          content: DEFAULT_FINANCE_SYSTEM },
  { name: 'LEGAL_SYSTEM',            content: DEFAULT_LEGAL_SYSTEM },
  { name: 'SALES_SYSTEM',            content: DEFAULT_SALES_SYSTEM },
  { name: 'MARKETING_SYSTEM',        content: DEFAULT_MARKETING_SYSTEM },
  { name: 'CONTRACT_SYSTEM',         content: DEFAULT_CONTRACT_SYSTEM },
  { name: 'LEAD_ANALYST_SYSTEM',     content: DEFAULT_LEAD_ANALYST_SYSTEM },
  { name: 'VALUATION_SYSTEM',        content: DEFAULT_VALUATION_SYSTEM },
  { name: 'VALUATION_SEARCH_SYSTEM', content: DEFAULT_VALUATION_SEARCH_SYSTEM },
  { name: 'VALUATION_RENTAL_SYSTEM', content: DEFAULT_VALUATION_RENTAL_SYSTEM },
];

// Per-agent RAG knowledge domain mapping (matches seed/knowledge/{domain}/ folders).
const AGENT_KNOWLEDGE_FILTER: Record<string, { domains: string[] }> = {
  legal_specialist:     { domains: ['legal'] },
  contract_specialist:  { domains: ['legal'] },
  finance_specialist:   { domains: ['finance', 'market'] },
  valuation_specialist: { domains: ['market'] },
  inventory_specialist: { domains: ['product', 'market'] },
  marketing_specialist: { domains: ['market', 'product'] },
  sales_specialist:     { domains: ['product', 'market'] },
  lead_analyst:         { domains: ['product'] },
  router:               { domains: [] },
  writer:               { domains: ['legal', 'finance', 'market', 'product'] },
};

const up = async (client: PoolClient): Promise<void> => {
  // Defensive — column added in 091, but ensure exists in case order differs.
  await client.query(`
    ALTER TABLE ai_agents
      ADD COLUMN IF NOT EXISTS knowledge_filter jsonb NOT NULL DEFAULT '{}'::jsonb;
  `);

  // 1) Append v2 to versions[] for each (tenant, name) — idempotent via JSONB check.
  for (const p of PROMPTS_V2) {
    await client.query(
      `
      UPDATE prompt_templates
         SET versions = COALESCE(versions, '[]'::jsonb) || $1::jsonb,
             updated_at = NOW()
       WHERE name = $2
         AND NOT EXISTS (
           SELECT 1
             FROM jsonb_array_elements(COALESCE(versions, '[]'::jsonb)) AS v
            WHERE v->>'tag' = $3
         );
      `,
      [
        JSON.stringify([{
          version: 2,
          tag: PROMPT_VERSION_TAG,
          content: p.content,
          status: 'DRAFT',
          createdAt: new Date().toISOString(),
          source: 'migration_092',
          notes: 'v2: 7-section framework (ROLE/GOAL/CONTEXT/TOOLS/CONSTRAINTS/OUTPUT/EXAMPLES) + citation enforcement. Promote via AI Governance UI.',
        }]),
        p.name,
        PROMPT_VERSION_TAG,
      ]
    );
  }

  // 2) Patch ai_agents.knowledge_filter per role.
  for (const [role, filter] of Object.entries(AGENT_KNOWLEDGE_FILTER)) {
    await client.query(
      `UPDATE ai_agents
          SET knowledge_filter = $1::jsonb,
              updated_at = NOW()
        WHERE role = $2;`,
      [JSON.stringify(filter), role]
    );
  }
};

const down = async (client: PoolClient): Promise<void> => {
  // Remove v2 entries from versions[] (admin can re-seed by re-running m092).
  for (const p of PROMPTS_V2) {
    await client.query(
      `
      UPDATE prompt_templates
         SET versions = (
           SELECT COALESCE(jsonb_agg(v), '[]'::jsonb)
             FROM jsonb_array_elements(versions) AS v
            WHERE v->>'tag' IS DISTINCT FROM $2
         )
       WHERE name = $1;
      `,
      [p.name, PROMPT_VERSION_TAG]
    );
  }
  // Reset knowledge_filter back to {}
  await client.query(`UPDATE ai_agents SET knowledge_filter = '{}'::jsonb;`);
};

export default {
  up,
  down,
  description: 'Seed v2 prompt versions (7-section framework) + per-agent knowledge_filter',
};
