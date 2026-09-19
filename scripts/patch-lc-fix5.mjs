import fs from "node:fs";
const run = "server/services/learningCycleRunner.ts";
const o6 = [
  "  });",
  "  if (",
  "      evaluation.claimed",
].join("\n");
const n6 = [
  "  });",
  "  // P-AUDIT #1b: alert khi cycle FAILED 2 lan lien tiep cua tenant",
  "  if (evaluation.claimed && evaluation.cycle?.status === 'FAILED') {",
  "    try {",
  "      const consec = await withTenantContext(tenantId, async (client) => (await client.query(",
  "        `SELECT COUNT(*)::int AS c FROM (SELECT status FROM ai_learning_cycles WHERE tenant_id=$1 ORDER BY started_at DESC LIMIT 2) t WHERE status='FAILED'`,",
  "        [tenantId],",
  "      )).rows[0]?.c || 0);",
  "      if (consec >= 2) {",
  "        void agentMemoryService.recordSignal(tenantId, {",
  "          signalType: 'learning_cycle_failed',",
  "          actorId: 'MINH',",
  "          subjectType: 'learning_cycle',",
  "          subjectId: String(evaluation.cycle.cycle_key || evaluation.cycle.id),",
  "          dedupeKey: `lc-fail:${tenantId}:${evaluation.cycle.cycle_key || evaluation.cycle.id}`,",
  "          payload: { cycleKey: evaluation.cycle.cycle_key, errorText: evaluation.cycle.error_text },",
  "          provenance: 'learning_cycle_runner',",
  "        }).catch(() => undefined);",
  "        logger.warn(`[LearningCycle] FAILED x${consec} lien tiep tenant=${tenantId} cycle=${evaluation.cycle.cycle_key}`);",
  "      }",
  "    } catch { /* alert optional */ }",
  "  }",
  "  if (",
  "      evaluation.claimed",
].join("\n");
let s = fs.readFileSync(run, "utf8");
if (s.includes("learning_cycle_failed")) { console.log("SKIP alert already"); process.exit(0); }
if (!s.includes(o6)) { console.log("MISS alert anchor"); process.exit(1); }
s = s.replace(o6, n6);
fs.writeFileSync(run, s);
console.log("FIX5-ALERT-OK");
