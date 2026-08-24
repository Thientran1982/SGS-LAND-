import { withTenantContext } from '../db';
import { DEFAULT_AGENT_ROLE_CARDS } from '../ai/agentRoleCards';

export type OperatingEventInput = {
  eventId: string;
  eventType: string;
  idempotencyKey: string;
  actor: 'SYSTEM' | 'STAFF' | 'BUYER' | 'AGENT';
  urgency?: number;
  payload?: Record<string, unknown>;
};

class AgentOperatingRepository {
  async enqueueEvent(tenantId: string, event: OperatingEventInput) {
    return withTenantContext(tenantId, async client => {
      const result = await client.query(
        `INSERT INTO agent_operating_events
          (tenant_id,event_id,event_type,idempotency_key,actor,payload_json,urgency)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)
         ON CONFLICT (tenant_id,idempotency_key) DO UPDATE
           SET updated_at=NOW()
         RETURNING *`,
        [tenantId, event.eventId, event.eventType, event.idempotencyKey, event.actor, JSON.stringify(event.payload || {}), Math.max(0, Math.min(100, Number(event.urgency) || 50))],
      );
      return result.rows[0];
    });
  }

  async claimEvents(tenantId: string, limit = 25) {
    return withTenantContext(tenantId, async client => {
      const result = await client.query(
        `UPDATE agent_operating_events SET status='PROCESSING', attempts=attempts+1,
            lease_token=gen_random_uuid(), lease_expires_at=NOW()+INTERVAL '2 minutes',
            updated_at=NOW()
         WHERE id IN (
           SELECT id FROM agent_operating_events
            WHERE tenant_id=$1
              AND (status IN ('PENDING','FAILED') OR (status='PROCESSING' AND lease_expires_at < NOW()))
              AND available_at <= NOW() AND attempts < 5
            ORDER BY urgency DESC, created_at FOR UPDATE SKIP LOCKED LIMIT $2
         ) RETURNING *`,
        [tenantId, Math.max(1, Math.min(limit, 100))],
      );
      return result.rows;
    });
  }

  async finishEvent(tenantId: string, id: string, status: 'DONE' | 'FAILED' | 'DEAD_LETTER', error?: string, leaseToken?: string) {
    return withTenantContext(tenantId, async client => {
      const result = await client.query(
        `UPDATE agent_operating_events
            SET status=$3, last_error=$4,
                available_at=CASE WHEN $3='FAILED' THEN NOW()+LEAST(INTERVAL '15 minutes', INTERVAL '5 seconds' * POWER(2, GREATEST(attempts - 1, 0))) ELSE available_at END,
                lease_token=NULL, lease_expires_at=NULL,
                dead_lettered_at=CASE WHEN $3='DEAD_LETTER' THEN NOW() ELSE dead_lettered_at END,
                updated_at=NOW()
          WHERE tenant_id=$1 AND id=$2 AND status='PROCESSING'
            AND ($5::uuid IS NULL OR lease_token=$5::uuid) RETURNING *`,
        [tenantId, id, status, error?.slice(0, 1000) || null, leaseToken || null],
      );
      return result.rows[0] || null;
    });
  }

  async heartbeatEvent(tenantId: string, id: string, leaseToken: string) {
    return withTenantContext(tenantId, async client => {
      const result = await client.query(
        `UPDATE agent_operating_events
            SET lease_expires_at=NOW()+INTERVAL '2 minutes', updated_at=NOW()
          WHERE tenant_id=$1 AND id=$2 AND status='PROCESSING' AND lease_token=$3
          RETURNING id`,
        [tenantId, id, leaseToken],
      );
      return (result.rowCount ?? 0) === 1;
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

  async listWeeklyKpi(tenantId: string, startDate?: string) {
    return withTenantContext(tenantId, async client => {
      const result = await client.query(`
        SELECT agent_key, period_start, period_end, metrics_json, created_at
        FROM agent_kpi_snapshots
        WHERE tenant_id=$1 AND period_start >= COALESCE($2::date, CURRENT_DATE - INTERVAL '7 days')
        ORDER BY period_start DESC, agent_key
      `, [tenantId, startDate || null]);
      return result.rows;
    });
  }

  async upsertWeeklyKpi(tenantId: string, input: { agentKey: string; periodStart: string; periodEnd: string; metrics?: Record<string, unknown> }) {
    return withTenantContext(tenantId, async client => (await client.query(`
      INSERT INTO agent_kpi_snapshots (tenant_id, agent_key, period_start, period_end, metrics_json)
      VALUES ($1,$2,$3,$4,$5::jsonb)
      ON CONFLICT (tenant_id, agent_key, period_start, period_end) DO UPDATE
        SET metrics_json=EXCLUDED.metrics_json, created_at=NOW()
      RETURNING *
    `, [tenantId, input.agentKey, input.periodStart, input.periodEnd, JSON.stringify(input.metrics || {})])).rows[0]);
  }

  async listShiftReports(tenantId: string, limit = 14) {
    return withTenantContext(tenantId, async client => (await client.query(`
      SELECT * FROM agent_shift_reports WHERE tenant_id=$1
      ORDER BY report_date DESC, shift LIMIT $2
    `, [tenantId, Math.max(1, Math.min(limit, 60))])).rows);
  }

  async upsertShiftReport(tenantId: string, input: { reportDate: string; shift?: string; metrics?: Record<string, unknown>; summary?: string }) {
    return withTenantContext(tenantId, async client => (await client.query(`
      INSERT INTO agent_shift_reports (tenant_id, report_date, shift, metrics_json, summary)
      VALUES ($1,$2,$3,$4::jsonb,$5)
      ON CONFLICT (tenant_id, report_date, shift) DO UPDATE
        SET metrics_json=EXCLUDED.metrics_json, summary=EXCLUDED.summary, updated_at=NOW()
      RETURNING *
    `, [tenantId, input.reportDate, input.shift || 'ALL_DAY', JSON.stringify(input.metrics || {}), String(input.summary || '').slice(0, 5000)])).rows[0]);
  }

  async generateDailyShiftReport(tenantId: string, reportDate: string, shift = 'ALL_DAY') {
    return withTenantContext(tenantId, async client => {
      const [events, questions, executions] = await Promise.all([
        client.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status='DONE')::int AS done, COUNT(*) FILTER (WHERE status IN ('FAILED','DEAD_LETTER'))::int AS failed FROM agent_operating_events WHERE tenant_id=$1 AND created_at >= $2::date AND created_at < $2::date + INTERVAL '1 day'`, [tenantId, reportDate]),
        client.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status='ANSWERED')::int AS answered FROM agent_human_questions WHERE tenant_id=$1 AND created_at >= $2::date AND created_at < $2::date + INTERVAL '1 day'`, [tenantId, reportDate]),
        client.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status='SUCCESS')::int AS success, COUNT(*) FILTER (WHERE status IN ('ERROR','BLOCKED'))::int AS failed FROM agent_executions WHERE tenant_id=$1 AND created_at >= $2::date AND created_at < $2::date + INTERVAL '1 day'`, [tenantId, reportDate]),
      ]);
      const metrics = { events: events.rows[0], humanQuestions: questions.rows[0], executions: executions.rows[0] };
      const summary = `${metrics.executions.success}/${metrics.executions.total} runs thành công · ${metrics.events.done}/${metrics.events.total} event hoàn tất · ${metrics.humanQuestions.answered}/${metrics.humanQuestions.total} câu hỏi đã trả lời`;
      const result = await client.query(`
        INSERT INTO agent_shift_reports (tenant_id, report_date, shift, metrics_json, summary)
        VALUES ($1,$2,$3,$4::jsonb,$5)
        ON CONFLICT (tenant_id, report_date, shift) DO UPDATE SET metrics_json=EXCLUDED.metrics_json, summary=EXCLUDED.summary, updated_at=NOW()
        RETURNING *
      `, [tenantId, reportDate, shift, JSON.stringify(metrics), summary]);
      return result.rows[0];
    });
  }

  async reviewShiftReport(tenantId: string, id: string, reviewerId: string) {
    return withTenantContext(tenantId, async client => (await client.query(`
      UPDATE agent_shift_reports SET reviewed=TRUE, reviewed_by=$3, reviewed_at=NOW(), updated_at=NOW()
      WHERE tenant_id=$1 AND id=$2 RETURNING *
    `, [tenantId, id, reviewerId])).rows[0] || null);
  }

  async approveRoleCard(tenantId: string, agentKey: string, approved: boolean, reviewerId: string, reason = '') {
    return withTenantContext(tenantId, async client => (await client.query(`
      INSERT INTO agent_role_cards (tenant_id, agent_key, card_json, approval_status, approved_by, approved_at, approval_reason)
      VALUES ($1,$2,$3::jsonb,$4,$5,CASE WHEN $4='APPROVED' THEN NOW() ELSE NULL END,$6)
      ON CONFLICT (tenant_id, agent_key) DO UPDATE SET
        approval_status=EXCLUDED.approval_status, approved_by=EXCLUDED.approved_by,
        approved_at=EXCLUDED.approved_at, approval_reason=EXCLUDED.approval_reason, updated_at=NOW()
      RETURNING *
    `, [tenantId, agentKey, JSON.stringify(DEFAULT_AGENT_ROLE_CARDS.find(card => card.agentKey === agentKey) || {}), approved ? 'APPROVED' : 'REJECTED', reviewerId, reason.slice(0, 1000)])).rows[0]);
  }

  async listEvents(tenantId: string, limit = 100) {
    return withTenantContext(tenantId, async client => (await client.query(
      `SELECT * FROM agent_operating_events WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2`,
      [tenantId, Math.max(1, Math.min(limit, 200))],
    )).rows);
  }

  async cockpitSummary(tenantId: string) {
    return withTenantContext(tenantId, async client => {
      const [events, questions, executions, audits, rollouts, kpis, shifts, roleCards, rollbackAudits] = await Promise.all([
        client.query(`SELECT status, COUNT(*)::int AS count FROM agent_operating_events WHERE tenant_id=$1 GROUP BY status`, [tenantId]),
        client.query(`SELECT status, COUNT(*)::int AS count FROM agent_human_questions WHERE tenant_id=$1 GROUP BY status`, [tenantId]),
        client.query(`SELECT status, COUNT(*)::int AS count FROM agent_executions WHERE tenant_id=$1 GROUP BY status`, [tenantId]),
        client.query(`SELECT event_type, status, created_at FROM agent_audit_events WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 20`, [tenantId]),
        client.query(`SELECT agent_key, status, canary_percent, shadow_enabled, gate_summary, updated_at FROM ai_rollouts WHERE tenant_id=$1 ORDER BY updated_at DESC LIMIT 20`, [tenantId]),
        client.query(`SELECT * FROM agent_kpi_snapshots WHERE tenant_id=$1 AND period_end >= CURRENT_DATE - 7 ORDER BY period_start DESC, agent_key`, [tenantId]),
        client.query(`SELECT * FROM agent_shift_reports WHERE tenant_id=$1 ORDER BY report_date DESC, shift LIMIT 14`, [tenantId]),
        client.query(`SELECT agent_key, card_json, approval_status, approved_by, approved_at, approval_reason, updated_at FROM agent_role_cards WHERE tenant_id=$1`, [tenantId]),
        client.query(`SELECT id, entity_id, from_status, to_status, decision, reason, metrics_json, trace_id, created_at FROM ai_promotion_decisions WHERE tenant_id=$1 AND decision='ROLLBACK' ORDER BY created_at DESC LIMIT 30`, [tenantId]),
      ]);
      const savedCards = new Map(roleCards.rows.map(card => [card.agent_key, card]));
      return {
        roleCards: DEFAULT_AGENT_ROLE_CARDS.map(card => ({ ...card, ...(savedCards.get(card.agentKey) || {}) })),
        events: events.rows,
        humanQuestions: questions.rows,
        executions: executions.rows,
        recentAudit: audits.rows,
        rollouts: rollouts.rows,
        weeklyKpi: kpis.rows,
        shiftReports: shifts.rows,
        rollbackAudits: rollbackAudits.rows,
        generatedAt: new Date().toISOString(),
      };
    });
  }
}

export const agentOperatingRepository = new AgentOperatingRepository();