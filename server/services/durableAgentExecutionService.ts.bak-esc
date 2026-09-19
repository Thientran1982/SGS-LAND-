import { logger } from '../middleware/logger';
import { createHash } from 'crypto';
import { agentExecutionRepository } from '../repositories/agentExecutionRepository';
import type { AgentExecutionStepRecord } from '../repositories/agentExecutionRepository';
import {
  blockedAgentResponse,
  inspectAgentEnvelope,
  inspectAgentOutput,
  type GuardrailReport,
} from '../ai/agentGuardrails';
import { getOrchestrationDecision } from './orchestrationMode';
import { runWithSubagentPolicy } from './subagentPolicy';
import { approvalRequestRepository, type HighImpactAction } from '../repositories/approvalRequestRepository';
import { agentOperatingRepository } from '../repositories/agentOperatingRepository';

export interface DurableAgentResult<T> {
  runId: string;
  traceId: string;
  result: T;
  guardrail: GuardrailReport;
  resumed: boolean;
  cached: boolean;
  timings?: DurableAgentTimings;
  approvalRequestId?: string;
}

export interface DurableAgentTimings {
  /** Time spent in agent_execution claim/checkpoint/lease/finalize queries. */
  agentExecutionDbMs: number;
  /** Input/output guardrail inspection and persistence preparation time. */
  guardrailMs: number;
}

export type DurableAgentRunEvent =
  | {
      type: "agent_run_started";
      leadId: string;
      runId: string;
      inboundInteractionId: string;
    }
  | {
      type: "agent_run_progress";
      leadId: string;
      runId: string;
      inboundInteractionId: string;
      phase: "classify" | "retrieve" | "specialist" | "compose" | "guardrail";
      elapsedMs: number;
    }
  | {
      type: "agent_run_finished";
      leadId: string;
      runId: string;
      inboundInteractionId: string;
      status: "SUCCESS" | "FAILED" | "BLOCKED";
    };

let durableAgentRunEventSink: ((event: DurableAgentRunEvent) => void) | null = null;

export function setDurableAgentRunEventSink(
  sink: ((event: DurableAgentRunEvent) => void) | null,
): void {
  durableAgentRunEventSink = sink;
}

function emitRunEvent(
  event: DurableAgentRunEvent,
): void {
  try {
    durableAgentRunEventSink?.(event);
  } catch (error: any) {
    logger.warn(`[DurableAgent] lifecycle event skipped: ${error?.message || error}`);
  }
}

export interface DurableResumeContext {
  executionId: string;
  attempt: number;
  completedSteps: AgentExecutionStepRecord[];
  specialistOutput?: unknown;
  planHash?: string;
  checkpointPlan: (plan: unknown, input: Record<string, any>) => Promise<{ compatible: boolean; specialistOutput?: unknown }>;
  checkpointSpecialistOutput: (output: unknown) => Promise<void>;
  runSubagent: <T>(params: SubagentRequest<T>) => Promise<T>;
}

interface SubagentRequest<T> {
  stepKey: string;
  specialist: string;
  input: Record<string, any>;
  execute: () => Promise<T>;
}

function stableSerialize(value: any): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(',')}}`;
}

export function checkpointHash(input: unknown): string {
  return createHash('sha256').update(stableSerialize(input)).digest('hex');
}

async function waitForTerminalExecution(
  tenantId: string,
  executionId: string,
  timeoutMs = 30_000,
  pollMs = 250,
  repository: typeof agentExecutionRepository = agentExecutionRepository,
): Promise<Awaited<ReturnType<typeof agentExecutionRepository.get>> | null> {
  const deadline = Date.now() + timeoutMs;
  let latest = await repository.get(tenantId, executionId);
  while (latest && latest.status === 'RUNNING' && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, pollMs));
    latest = await repository.get(tenantId, executionId);
  }
  return latest;
}

export async function runDurableAgentExecution<T extends {
  content?: string;
  suggestedAction?: string | null;
  sources?: unknown[];
  artifact?: unknown;
  steps?: Array<Record<string, any>>;
  escalated?: boolean;
  longForm?: boolean;
}>(params: {
  tenantId: string;
  idempotencyKey: string;
  sessionId?: string;
  leadId?: string;
  inboundInteractionId?: string;
  triggerSource: string;
  message: string;
  input?: Record<string, any>;
  execute: (resume: DurableResumeContext) => Promise<T>;
  maxSteps?: number;
  approval?: (result: T) => {
    leadId: string;
    actionType: HighImpactAction;
    payload: Record<string, any>;
    stepKey?: string;
    idempotencyKey?: string;
  } | undefined;
}): Promise<DurableAgentResult<T>> {
  const durableTimings: DurableAgentTimings = {
    agentExecutionDbMs: 0,
    guardrailMs: 0,
  };
  const timedRepository = new Proxy(agentExecutionRepository, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== 'function') return value;
      return async (...args: any[]) => {
        const startedAt = Date.now();
        try {
          return await value.apply(target, args);
        } finally {
          durableTimings.agentExecutionDbMs += Math.max(0, Date.now() - startedAt);
        }
      };
    },
  }) as typeof agentExecutionRepository;
  const orchestration = getOrchestrationDecision();
  logger.info(`[DurableAgent] orchestration mode=${orchestration.mode} enabled=${orchestration.enabled}`);
  if (!orchestration.enabled) {
    logger.warn(`[DurableAgent] Orchestration gate kept TypeScript mode: ${orchestration.reason}`);
  }
  const claim = await timedRepository.claim({
    tenantId: params.tenantId,
    idempotencyKey: params.idempotencyKey,
    sessionId: params.sessionId,
    leadId: params.leadId,
    triggerSource: params.triggerSource,
    input: {
      message: params.message.slice(0, 2000),
      ...(params.input || {}),
    },
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
        timings: durableTimings,
      };
    }
    if (execution.status === 'RUNNING') {
      const terminal = await waitForTerminalExecution(params.tenantId, execution.id, 30_000, 250, timedRepository);
      if (terminal && (terminal.status === 'SUCCESS' || terminal.status === 'BLOCKED') && terminal.output?.result) {
        return {
          runId: terminal.id,
          traceId: terminal.traceId,
          result: terminal.output.result as T,
          guardrail: terminal.guardrail as unknown as GuardrailReport,
          resumed: false,
          cached: true,
          timings: durableTimings,
        };
      }
    }
    throw new Error(`AGENT_EXECUTION_IN_PROGRESS:${execution.id}`);
  }

  const claimToken = execution.claimToken;
  const runStartedAt = Date.now();
  const inboundInteractionId = String(params.inboundInteractionId || "");
  const emitProgress = (
    phase: "classify" | "retrieve" | "specialist" | "compose" | "guardrail",
  ) => {
    if (!params.leadId || !inboundInteractionId) return;
    emitRunEvent({
      type: "agent_run_progress",
      leadId: params.leadId,
      runId: execution.id,
      inboundInteractionId,
      phase,
      elapsedMs: Date.now() - runStartedAt,
    });
  };
  let finishedEventEmitted = false;
  const emitFinished = (status: "SUCCESS" | "FAILED" | "BLOCKED") => {
    if (finishedEventEmitted || !params.leadId || !inboundInteractionId) return;
    finishedEventEmitted = true;
    emitRunEvent({
      type: "agent_run_finished",
      leadId: params.leadId,
      runId: execution.id,
      inboundInteractionId,
      status,
    });
  };
  if (params.leadId && inboundInteractionId) {
    emitRunEvent({
      type: "agent_run_started",
      leadId: params.leadId,
      runId: execution.id,
      inboundInteractionId,
    });
  }
  let checkpointRows: Awaited<ReturnType<typeof agentExecutionRepository.getSteps>>;
  try {
    checkpointRows = await timedRepository.getSteps(params.tenantId, execution.id);
  } catch (error) {
    emitFinished("FAILED");
    throw error;
  }
  const resumeContext: DurableResumeContext = {
    executionId: execution.id,
    attempt: execution.attempt,
    completedSteps: checkpointRows.filter(step => step.status === 'SUCCESS' || step.status === 'SKIPPED'),
    specialistOutput: undefined,
    planHash: undefined,
    checkpointPlan: async () => ({ compatible: false }),
    checkpointSpecialistOutput: async () => {},
    runSubagent: async () => {
      throw new Error('DURABLE_SUBAGENT_RUNNER_NOT_INITIALIZED');
    },
  };
  let specialistCheckpointCommitted = false;
  resumeContext.checkpointPlan = async (plan: unknown, input: Record<string, any>) => {
    const inputHash = checkpointHash(input);
    const planHash = checkpointHash(plan);
    const savedPlan = checkpointRows.find(step =>
      step.stepKey === '03_SPECIALIST_PLAN' &&
      step.status === 'SUCCESS' &&
      step.output?.inputHash === inputHash &&
      step.output?.planHash === planHash,
    );
    if (!savedPlan) {
      await timedRepository.saveStep({
        tenantId: params.tenantId,
        executionId: execution.id,
        claimToken,
        stepKey: '03_SPECIALIST_PLAN',
        specialist: 'SUPERVISOR',
        status: 'SUCCESS',
        input: { ...input, inputHash },
        output: { plan, inputHash, planHash },
      });
      resumeContext.planHash = planHash;
      resumeContext.specialistOutput = undefined;
      return { compatible: false };
    }
    const specialistCheckpoint = checkpointRows.find(step =>
      step.stepKey === '03_SPECIALIST_PIPELINE' &&
      step.status === 'SUCCESS' &&
      step.output?.planHash === planHash &&
      step.output?.inputHash === inputHash,
    );
    resumeContext.planHash = planHash;
    resumeContext.specialistOutput = specialistCheckpoint?.output?.specialistOutput;
    return { compatible: Boolean(specialistCheckpoint), specialistOutput: resumeContext.specialistOutput };
  };
  resumeContext.checkpointSpecialistOutput = async (output: unknown) => {
    const specialistGuardrail = inspectAgentOutput({
      content: JSON.stringify(output),
      sources: [{ source: 'durable-specialist-checkpoint' }],
    });
    if (specialistGuardrail.blocked) {
      throw new Error(`SPECIALIST_OUTPUT_BLOCKED:${specialistGuardrail.reason || 'guardrail'}`);
    }
    const outputHash = checkpointHash(output);
    await timedRepository.saveStep({
      tenantId: params.tenantId,
      executionId: execution.id,
      claimToken,
      stepKey: '03_SPECIALIST_PIPELINE',
      specialist: 'SPECIALIST_PIPELINE',
      status: 'SUCCESS',
      input: { inputHash: checkpointHash({ message: params.message.slice(0, 2000) }) },
      output: {
        specialistOutput: output,
        inputHash: checkpointHash({ message: params.message.slice(0, 2000) }),
        planHash: resumeContext.planHash || null,
        outputHash,
        guardrailChecked: true,
        guardrail: specialistGuardrail,
      },
    });
    specialistCheckpointCommitted = true;
  };
  resumeContext.runSubagent = async <T>({ stepKey, specialist, input, execute }: SubagentRequest<T>) => {
    const inputHash = checkpointHash({ planHash: resumeContext.planHash || null, input });
    const existing = checkpointRows.find(step =>
      step.stepKey === stepKey &&
      step.status === 'SUCCESS' &&
      step.output?.inputHash === inputHash,
    );
    if (existing) return (existing.output?.value ?? existing.output) as T;
    logger.info(`[DurableAgent] subagent replay step=${stepKey} execution=${execution.id}`);
    await timedRepository.saveStep({
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
      await timedRepository.saveStep({
        tenantId: params.tenantId,
        executionId: execution.id,
        claimToken,
        stepKey,
        specialist,
        status: 'SUCCESS',
        input: { ...input, inputHash },
        output: {
          value,
          inputHash,
          planHash: resumeContext.planHash || null,
          outputHash: checkpointHash(value),
        },
      });
      logger.info(`[DurableAgent] subagent success step=${stepKey} execution=${execution.id} durationMs=${Date.now() - startedAt}`);
      return value;
    } catch (error: any) {
      logger.warn(`[DurableAgent] subagent failed step=${stepKey} execution=${execution.id} error=${String(error?.message || error)}`);
      await timedRepository.saveStep({
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
    timedRepository
      .heartbeat(params.tenantId, execution.id, claimToken)
      .catch((error: any) => {
        const err = error instanceof Error ? error : new Error(String(error));
        if (err.message.startsWith('AGENT_EXECUTION_LEASE_LOST:')) {
          heartbeatError = err;
        } else {
          // Transient DB/network hiccups should not abort an otherwise
          // healthy run; only a confirmed lease loss is fatal. The next
          // heartbeat tick will retry.
          logger.warn(`[DurableAgent] heartbeat error (non-fatal) execution=${execution.id} error=${err.message}`);
        }
      });
  }, 30_000);
  heartbeat.unref?.();
  const assertLease = () => {
    if (heartbeatError) throw heartbeatError;
  };

  try {
  const inputGuardrailStartedAt = Date.now();
  const inputGuardrail = inspectAgentEnvelope(params.message, params.input || {});
  durableTimings.guardrailMs += Math.max(0, Date.now() - inputGuardrailStartedAt);
  if (!checkpointRows.some(step => step.stepKey === '01_INPUT_GUARDRAIL' && step.status === 'SUCCESS')) {
    await timedRepository.saveStep({
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
    await timedRepository.finish({
      tenantId: params.tenantId,
      executionId: execution.id,
      claimToken,
      status: 'BLOCKED',
      output: { result: blocked },
      guardrail: inputGuardrail,
    });
    emitProgress("guardrail");
    emitFinished("BLOCKED");
    return {
      runId: execution.id,
      traceId: execution.traceId,
      result: blocked,
      guardrail: inputGuardrail,
      resumed: claim.resumed,
      cached: false,
      timings: durableTimings,
    };
  }
  emitProgress("classify");

  assertLease();
  if (!checkpointRows.some(step => step.stepKey === '02_SUPERVISOR' && step.status === 'SUCCESS')) {
    await timedRepository.saveStep({
      tenantId: params.tenantId,
      executionId: execution.id,
      claimToken,
      stepKey: '02_SUPERVISOR',
      specialist: 'SUPERVISOR',
      status: 'SUCCESS',
      output: { decision: 'EXECUTE_EXISTING_PIPELINE', maxSteps: execution.maxSteps },
    });
  }
  emitProgress("retrieve");
  if (!checkpointRows.some(step => step.stepKey === '03_SPECIALIST_PIPELINE' && step.status === 'SUCCESS')) {
    await timedRepository.saveStep({
      tenantId: params.tenantId,
      executionId: execution.id,
      claimToken,
      stepKey: '03_SPECIALIST_PIPELINE',
      specialist: 'SPECIALIST_PIPELINE',
      status: 'RUNNING',
    });
  }
  emitProgress("specialist");

    // The gate is intentionally observed, but no LangGraph runtime is linked
    // until the exit criteria in the decision record are met.
    const result = await params.execute(resumeContext);
    assertLease();
    emitProgress("compose");
    const completedSteps = Array.isArray(result.steps) ? result.steps.slice(0, execution.maxSteps) : [];
    await timedRepository.saveStep({
      tenantId: params.tenantId,
      executionId: execution.id,
      claimToken,
      stepKey: '03_SPECIALIST_PIPELINE',
      specialist: String((result as any).intent || 'SPECIALIST_PIPELINE'),
      status: 'SUCCESS',
      output: {
        specialistOutput: (result as any).specialistOutput,
        inputHash: checkpointHash({ message: params.message.slice(0, 2000) }),
        planHash: resumeContext.planHash || null,
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
      await timedRepository.saveStep({
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

    const outputGuardrailStartedAt = Date.now();
    const outputGuardrail = inspectAgentOutput(result);
    durableTimings.guardrailMs += Math.max(0, Date.now() - outputGuardrailStartedAt);
    const guardedResult = {
      ...result,
      content: outputGuardrail.blocked
        ? blockedAgentResponse(outputGuardrail.reason)
        : outputGuardrail.sanitizedContent,
      escalated: result.escalated || outputGuardrail.escalate,
      suggestedAction: outputGuardrail.blocked ? 'NONE' : result.suggestedAction,
    } as T;
    await timedRepository.saveStep({
      tenantId: params.tenantId,
      executionId: execution.id,
      claimToken,
      stepKey: '04_OUTPUT_GUARDRAIL',
      specialist: 'GUARDRAIL',
      status: outputGuardrail.blocked ? 'BLOCKED' : 'SUCCESS',
      output: outputGuardrail,
    });
    emitProgress("guardrail");
    if ((guardedResult as any).escalated) {
      // Surface the escalation to a human reviewer without affecting the
      // customer-facing response path; failures here are logged, not thrown.
      try {
        await agentOperatingRepository.createHumanQuestion(params.tenantId, {
          agentKey: 'MINH',
          question: `Minh đã escalate một phản hồi cần con người xác minh (session=${params.sessionId || 'n/a'}).`,
          leadId: params.leadId,
          priority: 70,
          context: {
            executionId: execution.id,
            traceId: execution.traceId,
            reason: outputGuardrail.reason || 'UNSUPPORTED_SENSITIVE_CLAIM',
            flags: outputGuardrail.flags,
          },
        });
      } catch (escalationError: any) {
        logger.warn(`[DurableAgent] escalation human-question skipped execution=${execution.id}: ${escalationError?.message || escalationError}`);
      }
    }
    const approvalSpec = params.approval?.(guardedResult);
    if (approvalSpec && !outputGuardrail.blocked) {
      const approval = await approvalRequestRepository.create({
        tenantId: params.tenantId,
        leadId: approvalSpec.leadId,
        actionType: approvalSpec.actionType,
        payload: approvalSpec.payload,
        executionId: execution.id,
        stepKey: approvalSpec.stepKey || '05_APPROVAL_INTERRUPT',
        idempotencyKey: approvalSpec.idempotencyKey || `${execution.id}:${approvalSpec.actionType}`,
      });
      await timedRepository.saveStep({
        tenantId: params.tenantId,
        executionId: execution.id,
        claimToken,
        stepKey: approvalSpec.stepKey || '05_APPROVAL_INTERRUPT',
        specialist: 'APPROVAL_BROKER',
        status: 'BLOCKED',
        output: { approvalRequestId: approval.id, actionType: approvalSpec.actionType },
      });
      await timedRepository.pauseForApproval({
        tenantId: params.tenantId,
        executionId: execution.id,
        claimToken,
        approvalRequestId: approval.id,
        stepKey: approvalSpec.stepKey || '05_APPROVAL_INTERRUPT',
      });
      emitFinished("BLOCKED");
      return {
        runId: execution.id,
        traceId: execution.traceId,
        result: guardedResult,
        guardrail: outputGuardrail,
        resumed: claim.resumed,
        cached: false,
        timings: durableTimings,
        approvalRequestId: approval.id,
      };
    }
    await timedRepository.finish({
      tenantId: params.tenantId,
      executionId: execution.id,
      claimToken,
      status: outputGuardrail.blocked ? 'BLOCKED' : 'SUCCESS',
      output: { result: guardedResult },
      guardrail: outputGuardrail,
    });
    emitFinished(outputGuardrail.blocked ? "BLOCKED" : "SUCCESS");
    return {
      runId: execution.id,
      traceId: execution.traceId,
      result: guardedResult,
      guardrail: outputGuardrail,
      resumed: claim.resumed,
      cached: false,
      timings: durableTimings,
    };
  } catch (error: any) {
    const leaseLost = String(error?.message || error).startsWith('AGENT_EXECUTION_LEASE_LOST:');
    if (!leaseLost && !specialistCheckpointCommitted) {
      await timedRepository.saveStep({
        tenantId: params.tenantId,
        executionId: execution.id,
        claimToken,
        stepKey: '03_SPECIALIST_PIPELINE',
        specialist: 'SPECIALIST_PIPELINE',
        status: 'ERROR',
        errorText: error?.message || String(error),
      }).catch(() => {});
    }
    if (!leaseLost) {
      await timedRepository.finish({
        tenantId: params.tenantId,
        executionId: execution.id,
        claimToken,
        status: 'ERROR',
        errorText: error?.message || String(error),
      }).catch(() => {});
    }
    emitFinished("FAILED");
    logger.error(`[DurableAgent] execution ${execution.id} failed:`, error);
    throw error;
  } finally {
    clearInterval(heartbeat);
  }
}