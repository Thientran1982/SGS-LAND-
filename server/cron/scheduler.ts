/**
 * GEPA cron scheduler — pure ESM setInterval (no node-cron dependency).
 * node-cron uses CJS dynamic require('events') which breaks ESM bundling.
 *
 * Job 1: Daily at 02:00 Asia/Ho_Chi_Minh — GEPA optimizer for all agents
 * Job 2: Every 1 hour                    — expire idle chat sessions (>2h)
 * Job 3: Every 6 hours                   — log GEPA + session stats
 */
import { pool } from '../db';
import { logger } from '../middleware/logger';
import { runGEPAOptimizer } from '../gepa/optimizer';
import { AGENT_PROFILES } from '../agents/profiles';

const MS_HOUR  = 60 * 60 * 1000;
const MS_6H    = 6  * MS_HOUR;
const MS_DAY   = 24 * MS_HOUR;

/** Returns ms until the next occurrence of HH:MM in Asia/Ho_Chi_Minh (UTC+7). */
function msUntilNextHCM(hour: number, minute = 0): number {
    const nowUtcMs = Date.now();
    // HCM is UTC+7
    const nowHCM = new Date(nowUtcMs + 7 * MS_HOUR);
    const target = new Date(nowHCM);
    target.setUTCHours(hour, minute, 0, 0);
    let diffMs = target.getTime() - nowHCM.getTime();
    if (diffMs <= 0) diffMs += MS_DAY; // already passed today → schedule tomorrow
    return diffMs;
}

// ── Job 1: GEPA daily optimizer at 02:00 HCM ─────────────────────────────────
async function runDailyOptimizer(): Promise<void> {
    logger.info('[Cron] GEPA daily optimizer started');
    for (const agent of AGENT_PROFILES) {
        await runGEPAOptimizer(agent.id).catch((err: any) => {
            logger.error(`[Cron] GEPA optimizer failed for ${agent.id}: ${err?.message}`);
        });
    }
    logger.info('[Cron] GEPA daily optimizer complete');
}

// ── Job 2: Expire idle sessions every hour ────────────────────────────────────
async function runSessionExpiry(): Promise<void> {
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
}

// ── Job 3: Log GEPA + session stats every 6 hours ────────────────────────────
async function runStatsLogger(): Promise<void> {
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
}

// ── Public init ───────────────────────────────────────────────────────────────
export function initCronJobs(): void {
    // Job 1: fire once at next 02:00 HCM, then repeat every 24h
    const delayToMidnight = msUntilNextHCM(2, 0);
    setTimeout(() => {
        runDailyOptimizer();
        setInterval(runDailyOptimizer, MS_DAY);
    }, delayToMidnight);

    // Job 2: fire immediately then every hour
    runSessionExpiry();
    setInterval(runSessionExpiry, MS_HOUR);

    // Job 3: fire immediately then every 6 hours
    runStatsLogger();
    setInterval(runStatsLogger, MS_6H);

    logger.info('[Cron] 3 GEPA cron jobs initialized (GEPA optimizer, session expiry, stats logger)');
}
