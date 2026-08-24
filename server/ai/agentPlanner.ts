import { shouldRetryAfterFailure } from './agentOperatingContracts';

export type PlanStep = { id: string; title: string; status: 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED' | 'ESCALATED'; attempts: number };

export function nextPlanAction(step: Pick<PlanStep, 'attempts' | 'status'>): 'RUN' | 'REPLAN' | 'ESCALATE' | 'DONE' {
  if (step.status === 'DONE') return 'DONE';
  if (step.status === 'FAILED') return shouldRetryAfterFailure(step.attempts) === 'ESCALATE' ? 'ESCALATE' : 'REPLAN';
  return 'RUN';
}