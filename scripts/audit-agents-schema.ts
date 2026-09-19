import { pool } from "../server/db";
const c = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='ai_agents' ORDER BY ordinal_position`);
console.log("AI_AGENTS-COLS", c.rows.map((r: any) => r.column_name + ":" + r.data_type).join(", "));
const n = await pool.query(`SELECT COUNT(*)::int c FROM ai_agents`);
console.log("AI_AGENTS-COUNT", n.rows[0].c);
const sample = await pool.query(`SELECT * FROM ai_agents LIMIT 3`);
for (const r of sample.rows) console.log("AG-SAMPLE", JSON.stringify(r).slice(0, 300));
await pool.end();
process.exit(0);
