import { pool } from "../server/db";
// đếm leak lỗi + template clarify trong câu trả lời của Minh
const fb = await pool.query(`SELECT COUNT(*)::int c FROM interactions WHERE direction='OUTBOUND' AND content ILIKE '%chưa thể hoàn tất phản hồi%'`);
console.log("FAIL-LEAK", fb.rows[0].c);
const fb2 = await pool.query(`SELECT COUNT(*)::int c FROM interactions WHERE direction='OUTBOUND' AND content ILIKE '%chỉ mang tính%'`);
console.log("CLARIFY-TEMPLATE", fb2.rows[0].c);
const tot = await pool.query(`SELECT COUNT(*)::int c FROM interactions WHERE direction='OUTBOUND'`);
console.log("OUTBOUND-TOTAL", tot.rows[0].c);
// journey: cột thật
const jc = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='lead_journey_memory'`);
console.log("JM-COLS", jc.rows.map((r: any) => r.column_name).join(","));
const textCol = ["notes", "summary", "content", "event", "description"].find((c) => jc.rows.some((r: any) => r.column_name === c));
if (textCol) {
  const jm = await pool.query(`SELECT LEFT("${textCol}", 140) AS c, created_at::text AS t FROM lead_journey_memory ORDER BY created_at DESC LIMIT 5`);
  for (const r of jm.rows) console.log("JM", JSON.stringify(r.c), String(r.t).slice(0, 16));
}
// store samples
const st = await pool.query(`SELECT namespace, key, kind, LEFT(value::text, 80) AS v FROM agent_store ORDER BY updated_at DESC LIMIT 6`);
for (const r of st.rows) console.log("ST", r.namespace, r.key, r.kind, JSON.stringify(r.v));
await pool.end();
process.exit(0);
