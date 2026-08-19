import { logger } from '../middleware/logger';
import { createHash } from 'crypto';
import { agentExecutionRepository } from '../repositories/agentExecutionRepository';
import type { AgentExecutionStepRecord } from '../repositories/agentExecutionRepository';
import {
  blockedAgentResponse,
  inspectAgentInput,
  inspectAgentOutput,
  type GuardrailReport,
} from '../ai/agentGuardrails';
import { getOrchestrationDecision } from './orchestrationMode';
import { runWithSubagentPolicy } from './subagentPolicy';

export interface DurableAgentResult<T> {
  runId: string;
  traceId: string;
  result: T;
  guardrail: GuardrailReport;
  resumed: boolean;
  cached: boolean;
}

export interface DurableResumeContext {
  executionId: string;
  attempt: number;
  completedSteps: AgentExecutionStepRecord[];
  specialistOutput?: unknown;
  runSubagent: <T>(params: SubagentRequest<T>) => Promise<T>;
}

interface SubagentRequest<T> {
  stepKey: string;
  specialist: string;
  input: Record<string, any>;
  execute: () => Promise<T>;
}

function checkpointHash(input: Record<string, any>): string {
  return createHash('sha256').update(JSON.stringify(input, Object.keys(input).sort())).digest('hex');
}

export async function runDurableAgentExecution<T extends {
  content?: string;
  suggestedAction?: string | null;
  sources?: unknown[];
  artifact?: unknown;
  steps?: Array<Record<string, any>>;
  escalated?: boolean;
}>(params: {
  tenantId: string;
  idempotencyKey: string;
  sessionId?: string;
  leadId?: string;
  triggerSource: string;
  message: string;
  execute: (resume: DurableResumeContext) => Promise<T>;
  maxSteps?: number;
}): Promise<DurableAgentResult<T>> {
  const orchestration = getOrchestrationDecision();
  if (orchestration.mode === 'langgraph') {
    throw new Error('LANGGRAPH_ORCHESTRATION_ADAPTER_NOT_SHIPPED');
  }
  if (!orchestration.enabled) {
    logger.warn(`[DurableAgent] Orchestration gate kept TypeScript mode: ${orchestration.reason}`);
  }
  const claim = await agentExecutionRepository.claim({
    tenantId: params.tenantId,
    idempotencyKey: params.idempotencyKey,
    sessionId: params.sessionId,
    leadId: params.leadId,
    triggerSource: params.triggerSource,
    input: { message: params.message.slice(0, 2000) },
    maxSteps: params.maxSteps,
  });
  const execution = claim.execution;

  if (!claim.claimed) {
    if ((execution.status === 'SUCCESS' || execution.status === 'BLOCKED') && execution.output?.result) {
      return {
        runId: execution.id,
        traceId: execution.traceId,
        result: execution.output.result as T,
        guardrail: execution.guardrail as unknown as GuardrailReport,
        resumed: false,
        cached: true,
      };
    }
    throw new Error(`AGENT_EXECUTION_IN_PROGRESS:${execution.id}`);
  }

  const claimToken = execution.claimToken;
  const checkpointRows = await agentExecutionRepository.getSteps(params.tenantId, execution.id);
  const specialistCheckpoint = checkpointRows.find(
    step => step.stepKey === '03_SPECIALIST_PIPELINE' && step.status === 'SUCCESS',
  );
  const resumeContext: DurableResumeContext = {
    executionId: execution.id,
    attempt: execution.attempt,
    completedSteps: checkpointRows.filter(step => step.status === 'SUCCESS' || step.status === 'SKIPPED'),
    specialistOutput: specialistCheckpoint?.output?.specialistOutput,
    runSubagent: async () => {
      throw new Error('DURABLE_SUBAGENT_RUNNER_NOT_INITIALIZED');
    },
  };
  resumeContext.runSubagent = async <T>({ stepKey, specialist, input, execute }: SubagentRequest<T>) => {
    const inputHash = checkpointHash(input);
    const existing = checkpointRows.find(step =>
      step.stepKey === stepKey &&
      step.status === 'SUCCESS' &&
      step.output?.inputHash === inputHash,
    );
    if (existing) return (existing.output?.value ?? existing.output) as T;
    logger.info(`[DurableAgent] subagent replay step=${stepKey} execution=${execution.id}`);
    await agentExecutionRepository.saveStep({
      tenantId: params.tenantId,
      executionId: execution.id,
      claimToken,
      stepKey,
      specialist,
      status: 'RUNNING',
      input: { ...input, inputHash },
    });
    try {
      const startedAt = Date.now();
      const value = await runWithSubagentPolicy(execute);
      await agentExecutionRepository.saveStep({
        tenantId: params.tenantId,
        executionId: execution.id,
        claimToken,
        stepKey,
        specialist,
        status: 'SUCCESS',
        input: { ...input, inputHash },
        output: { value, inputHash },
      });
      logger.info(`[DurableAgent] subagent success step=${stepKey} execution=${execution.id} durationMs=${Date.now() - startedAt}`);
      return value;
    } catch (error: any) {
      logger.warn(`[DurableAgent] subagent failed step=${stepKey} execution=${execution.id} error=${String(error?.message || error)}`);
      await agentExecutionRepository.saveStep({
        tenantId: params.tenantId,
        executionId: execution.id,
        claimToken,
        stepKey,
        specialist,
        status: 'ERROR',
        input: { ...input, inputHash },
        errorText: error?.message || String(error),
      });
      throw error;
    }
  };
  let heartbeatError: Error | null = null;
  const heartbeat = setInterval(() => {
    agentExecutionRepository
      .heartbeat(params.tenantId, execution.id, claimToken)
      .catch((error: any) => {
        heartbeatError = error instanceof Error ? error : new Error(String(error));
      });
  }, 30_000);
  heartbeat.unref?.();
  const assertLease = () => {
    if (heartbeatError) throw heartbeatError;
  };

  try {
  const inputGuardrail = inspectAgentInput(params.message);
  if (!checkpointRows.some(step => step.stepKey === '01_INPUT_GUARDRAIL' && step.status === 'SUCCESS')) {
    await agentExecutionRepository.saveStep({
      tenantId: params.tenantId,
      executionId: execution.id,
      claimToken,
      stepKey: '01_INPUT_GUARDRAIL',
      specialist: 'GUARDRAIL',
      status: inputGuardrail.blocked ? 'BLOCKED' : 'SUCCESS',
      output: inputGuardrail,
    });
  }
  if (inputGuardrail.blocked) {
    const blocked = {
      content: blockedAgentResponse(inputGuardrail.reason),
      suggestedAction: 'NONE',
      escalated: true,
      steps: [],
    } as unknown as T;
    await agentExecutionRepository.finish({
      tenantId: params.tenantId,
      executionId: execution.id,
      claimToken,
      status: 'BLOCKED',
      output: { result: blocked },
      guardrail: inputGuardrail,
    });
    return {
      runId: execution.id,
      traceId: execution.traceId,
      result: blocked,
      guardrail: inputGuardrail,
      resumed: claim.resumed,
      cached: false,
    };
  }

  assertLease();
  if (!checkpointRows.some(step => step.stepKey === '02_SUPERVISOR' && step.status === 'SUCCESS')) {
    await agentExecutionRepository.saveStep({
      tenantId: params.tenantId,
      executionId: execution.id,
      claimToken,
      stepKey: '02_SUPERVISOR',
      specialist: 'SUPERVISOR',
      status: 'SUCCESS',
      output: { decision: 'EXECUTE_EXISTING_PIPELINE', maxSteps: execution.maxSteps },
    });
  }
  if (!specialistCheckpoint) {
    await agentExecutionRepository.saveStep({
      tenantId: params.tenantId,
      executionId: execution.id,
      claimToken,
      stepKey: '03_SPECIALIST_PIPELINE',
      specialist: 'SPECIALIST_PIPELINE',
      status: 'RUNNING',
    });
  }

    const result = await params.execute(resumeContext);
    assertLease();
    const completedSteps = Array.isArray(result.steps) ? result.steps.slice(0, execution.maxSteps) : [];
    await agentExecutionRepository.saveStep({
      tenantId: params.tenantId,
      executionId: execution.id,
      claimToken,
      stepKey: '03_SPECIALIST_PIPELINE',
      specialist: String((result as any).intent || 'SPECIALIST_PIPELINE'),
      status: 'SUCCESS',
      output: {
        specialistOutput: (result as any).specialistOutput,
        specialistSteps: completedSteps.map((step: any) => ({
          agent: step.agent || step.node || step.name || 'unknown',
          status: step.status || 'DONE',
        })),
        confidence: (result as any).confidence,
      },
    });
    for (const [index, step] of completedSteps.entries()) {
      const specialist = String(
        (step as any).agent || (step as any).node || (step as any).name || 'UNKNOWN_SPECIALIST',
      );
      await agentExecutionRepository.saveStep({
        tenantId: params.tenantId,
        executionId: execution.id,
        claimToken,
        stepKey: `03.${String(index + 1).padStart(2, '0')}_${specialist.slice(0, 60)}`,
        specialist,
        status: (step as any).status === 'ERROR' ? 'ERROR' : 'SUCCESS',
        output: {
          status: (step as any).status || 'DONE',
          durationMs: (step as any).durationMs,
        },
        errorText: (step as any).error,
      });
    }

    const outputGuardrail = inspectAgentOutput(result);
    const guardedResult = {
      ...result,
      content: outputGuardrail.blocked
        ? blockedAgentResponse(outputGuardrail.reason)
        : outputGuardrail.sanitizedContent,
      escalated: result.escalated || outputGuardrail.escalate,
      suggestedAction: outputGuardrail.blocked ? 'NONE' : result.suggestedAction,
    } as T;
    await agentExecutionRepository.saveStep({
      tenantId: params.tenantId,
      executionId: execution.id,
      claimToken,
      stepKey: '04_OUTPUT_GUARDRAIL',
      specialist: 'GUARDRAIL',
      status: outputGuardrail.blocked ? 'BLOCKED' : 'SUCCESS',
      output: outputGuardrail,
    });
    await agentExecutionRepository.finish({
      tenantId: params.tenantId,
      executionId: execution.id,
      claimToken,
      status: outputGuardrail.blocked ? 'BLOCKED' : 'SUCCESS',
      output: { result: guardedResult },
      guardrail: outputGuardrail,
    });
    return {
      runId: execution.id,
      traceId: execution.traceId,
      result: guardedResult,
      guardrail: outputGuardrail,
      resumed: claim.resumed,
      cached: false,
    };
  } catch (error: any) {
    const leaseLost = String(error?.message || error).startsWith('AGENT_EXECUTION_LEASE_LOST:');
    if (!leaseLost) {
      await agentExecutionRepository.saveStep({
        tenantId: params.tenantId,
        executionId: execution.id,
        claimToken,
        stepKey: '03_SPECIALIST_PIPELINE',
        specialist: 'SPECIALIST_PIPELINE',
        status: 'ERROR',
        errorText: error?.message || String(error),
      }).catch(() => {});
      await agentExecutionRepository.finish({
        tenantId: params.tenantId,
        executionId: execution.id,
        claimToken,
        status: 'ERROR',
        errorText: error?.message || String(error),
      }).catch(() => {});
    }
    logger.error(`[DurableAgent] execution ${execution.id} failed:`, error);
    throw error;
  } finally {
    clearInterval(heartbeat);
  }
}