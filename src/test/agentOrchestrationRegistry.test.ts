import { describe, expect, it } from 'vitest';
import {
  AGENT_ORCHESTRATION_REGISTRY,
  getAgentRuntimeStatus,
  getAgentRoleForIntent,
  selectSecondaryIntents,
} from '../../server/ai/agentOrchestrationRegistry';

describe('Minh agent orchestration registry', () => {
  it('keeps all 13 governance capabilities mapped to their prompt keys and runtime roles', () => {
    expect(AGENT_ORCHESTRATION_REGISTRY.map(({ skillKey, promptKey, role }) => ({
      skillKey,
      promptKey,
      role,
    }))).toEqual([
      { skillKey: 'ROUTER_SYSTEM', promptKey: 'ROUTER_SYSTEM', role: 'router' },
      { skillKey: 'WRITER_PERSONA', promptKey: 'WRITER_PERSONA', role: 'writer' },
      { skillKey: 'INVENTORY_SYSTEM', promptKey: 'INVENTORY_SYSTEM', role: 'inventory_specialist' },
      { skillKey: 'FINANCE_SYSTEM', promptKey: 'FINANCE_SYSTEM', role: 'finance_specialist' },
      { skillKey: 'LEGAL_SYSTEM', promptKey: 'LEGAL_SYSTEM', role: 'legal_specialist' },
      { skillKey: 'SALES_SYSTEM', promptKey: 'SALES_SYSTEM', role: 'sales_specialist' },
      { skillKey: 'MARKETING_SYSTEM', promptKey: 'MARKETING_SYSTEM', role: 'marketing_specialist' },
      { skillKey: 'CONTRACT_SYSTEM', promptKey: 'CONTRACT_SYSTEM', role: 'contract_specialist' },
      { skillKey: 'LEAD_ANALYST_SYSTEM', promptKey: 'LEAD_ANALYST_SYSTEM', role: 'lead_analyst' },
      { skillKey: 'VALUATION_SYSTEM', promptKey: 'VALUATION_SYSTEM', role: 'valuation_specialist' },
      { skillKey: 'VALUATION_SEARCH_SYSTEM', promptKey: 'VALUATION_SEARCH_SYSTEM', role: 'valuation_search' },
      { skillKey: 'VALUATION_RENTAL_SYSTEM', promptKey: 'VALUATION_RENTAL_SYSTEM', role: 'valuation_rental' },
      { skillKey: 'FOLLOWUP_SYSTEM', promptKey: 'FOLLOWUP_SYSTEM', role: 'followup_agent' },
    ]);
    expect(new Set(AGENT_ORCHESTRATION_REGISTRY.map(item => item.skillKey)).size).toBe(13);
  });

  it('marks every capability as not connected when its runtime role is absent or inactive', () => {
    const runtimeAgents = [
      { role: 'router', active: true },
      { role: 'writer', active: false },
    ];

    expect(AGENT_ORCHESTRATION_REGISTRY.map(capability =>
      getAgentRuntimeStatus(capability.role, runtimeAgents),
    )).toEqual([
      'runtime',
      'chưa nối',
      'chưa nối',
      'chưa nối',
      'chưa nối',
      'chưa nối',
      'chưa nối',
      'chưa nối',
      'chưa nối',
      'chưa nối',
      'chưa nối',
      'chưa nối',
      'chưa nối',
    ]);
  });

  it('assigns one owner to each customer intent', () => {
    expect(getAgentRoleForIntent('SEARCH_INVENTORY')).toBe('inventory_specialist');
    expect(getAgentRoleForIntent('CALCULATE_LOAN')).toBe('finance_specialist');
    expect(getAgentRoleForIntent('ESTIMATE_VALUATION')).toBe('valuation_specialist');
    expect(getAgentRoleForIntent('DIRECT_ANSWER')).toBe('writer');
  });

  it('deduplicates secondary owners and excludes writer/background capabilities', () => {
    expect(selectSecondaryIntents('SEARCH_INVENTORY', [
      'CALCULATE_LOAN',
      'ESTIMATE_VALUATION',
      'ESTIMATE_VALUATION',
      'DIRECT_ANSWER',
      'ANALYZE_LEAD',
    ], 3)).toEqual(['CALCULATE_LOAN', 'ESTIMATE_VALUATION', 'ANALYZE_LEAD']);
  });
});