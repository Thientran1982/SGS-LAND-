/**
 * agentRunsService.ts
 *
 * Unified audit trail for background agents/crons. Wrap any agent handler
 * with `recordAgentRun(pool, name, fn, { triggerSource })` to get an INSERT
 * row at start (status='running') and an UPDATE at end (status='success'
 * | 'error' | 'skipped' with summary_json / error_text / duration_ms).
 *
 * Failures inside the audit layer must NEVER break the agent — every DB
 * write is wrapped in try/catch and logged via `logger.warn`.
 */
import type { Pool } from 'pg';
import { logger } from '../middleware/logger';
export type AgentRunStatus = 'success' | 'error' | 'skipped';
export interface AgentRunResult<T> {
  status: AgentRunStatus;
  summary?: Record<string, any>;
  result?: T;
}
export interface RecordAgentRunOpts {
  /** Where the run was triggered from (qstash, in_process, manual_admin, manual_cli, ...) */
  triggerSource?: string;
}
export async function startAgentRun(
  pool: Pool,
  agentName: string,
  triggerSource: string,
): Promise<string | null> {
  try {
    const r = await pool.query<{ id: string }>(
      `INSERT INTO agent_runs (agent_name, trigger_source, status)
       VALUES ($1, $2, 'running')
       RETURNING id`,
      [agentName, triggerSource],
    );
    return r.rows[0]?.id ?? null;
  } catch (err: any) {
    logger.warn(`[agent_runs] startRun failed for ${agentName}: ${err?.message || err}`);
    return null;
  }
}
export async function finishAgentRun(
  pool: Pool,
  runId: string | null,
  status: AgentRunStatus,
  summary: Record<string, any> | undefined,
  errorText: string | null,
  startedMs: number,
): Promise<void> {
  if (!runId) return;
  const durationMs = Date.now() - startedMs;
  try {
    await pool.query(
      `UPDATE agent_runs
          SET status       = $2,
              finished_at  = NOW(),
              duration_ms  = $3,
              summary_json = $4::jsonb,
              error_text   = $5
        WHERE id = $1`,
      [runId, status, durationMs, JSON.stringify(summary || {}), errorText],
    );
  } catch (err: any) {
    logger.warn(`[agent_runs] finishRun failed (${runId}): ${err?.message || err}`);
  }
}
/**
 * Wrap an async agent handler with an `agent_runs` audit row.
 *
 * The handler may either:
 *  - return a plain value `T` → recorded as status='success' with empty summary
 *  - return `{ status, summary, result }` → recorded with explicit status & summary
 *  - throw → recorded as status='error' with err.message and re-thrown
 *
 * @returns the unwrapped `T` (or `undefined` when the handler returned only
 *          status/summary). The caller can therefore await the same value
 *          they would have awaited from the original handler.
 */
export async function recordAgentRun<T>(
  pool: Pool,
  agentName: string,
  fn: () => Promise<T | AgentRunResult<T>>,
  opts: RecordAgentRunOpts = {},
): Promise<T | undefined> {
  const triggerSource = opts.triggerSource || 'unknown';
  const startedMs = Date.now();
  const runId = await startAgentRun(pool, agentName, triggerSource);
  try {
    const out = await fn();

    if (
      out &&
      typeof out === 'object' &&
      'status' in (out as any) &&
      ((out as any).status === 'success' ||
        (out as any).status === 'error' ||
        (out as any).status === 'skipped')
    ) {
      const r = out as AgentRunResult<T>;
      await finishAgentRun(pool, runId, r.status, r.summary, null, startedMs);
      return r.result;
    }
    await finishAgentRun(pool, runId, 'success', {}, null, startedMs);
    return out as T;
  } catch (err: any) {
    const msg = err?.message || String(err);
    await finishAgentRun(pool, runId, 'error', {}, msg.slice(0, 4000), startedMs);
    throw err;
  }
}