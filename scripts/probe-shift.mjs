import fs from "node:fs";
const F = "server/repositories/agentOperatingRepository.ts";
const s = fs.readFileSync(F, "utf8");
const i = s.indexOf("generateDailyShiftReport");
if (i === -1) { console.log("NO-FUNC"); process.exit(0); }
console.log(JSON.stringify({ at: i, snippet: s.slice(i, i + 900).replace(/\n/g, "⏎") }));
