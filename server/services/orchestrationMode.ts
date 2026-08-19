/**
 * LangGraph decision gate.
 *
 * The current durable TypeScript pipeline is the only production mode. A
 * LangGraph adapter must explicitly prove readiness before this flag can
 * select it; an accidental env typo can never switch orchestration.
 */
export type OrchestrationMode = 'typescript' | 'langgraph';

export interface OrchestrationDecision {
  mode: OrchestrationMode;
  enabled: boolean;
  reason: string;
}

export function getOrchestrationDecision(env: NodeJS.ProcessEnv = process.env): OrchestrationDecision {
  const requested = String(env.AI_ORCHESTRATION_MODE || 'typescript').trim().toLowerCase();
  const approved = env.LANGGRAPH_ORCHESTRATION_APPROVED === 'true';
  const adapterReady = env.LANGGRAPH_ORCHESTRATION_ADAPTER_READY === 'true';

  if (requested === 'langgraph' && approved && adapterReady) {
    return {
      mode: 'langgraph',
      enabled: true,
      reason: 'LangGraph was explicitly approved and its adapter is marked ready.',
    };
  }

  if (requested === 'langgraph') {
    return {
      mode: 'typescript',
      enabled: false,
      reason: 'LangGraph request rejected: approval and adapter readiness are both required.',
    };
  }

  return {
    mode: 'typescript',
    enabled: true,
    reason: 'Durable TypeScript orchestration remains the default production mode.',
  };
}

export function isLangGraphActive(env: NodeJS.ProcessEnv = process.env): boolean {
  return getOrchestrationDecision(env).mode === 'langgraph';
}