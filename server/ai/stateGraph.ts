import { logger } from '../middleware/logger';

export type NodeFunction<T> = (state: T) => Promise<Partial<T>>;
export type EdgeCondition<T> = (state: T) => string;

/**
 * P2: StateGraph engine — tach tu server/ai.ts thanh module doc lap.
 * - runNodeWithRetry (P0): retry + backoff tung node, GRAPH_NODE_RETRIES (default 2)
 * - GRAPH_INTERRUPT (P1): pause truoc node danh dau de cho human approval
 * - Loop-diagnostics (P2.3): khi cham MAX_ITERATIONS, log node-path va node-loop
 */
export class StateGraph<T> {
  private nodes: Map<string, NodeFunction<T>> = new Map();
  private edges: Map<string, Record<string, string> | EdgeCondition<T>> = new Map();
  private entryPoint: string = '';
  /** P1: GRAPH_INTERRUPT — nodes paused for human approval */
  private interrupts: Set<string> = new Set();

  addNode(name: string, func: NodeFunction<T>) {
    this.nodes.set(name, func);
    return this;
  }

  setEntryPoint(name: string) {
    this.entryPoint = name;
    return this;
  }

  addConditionalEdges(source: string, condition: EdgeCondition<T>, mapping: Record<string, string>) {
    this.edges.set(source, (state: T) => mapping[condition(state)] || mapping['default']);
    return this;
  }

  addEdge(source: string, target: string) {
    this.edges.set(source, { default: target });
    return this;
  }

  /** P1: GRAPH_INTERRUPT — mark a node to pause before execution for human approval */
  registerInterrupt(nodeName: string) {
    this.interrupts.add(nodeName);
    return this;
  }

  /** P0: node retry with backoff — GRAPH_NODE_RETRIES (default 2) */
  private async runNodeWithRetry(nodeName: string, nodeFunc: NodeFunction<T>, state: T) {
    const maxAttempts = 1 + (parseInt(process.env.GRAPH_NODE_RETRIES || '2', 10) || 2);
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await nodeFunc(state);
      } catch (err) {
        lastError = err;
        logger.warn('[StateGraph] node ' + nodeName + ' attempt ' + attempt + '/' + maxAttempts + ' failed: ' + ((err as Error).message));
        if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, attempt * 800));
      }
    }
    throw lastError;
  }

  async compileAndRun(initialState: T): Promise<T> {
    let currentState: any = { ...initialState };
    let currentNode = this.entryPoint;
    const MAX_ITERATIONS = 20;
    let iterations = 0;
    // P2.3: loop diagnostics
    const nodePath: string[] = [];
    const visitCount: Record<string, number> = {};

    while (currentNode && currentNode !== 'END') {
      if (++iterations > MAX_ITERATIONS) {
        logger.error('[StateGraph] Max iterations (' + MAX_ITERATIONS + ') exceeded. Forcing END.');
        logger.error('[StateGraph] Loop cause — node path: ' + JSON.stringify(nodePath));
        const loopNode = Object.entries(visitCount).sort((a, b) => b[1] - a[1])[0];
        if (loopNode) {
          logger.error('[StateGraph] Loop cause — most visited node: ' + loopNode[0] + ' (' + loopNode[1] + ' visits). Check its edge mapping / condition function.');
        }
        (currentState as any).finalResponse = (currentState as any).t('ai.msg_system_busy');
        (currentState as any).isSysMsg = true;
        break;
      }
      nodePath.push(currentNode);
      visitCount[currentNode] = (visitCount[currentNode] || 0) + 1;

      if (this.interrupts.has(currentNode)) {
        logger.info('[StateGraph] GRAPH_INTERRUPT: pausing before node ' + currentNode + ' for approval');
        (currentState as any).interrupted = { node: currentNode, reason: 'pending_approval', at: Date.now() };
        break;
      }
      const nodeFunc = this.nodes.get(currentNode);
      if (!nodeFunc) throw new Error('Node ' + currentNode + ' not found');

      try {
        const updates = await this.runNodeWithRetry(currentNode, nodeFunc, currentState);
        currentState = { ...currentState, ...updates };

        const edge = this.edges.get(currentNode);
        if (typeof edge === 'function') {
          currentNode = edge(currentState);
        } else if (edge && edge.default) {
          currentNode = edge.default;
        } else {
          currentNode = 'END';
        }
      } catch (error: any) {
        logger.error('Error in node ' + currentNode + ':', error);
        (currentState as any).trace.push({ id: 'err_' + Date.now(), node: 'ERROR', status: 'ERROR', output: error.message, timestamp: Date.now() });
        (currentState as any).nodeErrors = { ...((currentState as any).nodeErrors || {}), [currentNode]: error.message };
        if (currentNode === 'ROUTER') {
          (currentState as any).finalResponse = (currentState as any).t('ai.msg_system_busy');
          (currentState as any).isSysMsg = true;
          break;
        }
        const edge2 = this.edges.get(currentNode);
        if (typeof edge2 === 'function') {
          currentNode = edge2(currentState);
        } else if (edge2 && edge2.default) {
          currentNode = edge2.default;
        } else {
          currentNode = 'END';
        }
      }
    }
    if (!(currentState as any).finalResponse) {
      (currentState as any).finalResponse = (currentState as any).t('ai.msg_system_busy');
      (currentState as any).isSysMsg = true;
    }
    return currentState;
  }
}
