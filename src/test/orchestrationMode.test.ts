import { describe, expect, it } from 'vitest';
import { getOrchestrationDecision, isLangGraphActive } from '../../server/services/orchestrationMode';

describe('orchestration decision gate', () => {
  it('keeps TypeScript orchestration as the safe default', () => {
    expect(getOrchestrationDecision({})).toMatchObject({
      mode: 'typescript',
      enabled: true,
    });
    expect(isLangGraphActive({})).toBe(false);
  });

  it('rejects a LangGraph request without explicit approval and adapter readiness', () => {
    expect(getOrchestrationDecision({ AI_ORCHESTRATION_MODE: 'langgraph' })).toMatchObject({
      mode: 'typescript',
      enabled: false,
    });
  });

  it('requires both gates before LangGraph can ever become active', () => {
    const approvedOnly = {
      AI_ORCHESTRATION_MODE: 'langgraph',
      LANGGRAPH_ORCHESTRATION_APPROVED: 'true',
    };
    expect(isLangGraphActive(approvedOnly)).toBe(false);
    expect(isLangGraphActive({
      ...approvedOnly,
      LANGGRAPH_ORCHESTRATION_ADAPTER_READY: 'true',
    })).toBe(true);
  });

  it('supports immediate rollback to TypeScript mode', () => {
    expect(isLangGraphActive({
      AI_ORCHESTRATION_MODE: 'typescript',
      LANGGRAPH_ORCHESTRATION_APPROVED: 'true',
      LANGGRAPH_ORCHESTRATION_ADAPTER_READY: 'true',
    })).toBe(false);
  });
});