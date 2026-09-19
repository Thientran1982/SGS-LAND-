import { pool } from "../server/db";
const MAIN = "00000000-0000-0000-0000-000000000001";
const a = await pool.query(`SELECT name, display_name, role, active FROM ai_agents WHERE tenant_id=$1 ORDER BY name`, [MAIN]);
console.log("== MAIN-TENANT AGENTS (" + a.rows.length + ") ==");
for (const r of a.rows) console.log("AG", JSON.stringify({ name: r.name, role: r.role, active: r.active }));
// agents tên chuẩn (pipeline prompt dùng) thuộc tenants nào
const std = await pool.query(`SELECT tenant_id, name, active FROM ai_agents WHERE name IN ('SALES_AGENT','MARKETING_AGENT','ROUTER','WRITER','INVENTORY_AGENT','FINANCE_AGENT','LEGAL_AGENT','CONTRACT_AGENT','LEAD_ANALYST_AGENT','VALUATION_AGENT','FOLLOWUP_AGENT','QC_AGENT') ORDER BY name LIMIT 20`);
console.log("== STD-NAMED AGENTS ==");
for (const r of std.rows) console.log("STD", r.tenant_id?.slice(0, 8), r.name, "active=" + r.active);
// skills distinct cho MAIN tenant
const sk = await pool.query(`SELECT skill_key, category, title, id FROM agent_skills WHERE tenant_id=$1 AND published=true ORDER BY category, skill_key`, [MAIN]);
console.log("== MAIN SKILLS (" + sk.rows.length + ") ==");
for (const r of sk.rows) console.log("MSK", r.category, r.skill_key, r.id.slice(0, 8));
await pool.end();
process.exit(0);
