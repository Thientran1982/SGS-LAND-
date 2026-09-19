import fs from "node:fs";
const F = "server/services/autonomousLearningService.ts";
let s = fs.readFileSync(F, "utf8");
const re = /(async finishEvaluationCycle\(tenantId: string, cycleId: string, input: \{[\s\S]*?passed: boolean; summary: Record<string, unknown>;)([\s\S]*?traceId\?: string;[\s\S]*?\}\) \{)/;
if (!re.test(s)) { console.log("RE-MISS"); process.exit(1); }
if (s.includes("status?: 'SKIPPED'")) { console.log("ALREADY"); process.exit(0); }
s = s.replace(re, "$1 status?: 'SKIPPED';$2");
fs.writeFileSync(F, s);
console.log("FINISH-TYPE-FIXED");
