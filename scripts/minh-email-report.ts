// minh-email-report.ts — Minh gom dữ liệu agents + gửi email báo cáo cho chủ sở hữu
import { pool } from "../server/db";
import { brevoSendEmail, isBrevoConfigured } from "../server/services/brevoService";

const MAIN = "00000000-0000-0000-0000-000000000001";
const TO = process.env.REPORT_EMAIL || "toletran2408@gmail.com";

// ── 1. Gom dữ liệu ──
const runs = await pool.query(
  `SELECT agent_name, status, COUNT(*)::int c FROM agent_runs
   WHERE created_at > NOW() - INTERVAL '14 days' GROUP BY agent_name, status ORDER BY c DESC LIMIT 10`
);
const inter = await pool.query(
  `SELECT direction, COUNT(*)::int c FROM interactions WHERE timestamp > NOW() - INTERVAL '30 days' GROUP BY 1`
);
const leak = await pool.query(
  `SELECT COUNT(*)::int c FROM interactions WHERE direction='OUTBOUND' AND timestamp > NOW() - INTERVAL '30 days' AND content ILIKE '%chưa thể hoàn tất phản hồi%'`
);
const sig = await pool.query(
  `SELECT signal_type, COUNT(*)::int c FROM agent_signals WHERE created_at > NOW() - INTERVAL '7 days' GROUP BY 1 ORDER BY c DESC LIMIT 6`
);
const lc = await pool.query(
  `SELECT status, COUNT(*)::int c FROM ai_learning_cycles WHERE started_at > NOW() - INTERVAL '7 days' GROUP BY 1`
);
const esc = await pool.query(`SELECT COUNT(*)::int c FROM agent_human_questions WHERE status='OPEN'`);
const fup = await pool.query(`SELECT
  (SELECT COUNT(*)::int FROM follow_up_sequences) AS seqs,
  (SELECT COUNT(*)::int FROM follow_up_sends) AS sends`);
const bind = await pool.query(`SELECT COUNT(*)::int c FROM agent_skill_bindings WHERE status='ACTIVE'`);
const today = new Date().toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

// ── 2. Compose ──
const runRows = runs.rows.map((r: any) =>
  `<tr><td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;">${r.agent_name}</td><td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;">${r.status}</td><td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;text-align:right;"><b>${r.c}</b></td></tr>`
).join("");
const sigRows = sig.rows.map((r: any) => `<li><b>${r.signal_type}</b>: ${r.c}</li>`).join("");
const interRow = inter.rows.map((r: any) => `${r.direction === "INBOUND" ? "Khách hỏi" : "Minh trả lời"}: <b>${r.c}</b>`).join(" · ");
const lcRow = lc.rows.map((r: any) => `${r.status}: <b>${r.c}</b>`).join(" · ");

const html = `<!DOCTYPE html><html lang="vi"><body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px;">
<table width="640" style="max-width:640px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(15,23,42,.08);">
<tr><td style="background:linear-gradient(135deg,#0f172a,#334155);padding:24px 32px;">
<h1 style="margin:0;color:#fff;font-size:20px;">📊 BÁO CÁO AGENTS — SGS LAND</h1>
<p style="margin:6px 0 0;color:#cbd5e1;font-size:13px;">Minh tổng hợp từ hệ agents · ${today} · 14 ngày gần nhất</p></td></tr>
<tr><td style="padding:24px 32px;">
<h2 style="font-size:15px;color:#0f172a;margin:0 0 8px;">1. Agents chạy như thế nào</h2>
<table width="100%" style="border-collapse:collapse;font-size:13px;color:#334155;">
<tr style="background:#f1f5f9;"><th align="left" style="padding:6px 10px;">Agent</th><th align="left" style="padding:6px 10px;">Trạng thái</th><th align="right" style="padding:6px 10px;">Runs 14d</th></tr>
${runRows}
</table>
<h2 style="font-size:15px;color:#0f172a;margin:20px 0 8px;">2. Minh trò chuyện với khách</h2>
<p style="font-size:13px;color:#334155;margin:0 0 6px;">30 ngày: ${interRow}</p>
<p style="font-size:13px;color:${leak.rows[0].c > 0 ? "#b91c1c" : "#15803d"};margin:0;">⚠ Lộ thông báo lỗi cho khách: <b>${leak.rows[0].c}</b> tin (mục tiêu: 0)</p>
<h2 style="font-size:15px;color:#0f172a;margin:20px 0 8px;">3. Tự học & Escalation</h2>
<p style="font-size:13px;color:#334155;margin:0 0 4px;">Learning cycles 7 ngày: ${lcRow}</p>
<p style="font-size:13px;color:#334155;margin:0 0 4px;">Escalation chờ người xử lý: <b>${esc.rows[0].c}</b></p>
<p style="font-size:13px;color:#334155;margin:0;">Skill bindings ACTIVE: <b>${bind.rows[0].c}</b> · Follow-up sequences: <b>${fup.rows[0].seqs}</b> (${fup.rows[0].sends} touchpoint)</p>
<h2 style="font-size:15px;color:#0f172a;margin:20px 0 8px;">4. Tín hiệu hệ thống (7 ngày)</h2>
<ul style="font-size:13px;color:#334155;margin:0;padding-left:18px;">${sigRows}</ul>
</td></tr>
<tr><td style="background:#f8fafc;padding:14px 32px;"><p style="margin:0;font-size:11px;color:#94a3b8;">Báo cáo tự động bởi Minh (autonomousLearningService + agent_signals) · SGS LAND</p></td></tr>
</table></td></tr></table></body></html>`;

// ── 3. Gửi ──
if (!isBrevoConfigured()) {
  console.log("BREVO-NOT-CONFIGURED — in nội dung thay vì gửi:");
  console.log(html.slice(0, 400));
  console.log("TO:", TO);
} else {
  const res = await brevoSendEmail({
    to: TO,
    subject: `📊 Báo cáo Agents SGS LAND — ${today}`,
    html,
    text: "Báo cáo agents: xem bản HTML.",
    tags: ["minh-report", "agents"],
  });
  console.log("SEND", JSON.stringify({ success: res.success, messageId: res.messageId?.slice(0, 20), error: res.error?.slice(0, 80) }));
}
await pool.end();
process.exit(0);
