import { BaseRepository, PaginatedResult } from './baseRepository';
import { withTransaction } from '../db';
import { PoolClient } from 'pg';

export interface FeedbackData {
  interactionId?: string;
  leadId?: string;
  userId?: string;
  rating: -1 | 1;
  correction?: string;
  agentNode?: string;
  intent?: string;
  userMessage?: string;
  aiResponse?: string;
  model?: string;
  metadata?: Record<string, any>;
}

export interface RewardSignal {
  intent: string;
  agentNode?: string;
  positiveCount: number;
  negativeCount: number;
  avgScore: number;
  topExamples: Array<{ userMessage: string; aiResponse: string; rating: number }>;
  negativePatterns: Array<{ userMessage: string; correction: string }>;
  fewShotCache: Array<{ role: string; content: string }>;
  lastComputed: string;
}

export interface FeedbackStats {
  totalFeedback: number;
  positiveCount: number;
  negativeCount: number;
  approvalRate: number;
  byIntent: Array<{ intent: string; positive: number; negative: number; rate: number }>;
  byNode: Array<{ agentNode: string; positive: number; negative: number; rate: number }>;
  recentCorrections: Array<{ userMessage: string; aiResponse: string; correction: string; intent: string; createdAt: string }>;
}

class FeedbackRepository extends BaseRepository {
  constructor() {
    super('ai_feedback');
  }

  async create(tenantId: string | null | undefined, data: FeedbackData): Promise<any> {
    const params = [
      tenantId || null,
      data.interactionId || null,
      data.leadId || null,
      data.userId || null,
      data.rating,
      data.correction || null,
      data.agentNode || null,
      data.intent || null,
      data.userMessage || null,
      data.aiResponse || null,
      data.model || null,
      JSON.stringify(data.metadata || {}),
    ];
    const sql = `INSERT INTO ai_feedback (tenant_id, interaction_id, lead_id, user_id, rating, correction, agent_node, intent, user_message, ai_response, model, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`;

    if (tenantId) {
      return this.withTenant(tenantId, async (client: PoolClient) => {
        const result = await client.query(sql, params);
        return this.rowToEntity(result.rows[0]);
      });
    }
    // Guest (no tenantId) — use plain transaction without RLS
    return withTransaction(async (client: PoolClient) => {
      const result = await client.query(sql, params);
      return this.rowToEntity(result.rows[0]);
    });
  }

  async getStats(tenantId: string, days: number = 30): Promise<FeedbackStats> {
    return this.withTenant(tenantId, async (client: PoolClient) => {
      const cutoff = new Date(Date.now() - days * 86400000).toISOString();

      const totalRes = await client.query(
        `SELECT 
           COUNT(*)::int as total,
           COUNT(*) FILTER (WHERE rating = 1)::int as positive,
           COUNT(*) FILTER (WHERE rating = -1)::int as negative
         FROM ai_feedback WHERE created_at >= $1`,
        [cutoff]
      );
      const { total, positive, negative } = totalRes.rows[0];

      const byIntentRes = await client.query(
        `SELECT 
           intent,
           COUNT(*) FILTER (WHERE rating = 1)::int as positive,
           COUNT(*) FILTER (WHERE rating = -1)::int as negative
         FROM ai_feedback 
         WHERE created_at >= $1 AND intent IS NOT NULL
         GROUP BY intent ORDER BY (COUNT(*) FILTER (WHERE rating = -1)) DESC`,
        [cutoff]
      );

      const byNodeRes = await client.query(
        `SELECT 
           agent_node,
           COUNT(*) FILTER (WHERE rating = 1)::int as positive,
           COUNT(*) FILTER (WHERE rating = -1)::int as negative
         FROM ai_feedback 
         WHERE created_at >= $1 AND agent_node IS NOT NULL
         GROUP BY agent_node ORDER BY (COUNT(*) FILTER (WHERE rating = -1)) DESC`,
        [cutoff]
      );

      const correctionsRes = await client.query(
        `SELECT user_message, ai_response, correction, intent, created_at
         FROM ai_feedback 
         WHERE correction IS NOT NULL AND correction != '' AND created_at >= $1
         ORDER BY created_at DESC LIMIT 20`,
        [cutoff]
      );

      return {
        totalFeedback: total,
        positiveCount: positive,
        negativeCount: negative,
        approvalRate: total > 0 ? Math.round((positive / total) * 100) : 0,
        byIntent: byIntentRes.rows.map(r => ({
          intent: r.intent,
          positive: r.positive,
          negative: r.negative,
          rate: (r.positive + r.negative) > 0 ? Math.round((r.positive / (r.positive + r.negative)) * 100) : 0,
        })),
        byNode: byNodeRes.rows.map(r => ({
          agentNode: r.agent_node,
          positive: r.positive,
          negative: r.negative,
          rate: (r.positive + r.negative) > 0 ? Math.round((r.positive / (r.positive + r.negative)) * 100) : 0,
        })),
        recentCorrections: this.rowsToEntities(correctionsRes.rows),
      };
    });
  }

  async getTopExamples(tenantId: string, intent: string, limit: number = 3): Promise<Array<{ userMessage: string; aiResponse: string }>> {
    return this.withTenant(tenantId, async (client: PoolClient) => {
      const result = await client.query(
        `SELECT user_message, ai_response
         FROM ai_feedback 
         WHERE intent = $1 AND rating = 1 AND user_message IS NOT NULL AND ai_response IS NOT NULL
         ORDER BY created_at DESC LIMIT $2`,
        [intent, limit]
      );
      return result.rows.map(r => ({
        userMessage: r.user_message,
        aiResponse: r.ai_response,
      }));
    });
  }

  async getNegativePatterns(tenantId: string, intent: string, limit: number = 5): Promise<Array<{ userMessage: string; correction: string; aiResponse: string }>> {
    return this.withTenant(tenantId, async (client: PoolClient) => {
      const result = await client.query(
        `SELECT user_message, correction, ai_response
         FROM ai_feedback 
         WHERE intent = $1 AND rating = -1 AND correction IS NOT NULL AND correction != ''
         ORDER BY created_at DESC LIMIT $2`,
        [intent, limit]
      );
      return result.rows.map(r => ({
        userMessage: r.user_message,
        correction: r.correction,
        aiResponse: r.ai_response,
      }));
    });
  }

  async computeRewardSignal(tenantId: string, intent: string): Promise<void> {
    return this.withTenant(tenantId, async (client: PoolClient) => {
      const statsRes = await client.query(
        `SELECT 
           COUNT(*) FILTER (WHERE rating = 1)::int as positive,
           COUNT(*) FILTER (WHERE rating = -1)::int as negative,
           ROUND(AVG(rating)::numeric, 2) as avg_score
         FROM ai_feedback WHERE intent = $1`,
        [intent]
      );
      const { positive, negative, avg_score } = statsRes.rows[0];

      const topRes = await client.query(
        `SELECT user_message, ai_response FROM ai_feedback
         WHERE intent = $1 AND rating = 1 AND user_message IS NOT NULL AND ai_response IS NOT NULL
         ORDER BY created_at DESC LIMIT 3`,
        [intent]
      );

      const negRes = await client.query(
        `SELECT user_message, correction FROM ai_feedback
         WHERE intent = $1 AND rating = -1 AND correction IS NOT NULL AND correction != ''
         ORDER BY created_at DESC LIMIT 5`,
        [intent]
      );

      const fewShot: Array<{ role: string; content: string }> = [];
      for (const ex of topRes.rows) {
        fewShot.push({ role: 'user', content: ex.user_message });
        fewShot.push({ role: 'model', content: ex.ai_response });
      }

      await client.query(
        `INSERT INTO ai_reward_signals (tenant_id, intent, positive_count, negative_count, avg_score, top_examples, negative_patterns, few_shot_cache, last_computed, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (tenant_id, intent) DO UPDATE SET
           positive_count = $3, negative_count = $4, avg_score = $5,
           top_examples = $6, negative_patterns = $7, few_shot_cache = $8,
           last_computed = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP`,
        [
          tenantId, intent, positive, negative, avg_score || 0,
          JSON.stringify(topRes.rows.map(r => ({ userMessage: r.user_message, aiResponse: r.ai_response }))),
          JSON.stringify(negRes.rows.map(r => ({ userMessage: r.user_message, correction: r.correction }))),
          JSON.stringify(fewShot),
        ]
      );
    });
  }

  async getRewardSignal(tenantId: string, intent: string): Promise<RewardSignal | null> {
    return this.withTenant(tenantId, async (client: PoolClient) => {
      const result = await client.query(
        `SELECT * FROM ai_reward_signals WHERE intent = $1`,
        [intent]
      );
      return result.rows[0] ? this.rowToEntity(result.rows[0]) : null;
    });
  }

  async getAllRewardSignals(tenantId: string): Promise<RewardSignal[]> {
    return this.withTenant(tenantId, async (client: PoolClient) => {
      const result = await client.query(
        `SELECT * FROM ai_reward_signals ORDER BY negative_count DESC`
      );
      return this.rowsToEntities(result.rows);
    });
  }

  async getTrends(tenantId: string, days: number = 30): Promise<Array<{
    week: string;
    positive: number;
    negative: number;
    total: number;
    approvalRate: number;
  }>> {
    return this.withTenant(tenantId, async (client: PoolClient) => {
      const cutoff = new Date(Date.now() - days * 86400000).toISOString();
      const result = await client.query(
        `SELECT
           TO_CHAR(DATE_TRUNC('week', created_at), 'YYYY-MM-DD') AS week,
           COUNT(*) FILTER (WHERE rating = 1)::int  AS positive,
           COUNT(*) FILTER (WHERE rating = -1)::int AS negative,
           COUNT(*)::int                             AS total
         FROM ai_feedback
         WHERE created_at >= $1
         GROUP BY DATE_TRUNC('week', created_at)
         ORDER BY week ASC`,
        [cutoff]
      );
      return result.rows.map(r => ({
        week: r.week,
        positive: r.positive,
        negative: r.negative,
        total: r.total,
        approvalRate: r.total > 0 ? Math.round((r.positive / r.total) * 100) : 0,
      }));
    });
  }

  async listFeedback(tenantId: string, page: number = 1, pageSize: number = 20, intent?: string): Promise<{
    data: any[];
    total: number;
  }> {
    return this.withTenant(tenantId, async (client: PoolClient) => {
      const offset = (page - 1) * pageSize;
      const conditions: string[] = [];
      const params: any[] = [];
      if (intent) {
        conditions.push(`intent = $${params.length + 1}`);
        params.push(intent);
      }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const totalRes = await client.query(
        `SELECT COUNT(*)::int as total FROM ai_feedback ${where}`,
        params
      );
      const dataRes = await client.query(
        `SELECT id, rating, correction, agent_node, intent, user_message, ai_response, model, created_at
         FROM ai_feedback ${where}
         ORDER BY created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, pageSize, offset]
      );
      return {
        data: this.rowsToEntities(dataRes.rows),
        total: totalRes.rows[0]?.total || 0,
      };
    });
  }

  async computeAllRewardSignals(tenantId: string): Promise<void> {
    const INTENTS = [
      'SEARCH_INVENTORY', 'CALCULATE_LOAN', 'EXPLAIN_LEGAL', 'DRAFT_BOOKING',
      'EXPLAIN_MARKETING', 'DRAFT_CONTRACT', 'ANALYZE_LEAD', 'ESTIMATE_VALUATION',
      'DIRECT_ANSWER', 'GREETING', 'UNKNOWN',
    ];
    await Promise.all(INTENTS.map(intent =>
      this.computeRewardSignal(tenantId, intent).catch(() => {})
    ));
  }
}

export const feedbackRepository = new FeedbackRepository();
