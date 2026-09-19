import fs from "node:fs";
const run = "server/services/learningCycleRunner.ts";
let s = fs.readFileSync(run, "utf8");
if (s.includes("learning_cycle_failed")) { console.log("SKIP alert already"); process.exit(0); }
// Regex linh hoạt khoảng trắng: điểm kết thúc runLockedEvaluationCycle call + if ( PASSED )
const re = /(\}\);\s*\n)(\s*if \(\s*\n\s*evaluation\.claimed\s*\n\s*&& evaluation\.cycle\?\.status === 'PASSED')/;
if (!re.test(s)) { console.log("RE-MISS"); process.exit(1); }
const alert = [
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
].join("\n");
s = s.replace(re, (m, p1, p2) => p1 + alert + "\n" + p2);
fs.writeFileSync(run, s);
console.log("FIX6-ALERT-OK");
