import { pool } from "../server/db";
const cols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='agent_runs' ORDER BY ordinal_position`);
console.log("RUNS-COLS", cols.rows.map((c: any) => c.column_name).join(","));

// runs 14d theo trigger_source + status nếu có
const cn = cols.rows.map((c: any) => c.column_name);
const g1 = cn.includes("trigger_source") ? "trigger_source" : null;
const g2 = cn.includes("status") ? "status" : null;
if (g1) {
  const r = await pool.query(`SELECT ${g1}, ${g2 ? g2 + "," : ""} COUNT(*)::int c FROM agent_runs WHERE created_at > NOW() - INTERVAL '14 days' GROUP BY ${g1} ${g2 ? "," + g2 : ""} ORDER BY c DESC LIMIT 14`);
  console.log("== RUNS 14D BY TRIGGER ==");
  for (const row of r.rows) console.log("RUNT", JSON.stringify(row));
}
// trend theo ngày
const r2 = await pool.query(`SELECT DATE(created_at) d, COUNT(*)::int c FROM agent_runs WHERE created_at > NOW() - INTERVAL '14 days' GROUP BY 1 ORDER BY 1 DESC LIMIT 14`);
console.log("== RUNS DAILY ==");
for (const row of r2.rows) console.log("RUND", row.d, row.c);

// role cards chi tiết
const rc = await pool.query(`SELECT agent_key, active, approval_status FROM agent_role_cards ORDER BY agent_key`);
console.log("== ROLE CARDS ==");
for (const row of rc.rows) console.log("RC", JSON.stringify(row));

// skills: key + published
const sk = await pool.query(`SELECT skill_key, category, published, install_count FROM agent_skills ORDER BY install_count DESC NULLS LAST LIMIT 12`);
console.log("== SKILLS ==");
for (const row of sk.rows) console.log("SK", JSON.stringify(row));

// learning cycles: cột thời gian
const lcols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='ai_learning_cycles'`);
const lcn = lcols.rows.map((c: any) => c.column_name);
console.log("LC-COLS", lcn.join(","));
const tcol = ["updated_at", "started_at", "created", "timestamp"].find((c) => lcn.includes(c));
if (tcol) {
  const lc = await pool.query(`SELECT * FROM ai_learning_cycles ORDER BY "${tcol}" DESC LIMIT 4`);
  for (const row of lc.rows) console.log("LC", JSON.stringify(row).slice(0, 240));
}
await pool.end();
process.exit(0);
