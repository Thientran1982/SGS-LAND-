import { withTenantContext } from '../db';
import type { MinhChatPlan, MinhChatPlanDraft, MinhChatPlanStepStatus } from '../ai';

function mapPlan(row: any): MinhChatPlan {
  return {
    id: row.id,
    title: row.title,
    steps: Array.isArray(row.steps) ? row.steps : [],
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  };
}

class MinhChatPlanRepository {
  async findForSession(tenantId: string, userId: string, sessionId: string): Promise<MinhChatPlan | null> {
    return withTenantContext(tenantId, async client => {
      const result = await client.query(
        `SELECT id, title, steps, updated_at
           FROM minh_chat_plans
          WHERE tenant_id = $1 AND user_id = $2 AND session_id = $3
          LIMIT 1`,
        [tenantId, userId, sessionId],
      );
      return result.rows[0] ? mapPlan(result.rows[0]) : null;
    });
  }

  async createForSession(
    tenantId: string,
    userId: string,
    sessionId: string,
    draft: MinhChatPlanDraft,
  ): Promise<MinhChatPlan> {
    const steps = draft.steps.map(step => ({ ...step, status: 'PENDING' as const }));
    return withTenantContext(tenantId, async client => {
      await client.query(
        `INSERT INTO minh_chat_plans (tenant_id, user_id, session_id, title, steps)
         VALUES ($1, $2, $3, $4, $5::jsonb)
         ON CONFLICT (tenant_id, user_id, session_id) DO NOTHING`,
        [tenantId, userId, sessionId, draft.title, JSON.stringify(steps)],
      );
      const result = await client.query(
        `SELECT id, title, steps, updated_at
           FROM minh_chat_plans
          WHERE tenant_id = $1 AND user_id = $2 AND session_id = $3
          LIMIT 1`,
        [tenantId, userId, sessionId],
      );
      if (!result.rows[0]) throw new Error('Minh plan was not available after saving');
      return mapPlan(result.rows[0]);
    });
  }

  async updateStep(
    tenantId: string,
    userId: string,
    sessionId: string,
    stepId: string,
    status: MinhChatPlanStepStatus,
  ): Promise<MinhChatPlan | null> {
    return withTenantContext(tenantId, async client => {
      const selected = await client.query(
        `SELECT id, title, steps, updated_at
           FROM minh_chat_plans
          WHERE tenant_id = $1 AND user_id = $2 AND session_id = $3
          FOR UPDATE`,
        [tenantId, userId, sessionId],
      );
      if (!selected.rows[0]) return null;
      const plan = mapPlan(selected.rows[0]);
      const stepIndex = plan.steps.findIndex(step => step.id === stepId);
      if (stepIndex < 0) return null;
      plan.steps[stepIndex] = { ...plan.steps[stepIndex], status };

      const updated = await client.query(
        `UPDATE minh_chat_plans
            SET steps = $4::jsonb, updated_at = NOW()
          WHERE tenant_id = $1 AND user_id = $2 AND session_id = $3
          RETURNING id, title, steps, updated_at`,
        [tenantId, userId, sessionId, JSON.stringify(plan.steps)],
      );
      return updated.rows[0] ? mapPlan(updated.rows[0]) : null;
    });
  }
}

export const minhChatPlanRepository = new MinhChatPlanRepository();