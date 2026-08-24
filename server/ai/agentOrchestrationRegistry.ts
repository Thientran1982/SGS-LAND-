/**
 * Single source of truth for Minh's specialist routing.
 *
 * Specialists produce evidence only. WRITER is the only role allowed to
 * synthesize a customer-facing response.
 */
export type AgentCapability = {
  skillKey: string;
  role: string;
  intents: string[];
  mode: 'router' | 'specialist' | 'writer' | 'background';
  ragDomains?: string[];
};

export const AGENT_ORCHESTRATION_REGISTRY: readonly AgentCapability[] = [
  { skillKey: 'ROUTER_SYSTEM', role: 'router', intents: [], mode: 'router' },
  { skillKey: 'WRITER_PERSONA', role: 'writer', intents: ['DIRECT_ANSWER', 'CLARIFY'], mode: 'writer', ragDomains: ['legal', 'finance', 'market', 'product'] },
  { skillKey: 'INVENTORY_SYSTEM', role: 'inventory_specialist', intents: ['SEARCH_INVENTORY'], mode: 'specialist', ragDomains: ['product', 'market'] },
  { skillKey: 'FINANCE_SYSTEM', role: 'finance_specialist', intents: ['CALCULATE_LOAN'], mode: 'specialist', ragDomains: ['finance', 'market'] },
  { skillKey: 'LEGAL_SYSTEM', role: 'legal_specialist', intents: ['EXPLAIN_LEGAL'], mode: 'specialist', ragDomains: ['legal'] },
  { skillKey: 'SALES_SYSTEM', role: 'sales_specialist', intents: ['DRAFT_BOOKING'], mode: 'specialist', ragDomains: ['product', 'market'] },
  { skillKey: 'MARKETING_SYSTEM', role: 'marketing_specialist', intents: ['EXPLAIN_MARKETING'], mode: 'specialist', ragDomains: ['market', 'product'] },
  { skillKey: 'CONTRACT_SYSTEM', role: 'contract_specialist', intents: ['DRAFT_CONTRACT'], mode: 'specialist', ragDomains: ['legal'] },
  { skillKey: 'LEAD_ANALYST_SYSTEM', role: 'lead_analyst', intents: ['ANALYZE_LEAD'], mode: 'specialist', ragDomains: ['product'] },
  { skillKey: 'VALUATION_SYSTEM', role: 'valuation_specialist', intents: ['ESTIMATE_VALUATION'], mode: 'specialist', ragDomains: ['market'] },
  { skillKey: 'VALUATION_SEARCH_SYSTEM', role: 'valuation_search', intents: [], mode: 'specialist', ragDomains: ['market'] },
  { skillKey: 'VALUATION_RENTAL_SYSTEM', role: 'valuation_rental', intents: [], mode: 'specialist', ragDomains: ['market'] },
  { skillKey: 'FOLLOWUP_SYSTEM', role: 'followup_agent', intents: [], mode: 'background' },
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