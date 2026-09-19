// audit-agents2.ts — drill-down: runs schema, role cards, skills, cron/daemon
import { pool } from "../server/db";

// 0. schema agent_runs
const cols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='agent_runs'`);
console.log("RUNS-COLS", cols.rows.map((c: any) => c.column_name).join(","));

// 1. runs 14d theo feature/agent + status (tự thích ứng cột)
const hasFeature = cols.rows.some((c: any) => c.column_name === "feature");
const hasStatus = cols.rows.some((c: any) => c.column_name === "status");
if (hasFeature) {
  const q = hasStatus
    ? `SELECT feature, status, COUNT(*)::int c FROM agent_runs WHERE created_at > NOW() - INTERVAL '14 days' GROUP BY feature, status ORDER BY c DESC LIMIT 14`
    : `SELECT feature, COUNT(*)::int c FROM agent_runs WHERE created_at > NOW() - INTERVAL '14 days' GROUP BY feature ORDER BY c DESC LIMIT 14`;
  const r = await pool.query(q);
  console.log("== RUNS-BY-FEATURE 14D ==");
  for (const row of r.rows) console.log("RUNF", JSON.stringify(row));
}

// 2. role cards: rollout + KPI
try {
  const rc = await pool.query(`SELECT * FROM agent_role_cards LIMIT 20`);
  const sample = rc.rows[0] || {};
  const keys = Object.keys(sample);
  console.log("ROLE-COLS", keys.join(","));
  for (const row of rc.rows) {
    console.log("ROLE", JSON.stringify({ id: row.id || row.card_id, name: row.name || row.agent_name, rollout: row.rollout || row.status, enabled: row.enabled }));
  }
} catch (e: any) { console.log("ROLE-ERR", String(e?.message || e).slice(0, 90)); }

// 3. skills 28
try {
  const sk = await pool.query(`SELECT * FROM agent_skills LIMIT 30`);
  const keys = Object.keys(sk.rows[0] || {});
  console.log("SKILL-COLS", keys.join(","));
  for (const row of sk.rows) console.log("SKILL", JSON.stringify({ id: row.id, name: row.name || row.skill_name, enabled: row.enabled ?? row.status, dept: row.dept || row.category }));
} catch (e: any) { console.log("SKILL-ERR", String(e?.message || e).slice(0, 90)); }

// 4. cron/scheduler: bảng nào quản lịch?
const cronTbls = await pool.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' AND (tablename ~ 'cron|schedul|job|routine|daemon')`);
console.log("CRON-TABLES", cronTbls.rows.map((r: any) => r.tablename).join(","));
for (const t of cronTbls.rows) {
  try {
    const r = await pool.query(`SELECT COUNT(*)::int c FROM "${t.tablename}"`);
    console.log("CRON-TBL", t.tablename, r.rows[0].c);
  } catch {}
}

// 5. learning cycles gần đây: hành vi gì đang học
try {
  const lc = await pool.query(`SELECT * FROM ai_learning_cycles ORDER BY created_at DESC LIMIT 5`);
  const keys = Object.keys(lc.rows[0] || {});
  console.log("LC-COLS", keys.join(","));
  for (const row of lc.rows) console.log("LC", JSON.stringify(row).slice(0, 220));
} catch (e: any) { console.log("LC-ERR", String(e?.message || e).slice(0, 90)); }

// 6. human questions mới nhất (agent hỏi người)
try {
  const hq = await pool.query(`SELECT * FROM agent_human_questions ORDER BY created_at DESC LIMIT 3`);
  for (const row of hq.rows) console.log("HQ", JSON.stringify(row).slice(0, 200));
} catch (e: any) { console.log("HQ-ERR", String(e?.message || e).slice(0, 90)); }

await pool.end();
process.exit(0);
