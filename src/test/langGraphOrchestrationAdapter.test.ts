import { describe, expect, it } from 'vitest';
import { runLangGraphOrchestration } from '../../server/services/langGraphOrchestrationAdapter';

describe('LangGraph orchestration adapter', () => {
  it('executes the durable specialist handler through a real LangGraph graph', async () => {
    const result = await runLangGraphOrchestration({
      resume: {} as any,
      execute: async () => ({ content: 'ok', suggestedAction: 'NONE' }),
    });

    expect(result).toEqual({ content: 'ok', suggestedAction: 'NONE' });
  });

  it('fails closed when a graph returns no result', async () => {
    await expect(runLangGraphOrchestration({
      resume: {} as any,
      execute: async () => undefined as any,
    })).rejects.toThrow('LANGGRAPH_EMPTY_RESULT');
  });
});