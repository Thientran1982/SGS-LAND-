// patch-minh-router.mjs — ghép SystemOne vào minhChooseSpecialist (env-gated, idempotent, có backup)
import fs from "node:fs";
const F = "server/ai/minhOrchestrator.ts";
let src = fs.readFileSync(F, "utf8");
if (src.includes("minhSystemOneIntentJson")) { console.log("PATCH-SKIP: đã áp dụng trước đó"); process.exit(0); }
const anchorImp = "export const MINH_INTENT_TOOLS";
if (!src.includes(anchorImp)) { console.log("PATCH-FAIL: mất anchor import"); process.exit(1); }
src = src.replace(anchorImp, 'import { minhSystemOneIntentJson, systemOneRouterEnabled } from "../lib/minhSystemOneRouter.js";\n\n' + anchorImp);
const re = /raw = await args\.generateFn\(\{[\s\S]*?timeoutMs: 2500,\s*\n\s*\}\);/g;
const hits = src.match(re) || [];
if (hits.length !== 1) { console.log("PATCH-FAIL: anchor generateFn không duy nhất (" + hits.length + ")"); process.exit(1); }
const oldBlock = hits[0];
const innerArgs = oldBlock.slice(oldBlock.indexOf("{") + 1, oldBlock.lastIndexOf("})"));
const replacement = 'if (!systemOneRouterEnabled()) {\n      raw = await args.generateFn({' + innerArgs + '});\n    } else {\n      // JEV-ULTRAFAST P3b: engine SystemOne riêng (1 request choice + probabilities, env JEV_MODE).\n      // Lỗi/thiếu shape → null → đi đường LLM-JSON cũ bên dưới. FAIL-CLOSED.\n      const s1 = await minhSystemOneIntentJson({ generateFn: args.generateFn, message: args.message, intents: MINH_INTENT_TOOLS, feature: "MINH_ORCHESTRATOR", timeoutMs: 2500 });\n      raw = s1\n        ? JSON.stringify({ intent: s1.intent, reason: s1.reason, confidence: s1.confidence })\n        : await args.generateFn({' + innerArgs + '});\n    }';
fs.copyFileSync(F, F + ".bak-jev");
src = src.replace(re, replacement);
fs.writeFileSync(F, src);
console.log("PATCH-OK (backup: " + F + ".bak-jev)");
