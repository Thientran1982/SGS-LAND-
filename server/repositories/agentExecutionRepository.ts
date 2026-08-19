import { withTenantContext } from '../db';

export type AgentExecutionStatus = 'RUNNING' | 'SUCCESS' | 'ERROR' | 'BLOCKED';
export type AgentExecutionStepStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'ERROR' | 'SKIPPED' | 'BLOCKED';

export interface AgentExecution {
  id: string;
  tenantId: string;
  idempotencyKey: string;
  sessionId: string | null;
  leadId: string | null;
  status: AgentExecutionStatus;
  currentStep: string;
  attempt: number;
  maxSteps: number;
  traceId: string;
  input: Record<string, any>;
  output: Record<string, any> | null;
  guardrail: Record<string, any>;
  errorText: string | null;
  leaseExpiresAt: string;
  claimToken: string;
}

export interface ClaimExecutionResult {
  execution: AgentExecution;
  claimed: boolean;
  resumed: boolean;
}

function mapExecution(row: any): AgentExecution {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    idempotencyKey: row.idempotency_key,
    sessionId: row.session_id,
    leadId: row.lead_id,
    status: row.status,
    currentStep: row.current_step,
    attempt: row.attempt,
    maxSteps: row.max_steps,
    traceId: row.trace_id,
    input: row.input_json || {},
    output: row.output_json || null,
    guardrail: row.guardrail_json || {},
    errorText: row.error_text,
    leaseExpiresAt: row.lease_expires_at,
    claimToken: row.claim_token,
  };
}

export function canClaimExecution(status: AgentExecutionStatus, leaseExpired: boolean): boolean {
  return status === 'ERROR' || (status === 'RUNNING' && leaseExpired);
}

class AgentExecutionRepository {
  async claim(params: {
    tenantId: string;
    idempotencyKey: string;
    sessionId?: string;
    leadId?: string;
    agentName?: string;
    triggerSource: string;
    input?: Record<string, any>;
    maxSteps?: number;
  }): Promise<ClaimExecutionResult> {
    return withTenantContext(params.tenantId, async client => {
      const inserted = await client.query(
        `INSERT INTO agent_executions
          (tenant_id, idempotency_key, session_id, lead_id, agent_name, trigger_source, input_json, max_steps)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)
         ON CONFLICT (tenant_id, idempotency_key) DO NOTHING
         RETURNING *`,
        [
          params.tenantId,
          params.idempotencyKey,
          params.sessionId || null,
          params.leadId || null,
          params.agentName || 'SGS_AGENT',
          params.triggerSource,
          JSON.stringify(params.input || {}),
          Math.max(1, Math.min(params.maxSteps || 6, 12)),
        ],
      );
      if (inserted.rows[0]) {
        return { execution: mapExecution(inserted.rows[0]), claimed: true, resumed: false };
      }

      const existingResult = await client.query(
        `SELECT * FROM agent_executions
          WHERE tenant_id = $1 AND idempotency_key = $2
          FOR UPDATE`,
        [params.tenantId, params.idempotencyKey],
      );
      const existing = existingResult.rows[0];
      if (!existing) throw new Error('Agent execution disappeared during claim');
      const leaseExpired = new Date(existing.lease_expires_at).getTime() <= Date.now();
      if (!canClaimExecution(existing.status, leaseExpired)) {
        return { execution: mapExecution(existing), claimed: false, resumed: false };
      }

      const resumed = await client.query(
        `UPDATE agent_executions
            SET status = 'RUNNING',
                current_step = 'SUPERVISOR',
                attempt = attempt + 1,
                claim_token = gen_random_uuid(),
                error_text = NULL,
                lease_expires_at = NOW() + INTERVAL '2 minutes',
                updated_at = NOW()
          WHERE id = $1 AND tenant_id = $2
          RETURNING *`,
        [existing.id, params.tenantId],
      );
      return { execution: mapExecution(resumed.rows[0]), claimed: true, resumed: true };
    });
  }

  async saveStep(params: {
    tenantId: string;
    executionId: string;
    stepKey: string;
    specialist: string;
    status: AgentExecutionStepStatus;
    claimToken: string;
    input?: Record<string, any>;
    output?: Record<string, any>;
    errorText?: string;
  }): Promise<void> {
    await withTenantContext(params.tenantId, async client => {
      const fenced = await client.query(
        `UPDATE agent_executions
            SET current_step = $3,
                lease_expires_at = NOW() + INTERVAL '2 minutes',
                updated_at = NOW()
          WHERE id = $1
            AND tenant_id = $2
            AND claim_token = $4
            AND status = 'RUNNING'
          RETURNING id`,
        [params.executionId, params.tenantId, params.stepKey, params.claimToken],
      );
      if ((fenced.rowCount ?? 0) !== 1) {
        throw new Error(`AGENT_EXECUTION_LEASE_LOST:${params.executionId}`);
      }
      await client.query(
        `INSERT INTO agent_execution_steps
          (tenant_id, execution_id, step_key, specialist, status, input_json, output_json, error_text, finished_at)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,
                 CASE WHEN $5 IN ('SUCCESS','ERROR','SKIPPED','BLOCKED') THEN NOW() ELSE NULL END)
         ON CONFLICT (execution_id, step_key) DO UPDATE
           SET specialist = EXCLUDED.specialist,
               status = EXCLUDED.status,
               attempt = agent_execution_steps.attempt + CASE WHEN EXCLUDED.status = 'RUNNING' THEN 1 ELSE 0 END,
               input_json = EXCLUDED.input_json,
               output_json = EXCLUDED.output_json,
               error_text = EXCLUDED.error_text,
               finished_at = EXCLUDED.finished_at,
               updated_at = NOW()`,
        [
          params.tenantId,
          params.executionId,
          params.stepKey,
          params.specialist,
          params.status,
          JSON.stringify(params.input || {}),
          params.output ? JSON.stringify(params.output) : null,
          params.errorText?.slice(0, 4000) || null,
        ],
      );
    });
  }

  async finish(params: {
    tenantId: string;
    executionId: string;
    status: AgentExecutionStatus;
    claimToken: string;
    output?: Record<string, any>;
    guardrail?: Record<string, any>;
    errorText?: string;
  }): Promise<void> {
    await withTenantContext(params.tenantId, async client => {
      const result = await client.query(
      `UPDATE agent_executions
          SET status = $3,
              current_step = 'END',
              output_json = $4::jsonb,
              guardrail_json = $5::jsonb,
              error_text = $6,
              finished_at = NOW(),
              lease_expires_at = NOW(),
              updated_at = NOW()
        WHERE id = $1
          AND tenant_id = $2
          AND claim_token = $7
          AND status = 'RUNNING'`,
      [
        params.executionId,
        params.tenantId,
        params.status,
        params.output ? JSON.stringify(params.output) : null,
        JSON.stringify(params.guardrail || {}),
        params.errorText?.slice(0, 4000) || null,
        params.claimToken,
      ],
      );
      if ((result.rowCount ?? 0) !== 1) {
        throw new Error(`AGENT_EXECUTION_LEASE_LOST:${params.executionId}`);
      }
    });
  }

  async heartbeat(tenantId: string, executionId: string, claimToken: string): Promise<void> {
    await withTenantContext(tenantId, async client => {
      const result = await client.query(
        `UPDATE agent_executions
            SET lease_expires_at = NOW() + INTERVAL '2 minutes',
                updated_at = NOW()
          WHERE id = $1
            AND tenant_id = $2
            AND claim_token = $3
            AND status = 'RUNNING'`,
        [executionId, tenantId, claimToken],
      );
      if ((result.rowCount ?? 0) !== 1) {
        throw new Error(`AGENT_EXECUTION_LEASE_LOST:${executionId}`);
      }
    });
  }

  async get(tenantId: string, executionId: string): Promise<AgentExecution | null> {
    return withTenantContext(tenantId, async client => {
      const result = await client.query(
        `SELECT * FROM agent_executions WHERE id = $1 AND tenant_id = $2`,
        [executionId, tenantId],
      );
      return result.rows[0] ? mapExecution(result.rows[0]) : null;
    });
  }
}

export const agentExecutionRepository = new AgentExecutionRepository();