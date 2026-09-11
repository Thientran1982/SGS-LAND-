/**
 * MINH BRAIN (Pha 1 + 2 + 3) — orchestration layer chuan cho he thong neuron.
 * plan (LLM + keyword fallback) -> delegate (subagentPolicy 60s) -> agent_runs + signals.
 * Pha 2: gate langgraph (dynamic import adapter). Pha 3: budget guard 24h/tenant.
 */
import crypto from 'node:crypto';
import { pool, withTenantContext } from '../db';
import { liveChatEngine, generateLiveChatText } from './liveChatEngine';
import { minhChooseSpecialist, keywordPlan, MINH_INTENT_TOOLS } from './minhOrchestrator';
import type { MinhPlan } from './minhOrchestrator';
import { runWithSubagentPolicy } from '../services/subagentPolicy';
import { startAgentRun, finishAgentRun } from '../services/agentRunsService';
import { agentMemoryService } from '../services/agentMemoryService';
import { isLangGraphActive } from '../services/orchestrationMode';
import { canUseTool } from './toolPermissions';
import { logger } from '../middleware/logger';

const BRAIN_SUBAGENT_TIMEOUT_MS = 60_000;
const BRAIN_DAILY_BUDGET = Number(process.env.MINH_DAILY_DELEGATION_BUDGET || 200);

export async function getBudgetStatus(tenantId: string): Promise<{ used: number; budget: number; exceeded: boolean }> {
  const rows = await withTenantContext(tenantId, async client => client.query(
    "SELECT count(*)::int AS used FROM agent_runs WHERE (trigger_source ILIKE $1 OR trigger_source ILIKE $2) AND started_at > NOW() - INTERVAL '7 days'",
    ['minh%', 'cli%'],
  ));
  const used = Number(rows.rows[0]?.used || 0);
  return { used, budget: BRAIN_DAILY_BUDGET, exceeded: used >= BRAIN_DAILY_BUDGET };
}

export type MinhBrainOutcome = {
  plan: MinhPlan;
  tool: string;
  args: Record<string, any>;
  status: 'SUCCESS' | 'FAILED';
  output: unknown;
  error: string | null;
  durationMs: number;
  runId: string | null;
  correct: boolean;
  via: 'typescript' | 'langgraph';
};

export async function minhPlanTask(tenantId: string, task: string, sessionId?: string): Promise<MinhPlan> {
  const plan = await minhChooseSpecialist({
    tenantId,
    message: task,
    sessionId: sessionId || 'brain-' + Date.now().toString(36),
    generateFn: generateLiveChatText,
    fallbackIntent: 'GENERAL',
    fallbackTool: 'get_platform_knowledge',
  });
  if (plan) return plan;
  return keywordPlan('GENERAL', 'llm unavailable fallback');
}

export type SpecialistRun = {
  tool: string;
  args: Record<string, any>;
  status: 'SUCCESS' | 'FAILED';
  output: unknown;
  error: string | null;
  durationMs: number;
  runId: string | null;
  correct: boolean;
};




const TOOL_REQUIRED_ARGS: Record<string, string[]> = {
  get_valuation: ['address', 'area'],
  analyze_investment: ['purchasePrice'],
};

function parseVnd(text: string): number | null {
  const ty = text.match(/(\d+(?:[.,]\d+)?)\s*(?:ty|t?ỷ)/i);
  if (ty) return Math.round(Number(ty[1].replace(',', '.')) * 1_000_000_000);
  const tr = text.match(/(\d+(?:[.,]\d+)?)\s*(?:trieu|triệu)\b/i);
  if (tr) return Math.round(Number(tr[1].replace(',', '.')) * 1_000_000);
  return null;
}

function parseArea(text: string): number | null {
  const m = text.match(/(\d+(?:[.,]\d+)?)\s*(?:m2|m²|met vuong|m vuong)/i);
  return m ? Number(m[1].replace(',', '.')) : null;
}

function propertyTypeFrom(text: string): string | null {
  if (/can ho|chung cu|apartment/i.test(text)) return 'APARTMENT';
  if (/nha pho|townhouse/i.test(text)) return 'TOWNHOUSE';
  if (/biet thu|villa/i.test(text)) return 'VILLA';
  if (/dat nen|\bdat\b|land/i.test(text)) return 'LAND';
  if (/shophouse/i.test(text)) return 'SHOPHOUSE';
  return null;
}

export async function runSpecialistTool(params: {
  tenantId: string;
  task: string;
  sessionId: string;
  plan: MinhPlan;
  triggerSource?: string;
  onBehalfOf?: { userId: string; role: string };
}): Promise<SpecialistRun> {
  const started = Date.now();
  const tool = MINH_INTENT_TOOLS[params.plan.intent] || 'get_platform_knowledge';
  const buildArgs = INTENT_ARGS_BUILDERS[params.plan.intent] || INTENT_ARGS_BUILDERS.GENERAL;
  const args = buildArgs(params.tenantId, params.task);
  if (params.onBehalfOf && !canUseTool(params.onBehalfOf.role, tool)) {    logger.warn('[MinhBrain] onBehalfOf role ' + params.onBehalfOf.role + ' forbidden for ' + tool);    const runId0 = await startAgentRun(pool, tool, params.triggerSource || 'minh_brain');    await finishAgentRun(pool, runId0, 'error', { onBehalfOf: params.onBehalfOf, tool }, 'MINH_TOOL_FORBIDDEN: role ' + params.onBehalfOf.role, started);    await agentMemoryService.recordSignal(params.tenantId, { signalType: 'minh_delegation_result', actorId: 'MINH', subjectType: 'brain_task', subjectId: String(params.task).slice(0, 120), dedupeKey: 'minh-delegation-result:brain:forbidden:' + crypto.randomUUID(), payload: { sessionId: params.sessionId, intent: params.plan.intent, correct: false, forbidden: true }, provenance: 'minh_brain' }).catch(() => undefined);    return { tool, args, status: 'FAILED', output: null, error: 'MINH_TOOL_FORBIDDEN: role khong du quyen cho ' + tool, durationMs: Date.now() - started, runId: runId0, correct: false };  }
  const required = TOOL_REQUIRED_ARGS[tool] || [];
  const lower = params.task.toLowerCase();
  for (const key of required) {
    if (args[key] !== undefined && args[key] !== '') continue;
    if (key === 'area') {
      const areaValue = parseArea(lower);
      if (areaValue !== null) args[key] = areaValue;
    } else if (key === 'address') {
      args[key] = params.task.slice(0, 200);
    } else if (key === 'legalType') {
      args[key] = 'UNKNOWN';
      const legalMap: Array<[string, string]> = [['so ho|pink', 'PINK_BOOK'], ['so do|red', 'RED_BOOK'], ['hdmb|hop dong mua', 'HDMB'], ['vi bang', 'VI_BANG'], ['giay tay', 'GIAY_TAY']];
      for (const [pattern, value] of legalMap) {
        if (new RegExp(pattern, 'i').test(lower)) { args[key] = value; break; }
      }
    } else if (key === 'purchasePrice') {
      const price = parseVnd(lower);
      if (price !== null) args[key] = price;
    } else {
      args[key] = params.task.slice(0, 200);
    }
  }
  const missing = required.filter(key => args[key] === undefined || args[key] === null || args[key] === '');
  if (tool === 'search_listings') {
    const price = parseVnd(lower);
    if (price !== null) args['priceMax'] = price;
    const areaValue = parseArea(lower);
    if (areaValue !== null) args['areaMin'] = areaValue;
    const propertyType = propertyTypeFrom(lower);
    if (propertyType !== null) args['propertyType'] = propertyType;
  }
  if (tool === 'analyze_investment') {
    const rent = lower.match(/(?:thue|cho thue)[^\d]{0,20}(\d+(?:[.,]\d+)?)\s*(?:trieu|triệu)/i);
    if (rent) args['monthlyRent'] = Math.round(Number(rent[1].replace(',', '.')) * 1_000_000);
  }
  const runId = await startAgentRun(pool, tool, params.triggerSource || 'minh_brain');
  let status: 'SUCCESS' | 'FAILED' = 'FAILED';
  let output: unknown = null;
  let error: string | null = missing.length ? 'MINH_MISSING_ARGS: ' + missing.join(', ') : null;
  if (!error) {
    try {
      output = await runWithSubagentPolicy(
        () => liveChatEngine.callTool(tool, args),
        { timeoutMs: BRAIN_SUBAGENT_TIMEOUT_MS },
      );
      status = 'SUCCESS';
    } catch (err: any) {
      error = String(err?.message || err);
      logger.warn('[MinhBrain] delegate ' + tool + ' failed: ' + error);
    }
  }
  await finishAgentRun(
    pool,
    runId,
    status === 'SUCCESS' ? 'success' : 'error',
    { intent: params.plan.intent, confidence: params.plan.confidence, source: params.plan.source, tool },
    error,
    started,
  );
  const correct = status === 'SUCCESS';
  const token = params.plan.delegationToken || 'unknown-' + crypto.randomUUID();
  await agentMemoryService.recordSignal(params.tenantId, {
    signalType: 'minh_delegation_result',
    actorId: 'MINH',
    subjectType: 'brain_task',
    subjectId: String(params.task).slice(0, 120),
    dedupeKey: 'minh-delegation-result:brain:' + token,
    payload: {
      sessionId: params.sessionId,
      delegationToken: token,
      intent: params.plan.intent,
      confidence: params.plan.confidence,
      plannedTool: tool,
      usedTool: correct,
      correct,
      missingArgs: missing.length > 0 ? missing : null,
      latencyMs: Date.now() - started,
    },
    provenance: 'minh_brain',
  }).catch(signalError => logger.warn('[MinhBrain] result signal failed: ' + (signalError?.message || signalError)));
  return { tool, args, status, output, error, durationMs: Date.now() - started, runId, correct };
}
const INTENT_ARGS_BUILDERS: Record<string, (tenantId: string, task: string) => Record<string, any>> = {
  VALUATION: (tenantId, task) => ({ tenantId, query: task }),
  SEARCH: (tenantId, task) => ({ tenantId, query: task }),
  LEGAL: (tenantId, task) => ({ tenantId, query: task, legalType: 'UNKNOWN' }),
  PLANNING: (tenantId, task) => ({ tenantId, query: task }),
  FINANCE: (tenantId, task) => ({ tenantId, query: task }),
  PROJECT: (tenantId, task) => ({ tenantId, query: task }),
  LONGTHANH: (tenantId, task) => ({ tenantId, query: task }),
  INVESTMENT: (tenantId, task) => ({ tenantId, query: task }),
  LANDING: (tenantId, task) => ({ tenantId, query: task }),
  LEAD_SCORING: (tenantId, task) => ({ tenantId, query: task }),
  GENERAL: (tenantId, task) => ({ tenantId, domain: 'platform', query: task }),
};

export async function minhDelegateTask(
  tenantId: string,
  task: string,
  options: { triggerSource?: string } = {},
): Promise<MinhBrainOutcome> {
  const started = Date.now();
  const sessionId = 'brain-' + started.toString(36);
  const budget = await getBudgetStatus(tenantId);
  if (budget.exceeded) {
    logger.warn('[MinhBrain] daily delegation budget exceeded (' + budget.used + '/' + budget.budget + ')');
    return {
      plan: keywordPlan('GENERAL', 'daily budget exceeded'),
      tool: 'none',
      args: {},
      status: 'FAILED',
      output: null,
      error: 'MINH_BUDGET_EXCEEDED: ' + budget.used + '/' + budget.budget,
      durationMs: Date.now() - started,
      runId: null,
      correct: false,
      via: 'typescript',
    };
  }
  if (isLangGraphActive()) {
    const { runMinhGraph } = await import('./minhGraphAdapter');
    const state = await runMinhGraph(tenantId, task, { triggerSource: options.triggerSource || 'minh_brain' });
    const plan = await minhPlanTask(tenantId, task, sessionId);
    return {
      plan,
      tool: String(state.tool || 'get_platform_knowledge'),
      args: {},
      status: state.status === 'SUCCESS' ? 'SUCCESS' : 'FAILED',
      output: state.output ?? null,
      error: state.error ?? null,
      durationMs: Date.now() - started,
      runId: null,
      correct: state.status === 'SUCCESS',
      via: 'langgraph',
    };
  }
  const plan = await minhPlanTask(tenantId, task, sessionId);
  const token = plan.delegationToken || 'brain-' + crypto.randomUUID();
  const planWithToken: MinhPlan = { ...plan, delegationToken: token };
  if (!plan.delegationToken) {
    await agentMemoryService.recordSignal(tenantId, {
      signalType: 'minh_delegation',
      actorId: 'MINH',
      subjectType: 'brain_task',
      subjectId: String(task).slice(0, 120),
      dedupeKey: 'minh_delegation:brain:' + token,
      payload: { intent: plan.intent, confidence: plan.confidence, sessionId, delegationToken: token, source: plan.source },
      provenance: 'minh_brain',
    }).catch(signalError => logger.warn('[MinhBrain] delegation signal failed: ' + (signalError?.message || signalError)));
  }
  const specialist = await runSpecialistTool({ tenantId, task, sessionId, plan: planWithToken, triggerSource: options.triggerSource || 'minh_brain' });
  return { plan: planWithToken, tool: specialist.tool, args: specialist.args, status: specialist.status, output: specialist.output, error: specialist.error, durationMs: Date.now() - started, runId: specialist.runId, correct: specialist.correct, via: 'typescript' };
}
