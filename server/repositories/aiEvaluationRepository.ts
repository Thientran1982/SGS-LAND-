import { withTenantContext } from '../db';

export interface EvalRunInput {
  tenantId: string;
  name: string;
  fixtureVersion: string;
  variant?: string;
  promptVersion?: string;
  promptHash?: string;
  model?: string;
  provider?: string;
  metadata?: Record<string, unknown>;
  totalCases: number;
  createdBy?: string;
}

export const aiEvaluationRepository = {
  async createRun(input: EvalRunInput) {
    return withTenantContext(input.tenantId, async client => {
      const result = await client.query(
        `INSERT INTO ai_evaluation_runs
          (tenant_id,name,fixture_version,variant,prompt_version,prompt_hash,model,provider,metadata_json,total_cases,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11)
         RETURNING *`,
        [input.tenantId, input.name, input.fixtureVersion, input.variant || 'candidate', input.promptVersion || null,
          input.promptHash || null, input.model || null, input.provider || null, JSON.stringify(input.metadata || {}),
          input.totalCases, input.createdBy || null],
      );
      return result.rows[0];
    });
  },
  async addResult(tenantId: string, runId: string, result: Record<string, unknown>) {
    return withTenantContext(tenantId, async client => {
      const row = await client.query(
        `INSERT INTO ai_evaluation_results
          (tenant_id,run_id,case_id,channel,input_hash,trace_id,actual_intent,expected_intent,actual_agent,expected_agent,
           output_text,scores_json,latency_ms,input_tokens,output_tokens,cost_usd,error_text)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,$15,$16,$17)
         ON CONFLICT (run_id,case_id) DO UPDATE SET scores_json=EXCLUDED.scores_json,
           output_text=EXCLUDED.output_text, latency_ms=EXCLUDED.latency_ms, error_text=EXCLUDED.error_text
         RETURNING *`,
        [tenantId, runId, result.caseId, result.channel || 'ZALO', result.inputHash || null, result.traceId || null,
          result.actualIntent || null, result.expectedIntent || null, result.actualAgent || null, result.expectedAgent || null,
          result.output || null, JSON.stringify(result.scores || {}), result.latencyMs || null, result.inputTokens || null,
          result.outputTokens || null, result.costUsd || null, result.errorText || null],
      );
      await client.query(
        `UPDATE ai_evaluation_runs SET completed_cases=(SELECT COUNT(*) FROM ai_evaluation_results WHERE run_id=$1),
          summary_json=(SELECT COALESCE(jsonb_build_object(
            'intentAccuracy', AVG((scores_json->>'intentAccuracy')::numeric),
            'groundedness', AVG((scores_json->>'groundedness')::numeric),
            'toolSuccess', AVG((scores_json->>'toolSuccess')::numeric),
            'escalationRecall', AVG((scores_json->>'escalationRecall')::numeric),
            'safety', AVG((scores_json->>'safety')::numeric),
            'latencyP95', percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms)
          ), '{}'::jsonb) FROM ai_evaluation_results WHERE run_id=$1)
         WHERE id=$1`, [runId],
      );
      return row.rows[0];
    });
  },
  async listRuns(tenantId: string, limit = 30) {
    return withTenantContext(tenantId, async client => (await client.query(
      `SELECT * FROM ai_evaluation_runs WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2`, [tenantId, limit],
    )).rows);
  },
  async compare(tenantId: string, baselineId: string, candidateId: string) {
    return withTenantContext(tenantId, async client => (await client.query(
      `SELECT variant, id, name, fixture_version, prompt_version, prompt_hash, model, provider,
              total_cases, completed_cases, summary_json, created_at
         FROM ai_evaluation_runs
        WHERE tenant_id=$1 AND id = ANY($2::uuid[])`, [tenantId, [baselineId, candidateId]],
    )).rows);
  },
};