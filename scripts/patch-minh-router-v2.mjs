// patch-minh-router-v2.mjs — P2/P3c/P4: onResult telemetry vào call site S1 + verifier vào minhDelegateTask
import fs from "node:fs";
let changed = 0;

// 1) minhOrchestrator: nâng cấp call site S1 (thêm onResult telemetry — P4)
{
  const F = "server/ai/minhOrchestrator.ts";
  let src = fs.readFileSync(F, "utf8");
  const oldCall = 'const s1 = await minhSystemOneIntentJson({ generateFn: args.generateFn, message: args.message, intents: MINH_INTENT_TOOLS, feature: "MINH_ORCHESTRATOR", timeoutMs: 2500 });';
  const newCall = `const s1 = await minhSystemOneIntentJson({
        generateFn: args.generateFn, message: args.message, intents: MINH_INTENT_TOOLS,
        feature: "MINH_ORCHESTRATOR", timeoutMs: 2500,
        onResult: (r) => { try { void agentMemoryService.recordSignal(args.tenantId, { signalType: "minh_systemone_router", actorId: "MINH", subjectType: "chat_message", subjectId: String(args.message).slice(0, 120), dedupeKey: "minh-s1:" + (args.sessionId || "no-session") + ":" + Date.now().toString(36), payload: r, provenance: "minh_orchestrator" }).catch(() => undefined); } catch {} },
      });`;
  if (src.includes(newCall)) console.log("SKIP orchestrator (v2 da ap dung)");
  else if (src.includes(oldCall)) { src = src.split(oldCall).join(newCall); fs.writeFileSync(F, src); changed++; console.log("OK orchestrator: onResult signal (P4)"); }
  else { console.log("FAIL orchestrator: khong tim thay call site v1"); process.exit(1); }
}

// 2) minhBrain: import verifier + boc return thanh cong cua minhDelegateTask (P3c)
{
  const F = "server/ai/minhBrain.ts";
  let src = fs.readFileSync(F, "utf8");
  if (src.includes("verifyMinhAnswer")) { console.log("SKIP minhBrain (da co verifier)"); }
  else {
    const impAnchor = "import { minhChooseSpecialist, keywordPlan, MINH_INTENT_TOOLS } from './minhOrchestrator';";
    if (!src.includes(impAnchor)) { console.log("FAIL minhBrain: anchor import"); process.exit(1); }
    src = src.replace(impAnchor, impAnchor + '\nimport { verifyMinhAnswer } from "../lib/minhSystemOneRouter.js";');
    const retAnchor = "return { plan: planWithToken, tool: specialist.tool, args: specialist.args, status: specialist.status, output: specialist.output, error: specialist.error, durationMs: Date.now() - started, runId: specialist.runId, correct: specialist.correct, via: 'typescript' };";
    if (!src.includes(retAnchor)) { console.log("FAIL minhBrain: anchor return"); process.exit(1); }
    const repl = `// JEV-ULTRAFAST P3c: DONE khong tu chung minh thanh cong — verifier doc lap (env JEV_VERIFY=1, chi GHI DAU khong chan)
    let verify: Record<string, any> | null = null;
    if (specialist.status === 'SUCCESS' && process.env.JEV_VERIFY === '1') {
      try {
        verify = await verifyMinhAnswer({
          generateFn: (p: any) => generateLiveChatText({ ...p, feature: 'MINH_VERIFY' }),
          question: task,
          answer: typeof specialist.output === 'string' ? specialist.output : JSON.stringify(specialist.output ?? {}).slice(0, 3000),
          timeoutMs: 12000,
          onResult: (r: any) => { try { void agentMemoryService.recordSignal(tenantId, { signalType: 'minh_verify', actorId: 'MINH', subjectType: 'brain_task', subjectId: String(task).slice(0, 120), dedupeKey: 'minh-verify:' + crypto.randomUUID(), payload: r, provenance: 'minh_brain' }).catch(() => undefined); } catch {} },
        });
      } catch { verify = null; }
    }
    return { plan: planWithToken, tool: specialist.tool, args: specialist.args, status: specialist.status, output: specialist.output, error: specialist.error, durationMs: Date.now() - started, runId: specialist.runId, correct: specialist.correct, via: 'typescript', ...(verify ? { verify } : {}) };`;
    src = src.replace(retAnchor, repl);
    fs.copyFileSync(F, F + ".bak-jev2");
    fs.writeFileSync(F, src);
    changed++;
    console.log("OK minhBrain: verifyMinhAnswer vao minhDelegateTask (P3c) + signal (P4), backup .bak-jev2");
  }
}
console.log(changed ? "PATCH-V2-OK (" + changed + " file)" : "PATCH-V2-NOTHING");
