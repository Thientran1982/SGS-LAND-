import { pool } from "../server/db";
// 1. runs 14d theo agent_name — ai đã chạy và báo cáo
const r1 = await pool.query(
  `SELECT agent_name, status, COUNT(*)::int c FROM agent_runs WHERE created_at > NOW() - INTERVAL '14 days' GROUP BY agent_name, status ORDER BY c DESC LIMIT 16`
);
console.log("== RUNS-BY-AGENT 14D ==");
for (const r of r1.rows) console.log("RA", JSON.stringify(r));
// 2. agent_report signals gần nhất — nội dung báo cáo
const r2 = await pool.query(
  `SELECT LEFT(payload::text, 200) AS p, created_at::text FROM agent_signals WHERE signal_type='agent_report' ORDER BY created_at DESC LIMIT 4`
);
console.log("== REPORT SIGNALS ==");
for (const r of r2.rows) console.log("RS", r.p, "|", String(r.created_at).slice(0, 16));
// 3. shift reports gần nhất
const c3 = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='agent_shift_reports' ORDER BY ordinal_position`);
console.log("SHIFT-COLS", c3.rows.map((c: any) => c.column_name).join(","));
const r3 = await pool.query(`SELECT * FROM agent_shift_reports ORDER BY created_at DESC LIMIT 1`);
console.log("SHIFT-LAST", JSON.stringify(r3.rows[0] || {}).slice(0, 600));
// 4. KPI snapshots gần nhất
const r4 = await pool.query(`SELECT * FROM agent_kpi_snapshots ORDER BY created_at DESC LIMIT 2`);
for (const r of r4.rows) console.log("KPI", JSON.stringify(r).slice(0, 300));
// 5. người nhận mail khả dĩ: users/admin của tenant chính
try {
  const u = await pool.query(`SELECT email, role FROM users WHERE tenant_id='00000000-0000-0000-0000-000000000001' AND email IS NOT NULL ORDER BY created_at LIMIT 5`);
  for (const r of u.rows) console.log("USER", JSON.stringify(r));
} catch (e: any) { console.log("USERS-ERR", String(e?.message || e).slice(0, 60)); }
// 6. kênh gửi mail: emailService / brevo
try {
  const b = await pool.query(`SELECT COUNT(*)::int c FROM email_delivery_claims WHERE created_at > NOW() - INTERVAL '7 days'`);
  console.log("EMAIL-CLAIMS-7D", b.rows[0].c);
} catch {}
await pool.end();
process.exit(0);
