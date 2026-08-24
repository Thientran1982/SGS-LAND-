import { describe, expect, it } from 'vitest';
import {
  AGENT_ORCHESTRATION_REGISTRY,
  getAgentRoleForIntent,
  selectSecondaryIntents,
} from '../../server/ai/agentOrchestrationRegistry';

describe('Minh agent orchestration registry', () => {
  it('defines all 13 governance capabilities', () => {
    expect(AGENT_ORCHESTRATION_REGISTRY).toHaveLength(13);
    expect(new Set(AGENT_ORCHESTRATION_REGISTRY.map(item => item.skillKey)).size).toBe(13);
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