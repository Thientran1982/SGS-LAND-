// agentCronFallback.ts — QStash watchdog: khi QStash hết token/chết, tự gọi cron endpoint nội bộ
import { pool } from "../db";
import { logger } from "../middleware/logger";

const INTERNAL_BASE = process.env.INTERNAL_CRON_BASE || `http://127.0.0.1:${process.env.PORT || 5000}`;
const jwtSlice = process.env.JWT_SECRET?.slice(0, 32) || "";
// Per-endpoint secrets — đồng bộ với cách mount từng router trong server.ts
const ENDPOINT_DEFS: { ep: string; secret: string }[] = [
  { ep: "/api/internal/followup-cron", secret: process.env.FOLLOWUP_CRON_SECRET || jwtSlice },
  { ep: "/api/internal/engagement-email-cron", secret: process.env.ENGAGEMENT_CRON_SECRET || jwtSlice },
  { ep: "/api/internal/campaign-scheduler-cron", secret: process.env.CAMPAIGN_SCHEDULER_CRON_SECRET || jwtSlice },
  { ep: "/api/internal/seo-audit-cron", secret: process.env.AUTO_POSTING_CRON_SECRET || process.env.SOCIAL_PUBLISHING_CRON_SECRET || jwtSlice },
  { ep: "/api/internal/auto-posting-cron", secret: process.env.AUTO_POSTING_CRON_SECRET || process.env.SOCIAL_PUBLISHING_CRON_SECRET || jwtSlice },
];
const STALE_MINUTES = Number(process.env.QSTASH_STALE_MINUTES || 30);
const INTERVAL_MS = Number(process.env.INTERNAL_CRON_INTERVAL_MS || 10 * 60 * 1000);

let running = false;
let lastFallbackAt = 0;

async function qstashStale(): Promise<boolean> {
  try {
    const r = await pool.query(
      `SELECT EXTRACT(EPOCH FROM (NOW() - MAX(created_at)))::int AS age_min
       FROM agent_runs WHERE trigger_source='qstash' AND created_at > NOW() - INTERVAL '7 days'`
    );
    const age = r.rows[0]?.age_min;
    if (age === null || age === undefined) return true;
    return age > STALE_MINUTES;
  } catch { return true; }
}

async function tick() {
  if (running) return;
  running = true;
  try {
    if (!(await qstashStale())) return;
    const results: Record<string, string> = {};
    for (const { ep, secret } of ENDPOINT_DEFS) {
      try {
        const r = await fetch(INTERNAL_BASE + ep, {
          method: "POST",
          headers: { "content-type": "application/json", "x-internal-secret": secret },
          body: JSON.stringify({ trigger: "internal_fallback" }),
          signal: AbortSignal.timeout(58000),
        });
        results[ep] = `HTTP ${r.status}`;
      } catch (e: any) {
        results[ep] = "ERR " + String(e?.message || e).slice(0, 60);
      }
    }
    if (Date.now() - lastFallbackAt > 60 * 60 * 1000) {
      lastFallbackAt = Date.now();
      logger.warn(`[AgentCronFallback] QStash stale >${STALE_MINUTES}p — cron nội bộ đã kích hoạt: ${JSON.stringify(results)}`);
      try {
        await pool.query(
          `INSERT INTO agent_signals (tenant_id, signal_type, subject_type, subject_id, payload, provenance)
           VALUES ('00000000-0000-0000-0000-000000000001', 'qstash_fallback_activated', 'system', 'agent_cron_fallback', $1::jsonb, 'agent_cron_fallback')`,
          [JSON.stringify({ at: new Date().toISOString(), results })]
        );
      } catch { /* signal optional */ }
    }
  } finally {
    running = false;
  }
}

export function startAgentCronFallback() {
  if (process.env.AGENT_CRON_FALLBACK === "0") {
    logger.info("[AgentCronFallback] tắt theo env AGENT_CRON_FALLBACK=0");
    return;
  }
  setInterval(() => { void tick(); }, INTERVAL_MS).unref?.();
  void tick();
  logger.info(`[AgentCronFallback] ON — every ${Math.round(INTERVAL_MS / 60000)}p · ${ENDPOINT_DEFS.length} endpoints · stale>${STALE_MINUTES}p`);
}
