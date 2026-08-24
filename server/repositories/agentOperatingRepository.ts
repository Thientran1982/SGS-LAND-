import { withTenantContext } from '../db';
import { DEFAULT_AGENT_ROLE_CARDS } from '../ai/agentRoleCards';

export type OperatingEventInput = {
  eventId: string;
  eventType: string;
  idempotencyKey: string;
  actor: 'SYSTEM' | 'STAFF' | 'BUYER' | 'AGENT';
  payload?: Record<string, unknown>;
};

class AgentOperatingRepository {
  async enqueueEvent(tenantId: string, event: OperatingEventInput) {
    return withTenantContext(tenantId, async client => {
      const result = await client.query(
        `INSERT INTO agent_operating_events
          (tenant_id,event_id,event_type,idempotency_key,actor,payload_json)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb)
         ON CONFLICT (tenant_id,idempotency_key) DO UPDATE
           SET updated_at=NOW()
         RETURNING *`,
        [tenantId, event.eventId, event.eventType, event.idempotencyKey, event.actor, JSON.stringify(event.payload || {})],
      );
      return result.rows[0];
    });
  }

  async claimEvents(tenantId: string, limit = 25) {
    return withTenantContext(tenantId, async client => {
      const result = await client.query(
        `UPDATE agent_operating_events SET status='PROCESSING', attempts=attempts+1, updated_at=NOW()
         WHERE id IN (
           SELECT id FROM agent_operating_events
            WHERE tenant_id=$1 AND status IN ('PENDING','FAILED')
              AND available_at <= NOW() AND attempts < 3
            ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT $2
         ) RETURNING *`,
        [tenantId, Math.max(1, Math.min(limit, 100))],
      );
      return result.rows;
    });
  }

  async finishEvent(tenantId: string, id: string, status: 'DONE' | 'FAILED' | 'DEAD_LETTER', error?: string) {
    return withTenantContext(tenantId, async client => {
      const result = await client.query(
        `UPDATE agent_operating_events
            SET status=$3, last_error=$4, available_at=CASE WHEN $3='FAILED' THEN NOW()+INTERVAL '1 minute' ELSE available_at END, updated_at=NOW()
          WHERE tenant_id=$1 AND id=$2 RETURNING *`,
        [tenantId, id, status, error?.slice(0, 1000) || null],
      );
      return result.rows[0] || null;
    });
  }

  async createHumanQuestion(tenantId: string, input: {
    agentKey: string; question: string; leadId?: string; runId?: string; priority?: number; context?: Record<string, unknown>;
  }) {
    return withTenantContext(tenantId, async client => {
      const result = await client.query(
        `INSERT INTO agent_human_questions
          (tenant_id,agent_key,question,lead_id,run_id,priority,context_json)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb) RETURNING *`,
        [tenantId, input.agentKey, input.question.slice(0, 2000), input.leadId || null, input.runId || null,
          Math.max(0, Math.min(100, Number(input.priority) || 50)), JSON.stringify(input.context || {})],
      );
      return result.rows[0];
    });
  }

  async listHumanQuestions(tenantId: string, status = 'OPEN') {
    return withTenantContext(tenantId, async client => (await client.query(
      `SELECT * FROM agent_human_questions
        WHERE tenant_id=$1 AND status=$2
        ORDER BY priority DESC, created_at ASC LIMIT 200`,
      [tenantId, status],
    )).rows);
  }

  async answerHumanQuestion(tenantId: string, id: string, answer: string, answeredBy: string, approveMemory: boolean) {
    return withTenantContext(tenantId, async client => {
      const result = await client.query(
        `UPDATE agent_human_questions
            SET status='ANSWERED', answer=$3, answered_by=$4, answered_at=NOW(),
                memory_approved=$5, updated_at=NOW()
          WHERE tenant_id=$1 AND id=$2 AND status='OPEN' RETURNING *`,
        [tenantId, id, answer.slice(0, 10000), answeredBy, approveMemory],
      );
      return result.rows[0] || null;
    });
  }

  async listEvents(tenantId: string, limit = 100) {
    return withTenantContext(tenantId, async client => (await client.query(
      `SELECT * FROM agent_operating_events WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2`,
      [tenantId, Math.max(1, Math.min(limit, 200))],
    )).rows);
  }

  async cockpitSummary(tenantId: string) {
    return withTenantContext(tenantId, async client => {
      const [events, questions, executions, audits, rollouts] = await Promise.all([
        client.query(`SELECT status, COUNT(*)::int AS count FROM agent_operating_events WHERE tenant_id=$1 GROUP BY status`, [tenantId]),
        client.query(`SELECT status, COUNT(*)::int AS count FROM agent_human_questions WHERE tenant_id=$1 GROUP BY status`, [tenantId]),
        client.query(`SELECT status, COUNT(*)::int AS count FROM agent_executions WHERE tenant_id=$1 GROUP BY status`, [tenantId]),
        client.query(`SELECT event_type, status, created_at FROM agent_audit_events WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 20`, [tenantId]),
        client.query(`SELECT agent_key, status, canary_percent, shadow_enabled, gate_summary, updated_at FROM ai_rollouts WHERE tenant_id=$1 ORDER BY updated_at DESC LIMIT 20`, [tenantId]),
      ]);
      return {
        roleCards: DEFAULT_AGENT_ROLE_CARDS,
        events: events.rows,
        humanQuestions: questions.rows,
        executions: executions.rows,
        recentAudit: audits.rows,
        rollouts: rollouts.rows,
        generatedAt: new Date().toISOString(),
      };
    });
  }
}

export const agentOperatingRepository = new AgentOperatingRepository();