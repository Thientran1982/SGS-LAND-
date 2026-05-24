/**
 * GEPA cron scheduler — pure ESM setInterval, zero external dependencies.
 * Replaces node-cron which uses CJS dynamic require('events') incompatible with ESM.
 *
 * Job 1: GEPA optimizer    — every 24h  (86400000ms), first run after 5s
 * Job 2: Expire sessions   — every 1h   (3600000ms),  first run after 5s
 * Job 3: Log GEPA stats    — every 6h   (21600000ms), first run after 5s
 */
import { pool } from '../db';
import { logger } from '../middleware/logger';
import { runGEPAOptimizer } from '../gepa/optimizer';
import { AGENT_PROFILES } from '../agents/profiles';

const INITIAL_DELAY_MS = 5_000;
const DAILY_MS         = 86_400_000;
const HOURLY_MS        = 3_600_000;
const SIX_HOUR_MS      = 21_600_000;

// ── Job 1: GEPA daily optimizer ───────────────────────────────────────────────
async function runDailyOptimizer(): Promise<void> {
    logger.info('[Cron] GEPA daily optimizer started');
    for (const agent of AGENT_PROFILES) {
        await runGEPAOptimizer(agent.id).catch((err: any) => {
            logger.error(`[Cron] GEPA optimizer failed for ${agent.id}: ${err?.message}`);
        });
    }
    logger.info('[Cron] GEPA daily optimizer complete');
}

// ── Job 2: Expire idle chat sessions (>2h) ────────────────────────────────────
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

// ── Job 3: Log GEPA + session stats ──────────────────────────────────────────
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
    setTimeout(() => {
        // Job 1 — GEPA daily optimizer every 24h
        runDailyOptimizer();
        setInterval(runDailyOptimizer, DAILY_MS);

        // Job 2 — expire idle sessions every 1h
        runSessionExpiry();
        setInterval(runSessionExpiry, HOURLY_MS);

        // Job 3 — log stats every 6h
        runStatsLogger();
        setInterval(runStatsLogger, SIX_HOUR_MS);

        logger.info('[Cron] 3 GEPA cron jobs initialized (GEPA optimizer, session expiry, stats logger)');
    }, INITIAL_DELAY_MS);
}
