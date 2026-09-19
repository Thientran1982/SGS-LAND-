import fs from "node:fs";
const svc = "server/services/autonomousLearningService.ts";
const run = "server/services/learningCycleRunner.ts";
let applied = 0;
const apply = (file, oldStr, newStr, tag) => {
  let s = fs.readFileSync(file, "utf8");
  if (s.includes(newStr)) { console.log("SKIP " + tag); return; }
  if (!s.includes(oldStr)) { console.log("MISS " + tag); process.exit(1); }
  s = s.split(oldStr).join(newStr);
  fs.writeFileSync(file, s);
  applied++;
  console.log("OK " + tag);
};

// svc 1: run() type
apply(svc,
  "    run: () => Promise<{ passed: boolean; summary: Record<string, unknown> }>;",
  "    run: () => Promise<{ passed: boolean; summary: Record<string, unknown>; status?: 'SKIPPED'; errorText?: string }>;",
  "svc-runtype");

// svc 2: status const
apply(svc,
  "const status = input.passed ? 'PASSED' : 'FAILED';",
  "const status = input.status === 'SKIPPED' ? 'SKIPPED' : input.passed ? 'PASSED' : 'FAILED';",
  "svc-status");

// svc 3: audit event type
apply(svc,
  "[tenantId, input.passed ? 'EVALUATION_PASSED' : 'EVALUATION_FAILED', cycleId,",
  "[tenantId, input.status === 'SKIPPED' ? 'EVALUATION_SKIPPED' : input.passed ? 'EVALUATION_PASSED' : 'EVALUATION_FAILED', cycleId,",
  "svc-audit");

// runner 1: guard SKIPPED + errorText
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
apply(run, o5, n5, "runner-guard");

// runner 2: alert FAILED x2
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
apply(run, o6, n6, "runner-alert");

console.log("FIX3-DONE applied=" + applied);
