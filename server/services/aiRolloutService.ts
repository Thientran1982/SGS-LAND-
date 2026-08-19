import { createHash } from 'crypto';
import { withTenantContext } from '../db';

export type RolloutDecision = {
  mode: 'baseline' | 'candidate' | 'shadow';
  rolloutId?: string;
  reason: string;
};

export function deterministicBucket(subject: string): number {
  const hex = createHash('sha256').update(subject).digest('hex').slice(0, 8);
  return parseInt(hex, 16) % 100;
}

export function decideRollout(params: {
  rollout: any;
  subject: string;
  killSwitch?: boolean;
}): RolloutDecision {
  if (!params.rollout || params.killSwitch || params.rollout.status === 'KILLED' || params.rollout.status === 'ROLLED_BACK') {
    return { mode: 'baseline', reason: params.killSwitch ? 'kill_switch' : 'no_active_candidate' };
  }
  const bucket = deterministicBucket(`${params.rollout.id}:${params.subject}`);
  if (params.rollout.shadowEnabled && params.rollout.status === 'SHADOW') {
    return { mode: 'shadow', rolloutId: params.rollout.id, reason: 'shadow_cohort' };
  }
  if (params.rollout.status === 'CANARY' && bucket < Number(params.rollout.canaryPercent || 0)) {
    return { mode: 'candidate', rolloutId: params.rollout.id, reason: 'canary_cohort' };
  }
  if (params.rollout.status === 'ACTIVE') {
    return { mode: 'candidate', rolloutId: params.rollout.id, reason: 'active_rollout' };
  }
  return { mode: 'baseline', rolloutId: params.rollout.id, reason: 'outside_canary' };
}

export const aiRolloutService = {
  async getActive(tenantId: string, agentKey: string): Promise<any | null> {
    return withTenantContext(tenantId, async client => {
      const result = await client.query(
        `SELECT * FROM ai_rollouts
          WHERE tenant_id=$1 AND agent_key=$2 AND status IN ('SHADOW','CANARY','ACTIVE')
          ORDER BY updated_at DESC LIMIT 1`,
        [tenantId, agentKey],
      );
      return result.rows[0] || null;
    });
  },

  async kill(tenantId: string, rolloutId: string, reason: string): Promise<any | null> {
    return withTenantContext(tenantId, async client => {
      const result = await client.query(
        `UPDATE ai_rollouts SET status='KILLED', rollback_reason=$3, updated_at=NOW()
          WHERE tenant_id=$1 AND id=$2 AND status IN ('SHADOW','CANARY','ACTIVE')
          RETURNING *`,
        [tenantId, rolloutId, reason.slice(0, 500)],
      );
      return result.rows[0] || null;
    });
  },

  async rollback(tenantId: string, rolloutId: string, reason: string): Promise<any | null> {
    return withTenantContext(tenantId, async client => {
      const result = await client.query(
        `UPDATE ai_rollouts SET status='ROLLED_BACK', canary_percent=0, shadow_enabled=false,
          rollback_reason=$3, updated_at=NOW()
          WHERE tenant_id=$1 AND id=$2 AND status IN ('SHADOW','CANARY','ACTIVE')
          RETURNING *`,
        [tenantId, rolloutId, reason.slice(0, 500)],
      );
      return result.rows[0] || null;
    });
  },
};