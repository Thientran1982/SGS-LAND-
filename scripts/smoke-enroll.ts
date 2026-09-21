import { pool } from "../server/db";
import { followupSequenceRepository } from "../server/repositories/followupSequenceRepository";
const MAIN = "00000000-0000-0000-0000-000000000001";
const lead = await pool.query(`SELECT id, name, phone, email FROM leads WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 1`, [MAIN]);
const l = lead.rows[0];
if (!l) { console.log("NO-LEAD"); process.exit(1); }
const existing = await followupSequenceRepository.getActiveSequenceForLead(pool, MAIN, l.id);
if (existing) { console.log("ALREADY", existing.id); process.exit(0); }
const seq = await followupSequenceRepository.createSequence(pool, MAIN, {
  leadId: l.id, leadName: l.name, leadPhone: l.phone, leadEmail: l.email, source: "LIVE_CHAT",
});
const cnt = await pool.query(`SELECT COUNT(*)::int c FROM follow_up_sequences`);
const sends = await pool.query(`SELECT COUNT(*)::int c FROM follow_up_sends`);
console.log("ENROLLED seq=" + seq.id, "lead=" + l.id, "total-sequences=" + cnt.rows[0].c, "total-sends=" + sends.rows[0].c);
await pool.end();
process.exit(0);
