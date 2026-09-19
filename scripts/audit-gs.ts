import { pool } from "../server/db";
const c = await pool.query(`SELECT COUNT(*)::int AS total, COUNT(DISTINCT tenant_id)::int AS tenants FROM ai_golden_set_cases WHERE active = true`);
console.log("GOLDEN-ACTIVE", JSON.stringify(c.rows[0]));
const byT = await pool.query(`SELECT tenant_id, category, COUNT(*)::int AS c FROM ai_golden_set_cases WHERE active = true GROUP BY 1,2 ORDER BY 1,2 LIMIT 12`);
for (const r of byT.rows) console.log("GS", r.tenant_id?.slice(0, 8), r.category, r.c);
await pool.end();
process.exit(0);
