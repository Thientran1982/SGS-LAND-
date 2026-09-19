// patch-server-mount.mjs — mount follow-up system vào server.ts (Rec 3)
import fs from "node:fs";
const F = "server.ts";
let s = fs.readFileSync(F, "utf8");
if (s.includes("createFollowUpRoutes")) { console.log("SKIP already mounted"); process.exit(0); }
let n = 0;
// 1) imports: chèn sau dòng import cuối cùng ở đầu file
const importRe = /^import .*$/m;
const firstImport = s.match(importRe);
if (!firstImport) { console.log("MISS import anchor"); process.exit(1); }
const idx = firstImport.index + firstImport[0].length;
const imports = '\nimport { createFollowUpRoutes } from "./server/routes/followupRoutes";\nimport { createFollowUpCronRouter, startFollowUpCron } from "./server/routes/followupCronRoutes";';
s = s.slice(0, idx) + imports + s.slice(idx);
n++;
// 2) mount block: chèn ngay trước server.listen( hoặc app.listen(
let listenIdx = s.indexOf("server.listen(");
if (listenIdx === -1) listenIdx = s.indexOf("app.listen(");
if (listenIdx === -1) { console.log("MISS listen anchor"); process.exit(1); }
// đầu dòng chứa listen
const lineStart = s.lastIndexOf("\n", listenIdx) + 1;
const block = [
  "  // P-AUDIT Rec3: follow-up agent system (D+1/3/5/7, Zalo→SMS→Email)",
  "  app.use(apiRateLimit, createFollowUpRoutes(pool, authenticateToken));",
  "  {",
  "    const followUpCronSecret =",
  "      process.env.FOLLOWUP_CRON_SECRET ||",
  "      process.env.JWT_SECRET?.slice(0, 32) ||",
  "      '';",
  "    app.use(createFollowUpCronRouter(pool, followUpCronSecret));",
  "    try {",
  "      startFollowUpCron(pool, followUpCronSecret);",
  "    } catch (err: any) {",
  "      logger.warn(`[FollowUpCron] Không thể khởi động in-process cron: ${err?.message || err}`);",
  "    }",
  "  }",
  "",
].join("\n");
s = s.slice(0, lineStart) + block + s.slice(lineStart);
n++;
fs.copyFileSync(F, F + ".bak-rec3");
fs.writeFileSync(F, s);
console.log("MOUNT-OK changes=" + n + " (backup server.ts.bak-rec3)");
