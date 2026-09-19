import { pool, withTenantContext } from "../server/db";
// định nghĩa withTenantContext
import fs from "node:fs";
const dbSrc = fs.readFileSync("server/db.ts", "utf8");
const i = dbSrc.indexOf("withTenantContext");
console.log("WTC-SRC", JSON.stringify(dbSrc.slice(Math.max(0, i - 60), i + 420)));
// RLS policy của ai_agents
const pol = await pool.query(`SELECT policyname, cmd, qual FROM pg_policies WHERE tablename='ai_agents' LIMIT 3`);
for (const r of pol.rows) console.log("POL", r.policyname, r.cmd, String(r.qual).slice(0, 160));
const rls = await pool.query(`SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname IN ('ai_agents','agent_skills')`);
for (const r of rls.rows) console.log("RLS", r.relname, "row=" + r.relrowsecurity, "force=" + r.relforcerowsecurity);
await pool.end();
process.exit(0);
