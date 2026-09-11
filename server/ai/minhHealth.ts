import { pool } from '../db';
import { getBudgetStatus } from './minhBrain';
import { getMinhCalibrationPromptLine } from '../services/minhCalibrationService';
import { getOrchestrationDecision } from '../services/orchestrationMode';

export type MinhBrainHealth = {
  tenantId: string;
  mode: string;
  budget: { used: number; budget: number; exceeded: boolean };
  calibration: string;
  delegations7d: number;
  delegationSuccess7d: number;
  capabilityGaps7d: number;
  sloBreaches24h: number;
  byIntent: Array<{ intent: string; count: number }>;
};

export async function getMinhBrainHealth(tenantId: string): Promise<MinhBrainHealth> {
  const budget = await getBudgetStatus(tenantId);
  const calibration = await getMinhCalibrationPromptLine(tenantId);
  const mode = getOrchestrationDecision();
  const res = await pool.query(
    "SELECT count(*)::int AS total, sum(CASE WHEN payload::jsonb->>'correct' = 'true' THEN 1 ELSE 0 END)::int AS correct FROM agent_signals WHERE tenant_id=$1 AND signal_type='minh_delegation_result' AND created_at > NOW() - INTERVAL '7 days'",
    [tenantId],
  );
  const byIntent = await pool.query(
    "SELECT payload::jsonb->>'intent' AS intent, count(*)::int AS c FROM agent_signals WHERE tenant_id=$1 AND signal_type='minh_delegation' AND created_at > NOW() - INTERVAL '7 days' GROUP BY 1 ORDER BY c DESC",
    [tenantId],
  );
  const gaps = await pool.query(
    "SELECT count(*)::int AS c FROM agent_signals WHERE tenant_id=$1 AND signal_type='minh_capability_gap' AND created_at > NOW() - INTERVAL '7 days'",
    [tenantId],
  );
  const slo = await pool.query(
    "SELECT count(*)::int AS c FROM agent_signals WHERE tenant_id=$1 AND signal_type='latency_slo_breach' AND created_at > NOW() - INTERVAL '24 hours'",
    [tenantId],
  );
  return {
    tenantId,
    mode: mode.mode,
    budget,
    calibration,
    delegations7d: Number(res.rows[0]?.total || 0),
    delegationSuccess7d: Number(res.rows[0]?.correct || 0),
    capabilityGaps7d: Number(gaps.rows[0]?.c || 0),
    sloBreaches24h: Number(slo.rows[0]?.c || 0),
    byIntent: byIntent.rows.map(row => ({ intent: String(row.intent), count: Number(row.c) })),
  };
}
