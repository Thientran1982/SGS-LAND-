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
  manifest: AgentManifest;
};

export type AgentManifest = {
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  readScopes: string[];
  writeScopes: string[];
  maxLatencyMs: number;
  requiresApproval: boolean;
  evidenceRequirements: string[];
  fallbackPolicy: 'KEYWORD_FALLBACK' | 'DEGRADED_RESPONSE' | 'HUMAN_REVIEW' | 'NO_FALLBACK';
};

export type RuntimeAgent = {
  role: string;
  active: boolean;
};

/**
 * Secondary specialist fan-out is opt-in. Keep it disabled while the
 * single-intent router baseline is being evaluated.
 */
export const COMPOUND_ROUTING_ENV = 'MINH_COMPOUND_ROUTING_ENABLED';

export function isCompoundRoutingEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return String(env[COMPOUND_ROUTING_ENV] || '').trim().toLowerCase() === 'true';
}

function buildManifest(input: {
  role: string;
  mode: AgentCapability['mode'];
  ragDomains?: string[];
  requiresApproval?: boolean;
  writeScopes?: string[];
}): AgentManifest {
  const readScopes = (input.ragDomains?.length ? input.ragDomains : ['session'])
    .map(domain => `tenant:${domain}`);
  const requiresApproval = input.requiresApproval === true;
  const fallbackPolicy = input.mode === 'router'
    ? 'KEYWORD_FALLBACK'
    : input.mode === 'writer'
      ? 'HUMAN_REVIEW'
      : input.mode === 'background'
        ? 'DEGRADED_RESPONSE'
        : 'DEGRADED_RESPONSE';
  return {
    inputSchema: {
      type: 'object',
      required: ['task', 'tenantScope'],
      properties: {
        task: { type: 'string', minLength: 1, maxLength: 8_000 },
        tenantScope: { type: 'string', minLength: 1 },
        evidence: { type: 'array' },
      },
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      required: ['status', 'evidence'],
      properties: {
        status: { type: 'string', enum: ['SUCCESS', 'PARTIAL', 'DEGRADED', 'FAILED'] },
        evidence: { type: 'array' },
        uncertainty: { type: 'string' },
      },
      additionalProperties: true,
    },
    readScopes,
    writeScopes: input.writeScopes || (requiresApproval ? ['approval_request:draft'] : []),
    maxLatencyMs: input.mode === 'router' ? 8_000 : input.mode === 'background' ? 30_000 : 15_000,
    requiresApproval,
    evidenceRequirements: input.mode === 'writer'
      ? ['verified_source_for_sensitive_claims']
      : input.mode === 'router'
        ? []
        : ['source_identity', 'observed_at_or_explicit_unavailable'],
    fallbackPolicy,
  };
}

type CapabilityInput = Omit<AgentCapability, 'manifest'> & { manifest?: AgentManifest };

function defineCapability(input: CapabilityInput): AgentCapability {
  return {
    ...input,
    manifest: input.manifest || buildManifest(input),
  };
}

export const AGENT_ORCHESTRATION_REGISTRY: readonly AgentCapability[] = [
  defineCapability({ skillKey: 'ROUTER_SYSTEM', promptKey: 'ROUTER_SYSTEM', displayName: 'Router', descriptionKey: 'ai.agent_router_desc', role: 'router', intents: [], mode: 'router', ownerIntent: 'Phân loại và định tuyến' }),
  defineCapability({ skillKey: 'WRITER_PERSONA', promptKey: 'WRITER_PERSONA', displayName: 'Writer', descriptionKey: 'ai.agent_writer_desc', role: 'writer', intents: ['DIRECT_ANSWER', 'CLARIFY'], mode: 'writer', ragDomains: ['legal', 'finance', 'market', 'product'], ownerIntent: 'DIRECT_ANSWER · CLARIFY' }),
  defineCapability({ skillKey: 'INVENTORY_SYSTEM', promptKey: 'INVENTORY_SYSTEM', displayName: 'Inventory', descriptionKey: 'ai.agent_inventory_desc', role: 'inventory_specialist', intents: ['SEARCH_INVENTORY'], mode: 'specialist', ragDomains: ['product', 'market'], ownerIntent: 'SEARCH_INVENTORY' }),
  defineCapability({ skillKey: 'FINANCE_SYSTEM', promptKey: 'FINANCE_SYSTEM', displayName: 'Finance', descriptionKey: 'ai.agent_finance_desc', role: 'finance_specialist', intents: ['CALCULATE_LOAN'], mode: 'specialist', ragDomains: ['finance', 'market'], ownerIntent: 'CALCULATE_LOAN' }),
  defineCapability({ skillKey: 'LEGAL_SYSTEM', promptKey: 'LEGAL_SYSTEM', displayName: 'Legal', descriptionKey: 'ai.agent_legal_desc', role: 'legal_specialist', intents: ['EXPLAIN_LEGAL'], mode: 'specialist', ragDomains: ['legal'], ownerIntent: 'EXPLAIN_LEGAL' }),
  defineCapability({ skillKey: 'SALES_SYSTEM', promptKey: 'SALES_SYSTEM', displayName: 'Sales', descriptionKey: 'ai.agent_sales_desc', role: 'sales_specialist', intents: ['DRAFT_BOOKING'], mode: 'specialist', ragDomains: ['product', 'market'], ownerIntent: 'DRAFT_BOOKING', manifest: buildManifest({ role: 'sales_specialist', mode: 'specialist', ragDomains: ['product', 'market'], requiresApproval: true }) }),
  defineCapability({ skillKey: 'MARKETING_SYSTEM', promptKey: 'MARKETING_SYSTEM', displayName: 'Marketing', descriptionKey: 'ai.agent_marketing_desc', role: 'marketing_specialist', intents: ['EXPLAIN_MARKETING'], mode: 'specialist', ragDomains: ['market', 'product'], ownerIntent: 'EXPLAIN_MARKETING' }),
  defineCapability({ skillKey: 'LANDING_DESIGN', promptKey: 'LANDING_DESIGN_SYSTEM', displayName: 'Landing Design', descriptionKey: 'ai.agent_landing_design_desc', role: 'landing_design_agent', intents: [], mode: 'specialist', ragDomains: ['product'], ownerIntent: 'LANDING (design handoff)', manifest: buildManifest({ role: 'landing_design_agent', mode: 'specialist', ragDomains: ['product'], writeScopes: ['draft:landing'] }) }),
  defineCapability({ skillKey: 'CONTRACT_SYSTEM', promptKey: 'CONTRACT_SYSTEM', displayName: 'Contract', descriptionKey: 'ai.agent_contract_desc', role: 'contract_specialist', intents: ['DRAFT_CONTRACT'], mode: 'specialist', ragDomains: ['legal'], ownerIntent: 'DRAFT_CONTRACT', manifest: buildManifest({ role: 'contract_specialist', mode: 'specialist', ragDomains: ['legal'], requiresApproval: true }) }),
  defineCapability({ skillKey: 'LEAD_ANALYST_SYSTEM', promptKey: 'LEAD_ANALYST_SYSTEM', displayName: 'Lead Analyst', descriptionKey: 'ai.agent_lead_analyst_desc', role: 'lead_analyst', intents: ['ANALYZE_LEAD'], mode: 'specialist', ragDomains: ['product'], ownerIntent: 'ANALYZE_LEAD' }),
  defineCapability({ skillKey: 'VALUATION_SYSTEM', promptKey: 'VALUATION_SYSTEM', displayName: 'Valuation Extract', descriptionKey: 'ai.agent_valuation_desc', role: 'valuation_specialist', intents: ['ESTIMATE_VALUATION'], mode: 'specialist', ragDomains: ['market'], ownerIntent: 'ESTIMATE_VALUATION' }),
  defineCapability({ skillKey: 'VALUATION_SEARCH_SYSTEM', promptKey: 'VALUATION_SEARCH_SYSTEM', displayName: 'Valuation Sale', descriptionKey: 'ai.agent_valuation_search_desc', role: 'valuation_search', intents: [], mode: 'specialist', ragDomains: ['market'], ownerIntent: 'ESTIMATE_VALUATION · giá bán' }),
  defineCapability({ skillKey: 'VALUATION_RENTAL_SYSTEM', promptKey: 'VALUATION_RENTAL_SYSTEM', displayName: 'Valuation Rental', descriptionKey: 'ai.agent_valuation_rental_desc', role: 'valuation_rental', intents: [], mode: 'specialist', ragDomains: ['market'], ownerIntent: 'ESTIMATE_VALUATION · giá thuê' }),
  defineCapability({ skillKey: 'FOLLOWUP_SYSTEM', promptKey: 'FOLLOWUP_SYSTEM', displayName: 'Follow Up', descriptionKey: 'ai.agent_followup_desc', role: 'followup_agent', intents: [], mode: 'background', ownerIntent: 'FOLLOWUP (nội bộ)', manifest: buildManifest({ role: 'followup_agent', mode: 'background', requiresApproval: true, writeScopes: ['approval_request:draft'] }) }),
  ...MARKETING_GROWTH_CAPABILITIES.map(capability => defineCapability({
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

export function validateAgentManifest(capability: AgentCapability): string[] {
  const errors: string[] = [];
  const manifest = capability.manifest;
  if (!manifest || typeof manifest !== 'object') return [`${capability.skillKey}: manifest missing`];
  if (!manifest.inputSchema || typeof manifest.inputSchema !== 'object') errors.push(`${capability.skillKey}: inputSchema missing`);
  if (!manifest.outputSchema || typeof manifest.outputSchema !== 'object') errors.push(`${capability.skillKey}: outputSchema missing`);
  if (!Array.isArray(manifest.readScopes)) errors.push(`${capability.skillKey}: readScopes missing`);
  if (!Array.isArray(manifest.writeScopes)) errors.push(`${capability.skillKey}: writeScopes missing`);
  if (!Number.isFinite(manifest.maxLatencyMs) || manifest.maxLatencyMs <= 0) errors.push(`${capability.skillKey}: maxLatencyMs invalid`);
  if (typeof manifest.requiresApproval !== 'boolean') errors.push(`${capability.skillKey}: requiresApproval invalid`);
  if (!Array.isArray(manifest.evidenceRequirements)) errors.push(`${capability.skillKey}: evidenceRequirements missing`);
  if (!manifest.fallbackPolicy) errors.push(`${capability.skillKey}: fallbackPolicy missing`);
  return errors;
}

export function validateAgentOrchestrationRegistry(
  registry: readonly AgentCapability[] = AGENT_ORCHESTRATION_REGISTRY,
): string[] {
  const errors = registry.flatMap(validateAgentManifest);
  const skillKeys = new Set<string>();
  const intentOwners = new Map<string, string>();
  for (const capability of registry) {
    if (skillKeys.has(capability.skillKey)) errors.push(`duplicate skillKey: ${capability.skillKey}`);
    skillKeys.add(capability.skillKey);
    for (const intent of capability.intents) {
      const previous = intentOwners.get(intent);
      if (previous && previous !== capability.skillKey) {
        errors.push(`duplicate intent owner: ${intent}`);
      }
      intentOwners.set(intent, capability.skillKey);
    }
  }
  return errors;
}

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
