import { pool } from '../db';
import { logger } from '../middleware/logger';
import type { FeedbackEvent } from './types';
import { runGEPAOptimizer } from './optimizer';

const FEEDBACK_THRESHOLD = 20;

export async function recordFeedback(event: FeedbackEvent): Promise<void> {
  try {
    // 1. Save feedback event to DB
    await pool.query(
      `INSERT INTO feedback_events (session_id, message_id, agent_id, variant_id, rating, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING`,
      [
        event.sessionId,
        event.messageId,
        event.agentId,
        event.variantId,
        event.rating,
        event.timestamp ?? new Date(),
      ],
    );

    // 2. Update wins/losses on the variant
    if (event.variantId) {
      const delta = event.rating === 'positive' ? { col: 'wins' } : event.rating === 'negative' ? { col: 'losses' } : null;
      if (delta) {
        await pool.query(
          `UPDATE prompt_variants SET ${delta.col} = ${delta.col} + 1,
            fitness_score = CASE
              WHEN (wins + losses + 1) > 0
              THEN wins::float / GREATEST(wins + losses + 1, 1)
              ELSE fitness_score
            END
           WHERE id = $1`,
          [event.variantId],
        );
      }
    }

    // 3. Count new (unprocessed) feedbacks for this agent — trigger optimizer if >= threshold
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS cnt FROM feedback_events
       WHERE agent_id = $1 AND optimized_at IS NULL`,
      [event.agentId],
    );
    const newCount = parseInt(rows[0]?.cnt ?? '0', 10);

    if (newCount >= FEEDBACK_THRESHOLD) {
      // Mark feedbacks as processed
      await pool.query(
        `UPDATE feedback_events SET optimized_at = NOW()
         WHERE agent_id = $1 AND optimized_at IS NULL`,
        [event.agentId],
      );

      // Fire optimizer asynchronously (non-blocking)
      runGEPAOptimizer(event.agentId).catch(err => {
        logger.error(`[GEPA] Async optimizer trigger failed for ${event.agentId}: ${err?.message}`);
      });

      logger.info(`[GEPA] Threshold reached (${newCount} feedbacks) — triggered optimizer for agent "${event.agentId}"`);
    }
  } catch (err: any) {
    logger.error(`[GEPA] recordFeedback error: ${err?.message}`);
  }
}
