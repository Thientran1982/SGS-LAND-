import { pool } from "../server/db";
const sg = await pool.query(`SELECT signal_type, COUNT(*)::int c FROM agent_signals GROUP BY 1 ORDER BY c DESC LIMIT 12`);
console.log("== SIGNALS ==");
for (const r of sg.rows) console.log("SG", r.signal_type, r.c);
const sgs = await pool.query(`SELECT signal_type, LEFT(payload::text, 130) AS p, created_at::text FROM agent_signals WHERE signal_type IN ('match_chosen','minh_delegation','lead_captured') ORDER BY created_at DESC LIMIT 5`);
for (const r of sgs.rows) console.log("SGP", r.signal_type, r.p, String(r.created_at).slice(0, 16));
const jm = await pool.query(`SELECT LEFT(content, 140) AS c, created_at::text FROM lead_journey_memory ORDER BY created_at DESC LIMIT 5`);
console.log("== JOURNEY ==");
for (const r of jm.rows) console.log("JM", JSON.stringify(r.c), String(r.created_at).slice(0, 16));
const st = await pool.query(`SELECT namespace, key, kind, LEFT(value::text, 90) AS v FROM agent_store ORDER BY updated_at DESC LIMIT 6`);
console.log("== STORE ==");
for (const r of st.rows) console.log("ST", r.namespace, r.key, r.kind, JSON.stringify(r.v));
// Q&A: đếm bao nhiêu câu trả lời là template lỗi/fallback
const fb = await pool.query(`SELECT COUNT(*)::int c FROM interactions WHERE direction='OUTBOUND' AND (content ILIKE '%chưa thể hoàn tất phản hồi%' OR content ILIKE '%chưa thể hoàn tất%')`);
console.log("FAIL-LEAK-COUNT", fb.rows[0].c);
const fb2 = await pool.query(`SELECT COUNT(*)::int c, MIN(timestamp::text) f, MAX(timestamp::text) l FROM interactions WHERE direction='OUTBOUND' AND content ILIKE '%chỉ mang tính%'`);
console.log("CLARIFY-TEMPLATE-COUNT", JSON.stringify(fb2.rows[0]));
await pool.end();
process.exit(0);
