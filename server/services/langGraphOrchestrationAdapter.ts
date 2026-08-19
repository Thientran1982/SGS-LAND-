import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import type { DurableResumeContext } from './durableAgentExecutionService';

type LangGraphState<T> = {
  result?: T;
};

const LangGraphState = Annotation.Root({
  result: Annotation<unknown>,
});

/**
 * LangGraph is deliberately an orchestration adapter, not the durability layer.
 * DurableAgentExecutionService owns claims, leases, fencing, checkpoints and
 * approval interrupts; this graph owns the execution-node boundary.
 */
export async function runLangGraphOrchestration<T>(params: {
  resume: DurableResumeContext;
  execute: (resume: DurableResumeContext) => Promise<T>;
}): Promise<T> {
  const graph = new StateGraph(LangGraphState)
    .addNode('specialist_pipeline', async () => ({
      result: await params.execute(params.resume),
    }))
    .addEdge(START, 'specialist_pipeline')
    .addEdge('specialist_pipeline', END)
    .compile();

  const output = await graph.invoke({}) as LangGraphState<T>;
  if (!output.result) throw new Error('LANGGRAPH_EMPTY_RESULT');
  return output.result;
}