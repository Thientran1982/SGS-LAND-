import { pool } from "../server/db";
const MAIN = "00000000-0000-0000-0000-000000000001";
// toàn bộ skills
const sk = await pool.query(`SELECT skill_key, category, title, version, published FROM agent_skills ORDER BY category, skill_key`);
console.log("== SKILLS (" + sk.rows.length + ") ==");
for (const r of sk.rows) console.log("SK", JSON.stringify(r));
// agents của tenant chính
const ag = await pool.query(`SELECT id, name, agent_type FROM ai_agents WHERE tenant_id=$1 ORDER BY name`, [MAIN]);
console.log("== AGENTS MAIN (" + ag.rows.length + ") ==");
for (const r of ag.rows) console.log("AG", r.name, "| type:", r.agent_type || "-", "| id:", String(r.id).slice(0, 8));
await pool.end();
process.exit(0);
