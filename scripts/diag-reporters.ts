import { pool } from "../server/db";
// 1. engagement-email-cron lỗi
const e1 = await pool.query(
  `SELECT LEFT(COALESCE(error_text, summary_json::text), 220) AS err, COUNT(*)::int c
   FROM agent_runs WHERE agent_name='engagement-email-cron' AND status='error' AND created_at > NOW() - INTERVAL '14 days'
   GROUP BY 1 ORDER BY c DESC LIMIT 4`
);
console.log("== ENGAGEMENT ERRORS ==");
for (const r of e1.rows) console.log("EE", r.c, JSON.stringify(r.err));
// 2. get_valuation lỗi
const e2 = await pool.query(
  `SELECT LEFT(COALESCE(error_text, summary_json::text), 220) AS err, started_at::text
   FROM agent_runs WHERE agent_name LIKE '%valuation%' AND status='error' AND created_at > NOW() - INTERVAL '14 days'
   ORDER BY created_at DESC LIMIT 3`
);
console.log("== VALUATION ERRORS ==");
for (const r of e2.rows) console.log("VE", JSON.stringify(r.err), String(r.started_at).slice(0, 16));
// 3. shift report: generator đọc từ đâu — xem 1 bản đầy đủ
const e3 = await pool.query(`SELECT metrics_json, summary_json FROM agent_shift_reports ORDER BY created_at DESC LIMIT 1`);
console.log("SHIFT-METRICS", JSON.stringify(e3.rows[0]?.metrics_json || {}).slice(0, 300));
console.log("SHIFT-SUMMARY", JSON.stringify(e3.rows[0]?.summary_json || {}).slice(0, 300));
// 4. seo-audit signal payload đầy đủ
const e4 = await pool.query(`SELECT payload FROM agent_signals WHERE signal_type='agent_report' ORDER BY created_at DESC LIMIT 1`);
console.log("SEO-PAYLOAD", JSON.stringify(e4.rows[0]?.payload || {}).slice(0, 400));
await pool.end();
process.exit(0);
