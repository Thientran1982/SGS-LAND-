// audit-jev.ts — audit sâu JEV trên hệ SGS LAND (file + wiring + engine + DB)
import fs from "node:fs";

console.log("== 1. FILE INVENTORY ==");
const FILES = [
  "server/lib/jevcompact.js", "server/lib/systemone.js",
  "server/lib/minhSystemOneRouter.ts", "server/cron/agentCronFallback.ts",
  "scripts/patch-lc-wire.mjs", "scripts/patch-server-mount.mjs",
];
for (const f of FILES) {
  try { const s = fs.statSync(f); console.log("FILE", f, s.size + "B"); }
  catch { console.log("FILE", f, "MISSING"); }
}

console.log("== 2. WIRING ==");
const check = (f: string, needles: string[]) => {
  try {
    const s = fs.readFileSync(f, "utf8");
    for (const n of needles) console.log("WIRE", f.split("/").pop(), JSON.stringify(n), s.includes(n) ? "OK" : "MISSING");
  } catch (e: any) { console.log("WIRE", f, "READ-ERR", String(e?.message).slice(0, 60)); }
};
check("server/ai/minhOrchestrator.ts", ["minhSystemOneIntentJson", "systemOneRouterEnabled", "onResult: (r) =>"]);
check("server/ai/minhBrain.ts", ["verifyMinhAnswer", "JEV_VERIFY === '1'"]);
check("server/ai/liveChatEngine.ts", ["followupSequenceRepository", "price_followup_needed"]);
check("server.ts", ["startAgentCronFallback", "createFollowUpRoutes", "openrouter: true", "nex-agi/nex-n2.5-mini:free"]);
check("server/services/durableAgentExecutionService.ts", ["Câu hỏi của khách"]);
check("server/repositories/agentOperatingRepository.ts", ["agentRuns: runs.rows[0]", "SKIPPED"]);

console.log("== 3. ENGINE SMOKE (fake asker, không mạng) ==");
const { makeLocalAsker } = await import("../server/lib/systemone.js");
const { compact } = await import("../server/lib/jevcompact.js");
const asker = makeLocalAsker({ model: "fake", llmCall: async (messages: any[]) => {
  const names = [...String(messages[1]?.content || "").matchAll(/"(call_[^"]+|result_[^"]+)"/g)].map((m: any) => m[1]);
  const answers: any = {};
  for (const n of new Set(names as string[])) answers[n] = { noul: String(n).startsWith("call_") ? 0.95 : 0.05 };
  return { ok: true, text: JSON.stringify({ answers }) };
} });
const long = "X".repeat(600);
const hist: any[] = [
  { role: "user", text: "muc tieu" },
  { role: "assistant", text: "", toolUses: [{ tool_use_id: "t1", tool: "get_report", input: { dept: "cskh" }, text: long }] },
  { role: "user", text: "", toolResults: [{ tool_use_id: "t1", text: long }] },
  { role: "user", text: "hoi tiep" },
  { role: "assistant", text: "tra loi" },
];
const result = await compact(hist, asker, { preserveRecentMessages: 1, minReductionRatio: 0.1 });
console.log("SMOKE", JSON.stringify({ requests: result.stats.requests, giamPct: Math.round((1 - result.stats.charsAfter / result.stats.charsBefore) * 100) }));

console.log("== 4. ROUTER VALIDATION ==");
const { minhSystemOneIntentJson, systemOneRouterEnabled } = await import("../server/lib/minhSystemOneRouter.js");
process.env.JEV_MODE = process.env.JEV_MODE || "local";
console.log("MODE", process.env.JEV_MODE, "enabled=", systemOneRouterEnabled());
const gen = async () => JSON.stringify({ answers: { specialist: { choice: "VALUATION", confidence: 0.9, probabilities: { VALUATION: 0.85, SEARCH: 0.1, GENERAL: 0.05 } } } });
const r = await minhSystemOneIntentJson({ generateFn: gen, message: "gia nha 100m2?", intents: { VALUATION: "dg", SEARCH: "tk", GENERAL: "c" }, timeoutMs: 5000 });
console.log("ROUTER", JSON.stringify(r));

console.log("== 5. DB SIGNALS & CYCLES ==");
const { pool } = await import("../server/db");
const sg = await pool.query(`SELECT signal_type, COUNT(*)::int c FROM agent_signals WHERE signal_type IN ('minh_systemone_router','price_followup_needed','qstash_fallback_activated','learning_cycle_failed','minh_verify') GROUP BY 1 ORDER BY c DESC`);
for (const r of sg.rows) console.log("DB-SIG", r.signal_type, r.c);
const lc = await pool.query(`SELECT status, COUNT(*)::int c FROM ai_learning_cycles WHERE started_at > NOW() - INTERVAL '3 days' GROUP BY 1`);
for (const r of lc.rows) console.log("DB-LC", r.status, r.c);
const envRow = await pool.query(`SELECT config_value->'providerFallback' AS pf FROM enterprise_config WHERE config_key='ai_config' LIMIT 1`).catch(() => ({rows: []}));
console.log("PF-CFG", JSON.stringify(envRow.rows[0] || {}).slice(0, 120));
await pool.end();
process.exit(0);
