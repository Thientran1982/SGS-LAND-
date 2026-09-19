import { pool } from "../server/db";
const T = "00000000-0000-0000-0000-000000000001";

// 1. interactions: phân bố + Q&A gần nhất
const st = await pool.query(`SELECT type, direction, COUNT(*)::int c FROM interactions GROUP BY 1,2 ORDER BY c DESC LIMIT 8`);
for (const r of st.rows) console.log("STAT", r.type, r.direction, r.c);

const qa = await pool.query(
  `SELECT lead_id, type, direction, LEFT(content, 180) AS content, timestamp::text AS ts
   FROM interactions WHERE timestamp > NOW() - INTERVAL '30 days'
   ORDER BY timestamp DESC LIMIT 14`
);
console.log("== QA RECENT ==");
for (const r of qa.rows) console.log("QA", JSON.stringify(r));

// 2. escalation: Minh hỏi người
const hq = await pool.query(
  `SELECT question, status, created_at::text FROM agent_human_questions ORDER BY created_at DESC LIMIT 6`
);
console.log("== ESCALATIONS ==");
for (const r of hq.rows) console.log("HQ", JSON.stringify({ q: String(r.question || "").slice(0, 200), s: r.status, t: String(r.created_at).slice(0, 16) }));

// 3. journey memory
const jm = await pool.query(
  `SELECT LEFT(content, 150) AS c, created_at::text FROM lead_journey_memory ORDER BY created_at DESC LIMIT 6`
);
console.log("== JOURNEY ==");
for (const r of jm.rows) console.log("JM", JSON.stringify(r.c), String(r.created_at).slice(0, 16));

// 4. signals by type (Minh ghi nhận gì)
const sg = await pool.query(`SELECT signal_type, COUNT(*)::int c FROM agent_signals GROUP BY 1 ORDER BY c DESC LIMIT 10`);
console.log("== SIGNALS ==");
for (const r of sg.rows) console.log("SG", r.signal_type, r.c);

await pool.end();
process.exit(0);
