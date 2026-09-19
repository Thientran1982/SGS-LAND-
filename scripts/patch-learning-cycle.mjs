// patch-learning-cycle.mjs — Khuyến nghị 1: sửa learning cycles
// 1) SKIPPED khi tenant chưa có golden set (hết FAILED giả)  2) errorText thật khi gate fail
// 3) alert signal khi FAILED 2 lần liên tiếp. Backups + idempotent.
import fs from "node:fs";
let n = 0;

// ── service: run() type ──
{
  const F = "server/services/autonomousLearningService.ts";
  let s = fs.readFileSync(F, "utf8");
  const o1 = "    run: () => Promise<{ passed: boolean; summary: Record<string, unknown> }>;";
  const n1 = "    run: () => Promise<{ passed: boolean; summary: Record<string, unknown>; status?: 'SKIPPED'; errorText?: string }>;";
  if (s.includes(n1)) console.log("SKIP svc-runtype");
  else if (s.includes(o1)) { s = s.replace(o1, n1); n++; console.log("OK svc run-type +SKIPPED"); }
  else { console.log("FAIL svc run-type anchor"); process.exit(1); }
  const o2 = "input: { passed: boolean; summary: Record<string, unknown>; errorText?: string; traceId?: string; }) {";
  const n2 = "input: { passed: boolean; summary: Record<string, unknown>; status?: 'SKIPPED'; errorText?: string; traceId?: string; }) {";
  if (s.includes(n2)) console.log("SKIP svc-finish-type");
  else if (s.includes(o2)) { s = s.replace(o2, n2); n++; console.log("OK svc finish-type +SKIPPED"); }
  else { console.log("FAIL svc finish-type anchor"); process.exit(1); }
  const o3 = "const status = input.passed ? 'PASSED' : 'FAILED';";
  const n3 = "const status = input.status === 'SKIPPED' ? 'SKIPPED' : input.passed ? 'PASSED' : 'FAILED';";
  if (s.includes(n3)) console.log("SKIP svc-status");
  else if (s.includes(o3)) { s = s.replace(o3, n3); n++; console.log("OK svc status SKIPPED"); }
  else { console.log("FAIL svc status anchor"); process.exit(1); }
  const o4 = "[tenantId, input.passed ? 'EVALUATION_PASSED' : 'EVALUATION_FAILED', cycleId,";
  const n4 = "[tenantId, input.status === 'SKIPPED' ? 'EVALUATION_SKIPPED' : input.passed ? 'EVALUATION_PASSED' : 'EVALUATION_FAILED', cycleId,";
  if (s.includes(n4)) console.log("SKIP svc-audit");
  else if (s.includes(o4)) { s = s.replace(o4, n4); n++; console.log("OK svc audit event SKIPPED"); }
  else { console.log("FAIL svc audit anchor"); process.exit(1); }
  fs.copyFileSync(F, F + ".bak-lc");
  fs.writeFileSync(F, s);
}

// ── runner: guard + errorText + alert ──
{
  const F = "server/services/learningCycleRunner.ts";
  let s = fs.readFileSync(F, "utf8");
  const o5 = [
    "        const golden = await evaluateGoldenSet(tenantId);",
    "        const feedback = await adjudicateFeedbackForTenant(tenantId);",
    "        return {",
    "          passed: golden.passed,",
    "          summary: { ...golden.summary, feedback },",
    "        };",
  ].join("\n");
  const n5 = [
    "        const golden = await evaluateGoldenSet(tenantId);",
    "        const feedback = await adjudicateFeedbackForTenant(tenantId);",
    "        // P-AUDIT #1: tenant chua co golden set du toi thieu → SKIPPED (khong phai FAILED gia)",
    "        const minCases = Number(golden.summary?.gates?.minimumCases ?? 20);",
    "        const casesEvaluated = Number(golden.summary?.casesEvaluated ?? 0);",
    "        if (casesEvaluated < minCases) {",
    "          return {",
    "            passed: true,",
    "            status: 'SKIPPED' as const,",
    "            summary: { ...golden.summary, feedback, skippedReason: `golden_set_insufficient:${casesEvaluated}/${minCases}` },",
    "          };",
    "        }",
    "        return {",
    "          passed: golden.passed,",
    "          summary: { ...golden.summary, feedback },",
    "          errorText: golden.passed ? undefined : `gate failed: match=${golden.summary?.match?.accuracy} valuation=${golden.summary?.valuation?.passRate} cases=${casesEvaluated}`,",
    "        };",
  ].join("\n");
  if (s.includes("golden_set_insufficient")) console.log("SKIP runner-guard");
  else if (s.includes(o5)) { s = s.replace(o5, n5); n++; console.log("OK runner guard SKIPPED + errorText"); }
  else { console.log("FAIL runner guard anchor"); process.exit(1); }
  const o6 = [
    "    });",
    "    if (",
    "      evaluation.claimed",
    "      && evaluation.cycle?.status === 'PASSED'",
  ].join("\n");
  const n6 = [
    "    });",
    "    // P-AUDIT #1b: alert khi cycle FAILED 2 lan lien tiep cua tenant",
    "    if (evaluation.claimed && evaluation.cycle?.status === 'FAILED') {",
    "      try {",
    "        const consec = await withTenantContext(tenantId, async (client) => (await client.query(",
    "          `SELECT COUNT(*)::int AS c FROM (SELECT status FROM ai_learning_cycles WHERE tenant_id=$1 ORDER BY started_at DESC LIMIT 2) t WHERE status='FAILED'`,",
    "          [tenantId],",
    "        )).rows[0]?.c || 0);",
    "        if (consec >= 2) {",
    "          void agentMemoryService.recordSignal(tenantId, {",
    "            signalType: 'learning_cycle_failed',",
    "            actorId: 'MINH',",
    "            subjectType: 'learning_cycle',",
    "            subjectId: String(evaluation.cycle.cycle_key || evaluation.cycle.id),",
    "            dedupeKey: `lc-fail:${tenantId}:${evaluation.cycle.cycle_key || evaluation.cycle.id}`,",
    "            payload: { cycleKey: evaluation.cycle.cycle_key, errorText: evaluation.cycle.error_text },",
    "            provenance: 'learning_cycle_runner',",
    "          }).catch(() => undefined);",
    "          logger.warn(`[LearningCycle] FAILED x${consec} lien tiep tenant=${tenantId} cycle=${evaluation.cycle.cycle_key}`);",
    "        }",
    "      } catch { /* alert optional */ }",
    "    }",
    "    if (",
    "      evaluation.claimed",
    "      && evaluation.cycle?.status === 'PASSED'",
  ].join("\n");
  if (s.includes("learning_cycle_failed")) console.log("SKIP runner-alert");
  else if (s.includes(o6)) { s = s.replace(o6, n6); n++; console.log("OK runner alert FAILED x2"); }
  else { console.log("FAIL runner alert anchor"); process.exit(1); }
  fs.copyFileSync(F, F + ".bak-lc");
  fs.writeFileSync(F, s);
}
console.log(n ? "PATCH-LC-OK (" + n + " thay doi)" : "PATCH-LC-NOTHING");
