// patch-server-fallback.mjs — mount QStash fallback watchdog vào server.ts
import fs from "node:fs";
const F = "server.ts";
let s = fs.readFileSync(F, "utf8");
if (s.includes("startAgentCronFallback")) { console.log("SKIP already mounted"); process.exit(0); }
let n = 0;
// 1) import — chèn sau dòng import cuối (trước dòng code đầu tiên)
const importMatch = s.match(/^import .*$/m);
if (!importMatch) { console.log("MISS import anchor"); process.exit(1); }
const iIdx = importMatch.index + importMatch[0].length;
s = s.slice(0, iIdx) + '\nimport { startAgentCronFallback } from "./server/cron/agentCronFallback";' + s.slice(iIdx);
n++;
// 2) start — chèn ngay trước server.listen( / app.listen(
let li = s.indexOf("server.listen(");
if (li === -1) li = s.indexOf("app.listen(");
if (li === -1) { console.log("MISS listen anchor"); process.exit(1); }
const lineStart = s.lastIndexOf("\n", li) + 1;
s = s.slice(0, lineStart) + "  // P-AUDIT: QStash watchdog — cron nội bộ thay thế khi QStash hết token/chết\n  startAgentCronFallback();\n" + s.slice(lineStart);
n++;
fs.copyFileSync(F, F + ".bak-qstash");
fs.writeFileSync(F, s);
console.log("FALLBACK-MOUNT-OK changes=" + n + " (backup server.ts.bak-qstash)");
