/**
 * Single source of truth for Minh's specialist routing.
 *
 * Specialists produce evidence only. WRITER is the only role allowed to
 * synthesize a customer-facing response.
 */
import { MARKETING_GROWTH_CAPABILITIES } from './marketingGrowthAgents';

export type AgentCapability = {
  skillKey: string;
  promptKey: string;
  displayName: string;
  descriptionKey: string;
  role: string;
  intents: string[];
  mode: 'router' | 'specialist' | 'writer' | 'background';
  ragDomains?: string[];
  /** Human-readable intent ownership used by AI Governance. */
  ownerIntent?: string;
};

export type RuntimeAgent = {
  role: string;
  active: boolean;
};

export const AGENT_ORCHESTRATION_REGISTRY: readonly AgentCapability[] = [
  { skillKey: 'ROUTER_SYSTEM', promptKey: 'ROUTER_SYSTEM', displayName: 'Router', descriptionKey: 'ai.agent_router_desc', role: 'router', intents: [], mode: 'router', ownerIntent: 'Phân loại và định tuyến' },
  { skillKey: 'WRITER_PERSONA', promptKey: 'WRITER_PERSONA', displayName: 'Writer', descriptionKey: 'ai.agent_writer_desc', role: 'writer', intents: ['DIRECT_ANSWER', 'CLARIFY'], mode: 'writer', ragDomains: ['legal', 'finance', 'market', 'product'], ownerIntent: 'DIRECT_ANSWER · CLARIFY' },
  { skillKey: 'INVENTORY_SYSTEM', promptKey: 'INVENTORY_SYSTEM', displayName: 'Inventory', descriptionKey: 'ai.agent_inventory_desc', role: 'inventory_specialist', intents: ['SEARCH_INVENTORY'], mode: 'specialist', ragDomains: ['product', 'market'], ownerIntent: 'SEARCH_INVENTORY' },
  { skillKey: 'FINANCE_SYSTEM', promptKey: 'FINANCE_SYSTEM', displayName: 'Finance', descriptionKey: 'ai.agent_finance_desc', role: 'finance_specialist', intents: ['CALCULATE_LOAN'], mode: 'specialist', ragDomains: ['finance', 'market'], ownerIntent: 'CALCULATE_LOAN' },
  { skillKey: 'LEGAL_SYSTEM', promptKey: 'LEGAL_SYSTEM', displayName: 'Legal', descriptionKey: 'ai.agent_legal_desc', role: 'legal_specialist', intents: ['EXPLAIN_LEGAL'], mode: 'specialist', ragDomains: ['legal'], ownerIntent: 'EXPLAIN_LEGAL' },
  { skillKey: 'SALES_SYSTEM', promptKey: 'SALES_SYSTEM', displayName: 'Sales', descriptionKey: 'ai.agent_sales_desc', role: 'sales_specialist', intents: ['DRAFT_BOOKING'], mode: 'specialist', ragDomains: ['product', 'market'], ownerIntent: 'DRAFT_BOOKING' },
  { skillKey: 'MARKETING_SYSTEM', promptKey: 'MARKETING_SYSTEM', displayName: 'Marketing', descriptionKey: 'ai.agent_marketing_desc', role: 'marketing_specialist', intents: ['EXPLAIN_MARKETING'], mode: 'specialist', ragDomains: ['market', 'product'], ownerIntent: 'EXPLAIN_MARKETING' },
  { skillKey: 'CONTRACT_SYSTEM', promptKey: 'CONTRACT_SYSTEM', displayName: 'Contract', descriptionKey: 'ai.agent_contract_desc', role: 'contract_specialist', intents: ['DRAFT_CONTRACT'], mode: 'specialist', ragDomains: ['legal'], ownerIntent: 'DRAFT_CONTRACT' },
  { skillKey: 'LEAD_ANALYST_SYSTEM', promptKey: 'LEAD_ANALYST_SYSTEM', displayName: 'Lead Analyst', descriptionKey: 'ai.agent_lead_analyst_desc', role: 'lead_analyst', intents: ['ANALYZE_LEAD'], mode: 'specialist', ragDomains: ['product'], ownerIntent: 'ANALYZE_LEAD' },
  { skillKey: 'VALUATION_SYSTEM', promptKey: 'VALUATION_SYSTEM', displayName: 'Valuation Extract', descriptionKey: 'ai.agent_valuation_desc', role: 'valuation_specialist', intents: ['ESTIMATE_VALUATION'], mode: 'specialist', ragDomains: ['market'], ownerIntent: 'ESTIMATE_VALUATION' },
  { skillKey: 'VALUATION_SEARCH_SYSTEM', promptKey: 'VALUATION_SEARCH_SYSTEM', displayName: 'Valuation Sale', descriptionKey: 'ai.agent_valuation_search_desc', role: 'valuation_search', intents: [], mode: 'specialist', ragDomains: ['market'], ownerIntent: 'ESTIMATE_VALUATION · giá bán' },
  { skillKey: 'VALUATION_RENTAL_SYSTEM', promptKey: 'VALUATION_RENTAL_SYSTEM', displayName: 'Valuation Rental', descriptionKey: 'ai.agent_valuation_rental_desc', role: 'valuation_rental', intents: [], mode: 'specialist', ragDomains: ['market'], ownerIntent: 'ESTIMATE_VALUATION · giá thuê' },
  { skillKey: 'FOLLOWUP_SYSTEM', promptKey: 'FOLLOWUP_SYSTEM', displayName: 'Follow Up', descriptionKey: 'ai.agent_followup_desc', role: 'followup_agent', intents: [], mode: 'background', ownerIntent: 'FOLLOWUP (nội bộ)' },
  ...MARKETING_GROWTH_CAPABILITIES.map(capability => ({
    skillKey: capability.promptKey,
    promptKey: capability.promptKey,
    displayName: capability.displayName,
    descriptionKey: `ai.agent_${capability.role}_desc`,
    role: capability.role,
    intents: [],
    mode: capability.mode === 'realtime' ? 'specialist' as const : 'background' as const,
    ragDomains: capability.ragDomains,
    ownerIntent: capability.ownerIntent,
  })),
];

const byIntent = new Map(
  AGENT_ORCHESTRATION_REGISTRY.flatMap(capability =>
    capability.intents.map(intent => [intent, capability] as const),
  ),
);

export function getAgentCapabilityForIntent(intent: string): AgentCapability | undefined {
  return byIntent.get(intent);
}

export function getAgentRoleForIntent(intent: string): string {
  return getAgentCapabilityForIntent(intent)?.role || 'writer';
}

export function getAgentRuntimeStatus(
  role: string,
  runtimeAgents: readonly RuntimeAgent[],
): 'runtime' | 'chưa nối' {
  return runtimeAgents.some(agent => agent.role === role && agent.active) ? 'runtime' : 'chưa nối';
}

/** Preserve order, remove duplicate owners, and cap specialist fan-out. */
export function selectSecondaryIntents(
  primaryIntent: string,
  intents: readonly string[],
  maxSpecialists = 2,
): string[] {
  const seenRoles = new Set<string>();
  const selected: string[] = [];
  for (const intent of intents) {
    if (!intent || intent === primaryIntent) continue;
    const capability = getAgentCapabilityForIntent(intent);
    if (!capability || capability.mode !== 'specialist' || seenRoles.has(capability.role)) continue;
    seenRoles.add(capability.role);
    selected.push(intent);
    if (selected.length >= maxSpecialists) break;
  }
  return selected;
}
