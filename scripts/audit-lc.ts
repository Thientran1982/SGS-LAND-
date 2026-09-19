import { pool } from "../server/db";
const r = await pool.query(
  `SELECT cycle_key, tenant_id, status, error_text, started_at FROM ai_learning_cycles WHERE status='FAILED' ORDER BY started_at DESC LIMIT 3`
);
for (const row of r.rows) {
  console.log("CYCLE", row.cycle_key, row.tenant_id?.slice(0, 8), row.started_at);
  console.log("ERR:", String(row.error_text || "(null)").slice(0, 400));
  console.log("---");
}
await pool.end();
process.exit(0);
