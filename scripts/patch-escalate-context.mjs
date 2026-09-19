// patch-escalate-context.mjs — escalation kèm câu hỏi của khách (hết template generic)
import fs from "node:fs";
const F = "server/services/durableAgentExecutionService.ts";
let s = fs.readFileSync(F, "utf8");
if (s.includes("Câu hỏi của khách:")) { console.log("SKIP already"); process.exit(0); }
const o = "question: `Minh đã escalate một phản hồi cần con người xác minh (session=${params.sessionId || 'n/a'}).`,";
const n = "question: `Minh đã escalate một phản hồi cần con người xác minh (session=${params.sessionId || 'n/a'}). Câu hỏi của khách: ${String(params.message || '').slice(0, 300)}`,";
if (!s.includes(o)) { console.log("MISS anchor"); process.exit(1); }
s = s.replace(o, n);
fs.copyFileSync(F, F + ".bak-esc");
fs.writeFileSync(F, s);
console.log("ESCALATE-CONTEXT-OK");
