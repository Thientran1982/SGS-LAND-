// patch-openrouter-fallback.mjs — bật OpenRouter làm fallback khẩn cấp (model free đã test sống)
import fs from "node:fs";
const F = "server/ai/providers/index.ts";
let src = fs.readFileSync(F, "utf8");
if (src.includes("nex-agi/nex-n2.5-mini:free") && src.includes("openrouter: true,")) { console.log("SKIP: da ap dung"); process.exit(0); }
const o1 = "openrouter: 'z-ai/glm-5.3',";
if (!src.includes(o1)) { console.log("FAIL: anchor model"); process.exit(1); }
src = src.replace(o1, "openrouter: 'nex-agi/nex-n2.5-mini:free', // P-OR: model free da test 200 (z-ai/glm-5.3 gay 402 khi chua nap credit)");
const o2 = "openrouter: false,";
const count = src.split(o2).length - 1;
if (count !== 1) { console.log("FAIL: anchor enabled count=" + count); process.exit(1); }
src = src.replace(o2, "openrouter: true, // P-OR: fallback cuoi cung khi bai/anthropic/xai/openai deu chet");
fs.copyFileSync(F, F + ".bak-or");
fs.writeFileSync(F, src);
console.log("PATCH-OR-OK (backup " + F + ".bak-or)");
