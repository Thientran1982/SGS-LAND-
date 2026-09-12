/**
 * MINH GRAPH ADAPTER (Pha 2 + Pha 3) — LangGraph StateGraph bo nao Minh.
 * Pha 3: PostgresSaver checkpointer ben vung (bang checkpoint trong DB Aiven)
 * thay MemorySaver in-process; fallback MemorySaver khi DB chua san sang.
 */
import { StateGraph, Annotation, START, END, MemorySaver } from '@langchain/langgraph';
import { MINH_INTENT_TOOLS } from './minhOrchestrator';
import { runSpecialistTool, minhPlanTask } from './minhBrain';
import { buildCheckpointerPool, pool } from '../db';
import { Pool } from 'pg';
import { logger } from '../middleware/logger';

const GraphState = Annotation.Root({
  tenantId: Annotation<string>,
  task: Annotation<string>,
  triggerSource: Annotation<string>,
  sessionId: Annotation<string>,
  intent: Annotation<string>,
  tool: Annotation<string>,
  confidence: Annotation<number>,
  planSource: Annotation<string>,
  delegationToken: Annotation<string>,
  status: Annotation<string>,
  output: Annotation<any>,
  error: Annotation<string>,
  args: Annotation<any>,
  runId: Annotation<string | null>,
  correct: Annotation<boolean>,
});

let compiled: any = null;
let compiling: Promise<any> | null = null;

let aivenCheckpointerPool: Pool | null = null;
function getAivenCheckpointerPool(connectionString: string): Pool {
  if (!aivenCheckpointerPool) {
    aivenCheckpointerPool = buildCheckpointerPool(connectionString);
  }
  return aivenCheckpointerPool;
}

function getCheckpointerStorePool(): Pool {
  return aivenCheckpointerPool ?? pool;
}

async function buildMinhGraph() {
  let checkpointer: any = new MemorySaver();
  try {
    const aivenUrl = String(process.env.AIVEN_DATABASE_URL || '');
    const { PostgresSaver } = await import('@langchain/langgraph-checkpoint-postgres');
    // AIVEN_DATABASE_URL may point at a different database than the app pool,
    // so the checkpointer must use its own dedicated pool when configured.
    // pg resolves sslmode from the connection string itself.
    const saverPool = aivenUrl ? getAivenCheckpointerPool(aivenUrl) : pool;
    const pgSaver = new PostgresSaver(saverPool);
    await pgSaver.setup();
    checkpointer = pgSaver;
    logger.info('[MinhGraph] PostgresSaver checkpointer READY (pool=' + (aivenUrl ? 'aiven' : 'main') + ')');
  } catch (error: any) {
    logger.warn('[MinhGraph] PostgresSaver khong kha dung — fallback MemorySaver: ' + (error?.message || error));
  }
  const builder = new StateGraph(GraphState)
    .addNode('minh_plan', async (state: typeof GraphState.State) => {
      const plan = await minhPlanTask(state.tenantId, state.task, state.sessionId);
      return {
        intent: plan.intent,
        tool: MINH_INTENT_TOOLS[plan.intent] || 'get_platform_knowledge',
        confidence: plan.confidence,
        planSource: plan.source,
        delegationToken: plan.delegationToken || '',
      };
    })
    .addNode('specialist', async (state: typeof GraphState.State) => {
      const plan = {
        intent: state.intent,
        reason: 'langgraph node',
        confidence: state.confidence,
        source: state.planSource as 'MINH_LLM' | 'KEYWORD_FALLBACK',
        delegationToken: state.delegationToken,
      };
      const run = await runSpecialistTool({
        tenantId: state.tenantId,
        task: state.task,
        sessionId: state.sessionId,
        plan,
        triggerSource: state.triggerSource + '_langgraph',
      });
      return { status: run.status, output: run.output, error: run.error, tool: run.tool, args: run.args, runId: run.runId, correct: run.correct };
    })
    .addEdge(START, 'minh_plan')
    .addConditionalEdges('minh_plan', (state: typeof GraphState.State) => (state.intent ? 'specialist' : END), { specialist: 'specialist', [END]: END })
    .addEdge('specialist', END);
  return builder.compile({ checkpointer });
}

export async function getMinhGraph() {
  if (compiled) return compiled;
  if (!compiling) {
    compiling = buildMinhGraph().then(graph => {
      compiled = graph;
      return graph;
    }).catch(error => {
      compiling = null;
      logger.error('[MinhGraph] compile failed: ' + (error?.message || error));
      throw error;
    });
  }
  return compiling;
}

export async function listGraphThreads(limit = 10): Promise<Array<{ threadId: string; checkpoints: number }>> {
  const rows = await getCheckpointerStorePool().query(
    'SELECT thread_id, count(*)::int AS checkpoints FROM checkpoints GROUP BY thread_id ORDER BY max(checkpoint_id) DESC LIMIT $1',
    [limit],
  );
  return rows.rows.map(row => ({ threadId: row.thread_id, checkpoints: Number(row.checkpoints) }));
}

export async function getGraphThreadState(threadId: string): Promise<Record<string, any> | null> {
  const graph = await getMinhGraph();
  const state = await graph.getState({ configurable: { thread_id: threadId } });
  return (state?.values ?? null) as Record<string, any> | null;
}

export async function resumeMinhGraph(threadId: string): Promise<Record<string, any>> {
  const graph = await getMinhGraph();
  const finalState = await graph.invoke(null, { configurable: { thread_id: threadId } });
  logger.info('[MinhGraph] resume done thread=' + threadId + ' status=' + finalState.status);
  return { ...finalState, threadId };
}

export async function runMinhGraph(
  tenantId: string,
  task: string,
  options: { triggerSource?: string; threadId?: string } = {},
) {
  const graph = await getMinhGraph();
  const sessionId = 'graph-' + Date.now().toString(36);
  const threadId = options.threadId || sessionId;
  const config = { configurable: { thread_id: threadId } };
  const finalState = await graph.invoke(
    { tenantId, task, triggerSource: options.triggerSource || 'cli', sessionId },
    config,
  );
  logger.info('[MinhGraph] run done thread=' + threadId + ' status=' + finalState.status + ' tool=' + finalState.tool);
  return { ...finalState, threadId };
}
