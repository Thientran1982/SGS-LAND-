import cron from 'node-cron';
import { pool } from '../db';
import { logger } from '../middleware/logger';
import { runGEPAOptimizer } from '../gepa/optimizer';
import { AGENT_PROFILES } from '../agents/profiles';

export function initCronJobs(): void {
  // Job 1 — '0 2 * * *': Run GEPA optimizer for all agents (daily at 2 AM)
  cron.schedule('0 2 * * *', async () => {
    logger.info('[Cron] GEPA daily optimizer started');
    for (const agent of AGENT_PROFILES) {
      await runGEPAOptimizer(agent.id).catch(err => {
        logger.error(`[Cron] GEPA optimizer failed for ${agent.id}: ${err?.message}`);
      });
    }
    logger.info('[Cron] GEPA daily optimizer complete');
  }, { timezone: 'Asia/Ho_Chi_Minh' });

  // Job 2 — '0 * * * *': Expire chat sessions idle > 2 hours
  cron.schedule('0 * * * *', async () => {
    try {
      const result = await pool.query(
        `UPDATE chat_sessions
         SET session_status = 'expired'
         WHERE session_status = 'active'
           AND updated_at < NOW() - INTERVAL '2 hours'`,
      );
      if ((result.rowCount ?? 0) > 0) {
        logger.info(`[Cron] Expired ${result.rowCount} idle chat sessions (>2h)`);
      }
    } catch (err: any) {
      logger.error(`[Cron] Session expiry failed: ${err?.message}`);
    }
  }, { timezone: 'Asia/Ho_Chi_Minh' });

  // Job 3 — '0 */6 * * *': Log GEPA stats every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    try {
      const { rows } = await pool.query(`
        SELECT
          agent_id,
          COUNT(*) AS variants,
          ROUND(AVG(fitness_score)::numeric, 3) AS avg_fitness,
          SUM(wins) AS total_wins,
          SUM(losses) AS total_losses
        FROM prompt_variants
        GROUP BY agent_id
        ORDER BY agent_id
      `);
      if (rows.length > 0) {
        logger.info('[Cron] GEPA stats: ' + JSON.stringify(rows));
      }

      const { rows: sessionRows } = await pool.query(`
        SELECT session_status, COUNT(*) AS cnt
        FROM chat_sessions
        GROUP BY session_status
      `);
      logger.info('[Cron] Session stats: ' + JSON.stringify(sessionRows));
    } catch (err: any) {
      logger.error(`[Cron] Stats logging failed: ${err?.message}`);
    }
  }, { timezone: 'Asia/Ho_Chi_Minh' });

  logger.info('[Cron] 3 GEPA cron jobs initialized (GEPA optimizer, session expiry, stats logger)');
}
